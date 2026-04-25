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
    const MINUTOS_ANTECEDENCIA = 30 
    const agora = new Date()
    
    // 1. Busca jogos que ainda não começaram
    const { data: todosJogos } = await supabase
      .from('games')
      .select('id, competition_id, team_a:teams!team_a_id(name), team_b:teams!team_b_id(name), start_time')
      .gt('start_time', new Date(agora.getTime() - 10 * 60000).toISOString())
      .order('start_time', { ascending: true })
      .limit(10)

    const jogosProximos = todosJogos?.filter(jogo => {
      const jogoData = new Date(jogo.start_time)
      const diffMilissegundos = jogoData.getTime() - agora.getTime()
      const diffMinutos = diffMilissegundos / 60000
      return diffMinutos > 0 && diffMinutos <= MINUTOS_ANTECEDENCIA
    }) || []

    if (jogosProximos.length === 0) {
      return NextResponse.json({ 
        message: "Nenhum jogo na janela de 30min.", 
        debug_agora: agora.toISOString(),
        proximos_jogos_encontrados: todosJogos?.map(j => ({ nome: j.team_a.name, hora: j.start_time }))
      })
    }

    const relatorio = []
    const debug_steps = [] // <-- NOSSO RASTREADOR

    for (const jogo of jogosProximos) {
      let passoDeDebug = {
        jogo_id: jogo.id,
        competition_id: jogo.competition_id
      }

      // PASSO A: Busca inscritos
      const { data: inscritos, error: erroInscritos } = await supabase
        .from('enrollments')
        .select('user_id, profiles!inner(id, nickname, whatsapp, is_active)')
        .eq('competition_id', jogo.competition_id)
        .eq('is_paid', true)

      passoDeDebug.erro_consulta_inscritos = erroInscritos
      passoDeDebug.total_inscritos_encontrados = inscritos ? inscritos.length : 0
      passoDeDebug.inscritos_bruto = inscritos // Mostra exatamente o que o banco devolveu

      if (!inscritos || inscritos.length === 0) {
        debug_steps.push(passoDeDebug)
        continue;
      }

      // PASSO B: Busca palpites feitos
      const { data: palpitesFeitos, error: erroPalpites } = await supabase
        .from('bets')
        .select('user_id')
        .eq('game_id', jogo.id)

      const idsQuePalpitaram = palpitesFeitos ? palpitesFeitos.map(p => p.user_id) : []
      passoDeDebug.erro_consulta_palpites = erroPalpites
      passoDeDebug.total_palpites_encontrados = idsQuePalpitaram.length
      passoDeDebug.ids_que_palpitaram = idsQuePalpitaram

      // PASSO C: Filtra os esquecidos
      const esquecidos = inscritos
        .map(i => i.profiles)
        .filter(p => p.is_active === true && p.whatsapp && !idsQuePalpitaram.includes(p.id))

      passoDeDebug.esquecidos_apos_filtro = esquecidos

      debug_steps.push(passoDeDebug)

      // Executa o envio
      for (const usuario of esquecidos) {
        let numeroLimpo = usuario.whatsapp.replace(/\D/g, '')
        const telefoneFinal = numeroLimpo.length <= 11 ? `55${numeroLimpo}` : numeroLimpo
        const mensagem = `⚠️ *ALERTA DE BOLÃO* ⚠️\n\nEi ${usuario.nickname || 'Campeão'}! 🏃‍♂️💨\n\nO jogo *${jogo.team_a.name} x ${jogo.team_b.name}* começa em menos de 30 minutos e você ainda não palpitou!\n\nCorre lá: https://bolao-copa-final.vercel.app/`

        const zapiInstanceId = process.env.ZAPI_INSTANCE_ID
        const zapiToken = process.env.ZAPI_TOKEN
        const zapiClientToken = process.env.ZAPI_CLIENT_TOKEN 
        
        let resultadoEnvio = "Não configurado"
        let erroDetalhado = null

        if (zapiInstanceId && zapiToken) {
            try {
                const headers = { 'Content-Type': 'application/json' }
                if (zapiClientToken) headers['Client-Token'] = zapiClientToken

                const response = await fetch(`https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-text`, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({ phone: telefoneFinal, message: mensagem })
                })
                
                const responseData = await response.json()
                if (response.ok) {
                    resultadoEnvio = "SUCESSO Z-API"
                } else { 
                    resultadoEnvio = "ERRO Z-API"
                    erroDetalhado = responseData 
                }
            } catch (err) {
                resultadoEnvio = "ERRO DE REDE"
                erroDetalhado = err.message
            }
        }
        
        relatorio.push({ 
            usuario: usuario.nickname, 
            telefone_usado: telefoneFinal, 
            jogo: `${jogo.team_a.name} x ${jogo.team_b.name}`, 
            status: resultadoEnvio, 
            detalhes: erroDetalhado 
        })
      }
    }

    return NextResponse.json({ 
      sucesso: true, 
      esquecidos_notificados: relatorio,
      debug_steps: debug_steps // O RASTREADOR VAI CUSPIR TUDO AQUI
    })

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}