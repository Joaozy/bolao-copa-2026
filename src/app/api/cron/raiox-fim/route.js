import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response(JSON.stringify({ error: 'Acesso negado. Cron Secret inválido.' }), { status: 401 });
    }

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
      global: { fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }) }
    });

    const { data: palpites, error } = await supabase.rpc('get_match_fim');
    if (error) throw new Error(`Erro DB: ${error.message}`);
    if (!palpites || palpites.length === 0) return new Response(JSON.stringify({ message: 'Nenhum jogo recém-finalizado.' }), { status: 200 });

    const evento = palpites[0];
    const { game_id: gameId, mandante, visitante, gols_mandante, gols_visitante } = evento;
    const placarReal = `${mandante} ${gols_mandante} x ${gols_visitante} ${visitante}`;
    const palpitesDoJogo = palpites.filter(p => p.game_id === gameId);

    // --- 1. CÁLCULO INDEPENDENTE (Evita atraso do banco de dados) ---
    const cravadas = [];
    const iludidos = [];
    
    palpitesDoJogo.forEach(p => {
        const nome = p.nickname || p.nome_exibicao || p.nome || 'Alguém';
        const pA = p.guess_score_a;
        const pB = p.guess_score_b;
        const rA = gols_mandante;
        const rB = gols_visitante;

        // Videntes: Acertou na mosca (independente se os pontos já foram processados)
        if (pA === rA && pB === rB) {
            cravadas.push(nome);
            p.pontos_calculados = 10; 
        } 
        else {
            const acertouVencedor = Math.sign(pA - pB) === Math.sign(rA - rB);
            const acertouGol = pA === rA || pB === rB;
            
            // Iludidos: Errou quem ganhou e não acertou o gol de ninguém
            if (!acertouVencedor && !acertouGol) {
                // ADICIONA O PLACAR ERRADO PARA A PIADA FICAR BOA
                iludidos.push(`${nome} (apostou ${pA}x${pB})`);
                p.pontos_calculados = 0;
            } else {
                // Pontuou alguma coisa intermediária (2, 5 ou 7)
                if (acertouVencedor) {
                    if (acertouGol || (pA - pB) === (rA - rB)) p.pontos_calculados = 7;
                    else p.pontos_calculados = 5;
                } else {
                    p.pontos_calculados = 2;
                }
            }
        }
    });

    // --- 2. A MONTANHA RUSSA DO RANKING (Lógica Pura e Blindada) ---
    const { data: activeComp } = await supabase.from('competitions').select('id').eq('is_active', true).maybeSingle();
    let rankingStats = "Sem dados de ranking para analisar.";
    
    if (activeComp) {
        const { data: gameData } = await supabase.from('games').select('round').eq('id', gameId).maybeSingle();
        const { data: roundSetting } = await supabase.from('round_settings').select('multiplier').eq('competition_id', activeComp.id).eq('round_name', gameData?.round || '').maybeSingle();
        const multiplier = roundSetting?.multiplier || 1;

        const { data: leaderboard } = await supabase.from('leaderboard').select('user_id, nome_exibicao, total_pontos').eq('competition_id', activeComp.id);
        
        if (leaderboard && leaderboard.length > 0) {
            
            // 1. Criar um mapa exato dos pontos da rodada convertendo tudo para NÚMEROS
            const mapPontos = new Map();
            let dbJaProcessou = false;

            palpitesDoJogo.forEach(p => {
                const pA = Number(p.guess_score_a);
                const pB = Number(p.guess_score_b);
                const rA = Number(gols_mandante);
                const rB = Number(gols_visitante);
                
                let pts = 0;
                if (pA === rA && pB === rB) {
                    pts = 10;
                } else {
                    const acertouVencedor = Math.sign(pA - pB) === Math.sign(rA - rB);
                    const acertouGol = (pA === rA) || (pB === rB);
                    const acertouSaldo = (pA - pB) === (rA - rB);
                    
                    if (acertouVencedor) {
                        pts = (acertouGol || acertouSaldo) ? 7 : 5;
                    } else if (acertouGol) {
                        pts = 2;
                    }
                }
                
                mapPontos.set(p.user_id, pts * multiplier);
                
                // Marca se o Supabase já rodou a trigger no banco
                if (p.points_awarded !== null && p.points_awarded !== undefined) {
                    dbJaProcessou = true;
                }
            });

            // 2. Calcula as duas realidades (Rank Antes vs Rank Depois)
            const usersCalculados = leaderboard.map(u => {
                const pontosDoJogo = mapPontos.get(u.user_id) || 0;
                const totalDB = Number(u.total_pontos || 0);
                
                return {
                    id: u.user_id,
                    nome: u.nome_exibicao || 'Anônimo',
                    // Se o DB já processou, o atual é o DB e o antigo é DB - pontos.
                    pAntes: dbJaProcessou ? (totalDB - pontosDoJogo) : totalDB,
                    pAtuais: dbJaProcessou ? totalDB : (totalDB + pontosDoJogo)
                };
            });

            // 3. Ordenação com desempate alfabético estrito (impede falsos zeros)
            const sortFn = (key) => (a, b) => {
                if (b[key] !== a[key]) return b[key] - a[key];
                return a.nome.localeCompare(b.nome);
            };

            const rankAntes = [...usersCalculados].sort(sortFn('pAntes'));
            const rankDepois = [...usersCalculados].sort(sortFn('pAtuais'));

            let maiorSalto = { nome: '', posicoes: 0 };
            let maiorQueda = { nome: '', posicoes: 0 }; 

            // 4. Mede a diferença EXATA de posições
            usersCalculados.forEach(u => {
                const posAntes = rankAntes.findIndex(x => x.id === u.id) + 1;
                const posDepois = rankDepois.findIndex(x => x.id === u.id) + 1;
                const diff = posAntes - posDepois; // Positivo = subiu

                if (diff > maiorSalto.posicoes) maiorSalto = { nome: u.nome, posicoes: diff };
                if (diff < maiorQueda.posicoes) maiorQueda = { nome: u.nome, posicoes: diff };
            });

            // 5. O Árbitro Final
            if (maiorSalto.posicoes === 0 && maiorQueda.posicoes === 0) {
                rankingStats = `O ranking congelou! A galera cravou tão igual que o pelotão andou junto e ninguém ultrapassou ninguém na tabela. Um verdadeiro empate técnico no movimento das posições.`;
            } else {
                rankingStats = `
                  MAIOR SALTO: ${maiorSalto.nome} voou e subiu ${maiorSalto.posicoes} posições na tabela!
                  MAIOR QUEDA: ${maiorQueda.nome} escorregou feio e despencou ${Math.abs(maiorQueda.posicoes)} posições!
                `;
            }
        }
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const systemPrompt = `
      Você é o "Rei da Resenha", narrador sarcástico do nosso bolão de WhatsApp (fase mata-mata).
      Fim de papo na arena! O placar final cravado nos 90 minutos foi: *${placarReal}*.
      
      📊 DADOS TRATADOS:
      - Videntes que CRAVARAM o placar exato: ${cravadas.length > 0 ? cravadas.join(', ') : 'Nenhum mito conseguiu cravar!'}
      - Iludidos que ZERARAM no jogo: ${iludidos.length > 0 ? iludidos.slice(0, 3).join(', ') + (iludidos.length > 3 ? ' e mais alguns azarados' : '') : 'Milagrosamente, todo mundo pontuou algo!'}
      
      🎢 A MONTANHA RUSSA DO RANKING (DADOS EXATOS - NÃO ALTERE OS NÚMEROS):
      ${rankingStats}
      
      SUA MISSÃO - Crie uma resenha curta, debochada e épica com os seguintes blocos (PROIBIDO usar markdown de listas como asteriscos ou traços, pule linhas duplas entre blocos e use negrito MAIÚSCULO nos títulos):
      
      1. 🏁 FIM DE PAPO: Informe o placar final como um verdadeiro decreto.
      2. 🔮 OS VIDENTES: Se alguém cravou, trate-os como Deuses intocáveis. Se ninguém cravou, diga que o bolão tá cheio de mortais fracassados.
      3. 🤡 OS ILUDIDOS: Zombe pesadamente de apenas 1 ou 2 nomes da lista de Iludidos. USE O PLACAR QUE ELES APOSTARAM PARA FAZER A PIADA (ex: "O fulano achou que ia ser 3x0, deve ter assistido de olhos fechados").
      4. 🎢 A MONTANHA RUSSA: Use ESTRITAMENTE os nomes e números fornecidos na variável "MONTANHA RUSSA DO RANKING" acima. Não invente nomes nem recálcule posições. Apenas pegue quem deu o Maior Salto e faça um elogio exagerado, e pegue quem teve a Maior Queda e dê seus pêsames sarcásticos. (Comente tambem o quanto foi o salto ou queda. EX: Subiu incriveis 15 posicoes. Pisou na Casca de Banana e caiu 8 Posicoes. Seja Criativo e Varie sempre as piadas.)
      5. Seja Bastante Criativo e Varie bastante as piadas para que mensagens passadas ou futuras nao fiquem repetitivas. 
    `;

    const textoResenha = (await model.generateContent(systemPrompt)).response.text()
      .replace(/\\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[\*\-]\s/g, ''); 

    const zapRes = await fetch(`https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE_ID}/token/${process.env.ZAPI_TOKEN}/send-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Client-Token': process.env.ZAPI_CLIENT_TOKEN },
      body: JSON.stringify({ phone: "5579998134523", message: textoResenha })
    });
    if (!zapRes.ok) throw new Error(`Falha Z-API: ${zapRes.status}`);

    const { error: updateError } = await supabase
      .from('games')
      .update({ raiox_fim_enviado: true }) 
      .eq('id', gameId);

    if (updateError) console.error("ERRO AO ATUALIZAR FLAG NO BANCO:", updateError.message);

    return new Response(JSON.stringify({ message: `Fim de ${mandante}x${visitante} enviado com sucesso!`, gameId }), { status: 200 });

  } catch (error) {
    console.error("Falha Crítica no Raio-X Fim:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}