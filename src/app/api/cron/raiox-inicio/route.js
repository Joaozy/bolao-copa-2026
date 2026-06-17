import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'edge';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get('token') !== process.env.CRON_SECRET) {
      return new Response(JSON.stringify({ error: 'Acesso negado.' }), { status: 401 });
    }

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
      global: { fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }) }
    });

    // Chama a nova função isolada de INÍCIO
    const { data: palpites, error } = await supabase.rpc('get_match_inicio');
    if (error) throw new Error(`Erro DB: ${error.message}`);
    if (!palpites || palpites.length === 0) return new Response(JSON.stringify({ message: 'Nenhum jogo iniciando.' }), { status: 200 });

    const evento = palpites[0];
    const { game_id: gameId, mandante, visitante } = evento;
    const palpitesDoJogo = palpites.filter(p => p.game_id === gameId);
    
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const systemPrompt = `
      Você é o "Rei da Resenha", o administrador sarcástico de um bolão de WhatsApp.
      A bola acabou de rolar para *${mandante}* x *${visitante}*!
      
      📋 DADOS DOS PALPITES (${palpitesDoJogo.length} apostas):
      ${JSON.stringify(palpitesDoJogo)}
      
      SUA MISSÃO:
      1. 📢 Grite que começou e que as apostas estão TRANCADAS 🔒.
      2. 🤓 Solte uma curiosidade real sobre o confronto.
      3. 📊 Descubra o placar mais apostado (zombe do efeito manada).
      4. 🦓 Vasculhe os palpites e zombe dos nomes reais de quem fez palpites absurdos.
      5. ⚠️ Use apenas *negrito* e _itálico_. Não use hashtags (#). Use gírias raiz.
    `;

    const textoResenha = (await model.generateContent(systemPrompt)).response.text();

    const zapRes = await fetch(`https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE_ID}/token/${process.env.ZAPI_TOKEN}/send-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Client-Token': process.env.ZAPI_CLIENT_TOKEN },
      body: JSON.stringify({ phone: process.env.WHATSAPP_GRUPO_ID, message: textoResenha })
    });
    if (!zapRes.ok) throw new Error(`Falha Z-API: ${zapRes.status}`);

    await supabase.from('games').update({ raiox_enviado: true }).eq('id', gameId);

    return new Response(JSON.stringify({ message: `Início de ${mandante}x${visitante} enviado!`, gameId }), { status: 200 });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}