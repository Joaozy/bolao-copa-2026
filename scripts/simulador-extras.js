require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function rodarExtras() {
  const compId = 999;
  console.log('🚀 Iniciando simulação de Palpites Extras...');

  // 1. Inserir 10 Jogadores Fictícios
  const times = [901, 902, 903, 904, 905, 906, 907, 908, 909, 910];
  const players = times.map((t, idx) => ({
      team_id: t,
      name: `Craque Fictício ${idx + 1}`,
      position: 'Atacante'
  }));
  
  await supabase.from('players').upsert(players, { onConflict: 'name, team_id' });
  console.log('✅ 10 Jogadores inseridos nos times.');

  // 2. Pegar usuários e regras
  const { data: users } = await supabase.from('enrollments').select('user_id').eq('competition_id', compId);
  const { data: rules } = await supabase.from('special_rules').select('*').eq('competition_id', compId);

  if (!rules || rules.length === 0) {
      console.log('❌ Nenhuma regra especial encontrada! Vá no Admin e salve as regras primeiro.');
      return;
  }

  // 3. Gerar Palpites Aleatórios
  const bets = [];
  users.forEach(u => {
      rules.forEach(r => {
          const randomTeam = times[Math.floor(Math.random() * times.length)];
          const randomPlayer = players[Math.floor(Math.random() * players.length)].name;

          bets.push({
              user_id: u.user_id,
              special_rule_id: r.id,
              picked_team_id: r.type === 'top_scorer' ? null : randomTeam,
              picked_value: r.type === 'top_scorer' ? randomPlayer : null
          });
      });
  });

  const { error } = await supabase.from('special_bets').upsert(bets, { onConflict: 'user_id, special_rule_id' });

  if (error) {
      console.error('❌ Erro:', error.message);
  } else {
      console.log(`✅ ${bets.length} palpites extras gerados com sucesso!`);
  }
}

rodarExtras();