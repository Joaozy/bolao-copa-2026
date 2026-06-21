const fs = require('fs');

const csvData = fs.readFileSync('./players_rows.csv', 'utf8');
const linhas = csvData.split('\n');

const jogadoresCopa = [];

for (let i = 1; i < linhas.length; i++) {
    const linha = linhas[i].trim();
    if (!linha) continue;

    const colunas = linha.split(',');
    
    // Coluna 3 = competition_id (0: id, 1: name, 2: team_id, 3: competition_id)
    const competition_id = colunas[3];
    
    // Só pega os jogadores se a competição for a Copa (ID 7)
    if (competition_id === '7') {
        jogadoresCopa.push({
            id: colunas[0],
            name: colunas[1],
            team_id: Number(colunas[2]),
            photo_url: colunas[5] || '',
            overall: Number(colunas[6]) || 70,
            pos1: colunas[7] || '',
            pos2: colunas[8] || '',
            pos3: colunas[9] || ''
        });
    }
}

// Salva o JSON no local exato onde o jogo vai ler
const dir = './src/components/games/dados';
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

fs.writeFileSync(`${dir}/jogadoresCopa.json`, JSON.stringify(jogadoresCopa, null, 2));
console.log(`✅ Sucesso! ${jogadoresCopa.length} jogadores exportados para jogadoresCopa.json`);