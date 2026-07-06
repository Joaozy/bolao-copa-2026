import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const maxDuration = 60; // Aumenta tempo limite

export async function POST(request) {
  try {
    const { leagueId, season, round, competitionId, resetData } = await request.json()

    if (!leagueId || !season || !competitionId) {
      return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // 1. Limpeza Opcional
    if (resetData) {
      await supabase.from('bets').delete().neq('id', 0)
      await supabase.from('games').delete().eq('competition_id', competitionId)
    }

    // 2. Busca na API-Football
    let apiUrl = `https://v3.football.api-sports.io/fixtures?league=${leagueId}&season=${season}`
    if (round) apiUrl += `&round=${encodeURIComponent(round)}`

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY },
      cache: 'no-store'
    })

    const apiData = await response.json()

    if (apiData.errors && Object.keys(apiData.errors).length > 0) {
      return NextResponse.json({ error: 'Erro na API Externa', details: apiData.errors }, { status: 500 })
    }

    const matches = apiData.response || []
    if (matches.length === 0) {
      return NextResponse.json({ message: 'A API retornou 0 jogos para essa busca.' })
    }

    // 3. Cache de Times para evitar muitas consultas
    const { data: dbTeams } = await supabase.from('teams').select('id, name')
    const teamMap = {}
    dbTeams?.forEach(t => teamMap[t.name.toLowerCase()] = t.id)

    // Função interna para garantir time
    const ensureTeam = async (teamData) => {
        const cleanName = teamData.name.trim()
        const key = cleanName.toLowerCase()
        
        if (teamMap[key]) return teamMap[key]

        // Cria se não existe
        const { data: newTeam, error } = await supabase.from('teams').insert({
            name: cleanName,
            flag_code: 'BR', 
            badge_url: teamData.logo
        }).select('id').single()

        if (error) {
            console.error(`Erro ao criar time ${cleanName}:`, error.message)
            return null
        }
        
        teamMap[key] = newTeam.id
        return newTeam.id
    }

    // 4. Processamento
    let importCount = 0
    const report = []

    for (const match of matches) {
      try {
          const homeId = await ensureTeam(match.teams.home)
          const awayId = await ensureTeam(match.teams.away)

          if (homeId && awayId) {
            const statusShort = match.fixture.status.short
            const isFinished = ['FT', 'AET', 'PEN'].includes(statusShort)
            
            // LÓGICA DE SEPARAÇÃO DO PLACAR (90 MINUTOS VS PRORROGAÇÃO/PÊNALTIS)
            let placarCasa = null
            let placarFora = null
            let placarCasaExt = null
            let placarForaExt = null
            let placarCasaPen = null
            let placarForaPen = null

            // Not Started ou Cancelled
            const isFuture = ['NS', 'TBD', 'PST', 'CANC', 'ABD'].includes(statusShort)

            if (!isFuture) {
                const passouDos90 = ['ET', 'AET', 'P', 'PEN', 'BT'].includes(statusShort)

                if (passouDos90 && match.score?.fulltime?.home !== null) {
                    // Trava o bolão no resultado dos 90 minutos
                    placarCasa = match.score.fulltime.home
                    placarFora = match.score.fulltime.away
                    
                    // Salva a prorrogação para exibição visual
                    if (match.score?.extratime?.home !== null) {
                        placarCasaExt = match.score.extratime.home
                        placarForaExt = match.score.extratime.away
                    }
                    // Salva os pênaltis para exibição visual
                    if (match.score?.penalty?.home !== null) {
                        placarCasaPen = match.score.penalty.home
                        placarForaPen = match.score.penalty.away
                    }
                } else {
                    // Jogo normal (90 min apenas)
                    placarCasa = match.goals.home ?? null
                    placarFora = match.goals.away ?? null
                }
            }

            const { error } = await supabase.from('games').upsert({
              competition_id: parseInt(competitionId),
              api_id: match.fixture.id,
              round: match.league.round,
              team_a_id: homeId,
              team_b_id: awayId,
              start_time: match.fixture.date,
              score_a: placarCasa,
              score_b: placarFora,
              score_a_ext: placarCasaExt,
              score_b_ext: placarForaExt,
              score_a_pen: placarCasaPen,
              score_b_pen: placarForaPen,
              is_finished: isFinished,
              status_short: statusShort
            }, { onConflict: 'api_id' })

            if (!error) importCount++
            else report.push(`Erro DB Jogo ${match.fixture.id}: ${error.message}`)
          } else {
            report.push(`Erro Times Jogo ${match.fixture.id}: Não foi possível criar/achar times.`)
          }
      } catch (err) {
          report.push(`Erro Crítico Jogo ${match.fixture.id}: ${err.message}`)
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `${importCount} de ${matches.length} jogos importados.`,
      report: report.slice(0, 10) 
    })

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}