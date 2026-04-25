import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  try {
    // 1. Busca jogos finalizados que AINDA NÃO tiveram seus resultados notificados
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
      // 2. Busca o ranking atualizado da competição para saber a posição
      const { data: ranking } = await supabase
        .from('leaderboard')
        .select('user_id, total_pontos')
        .eq('competition_id', jogo.competition_id)
        .order('total_pontos', { ascending: false })

      // 3. Busca inscritos que QUEREM receber notificação (notify_results = true)
      const { data: inscritos } = await supabase
        .from('enrollments')
        .select('user_id, profiles!inner(id, nickname, whatsapp, is_active, notify_results)')
        .eq('competition_id', jogo.competition_id)
        .eq('is_paid', true)

      if (!inscritos || inscritos.length === 0) continue;

      // 4. Busca os palpites feitos para ESSE jogo, para saber os pontos ganhos
      const { data: palpites } = await supabase
        .from('bets')
        .select('user_id, points_awarded, guess_score_a, guess_score_b')
        .eq('game_id', jogo.id)

      const usuariosParaNotificar = inscritos
        .map(i => i.profiles)
        .filter(p => p.is_active && p.whatsapp && p.notify_results)

      for (const usuario of usuariosParaNotificar) {
        // Encontra o palpite e os pontos do usuário no jogo
        const palpiteUser = palpites?.find(p => p.user_id === usuario.id)
        const pontosGanhos = palpiteUser?.points_awarded || 0
        const palpiteTexto = palpiteUser ? `${palpiteUser.guess_score_a} x ${palpiteUser.guess_score_b}` : 'Não palpitou'

        // Encontra a posição do usuário no Ranking Geral
        const posicaoRanking = ranking?.findIndex(r => r.user_id === usuario.id) + 1
        const pontuacaoTotal = ranking?.find(r => r.user_id === usuario.id)?.total_pontos || 0

        // Formata o número
        let numeroLimpo = usuario.whatsapp.replace(/\D/g, '')
        const telefoneFinal = numeroLimpo.length <= 11 ? `55${numeroLimpo}` : numeroLimpo

        // Monta a mensagem personalizada
        const mensagem = `🏁 *FIM DE JOGO* 🏁\n\nFala ${usuario.nickname}! A partida terminou:\n⚽ *${jogo.team_a.name} ${jogo.score_a} x ${jogo.score_b} ${jogo.team_b.name}*\n\nSeu palpite: ${palpiteTexto}\n🔥 *Você fez ${pontosGanhos} pontos!*\n\n📊 *Resumo do Campeonato:*\nPontuação Total: ${pontuacaoTotal}\nSua Posição: ${posicaoRanking}º lugar 🏆\n\nAcesse para ver tudo: https://bolao-aju.vercel.app/`

        // Disparo Z-API
        const zapiInstanceId = process.env.ZAPI_INSTANCE_ID
        const zapiToken = process.env.ZAPI_TOKEN
        
        if (zapiInstanceId && zapiToken) {
            try {
                await fetch(`https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-text`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        ...(process.env.ZAPI_CLIENT_TOKEN && { 'Client-Token': process.env.ZAPI_CLIENT_TOKEN })
                    },
                    body: JSON.stringify({ phone: telefoneFinal, message: mensagem })
                })
            } catch (err) {
                console.error("Erro rede ZAPI:", err)
            }
        }
        
        relatorio.push({ usuario: usuario.nickname, pontos: pontosGanhos, posicao: posicaoRanking })
      }

      // 5. Marca o jogo como notificado para não enviar repetido no próximo ciclo do cron
      await supabase
        .from('games')
        .update({ results_notified: true })
        .eq('id', jogo.id)
    }

    return NextResponse.json({ sucesso: true, relatorio_envios: relatorio })

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}