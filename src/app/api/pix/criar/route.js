import { MercadoPagoConfig, Payment } from 'mercadopago';
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// Configura o cliente do Mercado Pago com o Token do .env.local
const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });

export async function POST(request) {
  try {
    const cookieStore = await cookies()
    
    // 1. Conecta ao Supabase para verificar quem é o usuário
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          get(name) { return cookieStore.get(name)?.value },
          set(name, value, options) { cookieStore.set({ name, value, ...options }) },
          remove(name, options) { cookieStore.set({ name, value: '', ...options }) },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Usuário não logado' }, { status: 401 })

    // 2. Recebe os dados do Frontend
    const { email, firstName, competitionId } = await request.json()
    
    if (!competitionId) {
        return NextResponse.json({ error: 'Competição não informada' }, { status: 400 })
    }

    // 3. SEGURANÇA: Busca o valor da inscrição no banco de dados
    // Nunca confie no valor enviado pelo frontend, o usuário pode alterar.
    const { data: comp } = await supabase
        .from('competitions')
        .select('entry_fee, name')
        .eq('id', competitionId)
        .single()
    
    if (!comp) {
        return NextResponse.json({ error: 'Competição inválida ou não encontrada' }, { status: 404 })
    }
    
    const valorReal = parseFloat(comp.entry_fee)

    // 4. Cria a preferência de pagamento no Mercado Pago
    const payment = new Payment(client);
    
    const paymentData = {
      body: {
        transaction_amount: valorReal,
        description: `Inscrição: ${comp.name}`,
        payment_method_id: 'pix',
        payer: {
          email: email || user.email,
          first_name: firstName || 'Participante',
        },
        // Metadata é crucial: é como saberemos quem pagou o quê depois
        metadata: {
          user_id: user.id,
          competition_id: competitionId 
        }
      }
    };

    const result = await payment.create(paymentData);

    // 5. Retorna o QR Code para a tela
    return NextResponse.json({
      id: result.id,
      qr_code: result.point_of_interaction.transaction_data.qr_code,
      qr_code_base64: result.point_of_interaction.transaction_data.qr_code_base64,
      status: result.status
    })

  } catch (error) {
    console.error('Erro Pix:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}