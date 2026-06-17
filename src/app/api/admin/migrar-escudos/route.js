import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    // Segurança para ninguém chover na sua API
    if (token !== process.env.CRON_SECRET) {
      return new Response(JSON.stringify({ error: 'Acesso negado.' }), { status: 401 })
    }

    // Conecta no Supabase usando o servidor da Vercel (que está livre de bloqueios)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // 1. Pega todos os times do banco
    const { data: teams, error: fetchError } = await supabase
      .from('teams')
      .select('id, name, flag_code')

    if (fetchError) throw new Error(fetchError.message)

    let atualizados = 0
    const relatorio = []

    // 2. Atualiza o badge_url de cada um usando a CDN gratuita da FlagCDN
    for (const team of teams) {
      if (team.flag_code) {
        const codigoBandeira = team.flag_code.toLowerCase()
        const novaUrl = `https://flagcdn.com/w320/${codigoBandeira}.png`

        const { error: updateError } = await supabase
          .from('teams')
          .update({ badge_url: novaUrl })
          .eq('id', team.id)

        if (!updateError) {
          atualizados++
          relatorio.push(`✅ ${team.name} atualizado para FlagCDN`)
        } else {
          relatorio.push(`❌ Erro no time ${team.name}: ${updateError.message}`)
        }
      } else {
        relatorio.push(`⏭️ ${team.name} pulado (sem flag_code no banco)`)
      }
    }

    return new Response(JSON.stringify({ 
      sucesso: true, 
      mensagem: `${atualizados} times migrados para a CDN gratuita com sucesso!`,
      detalhes: relatorio
    }), { status: 200 })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
}