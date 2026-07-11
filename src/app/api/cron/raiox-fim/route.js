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

    // --- 2. A MONTANHA RUSSA DO RANKING (NOVA ARQUITETURA - MAPA COMPLETO) ---
    const { data: activeComp } = await supabase.from('competitions').select('id').eq('is_active', true).maybeSingle();
    let rankingStats = "Sem dados de ranking para analisar.";
    
    if (activeComp) {
        const { data: ranking } = await supabase
            .from('leaderboard')
            .select('user_id, nome_exibicao, total_pontos, qtd_cv, qtd_vsg, qtd_av') 
            .eq('competition_id', activeComp.id);

        if (ranking && ranking.length > 0) {
            
            const nicknameMap = {};
            ranking.forEach(r => {
                nicknameMap[r.user_id] = (r.nome_exibicao || '').toLowerCase().trim();
            });

            // 1. TRATAMENTO DO DELAY DO BANCO: O gatilho do Supabase já rodou?
            const dbAtualizado = palpitesDoJogo.some(p => p.points_awarded !== null);

            // 2. ISOLAR A MATEMÁTICA: Criamos a base de dados exata para o ranking Antes vs Depois
            const rankingCompleto = ranking.map(r => {
                const palpite = palpitesDoJogo.find(p => p.user_id === r.user_id);
                
                // Se DB tá lento, usamos os pontos que a própria API calculou no Passo 1
                const pontosManual = Number(palpite?.pontos_calculados || 0);
                const pontosBanco = Number(palpite?.points_awarded || 0);
                const ganhos = dbAtualizado ? pontosBanco : pontosManual;
                
                const totalBanco = Number(r.total_pontos || 0);

                return {
                    user_id: r.user_id,
                    nome: r.nome_exibicao || 'Anônimo',
                    // Se o DB já foi atualizado, totalBanco é o Atual. Se não, totalBanco é o Anterior.
                    pontosAtuais: dbAtualizado ? totalBanco : totalBanco + ganhos,
                    pontosAnteriores: dbAtualizado ? totalBanco - ganhos : totalBanco,
                    cv: Number(r.qtd_cv || 0),
                    vsg: Number(r.qtd_vsg || 0),
                    av: Number(r.qtd_av || 0)
                };
            });

            const relatorioMovimentos = [];

            // 3. O LOOP DO JUÍZO FINAL: Filtra todos os usuários, exatamente como no notifica-resultados
            rankingCompleto.forEach(usuario => {
                const nomeAtual = nicknameMap[usuario.user_id] || '';

                // --- CALCULA POSIÇÃO ATUAL ---
                const posicaoAtual = rankingCompleto.filter(r => {
                    if (r.user_id === usuario.user_id) return false;
                    if (r.pontosAtuais > usuario.pontosAtuais) return true;
                    if (r.pontosAtuais === usuario.pontosAtuais) {
                        if (r.cv > usuario.cv) return true;
                        if (r.cv === usuario.cv) {
                            if (r.vsg > usuario.vsg) return true;
                            if (r.vsg === usuario.vsg) {
                                if (r.av > usuario.av) return true;
                                if (r.av === usuario.av) {
                                    const nomeR = nicknameMap[r.user_id] || '';
                                    if (nomeR.localeCompare(nomeAtual) < 0) return true;
                                }
                            }
                        }
                    }
                    return false;
                }).length + 1;

                // --- CALCULA POSIÇÃO ANTERIOR ---
                const posicaoAnterior = rankingCompleto.filter(r => {
                    if (r.user_id === usuario.user_id) return false;
                    if (r.pontosAnteriores > usuario.pontosAnteriores) return true;
                    if (r.pontosAnteriores === usuario.pontosAnteriores) {
                        if (r.cv > usuario.cv) return true;
                        if (r.cv === usuario.cv) {
                            if (r.vsg > usuario.vsg) return true;
                            if (r.vsg === usuario.vsg) {
                                if (r.av > usuario.av) return true;
                                if (r.av === usuario.av) {
                                    const nomeR = nicknameMap[r.user_id] || '';
                                    if (nomeR.localeCompare(nomeAtual) < 0) return true;
                                }
                            }
                        }
                    }
                    return false;
                }).length + 1;

                // ARMAZENA O MOVIMENTO
                const diff = posicaoAnterior - posicaoAtual; 
                
                if (diff !== 0) {
                    relatorioMovimentos.push({
                        nome: usuario.nome,
                        variacao: diff,
                        posAnterior: posicaoAnterior,
                        posAtual: posicaoAtual
                    });
                }
            });

            // 4. EXTRAIR OS 2 MAIORES DE CADA LADO
            relatorioMovimentos.sort((a, b) => b.variacao - a.variacao);

            const maioresSaltos = relatorioMovimentos.filter(m => m.variacao > 0).slice(0, 2);
            const maioresQuedas = relatorioMovimentos.filter(m => m.variacao < 0).slice(-2).reverse();

            // 5. EMBALAR OS DADOS CRUS PARA A IA LER COM FACILIDADE
            const txtSaltos = maioresSaltos.length > 0 
                ? maioresSaltos.map(m => `${m.nome} (Subiu ${m.variacao} posições: foi de ${m.posAnterior}º para ${m.posAtual}º lugar)`).join(' | ')
                : 'Nenhum salto relevante registrado.';

            const txtQuedas = maioresQuedas.length > 0
                ? maioresQuedas.map(m => `${m.nome} (Caiu ${Math.abs(m.variacao)} posições: despencou de ${m.posAnterior}º para ${m.posAtual}º lugar)`).join(' | ')
                : 'Nenhuma queda dramática registrada.';

            rankingStats = `[TOP 2 SUBIDAS]\n${txtSaltos}\n\n[TOP 2 QUEDAS]\n${txtQuedas}`;
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
      
      🎢 ESTATÍSTICAS DA MONTANHA RUSSA DO RANKING:
      ${rankingStats}
      
      SUA MISSÃO - Crie uma resenha curta, debochada e épica com os seguintes blocos (PROIBIDO usar markdown de listas como asteriscos ou traços, pule linhas duplas entre blocos e use negrito MAIÚSCULO nos títulos):
      
      1. 🏁 FIM DE PAPO: Informe o placar final como um verdadeiro decreto.
      2. 🔮 OS VIDENTES: Se alguém cravou, trate-os como Deuses intocáveis. Se ninguém cravou, diga que o bolão tá cheio de mortais fracassados.
      3. 🤡 OS ILUDIDOS: Zombe pesadamente de apenas 1 ou 2 nomes da lista de Iludidos. USE O PLACAR QUE ELES APOSTARAM PARA FAZER A PIADA.
      4. 🎢 A MONTANHA RUSSA: Use ESTRITAMENTE as estatísticas fornecidas em "ESTATÍSTICAS DA MONTANHA RUSSA". Comente EXPLÍCITAMENTE os números e posições. Elogie exageradamente os 2 usuários que mais subiram e zombe pesadamente dos 2 usuários que mais caíram.
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