require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function rodarExtrasBR() {
  const args = process.argv.slice(2);
  const compId = parseInt(args[0]);

  if (!compId) {
    console.log('❌ Uso: node scripts/simulador-br26-extras.js <ID_COMPETICAO>');
    process.exit(1);
  }

  console.log(`🚀 Gerando palpites extras para a Competição ${compId}...`);

  // 1. Verificar regras ativas
  const { data: rules } = await supabase.from('special_rules').select('*').eq('competition_id', compId);
  if (!rules || rules.length === 0) {
      console.log('❌ Nenhuma regra especial encontrada! Vá no painel Admin > Regras, ative as regras (Campeão, etc) e salve.');
      process.exit(1);
  }

  // 2. Pegar usuários inscritos
  const { data: users } = await supabase.from('enrollments').select('user_id').eq('competition_id', compId);
  if (!users || users.length === 0) {
      console.log('❌ Nenhum usuário inscrito nesta competição.');
      process.exit(1);
  }

  // 3. Pegar times que participam desta competição (através dos jogos importados)
  const { data: games } = await supabase.from('games').select('team_a_id, team_b_id').eq('competition_id', compId);
  const teamIds = [...new Set(games.flatMap(g => [g.team_a_id, g.team_b_id]))];
  
  if (teamIds.length === 0) {
      console.log('❌ Nenhum jogo encontrado para extrair os times do Brasileirão.');
      process.exit(1);
  }

  // 4. Pegar jogadores reais importados desses times
  const { data: players } = await supabase.from('players').select('name').in('team_id', teamIds);
  const playerNames = players && players.length > 0 ? players.map(p => p.name) : ['Jogador Genérico 1', 'Jogador Genérico 2'];

  // 5. Gerar apostas aleatórias
  const bets = [];
  users.forEach(u => {
      rules.forEach(r => {
          const randomTeam = teamIds[Math.floor(Math.random() * teamIds.length)];
          const randomPlayer = playerNames[Math.floor(Math.random() * playerNames.length)];

          bets.push({
              user_id: u.user_id,
              special_rule_id: r.id,
              picked_team_id: r.type === 'top_scorer' ? null : randomTeam,
              picked_value: r.type === 'top_scorer' ? randomPlayer : null
          });
      });
  });

  // Salvar no Banco
  const { error } = await supabase.from('special_bets').upsert(bets, { onConflict: 'user_id, special_rule_id' });

  if (error) {
      console.error('❌ Erro ao salvar palpites extras:', error.message);
  } else {
      console.log(`✅ ${bets.length} palpites extras gerados com sucesso para os ${users.length} usuários!`);
  }
}

rodarExtrasBR();