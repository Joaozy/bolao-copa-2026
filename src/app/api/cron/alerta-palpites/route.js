import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic' // Nada de cache
export const revalidate = 0 // Garante que o Next.js não guarde dados antigos

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  try {
    console.log('⏰ Iniciando verificação de alertas...')

    // 1. DEFINIR JANELA DE TEMPO (TESTE ATUAL: 120 minutos / 2 horas)
    // DICA: Para produção (Domingo), mude 120 para 60 (1 hora)
    const MINUTOS_ANTECEDENCIA = 120 
    
    const agora = new Date()
    const limiteTempo = new Date(agora.getTime() + MINUTOS_ANTECEDENCIA * 60 * 1000)

    // Busca jogos nesse intervalo que não terminaram
    const { data: jogosProximos } = await supabase
      .from('games')
      .select('id, team_a:teams!team_a_id(name), team_b:teams!team_b_id(name), start_time')
      .gt('start_time', agora.toISOString())
      .lt('start_time', limiteTempo.toISOString())

    if (!jogosProximos || jogosProximos.length === 0) {
      console.log('Nenhum jogo próximo encontrado.')
      return NextResponse.json({ message: `Nenhum jogo começando nos próximos ${MINUTOS_ANTECEDENCIA} min.` })
    }

    // 2. BUSCAR USUÁRIOS ATIVOS E PAGOS
    const { data: usuarios } = await supabase
      .from('profiles')
      .select('id, nickname, whatsapp, full_name')
      .eq('is_active', true)
      .eq('is_paid', true)
      .not('whatsapp', 'is', null) 

    const relatorio = []

    // 3. PARA CADA JOGO, VERIFICA QUEM ESQUECEU
    for (const jogo of jogosProximos) {
      // Busca palpites JÁ FEITOS para esse jogo
      const { data: palpitesFeitos } = await supabase
        .from('bets')
        .select('user_id')
        .eq('game_id', jogo.id)

      const idsQuePalpitaram = palpitesFeitos.map(p => p.user_id)
      const esquecidos = usuarios.filter(u => !idsQuePalpitaram.includes(u.id))

      console.log(`Jogo ${jogo.team_a.name} x ${jogo.team_b.name}: ${esquecidos.length} esquecidos.`)

      // 4. DISPARAR O ALERTA (Integração Z-API Ativa)
      for (const usuario of esquecidos) {
        // Limpeza do número
        let numeroLimpo = usuario.whatsapp.replace(/\D/g, '')
        // Garante formato 55 + DDD + Numero (se tiver menos que 12 digitos, assume BR)
        const telefoneFinal = numeroLimpo.length <= 11 ? `55${numeroLimpo}` : numeroLimpo

        const mensagem = `⚠️ *ALERTA DE BOLÃO* ⚠️\n\nEi ${usuario.nickname || 'Campeão'}! 🏃‍♂️💨\n\nO jogo *${jogo.team_a.name} x ${jogo.team_b.name}* começa em breve e você ainda não palpitou!\n\nCorre lá: https://bolao-copa-final.vercel.app/`

        // --- INTEGRAÇÃO Z-API ---
        const zapiInstanceId = process.env.ZAPI_INSTANCE_ID
        const zapiToken = process.env.ZAPI_TOKEN
        const zapiClientToken = process.env.ZAPI_CLIENT_TOKEN
        
        let resultadoEnvio = "Não configurado"
        let erroDetalhado = null

        if (zapiInstanceId && zapiToken && zapiClientToken) {
            try {
                const response = await fetch(`https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-text`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Client-Token': zapiClientToken
                    },
                    body: JSON.stringify({
                        phone: telefoneFinal,
                        message: mensagem
                    })
                })
                
                const responseData = await response.json()
                
                if (response.ok) {
                    resultadoEnvio = "SUCESSO Z-API"
                } else {
                    resultadoEnvio = "ERRO Z-API"
                    erroDetalhado = responseData 
                }
            } catch (err) {
                resultadoEnvio = "ERRO DE REDE"
                erroDetalhado = err.message
            }
        } else {
            resultadoEnvio = "Faltam credenciais no .env"
        }
        
        relatorio.push({ 
            usuario: usuario.nickname, 
            telefone_usado: telefoneFinal, // Mostra qual numero o robô usou
            jogo: `${jogo.team_a.name} x ${jogo.team_b.name}`, 
            status: resultadoEnvio,
            detalhes: erroDetalhado 
        })
      }
    }

    return NextResponse.json({ 
      sucesso: true, 
      esquecidos_notificados: relatorio 
    })

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}