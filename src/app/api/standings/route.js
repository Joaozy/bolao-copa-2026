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
    // 1. Descobre qual é a Liga/Temporada dessa competição
    const { data: comp } = await supabase
      .from('competitions')
      .select('api_league_id, api_season')
      .eq('id', competitionId)
      .single()

    if (!comp?.api_league_id || !comp?.api_season) {
      return NextResponse.json({ error: 'API não configurada para esta competição.' }, { status: 404 })
    }

    // 2. Busca na API-Football
    // Cache de 1 hora (3600s) para não gastar cota a toa, já que tabela muda pouco
    const response = await fetch(`https://v3.football.api-sports.io/standings?league=${comp.api_league_id}&season=${comp.api_season}`, {
      method: 'GET',
      headers: {
        'x-apisports-key': process.env.API_FOOTBALL_KEY
      },
      next: { revalidate: 3600 } 
    })

    const data = await response.json()
    
    // A API retorna as tabelas dentro de response[0].league.standings
    // É um array de arrays (para suportar grupos da Copa, por exemplo)
    const standings = data.response?.[0]?.league?.standings || []

    return NextResponse.json({ standings })

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}