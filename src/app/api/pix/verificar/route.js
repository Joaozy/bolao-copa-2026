import { MercadoPagoConfig, Payment } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });

export async function POST(request) {
  try {
    const { paymentId } = await request.json()
    console.log('Verificando Pix:', paymentId)
    
    const payment = new Payment(client);
    const paymentInfo = await payment.get({ id: paymentId });
    
    if (paymentInfo.status === 'approved') {
        const userId = paymentInfo.metadata.user_id;
        const competitionId = paymentInfo.metadata.competition_id; // <--- LÊ O ID DA COMPETIÇÃO

        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        )

        // ATUALIZA A TABELA DE INSCRIÇÕES (ENROLLMENTS)
        const { error } = await supabaseAdmin
            .from('enrollments')
            .update({ is_paid: true })
            .eq('user_id', userId)
            .eq('competition_id', competitionId) // Garante que paga a certa
        
        if (error) {
            console.error('Erro banco:', error)
            return NextResponse.json({ error: 'Erro ao atualizar banco' }, { status: 500 })
        }

        return NextResponse.json({ status: 'approved', message: 'Pagamento confirmado!' })
    }

    return NextResponse.json({ status: paymentInfo.status, message: 'Pendente.' })

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}