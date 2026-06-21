import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 300

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export async function GET(request) {
  try {
    // 🛡️ A FECHADURA DA VERCEL
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Acesso negado. Cron Secret inválido.' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data: jogosFinalizados } = await supabase
      .from('games')
      .select('id, competition_id, team_a:teams!team_a_id(name), team_b:teams!team_b_id(name), score_a, score_b')
      .eq('is_finished', true)
      .eq('results_notified', false)

    if (!jogosFinalizados || jogosFinalizados.length === 0) {
      return NextResponse.json({ message: "Nenhum novo resultado para notificar." })
    }

    const relatorio = []

    for (const jogo of jogosFinalizados) {
      // 🥇 BUSCA DO RANKING NO BANCO
      const { data: ranking } = await supabase
        .from('leaderboard')
        .select('user_id, total_pontos, qtd_cv, qtd_vsg, qtd_av') 
        .eq('competition_id', jogo.competition_id)

      const { data: inscritos } = await supabase
        .from('enrollments')
        .select('user_id, profiles!inner(id, nickname, whatsapp, is_active, notify_results)')
        .eq('competition_id', jogo.competition_id)
        .eq('is_paid', true)

      if (!inscritos || inscritos.length === 0) continue;

      // 📖 CRIANDO UM DICIONÁRIO DE NOMES PARA O DESEMPATE ALFABÉTICO
      const nicknameMap = {};
      inscritos.forEach(inscrito => {
        // Guardamos o nome em letras minúsculas e sem espaços extras para não dar erro na comparação
        nicknameMap[inscrito.user_id] = (inscrito.profiles.nickname || '').toLowerCase().trim();
      });

      const { data: palpites } = await supabase
        .from('bets')
        .select('user_id, points_awarded, guess_score_a, guess_score_b')
        .eq('game_id', jogo.id)

      // ⏱️ O "RANKING FANTASMA" PARA A SETA (SUBIU/CAIU)
      const rankingAnterior = ranking?.map(userRank => {
        const palpiteDesteUser = palpites?.find(p => p.user_id === userRank.user_id);
        const pontosGanhos = palpiteDesteUser?.points_awarded || 0;
        return {
          user_id: userRank.user_id,
          pontos_anteriores: Number(userRank.total_pontos) - pontosGanhos,
          cv: Number(userRank.qtd_cv),
          vsg: Number(userRank.qtd_vsg),
          av: Number(userRank.qtd_av)
        };
      }) || [];

      const usuariosParaNotificar = inscritos
        .map(i => i.profiles)
        .filter(p => p.is_active && p.whatsapp && p.notify_results)

      for (const usuario of usuariosParaNotificar) {
        const palpiteUser = palpites?.find(p => p.user_id === usuario.id)
        const pontosGanhos = palpiteUser?.points_awarded || 0
        const palpiteTexto = palpiteUser ? `${palpiteUser.guess_score_a} x ${palpiteUser.guess_score_b}` : 'Não palpitou'

        // Nome do usuário atual para a nossa regra de desempate
        const nomeAtual = nicknameMap[usuario.id] || '';

        // 📊 LÓGICA DE RANKING ESTRITA (Resolve Empates Absolutos com Ordem Alfabética)
        const statsAtual = ranking?.find(r => r.user_id === usuario.id) || { total_pontos: 0, qtd_cv: 0, qtd_vsg: 0, qtd_av: 0 };
        
        // Posição = 1 + N pessoas estritamente melhores que o usuário
        const posicaoAtual = ranking.filter(r => {
            if (r.user_id === usuario.id) return false; // Não compara com ele mesmo

            if (r.total_pontos > statsAtual.total_pontos) return true;
            if (r.total_pontos === statsAtual.total_pontos) {
                if (r.qtd_cv > statsAtual.qtd_cv) return true;
                if (r.qtd_cv === statsAtual.qtd_cv) {
                    if (r.qtd_vsg > statsAtual.qtd_vsg) return true;
                    if (r.qtd_vsg === statsAtual.qtd_vsg) {
                        if (r.qtd_av > statsAtual.qtd_av) return true;
                        if (r.qtd_av === statsAtual.qtd_av) {
                            // 🔥 EMPATE ABSOLUTO NAS MATEMÁTICAS: O Juiz Alfabético entra em ação!
                            const nomeR = nicknameMap[r.user_id] || '';
                            // Se o nome do concorrente vem ANTES no alfabeto (< 0), ele passa na frente!
                            if (nomeR.localeCompare(nomeAtual) < 0) return true;
                        }
                    }
                }
            }
            return false;
        }).length + 1;

        // 🔄 LÓGICA DE POSIÇÃO ANTERIOR (Com o mesmo Juiz Alfabético)
        const statsAnterior = rankingAnterior.find(r => r.user_id === usuario.id) || { pontos_anteriores: 0, cv: 0, vsg: 0, av: 0 };
        
        const posicaoAnterior = rankingAnterior.filter(r => {
            if (r.user_id === usuario.id) return false;

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

        // 🏹 DEFININDO A SETA DE TENDÊNCIA
        let variacaoTexto = "➖ Manteve a posição";
        if (posicaoAtual < posicaoAnterior) {
            const posicoesGanhas = posicaoAnterior - posicaoAtual;
            variacaoTexto = `⬆️ Subiu ${posicoesGanhas} posiç${posicoesGanhas > 1 ? 'ões' : 'ão'}`;
        } else if (posicaoAtual > posicaoAnterior) {
            const posicoesPerdidas = posicaoAtual - posicaoAnterior;
            variacaoTexto = `⬇️ Caiu ${posicoesPerdidas} posiç${posicoesPerdidas > 1 ? 'ões' : 'ão'}`;
        }

        let numeroLimpo = usuario.whatsapp.replace(/\D/g, '')
        const telefoneFinal = numeroLimpo.length <= 11 ? `55${numeroLimpo}` : numeroLimpo

        const mensagem = `🏁 *FIM DE JOGO* 🏁\n\nFala ${usuario.nickname}! A partida terminou:\n⚽ *${jogo.team_a.name} ${jogo.score_a} x ${jogo.score_b} ${jogo.team_b.name}*\n\nSeu palpite: ${palpiteTexto}\n🔥 *Você fez ${pontosGanhos} pontos!*\n\n📊 *Resumo do Campeonato:*\nPontuação Total: ${statsAtual.total_pontos}\nSua Posição: ${posicaoAtual}º lugar 🏆\nEstatística: ${variacaoTexto}\n\nAcesse para ver tudo: https://bolao-aju.vercel.app/`

        const zapiInstanceId = process.env.ZAPI_INSTANCE_ID
        const zapiToken = process.env.ZAPI_TOKEN
        
        if (zapiInstanceId && zapiToken) {
            try {
                const zapRes = await fetch(`https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-text`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        ...(process.env.ZAPI_CLIENT_TOKEN && { 'Client-Token': process.env.ZAPI_CLIENT_TOKEN })
                    },
                    body: JSON.stringify({ phone: telefoneFinal, message: mensagem })
                });

                if (!zapRes.ok) {
                    throw new Error(`Z-API rejeitou envio para ${usuario.nickname}: ${zapRes.status}`);
                }
            } catch (err) {
                console.error("Erro rede ZAPI:", err)
            }
        }
        
        relatorio.push({ usuario: usuario.nickname, pontos: pontosGanhos, posicao: posicaoAtual, variacao: variacaoTexto })

        const tempoEspera = Math.floor(Math.random() * (3000 - 1500 + 1)) + 1500;
        await sleep(tempoEspera);
      }

      await supabase
        .from('games')
        .update({ results_notified: true })
        .eq('id', jogo.id)
    }

    return NextResponse.json({ sucesso: true, relatorio_envios: relatorio })

  } catch (error) {
    console.error("Falha Crítica no Notifica Resultados:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
