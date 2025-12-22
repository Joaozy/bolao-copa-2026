const fs = require('fs');
const path = require('path');
const https = require('https');

// URLs CORRIGIDAS (Respeitando Maiúsculas/Minúsculas do GitHub)
const teams = [
  { name: 'atletico-mg', url: 'https://raw.githubusercontent.com/leandrowkz/futebol-open-data/master/logos/BR/Atletico%20Mineiro.png' },
  { name: 'bahia', url: 'https://raw.githubusercontent.com/leandrowkz/futebol-open-data/master/logos/BR/Bahia.png' },
  { name: 'botafogo', url: 'https://raw.githubusercontent.com/leandrowkz/futebol-open-data/master/logos/BR/Botafogo.png' },
  { name: 'ceara', url: 'https://raw.githubusercontent.com/leandrowkz/futebol-open-data/master/logos/BR/Ceara.png' },
  { name: 'corinthians', url: 'https://raw.githubusercontent.com/leandrowkz/futebol-open-data/master/logos/BR/Corinthians.png' },
  { name: 'cruzeiro', url: 'https://raw.githubusercontent.com/leandrowkz/futebol-open-data/master/logos/BR/Cruzeiro.png' },
  { name: 'flamengo', url: 'https://raw.githubusercontent.com/leandrowkz/futebol-open-data/master/logos/BR/Flamengo.png' },
  { name: 'fluminense', url: 'https://raw.githubusercontent.com/leandrowkz/futebol-open-data/master/logos/BR/Fluminense.png' },
  { name: 'fortaleza', url: 'https://raw.githubusercontent.com/leandrowkz/futebol-open-data/master/logos/BR/Fortaleza.png' },
  { name: 'gremio', url: 'https://raw.githubusercontent.com/leandrowkz/futebol-open-data/master/logos/BR/Gremio.png' },
  { name: 'internacional', url: 'https://raw.githubusercontent.com/leandrowkz/futebol-open-data/master/logos/BR/Internacional.png' },
  { name: 'juventude', url: 'https://raw.githubusercontent.com/leandrowkz/futebol-open-data/master/logos/BR/Juventude.png' },
  // Mirassol é novo na série A, usamos Wikimedia como fallback
  { name: 'mirassol', url: 'https://upload.wikimedia.org/wikipedia/en/thumb/4/4b/Mirassol_Futebol_Clube_logo.svg/200px-Mirassol_Futebol_Clube_logo.svg.png' },
  { name: 'palmeiras', url: 'https://raw.githubusercontent.com/leandrowkz/futebol-open-data/master/logos/BR/Palmeiras.png' },
  { name: 'bragantino', url: 'https://raw.githubusercontent.com/leandrowkz/futebol-open-data/master/logos/BR/Red%20Bull%20Bragantino.png' },
  { name: 'santos', url: 'https://raw.githubusercontent.com/leandrowkz/futebol-open-data/master/logos/BR/Santos.png' },
  { name: 'sao-paulo', url: 'https://raw.githubusercontent.com/leandrowkz/futebol-open-data/master/logos/BR/Sao%20Paulo.png' },
  { name: 'sport', url: 'https://raw.githubusercontent.com/leandrowkz/futebol-open-data/master/logos/BR/Sport%20Recife.png' },
  { name: 'vasco', url: 'https://raw.githubusercontent.com/leandrowkz/futebol-open-data/master/logos/BR/Vasco%20da%20Gama.png' },
  { name: 'vitoria', url: 'https://raw.githubusercontent.com/leandrowkz/futebol-open-data/master/logos/BR/Vitoria.png' },
  { name: 'criciuma', url: 'https://raw.githubusercontent.com/leandrowkz/futebol-open-data/master/logos/BR/Criciuma.png' },
  { name: 'atletico-go', url: 'https://raw.githubusercontent.com/leandrowkz/futebol-open-data/master/logos/BR/Atletico%20Goianiense.png' }
];

const badgesDir = path.join(__dirname, '../public/badges');

if (!fs.existsSync(badgesDir)) {
  fs.mkdirSync(badgesDir, { recursive: true });
  console.log('📂 Pasta public/badges criada!');
}

const downloadImage = (url, filepath) => {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 200) {
        const fileStream = fs.createWriteStream(filepath);
        res.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          resolve(filepath);
        });
      } else {
        res.resume();
        reject(new Error(`Status ${res.statusCode}`));
      }
    }).on('error', reject);
  });
};

(async () => {
  console.log('⬇️  Baixando escudos (URLs Corrigidas)...');
  for (const team of teams) {
    try {
      await downloadImage(team.url, path.join(badgesDir, `${team.name}.png`));
      console.log(`✅ ${team.name}.png baixado`);
    } catch (e) {
      console.error(`❌ Falha em ${team.name}. Salve manualmente na pasta.`);
    }
  }
  console.log('\n🏁 Fim. Se algum falhou, baixe no Google e salve na pasta public/badges com o nome indicado.');
})();