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
    // 1. Busca jogos monitorados (com API ID e não finalizados)
    const { data: jogosPendentes } = await supabase
      .from('games')
      .select('*')
      .not('api_id', 'is', null) 
      .eq('is_finished', false)

    if (!jogosPendentes || jogosPendentes.length === 0) {
      return NextResponse.json({ message: 'Nenhum jogo ao vivo monitorado no momento.' })
    }

    const relatorio = []
    const chunkSize = 20

    for (let i = 0; i < jogosPendentes.length; i += chunkSize) {
        const chunk = jogosPendentes.slice(i, i + chunkSize)
        const idsParaBuscar = chunk.map(j => j.api_id).join('-')
        
        const url = `https://v3.football.api-sports.io/fixtures?ids=${idsParaBuscar}`
        
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY },
          cache: 'no-store'
        })
        
        const dados = await response.json()
    
        if (dados.errors && Object.keys(dados.errors).length > 0) {
          relatorio.push(`ERRO API no Lote ${i}: ${JSON.stringify(dados.errors)}`)
          continue
        }
    
        if (dados.response) {
          for (const match of dados.response) {
            const gameIdApi = match.fixture.id
            const statusShort = match.fixture.status.short 
            
            // Garante que elapsed seja número ou null
            const rawElapsed = match.fixture.status.elapsed
            const elapsed = rawElapsed === null ? null : parseInt(rawElapsed)
    
            // Lista de status que significam "Ainda não começou"
            const notStarted = ['NS', 'TBD', 'PST', 'CANC', 'ABD']
            const isFuture = notStarted.includes(statusShort)

            let placarCasa = null
            let placarFora = null

            if (isFuture) {
                placarCasa = null
                placarFora = null
            } else {
                placarCasa = match.goals.home ?? 0
                placarFora = match.goals.away ?? 0
            }
            
            const jogoAcabou = ['FT', 'AET', 'PEN'].includes(statusShort)
            
            // Status que indicam "Bola Rolando"
            const isLive = ['1H', '2H', 'ET', 'P', 'BT'].includes(statusShort)
    
            const jogoNoBanco = jogosPendentes.find(j => j.api_id === gameIdApi)
    
            if (jogoNoBanco) {
              const mudouPlacar = placarCasa !== jogoNoBanco.score_a || placarFora !== jogoNoBanco.score_b
              const mudouStatus = statusShort !== jogoNoBanco.status_short || jogoAcabou !== jogoNoBanco.is_finished
              const mudouTempo = elapsed !== jogoNoBanco.elapsed
              
              // SE O JOGO ESTÁ AO VIVO, ATUALIZAMOS SEMPRE PARA GARANTIR O RELÓGIO
              const deveAtualizar = mudouPlacar || mudouStatus || mudouTempo || isLive

              if (deveAtualizar) {
                const { error } = await supabase
                  .from('games')
                  .update({
                    score_a: placarCasa,
                    score_b: placarFora,
                    is_finished: jogoAcabou,
                    status_short: statusShort, 
                    elapsed: elapsed           
                  })
                  .eq('id', jogoNoBanco.id)
    
                if (error) {
                    relatorio.push(`Erro DB Jogo ${gameIdApi}: ${error.message}`)
                } else {
                    const tipoUpdate = mudouPlacar ? 'GOL/PLACAR' : (mudouStatus ? 'STATUS' : 'TEMPO')
                    relatorio.push(`[${tipoUpdate}] Jogo ${gameIdApi}: ${placarCasa}x${placarFora} (${elapsed}' ${statusShort})`)
                    
                    if (!isFuture && mudouPlacar) {
                         await supabase.rpc('calculate_points')
                    }
                }
              } else {
                  // Log para debug: mostra que verificou mas estava igual
                  relatorio.push(`Sem mudanças Jogo ${gameIdApi}: API(${elapsed}') == DB(${jogoNoBanco.elapsed}')`)
              }
            }
          }
        }
    }

    return NextResponse.json({ 
      sucesso: true, 
      atualizados: relatorio 
    })

  } catch (error) {
    return NextResponse.json({ erro_critico: error.message }, { status: 500 })
  }
}