import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const competitionId = searchParams.get('competitionId')

  if (!competitionId) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  try {
    // 1. Pega configurações da API no banco
    const { data: comp } = await supabase
      .from('competitions')
      .select('api_league_id, api_season')
      .eq('id', competitionId)
      .single()

    if (!comp?.api_league_id || !comp?.api_season) {
      return NextResponse.json({ error: 'API não configurada.' }, { status: 404 })
    }

    // 2. Busca jogos na API-Football
    const response = await fetch(`https://v3.football.api-sports.io/fixtures?league=${comp.api_league_id}&season=${comp.api_season}`, {
      method: 'GET',
      headers: {
        'x-apisports-key': process.env.API_FOOTBALL_KEY
      },
      next: { revalidate: 3600 } // Cache de 1h
    })

    const data = await response.json()
    const matches = data.response || []

    // 3. Agrupa por Rodada (Ex: "Round of 16", "Final")
    const grouped = matches.reduce((acc, match) => {
      const round = match.league.round
      if (!acc[round]) acc[round] = []
      acc[round].push(match)
      return acc
    }, {})

    return NextResponse.json({ matches: grouped })

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}