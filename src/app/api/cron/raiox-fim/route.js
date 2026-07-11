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

    // --- 1. CÁLCULO INDEPENDENTE ---
    const cravadas = [];
    const iludidos = [];
    
    palpitesDoJogo.forEach(p => {
        const nome = p.nickname || p.nome_exibicao || p.nome || 'Alguém';
        const pA = p.guess_score_a;
        const pB = p.guess_score_b;
        const rA = gols_mandante;
        const rB = gols_visitante;

        if (pA === rA && pB === rB) {
            cravadas.push(nome);
            p.pontos_calculados = 10; 
        } 
        else {
            const acertouVencedor = Math.sign(pA - pB) === Math.sign(rA - rB);
            const acertouGol = pA === rA || pB === rB;
            
            if (!acertouVencedor && !acertouGol) {
                iludidos.push(`${nome} (apostou ${pA}x${pB})`);
                p.pontos_calculados = 0;
            } else {
                if (acertouVencedor) {
                    if (acertouGol || (pA - pB) === (rA - rB)) p.pontos_calculados = 7;
                    else p.pontos_calculados = 5;
                } else {
                    p.pontos_calculados = 2;
                }
            }
        }
    });

    // --- 2. A MONTANHA RUSSA DO RANKING (O CLONE PERFEITO DO NOTIFICA-RESULTADO) ---
    const { data: activeComp } = await supabase.from('competitions').select('id').eq('is_active', true).maybeSingle();
    let rankingStats = "Sem dados de ranking para analisar.";
    
    if (activeComp) {
        // Busca do ranking com TODOS os critérios
        const { data: ranking } = await supabase
            .from('leaderboard')
            .select('user_id, nome_exibicao, total_pontos, qtd_cv, qtd_vsg, qtd_av') 
            .eq('competition_id', activeComp.id);

        const { data: palpitesAtuais } = await supabase
            .from('bets')
            .select('user_id, points_awarded')
            .eq('game_id', gameId);

        // Prepara multiplicador caso o banco atrase
        const { data: gameData } = await supabase.from('games').select('round').eq('id', gameId).maybeSingle();
        const { data: roundSetting } = await supabase.from('round_settings').select('multiplier').eq('competition_id', activeComp.id).eq('round_name', gameData?.round || '').maybeSingle();
        const multiplier = roundSetting?.multiplier || 1;

        if (ranking && ranking.length > 0) {
            
            const nicknameMap = {};
            ranking.forEach(r => {
                nicknameMap[r.user_id] = (r.nome_exibicao || '').toLowerCase().trim();
            });

            // Cria o Ranking Fantasma (Anterior)
            const rankingAnterior = ranking.map(userRank => {
                const palpiteDesteUser = palpitesAtuais?.find(p => p.user_id === userRank.user_id);
                let pontosGanhos = Number(palpiteDesteUser?.points_awarded || 0);

                // Salva-vidas do Delay
                if (pontosGanhos === 0) {
                    const calcSalvaVidas = palpitesDoJogo.find(p => p.user_id === userRank.user_id);
                    pontosGanhos = Number(calcSalvaVidas?.pontos_calculados || 0) * multiplier;
                }

                return {
                    user_id: userRank.user_id,
                    pontos_anteriores: Number(userRank.total_pontos) - pontosGanhos,
                    cv: Number(userRank.qtd_cv),
                    vsg: Number(userRank.qtd_vsg),
                    av: Number(userRank.qtd_av)
                };
            });

            const relatorio = [];

            // Calcula subidas e quedas idêntico ao notifica-resultado
            ranking.forEach(usuario => {
                const nomeAtual = nicknameMap[usuario.user_id] || '';

                // Posição Atual
                const posicaoAtual = ranking.filter(r => {
                    if (r.user_id === usuario.user_id) return false;
                    if (Number(r.total_pontos) > Number(usuario.total_pontos)) return true;
                    if (Number(r.total_pontos) === Number(usuario.total_pontos)) {
                        if (Number(r.qtd_cv) > Number(usuario.qtd_cv)) return true;
                        if (Number(r.qtd_cv) === Number(usuario.qtd_cv)) {
                            if (Number(r.qtd_vsg) > Number(usuario.qtd_vsg)) return true;
                            if (Number(r.qtd_vsg) === Number(usuario.qtd_vsg)) {
                                if (Number(r.qtd_av) > Number(usuario.qtd_av)) return true;
                                if (Number(r.qtd_av) === Number(usuario.qtd_av)) {
                                    const nomeR = nicknameMap[r.user_id] || '';
                                    if (nomeR.localeCompare(nomeAtual) < 0) return true;
                                }
                            }
                        }
                    }
                    return false;
                }).length + 1;

                // Posição Anterior
                const statsAnterior = rankingAnterior.find(r => r.user_id === usuario.user_id) || { pontos_anteriores: 0, cv: 0, vsg: 0, av: 0 };
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

                const variacao = posicaoAnterior - posicaoAtual; 
                
                if (variacao !== 0) {
                    relatorio.push({
                        nome: usuario.nome_exibicao,
                        variacao: variacao,
                        posAnterior: posicaoAnterior,
                        posAtual: posicaoAtual
                    });
                }
            });

            // Extrai as pontas do relatório
            relatorio.sort((a, b) => b.variacao - a.variacao);
            
            const topSubidas = relatorio.filter(r => r.variacao > 0).slice(0, 2);
            const topQuedas = relatorio.filter(r => r.variacao < 0).slice(-2).reverse();

            const txtSaltos = topSubidas.length > 0 
                ? topSubidas.map(m => `${m.nome} (Subiu ${m.variacao} posições: da ${m.posAnterior}º para ${m.posAtual}º)`).join(' | ')
                : 'Ninguém teve uma subida relevante.';
            
            const txtQuedas = topQuedas.length > 0
                ? topQuedas.map(m => `${m.nome} (Caiu ${Math.abs(m.variacao)} posições: despencou da ${m.posAnterior}º para ${m.posAtual}º)`).join(' | ')
                : 'Ninguém teve uma queda dramática.';

            rankingStats = `[OS 2 MAIORES SALTOS]\n${txtSaltos}\n\n[AS 2 MAIORES QUEDAS]\n${txtQuedas}`;
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
      
      🎢 DADOS EXATOS DA MONTANHA RUSSA DO RANKING:
      ${rankingStats}
      
      SUA MISSÃO - Crie uma resenha curta, debochada e épica com os seguintes blocos (PROIBIDO usar markdown de listas como asteriscos ou traços, pule linhas duplas entre blocos e use negrito MAIÚSCULO nos títulos):
      
      1. 🏁 FIM DE PAPO: Informe o placar final como um verdadeiro decreto.
      2. 🔮 OS VIDENTES: Se alguém cravou, trate-os como Deuses intocáveis. Se ninguém cravou, diga que o bolão tá cheio de mortais fracassados.
      3. 🤡 OS ILUDIDOS: Zombe pesadamente de apenas 1 ou 2 nomes da lista de Iludidos. USE O PLACAR QUE ELES APOSTARAM PARA FAZER A PIADA.
      4. 🎢 A MONTANHA RUSSA: Use ESTRITAMENTE a lista de nomes fornecida no bloco "[OS 2 MAIORES SALTOS]" e "[AS 2 MAIORES QUEDAS]". Se tiver nomes lá, comente quantas posições eles subiram ou desceram e faça piadas humilhando ou enaltecendo. MANTENHA A GRAFIA EXATA DOS NOMES (não confunda homônimos). Se disser que não teve salto/queda, aí sim você pode dizer que congelou. 
      5. Seja Bastante Criativo e Varie bastante as piadas para que mensagens passadas ou futuras não fiquem repetitivas. 
    `;

    const textoResenha = (await model.generateContent(systemPrompt)).response.text()
      .replace(/\\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[\*\-]\s/g, ''); 

    const zapRes = await fetch(`https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE_ID}/token/${process.env.ZAPI_TOKEN}/send-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Client-Token': process.env.ZAPI_CLIENT_TOKEN },
      body: JSON.stringify({ phone: process.env.WHATSAPP_GRUPO_ID, message: textoResenha })
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