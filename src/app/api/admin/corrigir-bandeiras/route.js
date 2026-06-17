import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Dicionário mapeando o nome em português para o código oficial da FlagCDN
const DICIONARIO_BANDEIRAS = {
  'brasil': 'br', 'argentina': 'ar', 'franca': 'fr', 'alemanha': 'de',
  'espanha': 'es', 'portugal': 'pt', 'uruguai': 'uy', 'colombia': 'co',
  'italia': 'it', 'holanda': 'nl', 'belgica': 'be', 'croacia': 'hr',
  'estados unidos': 'us', 'eua': 'us', 'mexico': 'mx', 'japao': 'jp',
  'senegal': 'sn', 'marrocos': 'ma', 'suica': 'ch', 'camaroes': 'cm',
  'servia': 'rs', 'polonia': 'pl', 'gana': 'gh', 'coreia do sul': 'kr',
  'canada': 'ca', 'equador': 'ec', 'arabia saudita': 'sa', 'australia': 'au',
  'tunisia': 'tn', 'costa rica': 'cr', 'catar': 'qa', 'ira': 'ir',
  'inglaterra': 'gb-eng', 'pais de gales': 'gb-wls', 'chile': 'cl',
  'peru': 'pe', 'venezuela': 've', 'paraguai': 'py', 'bolivia': 'bo',
  'dinamarca': 'dk', 'suecia': 'se', 'noruega': 'no', 'escocia': 'gb-sct'
}

// Função para tirar acentos e deixar minúsculo (ex: "França" vira "franca")
function normalizarNome(nome) {
  if (!nome) return '';
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

    // 1. Pega os times com o nome
    const { data: teams, error: fetchError } = await supabase.from('teams').select('id, name')
    if (fetchError) throw new Error(fetchError.message)

    let atualizados = 0
    const relatorio = []

    // 2. Compara o nome com o dicionário e conserta o banco
    for (const team of teams) {
      const nomeLimpo = normalizarNome(team.name)
      const codigoCorreto = DICIONARIO_BANDEIRAS[nomeLimpo]

      if (codigoCorreto) {
        const novaUrl = `https://flagcdn.com/w320/${codigoCorreto}.png`

        const { error: updateError } = await supabase
          .from('teams')
          .update({ 
            flag_code: codigoCorreto, // Arruma a raiz do problema
            badge_url: novaUrl        // Coloca a imagem certa
          })
          .eq('id', team.id)

        if (!updateError) {
          atualizados++
          relatorio.push(`✅ ${team.name} corrigido para '${codigoCorreto}'`)
        } else {
          relatorio.push(`❌ Erro no time ${team.name}: ${updateError.message}`)
        }
      } else {
        relatorio.push(`⚠️ ${team.name} não encontrado no dicionário. Ficou sem alteração.`)
      }
    }

    return new Response(JSON.stringify({ 
      sucesso: true, 
      mensagem: `${atualizados} bandeiras corrigidas com sucesso! Adeus Brasil para todos.`,
      detalhes: relatorio
    }), { status: 200 })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
}