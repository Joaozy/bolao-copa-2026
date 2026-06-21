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
      // 🥇 O SEGREDO DO DESEMPATE ESTÁ AQUI
      // O robô agora ordena exatamente com a mesma matemática do seu site!
      const { data: ranking } = await supabase
        .from('leaderboard')
        .select('user_id, total_pontos, qtd_cv, qtd_vsg, qtd_av') 
        .eq('competition_id', jogo.competition_id)
        .order('total_pontos', { ascending: false })
        .order('qtd_cv', { ascending: false })
        .order('qtd_vsg', { ascending: false })
        .order('qtd_av', { ascending: false });

      const { data: inscritos } = await supabase
        .from('enrollments')
        .select('user_id, profiles!inner(id, nickname, whatsapp, is_active, notify_results)')
        .eq('competition_id', jogo.competition_id)
        .eq('is_paid', true)

      if (!inscritos || inscritos.length === 0) continue;

      const { data: palpites } = await supabase
        .from('bets')
        .select('user_id, points_awarded, guess_score_a, guess_score_b')
        .eq('game_id', jogo.id)

      // ⏱️ CRIANDO O "RANKING FANTASMA" PARA A SETA (SUBIU/CAIU)
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

      // Ordena o ranking anterior respeitando a mesma regra de desempate
      rankingAnterior.sort((a, b) => {
        if (b.pontos_anteriores !== a.pontos_anteriores) return b.pontos_anteriores - a.pontos_anteriores;
        if (b.cv !== a.cv) return b.cv - a.cv;
        if (b.vsg !== a.vsg) return b.vsg - a.vsg;
        return b.av - a.av;
      });

      const usuariosParaNotificar = inscritos
        .map(i => i.profiles)
        .filter(p => p.is_active && p.whatsapp && p.notify_results)

      for (const usuario of usuariosParaNotificar) {
        const palpiteUser = palpites?.find(p => p.user_id === usuario.id)
        const pontosGanhos = palpiteUser?.points_awarded || 0
        const palpiteTexto = palpiteUser ? `${palpiteUser.guess_score_a} x ${palpiteUser.guess_score_b}` : 'Não palpitou'

        // 📊 LÓGICA DE RANKING ESTRITA (1 a N, idêntico ao site)
        const pontuacaoTotal = ranking?.find(r => r.user_id === usuario.id)?.total_pontos || 0;
        const posicaoAtual = ranking.findIndex(r => r.user_id === usuario.id) + 1;

        // 🔄 COMPARANDO COM A POSIÇÃO ANTERIOR
        const posicaoAnterior = rankingAnterior.findIndex(r => r.user_id === usuario.id) + 1;

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

        // ✉️ NOVA MENSAGEM (Agora com a variação!)
        const mensagem = `🏁 *FIM DE JOGO* 🏁\n\nFala ${usuario.nickname}! A partida terminou:\n⚽ *${jogo.team_a.name} ${jogo.score_a} x ${jogo.score_b} ${jogo.team_b.name}*\n\nSeu palpite: ${palpiteTexto}\n🔥 *Você fez ${pontosGanhos} pontos!*\n\n📊 *Resumo do Campeonato:*\nPontuação Total: ${pontuacaoTotal}\nSua Posição: ${posicaoAtual}º lugar 🏆\nEstatística: ${variacaoTexto}\n\nAcesse para ver tudo: https://bolao-aju.vercel.app/`

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