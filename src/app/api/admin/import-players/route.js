import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const maxDuration = 60; 

export async function POST(request) {
  try {
    const { leagueId, season, competitionId, specificTeamId } = await request.json()

    if (!leagueId || !season || !competitionId) {
      return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // 1. Busca cache de times locais
    const { data: dbTeams } = await supabase.from('teams').select('id, name')
    const teamMap = {} // Nome Normalizado -> ID
    const idToNameMap = {} // ID -> Nome Normalizado
    
    dbTeams?.forEach(t => {
        const cleanName = t.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        teamMap[cleanName] = t.id
        idToNameMap[t.id] = cleanName
        
        // Mapeamentos
        if (cleanName.includes('athletico')) teamMap['athletico paranaense'] = t.id
        if (cleanName.includes('vasco')) teamMap['vasco da gama'] = t.id
        if (cleanName.includes('mineiro')) teamMap['atletico mineiro'] = t.id
        if (cleanName.includes('goianiense')) teamMap['atletico goianiense'] = t.id
        if (cleanName.includes('sport')) teamMap['sport recife'] = t.id
    })

    // 2. Busca Times na API
    const responseTeams = await fetch(`https://v3.football.api-sports.io/teams?league=${leagueId}&season=${season}`, {
      method: 'GET',
      headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY }
    })
    
    const dataTeams = await responseTeams.json()
    if (dataTeams.errors && Object.keys(dataTeams.errors).length > 0) {
        return NextResponse.json({ error: 'Erro API Times', details: dataTeams.errors }, { status: 500 })
    }

    let apiTeams = dataTeams.response || []

    // --- FILTRAGEM DE TIME ESPECÍFICO ---
    if (specificTeamId) {
        const targetName = idToNameMap[specificTeamId] // Nome do time que queremos (ex: "cruzeiro")
        if (targetName) {
            // Filtra a lista da API para manter APENAS o time que bate com o nome
            apiTeams = apiTeams.filter(item => {
                const apiName = item.team.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                // Verifica match exato ou parcial seguro
                return apiName === targetName || teamMap[apiName] == specificTeamId
            })
            
            if (apiTeams.length === 0) {
                return NextResponse.json({ error: `Não encontrei o time "${targetName}" na API com esse nome.` }, { status: 404 })
            }
        }
    }

    let totalPlayers = 0
    let teamsProcessed = 0

    // 3. Processa Elencos
    for (const item of apiTeams) {
        const apiTeamName = item.team.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        const localTeamId = teamMap[apiTeamName]

        if (localTeamId) {
            // Busca elenco
            const resSquad = await fetch(`https://v3.football.api-sports.io/players/squads?team=${item.team.id}`, {
                headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY }
            })
            const dataSquad = await resSquad.json()
            const squad = dataSquad.response?.[0]?.players || []

            if (squad.length > 0) {
                const playersToInsert = squad.map(p => ({
                    name: p.name,
                    position: p.position,
                    photo_url: p.photo,
                    team_id: localTeamId,
                    competition_id: parseInt(competitionId)
                }))

                // Limpa jogadores antigos desse time nessa competição para evitar duplicação
                await supabase.from('players').delete()
                    .eq('team_id', localTeamId)
                    .eq('competition_id', competitionId)

                const { error } = await supabase.from('players').insert(playersToInsert)
                
                if (!error) {
                    totalPlayers += playersToInsert.length
                    teamsProcessed++
                }
            }
        }
    }

    return NextResponse.json({ 
      success: true, 
      message: `${totalPlayers} jogadores de ${teamsProcessed} time(s) importados.`
    })

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}