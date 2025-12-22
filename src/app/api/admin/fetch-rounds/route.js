import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const leagueId = searchParams.get('leagueId')
  const season = searchParams.get('season')

  if (!leagueId || !season) {
    return NextResponse.json({ error: 'ID da Liga e Temporada são obrigatórios.' }, { status: 400 })
  }

  try {
    const response = await fetch(`https://v3.football.api-sports.io/fixtures/rounds?league=${leagueId}&season=${season}`, {
      method: 'GET',
      headers: {
        'x-apisports-key': process.env.API_FOOTBALL_KEY
      },
      cache: 'no-store'
    })

    const data = await response.json()

    if (data.errors && Object.keys(data.errors).length > 0) {
      return NextResponse.json({ error: 'Erro na API Externa', details: data.errors }, { status: 500 })
    }

    return NextResponse.json({ rounds: data.response || [] })

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}