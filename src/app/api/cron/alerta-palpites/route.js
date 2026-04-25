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
    console.log('⏰ Iniciando verificação de alertas...')

    // Janela de 30 minutos
    const MINUTOS_ANTECEDENCIA = 30 
    const agora = new Date()
    const limiteTempo = new Date(agora.getTime() + MINUTOS_ANTECEDENCIA * 60 * 1000)

    // 1. Busca jogos nesse intervalo
    const { data: jogosProximos } = await supabase
      .from('games')
      .select('id, competition_id, team_a:teams!team_a_id(name), team_b:teams!team_b_id(name), start_time')
      .gt('start_time', agora.toISOString())
      .lt('start_time', limiteTempo.toISOString())

    if (!jogosProximos || jogosProximos.length === 0) {
      return NextResponse.json({ message: `Nenhum jogo começando nos próximos ${MINUTOS_ANTECEDENCIA} min.` })
    }

    const relatorio = []

    for (const jogo of jogosProximos) {
      // 2. Busca quem está inscrito E pago nesta competição específica
      const { data: inscritos } = await supabase
        .from('enrollments')
        .select('user_id, profiles!inner(id, nickname, whatsapp, is_active)')
        .eq('competition_id', jogo.competition_id)
        .eq('is_paid', true)

      if (!inscritos || inscritos.length === 0) continue;

      // 3. Busca quem JÁ FEZ o palpite para este jogo
      const { data: palpitesFeitos } = await supabase
        .from('bets')
        .select('user_id')
        .eq('game_id', jogo.id)

      const idsQuePalpitaram = palpitesFeitos.map(p => p.user_id)
      
      // 4. Filtra os esquecidos (Ativos, com WhatsApp, e que não palpitaram)
      const esquecidos = inscritos
        .map(i => i.profiles)
        .filter(p => p.is_active && p.whatsapp && !idsQuePalpitaram.includes(p.id))

      for (const usuario of esquecidos) {
        let numeroLimpo = usuario.whatsapp.replace(/\D/g, '')
        const telefoneFinal = numeroLimpo.length <= 11 ? `55${numeroLimpo}` : numeroLimpo

        const mensagem = `⚠️ *ALERTA DE BOLÃO* ⚠️\n\nEi ${usuario.nickname || 'Campeão'}! 🏃‍♂️💨\n\nO jogo *${jogo.team_a.name} x ${jogo.team_b.name}* começa em menos de 30 minutos e você ainda não palpitou!\n\nCorre lá: https://bolao-copa-final.vercel.app/`

        // Integração Z-API
        const zapiInstanceId = process.env.ZAPI_INSTANCE_ID
        const zapiToken = process.env.ZAPI_TOKEN
        const zapiClientToken = process.env.ZAPI_CLIENT_TOKEN
        
        let resultadoEnvio = "Não configurado"
        let erroDetalhado = null

        if (zapiInstanceId && zapiToken && zapiClientToken) {
            try {
                const response = await fetch(`https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-text`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Client-Token': zapiClientToken },
                    body: JSON.stringify({ phone: telefoneFinal, message: mensagem })
                })
                
                const responseData = await response.json()
                if (response.ok) resultadoEnvio = "SUCESSO Z-API"
                else { resultadoEnvio = "ERRO Z-API"; erroDetalhado = responseData }
            } catch (err) {
                resultadoEnvio = "ERRO DE REDE"; erroDetalhado = err.message
            }
        }
        
        relatorio.push({ usuario: usuario.nickname, telefone_usado: telefoneFinal, jogo: `${jogo.team_a.name} x ${jogo.team_b.name}`, status: resultadoEnvio, detalhes: erroDetalhado })
      }
    }

    return NextResponse.json({ sucesso: true, esquecidos_notificados: relatorio })

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}