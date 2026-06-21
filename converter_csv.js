// converter_csv.js
const fs = require('fs');

// 1. Ler o ficheiro CSV
const csvData = fs.readFileSync('./players_rows.csv', 'utf8');
const linhas = csvData.split('\n');

const jogadoresCopa = [];

// 2. Ignorar o cabeçalho e ler linha a linha
for (let i = 1; i < linhas.length; i++) {
    const linha = linhas[i].trim();
    if (!linha) continue;

    // Lidar com vírgulas dentro do CSV
    const colunas = linha.split(',');
    
    // A coluna 3 (índice 3) é o competition_id. Só queremos a Copa (7)
    const competition_id = colunas[3];
    if (competition_id !== '7') continue;

    const jogador = {
        id: colunas[0],
        name: colunas[1],
        team_id: parseInt(colunas[2]),
        overall: parseInt(colunas[6]) || 70,
        pos1: colunas[7] || '',
        pos2: colunas[8] || '',
        pos3: colunas[9] || ''
    };

    jogadoresCopa.push(jogador);
}

// 3. Guardar no ficheiro JSON final
const caminhoSaida = './src/components/games/dados/jogadoresCopa.json';
fs.writeFileSync(caminhoSaida, JSON.stringify(jogadoresCopa, null, 2));

console.log(`✅ Sucesso! ${jogadoresCopa.length} jogadores da Copa do Mundo exportados para o JSON.`);