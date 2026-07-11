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

    // --- 2. A MONTANHA RUSSA DO RANKING (LÓGICA EXATA DO NOTIFICA-RESULTADOS) ---
    const { data: activeComp } = await supabase.from('competitions').select('id').eq('is_active', true).maybeSingle();
    let rankingStats = "Sem dados de ranking para analisar.";
    
    if (activeComp) {
        // Busca o ranking com TODOS os critérios de desempate oficiais
        const { data: ranking } = await supabase
            .from('leaderboard')
            .select('user_id, nome_exibicao, total_pontos, qtd_cv, qtd_vsg, qtd_av') 
            .eq('competition_id', activeComp.id);

        if (ranking && ranking.length > 0) {
            
            const nicknameMap = {};
            ranking.forEach(r => {
                nicknameMap[r.user_id] = (r.nome_exibicao || '').toLowerCase().trim();
            });

            // Constrói o ranking Anterior usando o mesmo esquema: pontos atuais MENOS os pontos_awarded deste jogo
            const rankingAnterior = ranking.map(userRank => {
                const palpiteDesteUser = palpitesDoJogo.find(p => p.user_id === userRank.user_id);
                const pontosGanhos = palpiteDesteUser?.points_awarded || 0; 
                
                return {
                    user_id: userRank.user_id,
                    pontos_anteriores: Number(userRank.total_pontos) - Number(pontosGanhos),
                    cv: Number(userRank.qtd_cv),
                    vsg: Number(userRank.qtd_vsg),
                    av: Number(userRank.qtd_av)
                };
            });

            let maiorSalto = { nome: '', posicoes: 0 };
            let maiorQueda = { nome: '', posicoes: 0 };

            // O JUÍZO FINAL: Compara a posição de CADA usuário antes e depois usando as regras estritas
            ranking.forEach(usuario => {
                const nomeAtual = nicknameMap[usuario.user_id] || '';

                // --- POSIÇÃO ATUAL ---
                const statsAtual = ranking.find(r => r.user_id === usuario.user_id);
                const posicaoAtual = ranking.filter(r => {
                    if (r.user_id === usuario.user_id) return false;
                    if (r.total_pontos > statsAtual.total_pontos) return true;
                    if (r.total_pontos === statsAtual.total_pontos) {
                        if (r.qtd_cv > statsAtual.qtd_cv) return true;
                        if (r.qtd_cv === statsAtual.qtd_cv) {
                            if (r.qtd_vsg > statsAtual.qtd_vsg) return true;
                            if (r.qtd_vsg === statsAtual.qtd_vsg) {
                                if (r.qtd_av > statsAtual.qtd_av) return true;
                                if (r.qtd_av === statsAtual.qtd_av) {
                                    const nomeR = nicknameMap[r.user_id] || '';
                                    if (nomeR.localeCompare(nomeAtual) < 0) return true;
                                }
                            }
                        }
                    }
                    return false;
                }).length + 1;

                // --- POSIÇÃO ANTERIOR ---
                const statsAnterior = rankingAnterior.find(r => r.user_id === usuario.user_id);
                const posicaoAnterior = rankingAnterior.filter(r => {
                    if (r.user_id === usuario.user_id) return false;
                    if (r.pontos_anteriores > statsAnterior.pontos_anteriores) return true;
                    if (r.pontos_anteriores === statsAnterior.pontos_anteriores) {
                        if (r.cv > statsAnterior.cv) return true;
                        if (r.cv === statsAnterior.cv) {
                            if (r.vsg > statsAnterior.vsg) return true;
                            if (r.vsg === statsAnterior.vsg) {
                                if (r.av > statsAnterior.av) return true;
                                if (r.av === statsAnterior.av) {
                                    const nomeR = nicknameMap[r.user_id] || '';
                                    if (nomeR.localeCompare(nomeAtual) < 0) return true;
                                }
                            }
                        }
                    }
                    return false;
                }).length + 1;

                // --- CÁLCULO DO SALTO/QUEDA ---
                const diff = posicaoAnterior - posicaoAtual; // Positivo = Subiu, Negativo = Caiu

                if (diff > maiorSalto.posicoes) maiorSalto = { nome: usuario.nome_exibicao, posicoes: diff };
                if (diff < maiorQueda.posicoes) maiorQueda = { nome: usuario.nome_exibicao, posicoes: diff };
            });

            rankingStats = `
              MAIOR SALTO: ${maiorSalto.posicoes > 0 ? `${maiorSalto.nome} voou e subiu ${maiorSalto.posicoes} posições na tabela!` : 'Nenhum salto relevante.'}
              MAIOR QUEDA: ${maiorQueda.posicoes < 0 ? `${maiorQueda.nome} escorregou feio e despencou ${Math.abs(maiorQueda.posicoes)} posições!` : 'Nenhuma queda dramática.'}
            `;
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