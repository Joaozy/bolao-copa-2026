import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const maxDuration = 60; 

export async function POST(request) {
  try {
    const { leagueId, season, competitionId } = await request.json()

    if (!leagueId || !season || !competitionId) {
      return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // 1. Busca cache de times para mapear ID
    const { data: dbTeams } = await supabase.from('teams').select('id, name')
    const teamMap = {}
    dbTeams?.forEach(t => {
        const cleanName = t.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        teamMap[cleanName] = t.id
        // Mapeamentos comuns
        if (cleanName.includes('athletico')) teamMap['athletico paranaense'] = t.id
        if (cleanName.includes('vasco')) teamMap['vasco da gama'] = t.id
        if (cleanName.includes('mineiro')) teamMap['atletico mineiro'] = t.id
        if (cleanName.includes('goianiense')) teamMap['atletico goianiense'] = t.id
        if (cleanName.includes('sport')) teamMap['sport recife'] = t.id
        if (cleanName.includes('america')) teamMap['america mineiro'] = t.id
    })

    // Função para garantir time
    const ensureTeam = async (teamData) => {
        const cleanName = teamData.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        let id = teamMap[cleanName]

        if (!id) {
            const { data: newTeam, error } = await supabase.from('teams').insert({
                name: teamData.name,
                flag_code: 'BR', // Padrão
                badge_url: teamData.logo
            }).select('id').single()
            if (!error) {
                id = newTeam.id
                teamMap[cleanName] = id
            }
        }
        return id
    }

    // 2. Busca na API
    const response = await fetch(`https://v3.football.api-sports.io/standings?league=${leagueId}&season=${season}`, {
      method: 'GET',
      headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY },
      cache: 'no-store'
    })

    const apiData = await response.json()
    if (apiData.errors && Object.keys(apiData.errors).length > 0) return NextResponse.json({ error: 'Erro API', details: apiData.errors }, { status: 500 })

    const standingsGroups = apiData.response?.[0]?.league?.standings || []
    if (standingsGroups.length === 0) return NextResponse.json({ message: 'Nenhuma tabela encontrada na API.' })

    // 3. Limpa tabela antiga dessa competição
    await supabase.from('standings').delete().eq('competition_id', competitionId)

    // 4. Insere novos dados
    let importedCount = 0
    
    // A API retorna array de arrays (grupos) ou array único
    for (const group of standingsGroups) {
        for (const row of group) {
            const teamId = await ensureTeam(row.team)
            
            if (teamId) {
                await supabase.from('standings').insert({
                    competition_id: parseInt(competitionId),
                    team_id: teamId,
                    group_name: row.group || 'Classificação Geral',
                    position: row.rank,
                    points: row.points,
                    played: row.all.played,
                    won: row.all.win,
                    drawn: row.all.draw,
                    lost: row.all.lose,
                    goals_for: row.all.goals.for,
                    goals_against: row.all.goals.against,
                    goals_diff: row.goalsDiff
                })
                importedCount++
            }
        }
    }

    return NextResponse.json({ success: true, message: `${importedCount} times importados para a tabela.` })

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}