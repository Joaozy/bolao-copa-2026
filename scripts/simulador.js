// scripts/simulador.js
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function rodarSimulacao() {
  const args = process.argv.slice(2);
  const compId = parseInt(args[0]);
  const numUsers = parseInt(args[1]) || 10;

  if (!compId) {
    console.log('❌ Uso: node scripts/simulador.js <ID_COMPETICAO> <NUM_USUARIOS>');
    process.exit(1);
  }

  console.log(`\n🚀 INICIANDO SIMULAÇÃO NA COMPETIÇÃO ${compId} COM ${numUsers} USUÁRIOS...`);

  // 1. Criar Usuários Falsos e Inscrever
  const usuariosGerados = [];
  for (let i = 1; i <= numUsers; i++) {
    const email = `simulador_${compId}_user${i}@teste.com`;
    const nickname = `Bot Fictício ${i}`;

    // Cria no Auth do Supabase
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email,
      password: 'password123',
      email_confirm: true
    });

    if (authErr && !authErr.message.includes('already registered')) {
        console.error(`Erro ao criar ${email}:`, authErr.message);
        continue;
    }

    // Pega o ID do usuário (seja novo ou se já existia)
    let userId;
    if (authData?.user) {
        userId = authData.user.id;
        // Atualiza o Profile
        await supabase.from('profiles').update({ nickname, full_name: nickname }).eq('id', userId);
    } else {
        const { data: exist } = await supabase.from('profiles').select('id').eq('email', email).single();
        userId = exist?.id;
    }

    if (userId) {
        usuariosGerados.push(userId);
        // Inscreve e marca como pago
        await supabase.from('enrollments').upsert({ 
            user_id: userId, competition_id: compId, is_paid: true 
        }, { onConflict: 'user_id, competition_id' });
    }
  }
  console.log(`✅ ${usuariosGerados.length} usuários inscritos e pagos.`);

  // 2. Buscar todos os jogos dessa competição
  const { data: jogos } = await supabase.from('games').select('id').eq('competition_id', compId);
  if (!jogos || jogos.length === 0) {
      console.log('❌ Nenhum jogo encontrado para esta competição.');
      process.exit(1);
  }

  console.log(`🎲 Gerando palpites para ${jogos.length} jogos...`);
  
  // 3. Gerar palpites aleatórios (Placares de 0 a 4)
  const palpites = [];
  usuariosGerados.forEach(userId => {
      jogos.forEach(jogo => {
          palpites.push({
              user_id: userId,
              game_id: jogo.id,
              guess_score_a: Math.floor(Math.random() * 5),
              guess_score_b: Math.floor(Math.random() * 5)
          });
      });
  });

  // Insere em lotes para não sobrecarregar
  for (let i = 0; i < palpites.length; i += 500) {
      const lote = palpites.slice(i, i + 500);
      const { error } = await supabase.from('bets').upsert(lote, { onConflict: 'user_id, game_id' });
      if (error) console.error('Erro no lote de palpites:', error.message);
  }

  console.log(`✅ ${palpites.length} palpites criados com sucesso! Simulador finalizado.\n`);
}

rodarSimulacao();