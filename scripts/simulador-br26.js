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
  const num1 = args[1];
  const num2 = args[2];

  if (!compId || !num1 || !num2) {
    console.log('❌ Uso: node scripts/simulador-br26.js <ID_COMPETICAO> <SEU_WHATSAPP_1> <SEU_WHATSAPP_2>');
    console.log('Ex: node scripts/simulador-br26.js 5 79999999999 79888888888');
    process.exit(1);
  }

  console.log(`\n🚀 INICIANDO SIMULAÇÃO BR26...`);

  // 1. Criar os 18 Bots
  const usuariosFicticios = [];
  for (let i = 1; i <= 18; i++) {
    const { data } = await supabase.auth.admin.createUser({ email: `botbr_${i}@teste.com`, password: 'password123', email_confirm: true });
    if (data?.user) {
        await supabase.from('profiles').update({ nickname: `Bot ${i}`, full_name: `Robô ${i}` }).eq('id', data.user.id);
        usuariosFicticios.push(data.user.id);
    }
  }

  // 2. Criar as 2 Contas Reais
  const contasReais = [];
  const telefones = [num1, num2];
  for (let i = 0; i < 2; i++) {
      const { data } = await supabase.auth.admin.createUser({ email: `meuteste_${i}@teste.com`, password: 'password123', email_confirm: true });
      if (data?.user) {
          await supabase.from('profiles').update({ nickname: `Real Tester ${i+1}`, whatsapp: telefones[i] }).eq('id', data.user.id);
          contasReais.push(data.user.id);
      }
  }

  const todosUsuarios = [...usuariosFicticios, ...contasReais];

  // Inscreve todos
  for (const uid of todosUsuarios) {
      await supabase.from('enrollments').upsert({ user_id: uid, competition_id: compId, is_paid: true }, { onConflict: 'user_id, competition_id' });
  }
  console.log(`✅ 20 usuários (18 Bots + 2 Reais) inscritos.`);

  // 3. Pega os jogos futuros (ordenados do mais próximo para o mais distante)
  const agora = new Date().toISOString();
  const { data: jogos } = await supabase.from('games').select('id').eq('competition_id', compId).gt('start_time', agora).order('start_time', { ascending: true });

  if (!jogos || jogos.length === 0) {
      console.log('❌ Nenhum jogo futuro encontrado para simular apostas.');
      process.exit(1);
  }

  // 4. Preenche os palpites
  const palpites = [];
  // Os 2 primeiros jogos cronológicos ficarão SEM PALPITE para as 2 contas reais
  const jogosParaIgnorarNosReais = [jogos[0].id, jogos[1] ? jogos[1].id : null];

  todosUsuarios.forEach(userId => {
      const isRealUser = contasReais.includes(userId);

      jogos.forEach(jogo => {
          // Se for usuário real e for um dos primeiros jogos, PULA o palpite
          if (isRealUser && jogosParaIgnorarNosReais.includes(jogo.id)) return;

          palpites.push({
              user_id: userId,
              game_id: jogo.id,
              guess_score_a: Math.floor(Math.random() * 4),
              guess_score_b: Math.floor(Math.random() * 4)
          });
      });
  });

  for (let i = 0; i < palpites.length; i += 500) {
      await supabase.from('bets').upsert(palpites.slice(i, i + 500), { onConflict: 'user_id, game_id' });
  }

  console.log(`✅ ${palpites.length} palpites criados! As contas reais não palpitaram nos jogos mais próximos.`);
  console.log(`⏳ Tudo pronto para o teste em tempo real!\n`);
}

rodarSimulacao();