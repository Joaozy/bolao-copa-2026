import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Dicionário atualizado com os nomes EXATOS em inglês do seu banco de dados
const DICIONARIO_BANDEIRAS = {
  'brazil': 'br', 
  'argentina': 'ar', 
  'france': 'fr', 
  'germany': 'de',
  'spain': 'es', 
  'portugal': 'pt', 
  'uruguay': 'uy', 
  'colombia': 'co',
  'netherlands': 'nl', 
  'belgium': 'be', 
  'croatia': 'hr', 
  'usa': 'us',
  'mexico': 'mx', 
  'japan': 'jp', 
  'senegal': 'sn', 
  'morocco': 'ma',
  'switzerland': 'ch', 
  'south korea': 'kr', 
  'canada': 'ca', 
  'ecuador': 'ec',
  'saudi arabia': 'sa', 
  'australia': 'au', 
  'tunisia': 'tn', 
  'qatar': 'qa',
  'iran': 'ir', 
  'england': 'gb-eng', 
  'scotland': 'gb-sct', 
  'paraguay': 'py',
  'south africa': 'za', 
  'haiti': 'ht', 
  'curacao': 'cw', 
  'ivory coast': 'ci',
  'egypt': 'eg', 
  'new zealand': 'nz', 
  'cape verde islands': 'cv', 
  'algeria': 'dz',
  'austria': 'at', 
  'jordan': 'jo', 
  'ghana': 'gh', 
  'panama': 'pa',
  'uzbekistan': 'uz', 
  'norway': 'no', 
  'czech republic': 'cz',
  'bosnia & herzegovina': 'ba', 
  'turkiye': 'tr', 
  'sweden': 'se',
  'iraq': 'iq', 
  'congo dr': 'cd'
}

function normalizarNome(nome) {
  if (!nome) return '';
  // Tira os acentos e joga pra minúsculo para garantir o acerto da chave do dicionário
  return nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (token !== process.env.CRON_SECRET) {
      return new Response(JSON.stringify({ error: 'Acesso negado.' }), { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data: teams, error: fetchError } = await supabase.from('teams').select('id, name')
    if (fetchError) throw new Error(fetchError.message)

    let atualizados = 0
    const relatorio = []

    for (const team of teams) {
      const nomeLimpo = normalizarNome(team.name)
      const codigoCorreto = DICIONARIO_BANDEIRAS[nomeLimpo]

      if (codigoCorreto) {
        const novaUrl = `https://flagcdn.com/w320/${codigoCorreto}.png`

        const { error: updateError } = await supabase
          .from('teams')
          .update({ 
            flag_code: codigoCorreto,
            badge_url: novaUrl
          })
          .eq('id', team.id)

        if (!updateError) {
          atualizados++
          relatorio.push(`✅ ${team.name} corrigido para '${codigoCorreto}'`)
        } else {
          relatorio.push(`❌ Erro no time ${team.name}: ${updateError.message}`)
        }
      } else {
        relatorio.push(`⚠️ ${team.name} ignorado (Clube ou seleção fora da lista).`)
      }
    }

    return new Response(JSON.stringify({ 
      sucesso: true, 
      mensagem: `${atualizados} seleções corrigidas com sucesso!`,
      detalhes: relatorio
    }), { status: 200 })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
}