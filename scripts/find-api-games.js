const https = require('https');

// 1. Configure sua chave aqui apenas para rodar o script localmente
const API_KEY = '9343ec7f2fa3371a4d6e1fc2c37e1c93'; 

// ID do Brasileirão Série A na API-Football é 71
const LEAGUE_ID = 85; 
const SEASON = 2025; // Atualizado para 2025

const options = {
  hostname: 'v3.football.api-sports.io',
  // Mudamos de 'last=10' para 'next=10' para pegar os jogos agendados para Domingo
  path: `/fixtures?league=${LEAGUE_ID}&season=${SEASON}&next=15`, 
  method: 'GET',
  headers: {
    'x-apisports-key': API_KEY // <--- CORREÇÃO: Nome do cabeçalho oficial da API-Sports
  }
};

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    const response = JSON.parse(data);
    
    if (response.errors && Object.keys(response.errors).length > 0) {
      console.error('Erro na API:', response.errors);
      return;
    }

    if (response.response.length === 0) {
      console.log('Nenhum jogo encontrado para essa data/temporada.');
      return;
    }

    console.log('\n📋 LISTA DE JOGOS E SEUS IDs (Copie o ID para o Supabase):');
    console.log('-------------------------------------------------------');
    
    response.response.forEach(game => {
      const home = game.teams.home.name;
      const away = game.teams.away.name;
      const id = game.fixture.id;
      const date = new Date(game.fixture.date).toLocaleString('pt-BR');
      const status = game.fixture.status.long;
      const score = `${game.goals.home} x ${game.goals.away}`;

      console.log(`🆔 ID: ${id} | 📅 ${date}`);
      console.log(`⚽ ${home} x ${away} | Status: ${status} (${score})`);
      console.log('-------------------------------------------------------');
    });
  });
});

req.on('error', (error) => {
  console.error(error);
});

req.end();