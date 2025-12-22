const { createClient } = require('@supabase/supabase-js');
const https = require('https');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

// CONFIGURAÇÃO REAL 2025
const API_KEY = process.env.API_FOOTBALL_KEY;
const LEAGUE_ID = 71; // Brasileirão
const SEASON = 2025;  // Agora buscamos o ano corrente real
const ROUND = 'Regular Season - 38'; // A última rodada

// Conexão com o Banco
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const fetchRealGames = () => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'v3.football.api-sports.io',
      // Busca diretamente a temporada e rodada solicitadas
      path: `/fixtures?league=${LEAGUE_ID}&season=${SEASON}&round=${encodeURIComponent(ROUND)}`,
      method: 'GET',
      headers: { 'x-apisports-key': API_KEY }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });

    req.on('error', reject);
    req.end();
  });
};

(async () => {
  console.log(`⚽ Buscando dados OFICIAIS da rodada final de ${SEASON}...`);

  try {
    // 1. Limpa jogos antigos para garantir que só teremos os dados oficiais
    console.log('🧹 Limpando tabela de jogos antigos...');
    await supabase.from('bets').delete().neq('id', 0);
    await supabase.from('games').delete().neq('id', 0);

    // 2. Garante a competição no banco
    let { data: comp } = await supabase
      .from('competitions')
      .select('id')
      .eq('slug', 'brasileirao-2025')
      .single();
      
    // Se não existir a competição, cria ela
    if (!comp) {
        console.log('⚠️ Competição não encontrada. Criando Brasileirão 2025...');
        const { data: newComp } = await supabase.from('competitions').insert({
            name: 'Brasileirão Série A 2025',
            slug: 'brasileirao-2025',
            type: 'pontos_corridos',
            entry_fee: 50
        }).select().single();
        comp = newComp;
    }

    // 3. Busca Times no Banco e cria Mapa
    const { data: dbTeams } = await supabase.from('teams').select('id, name');
    const teamMap = {}; 
    
    dbTeams.forEach(t => {
        const cleanName = t.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        teamMap[cleanName] = t.id;
        
        // Mapeamentos manuais comuns
        if (cleanName.includes('athletico')) teamMap['athletico paranaense'] = t.id;
        if (cleanName.includes('vasco')) teamMap['vasco da gama'] = t.id;
        if (cleanName.includes('mineiro')) teamMap['atletico mineiro'] = t.id;
        if (cleanName.includes('goianiense')) teamMap['atletico goianiense'] = t.id;
        if (cleanName.includes('america')) teamMap['america mineiro'] = t.id;
        if (cleanName.includes('sport')) teamMap['sport recife'] = t.id;
    });

    // --- FUNÇÃO INTELIGENTE: BUSCA OU CRIA TIME ---
    const findOrCreateTeam = async (teamData) => {
        const cleanName = teamData.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        let id = teamMap[cleanName];

        if (!id) {
            console.log(`🆕 Time não encontrado: "${teamData.name}". Cadastrando automaticamente...`);
            
            const { data: newTeam, error } = await supabase.from('teams').insert({
                name: teamData.name,
                flag_code: 'BR', // Assume BR para o Brasileirão
                badge_url: teamData.logo // Usa o logo que vem da API
            }).select('id').single();

            if (error) {
                console.error(`❌ Erro ao criar time ${teamData.name}:`, error.message);
                return null;
            }

            id = newTeam.id;
            teamMap[cleanName] = id; // Atualiza o mapa para não duplicar
        }
        return id;
    };

    // 4. Pega dados da API
    const apiData = await fetchRealGames();
    
    if (apiData.errors && Object.keys(apiData.errors).length > 0) {
      console.error('❌ Erro da API:', apiData.errors);
      return;
    }

    const matches = apiData.response;
    if (!matches || matches.length === 0) {
        console.error('❌ Nenhum jogo encontrado na API para 2025 Rodada 38.');
        return;
    }

    console.log(`✅ Encontrados ${matches.length} jogos oficiais.`);

    const gamesToInsert = [];

    // 5. Prepara os jogos
    for (const match of matches) {
      // Agora usamos a função que cria o time se ele não existir
      const homeId = await findOrCreateTeam(match.teams.home);
      const awayId = await findOrCreateTeam(match.teams.away);

      const isFinished = ['FT', 'AET', 'PEN'].includes(match.fixture.status.short);

      if (homeId && awayId) {
        console.log(`📌 Processando: ${match.teams.home.name} ${match.goals.home ?? ''} x ${match.goals.away ?? ''} ${match.teams.away.name}`);
        
        gamesToInsert.push({
          competition_id: comp.id,
          api_id: match.fixture.id,
          round: '38ª Rodada',
          team_a_id: homeId,
          team_b_id: awayId,
          start_time: match.fixture.date, // DATA REAL DA API
          score_a: match.goals.home,      // PLACAR REAL
          score_b: match.goals.away,      // PLACAR REAL
          is_finished: isFinished
        });
      } else {
        console.warn(`⚠️ Falha ao processar times para o jogo ${match.fixture.id}`);
      }
    }

    if (gamesToInsert.length > 0) {
      const { error } = await supabase.from('games').insert(gamesToInsert);
      if (error) console.error('❌ Erro ao salvar no banco:', error);
      else console.log(`🎉 Sucesso! ${gamesToInsert.length} jogos oficiais importados.`);
    } else {
      console.log('Nenhum jogo compatível foi importado.');
    }

  } catch (error) {
    console.error('Erro Crítico:', error);
  }
})();