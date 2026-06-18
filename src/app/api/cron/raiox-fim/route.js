import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'edge';

export async function GET(request) {
  try {
    // 1. NOVA FECHADURA DA VERCEL (Lê o Header invisível do Cron)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response(JSON.stringify({ error: 'Acesso negado. Cron Secret inválido.' }), { status: 401 });
    }

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
      global: { fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }) }
    });

    // Chama a nova função isolada de FIM
    const { data: palpites, error } = await supabase.rpc('get_match_fim');
    if (error) throw new Error(`Erro DB: ${error.message}`);
    if (!palpites || palpites.length === 0) return new Response(JSON.stringify({ message: 'Nenhum jogo recém-finalizado.' }), { status: 200 });

    const evento = palpites[0];
    const { game_id: gameId, mandante, visitante, gols_mandante, gols_visitante } = evento;
    const placarReal = `${mandante} ${gols_mandante} x ${gols_visitante} ${visitante}`;
    const palpitesDoJogo = palpites.filter(p => p.game_id === gameId);
    
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const systemPrompt = `
      Você é o "Rei da Resenha", narrador sarcástico do bolão de WhatsApp.
      Fim de papo! O placar final foi: *${placarReal}*.
      
      📋 PALPITES:
      ${JSON.stringify(palpitesDoJogo)}
      
      SUA MISSÃO:
      1. 🏁 Informe o placar final com energia.
      2. 🔮 OS VIDENTES: Encontre e exalte os nomes reais de TODOS que acertaram o placar exato (${gols_mandante}x${gols_visitante}). Se ninguém acertou, zombe geral.
      3. 🤡 OS ILUDIDOS: Zombe pesado de alguns nomes reais que erraram feio.
      4. ⚠️ Use emojis, *negrito* e gírias raiz. Sem hashtags (#).
    `;

    // 2. A VASSOURA DE FORMATAÇÃO (Limpa os \n perdidos)
    const textoResenha = (await model.generateContent(systemPrompt)).response.text()
      .replace(/\\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n');

    const zapRes = await fetch(`https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE_ID}/token/${process.env.ZAPI_TOKEN}/send-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Client-Token': process.env.ZAPI_CLIENT_TOKEN },
      body: JSON.stringify({ phone: process.env.WHATSAPP_GRUPO_ID, message: textoResenha })
    });
    if (!zapRes.ok) throw new Error(`Falha Z-API: ${zapRes.status}`);

    await supabase.from('games').update({ raiox_fim_enviado: true }).eq('id', gameId);

    return new Response(JSON.stringify({ message: `Fim de ${mandante}x${visitante} enviado!`, gameId }), { status: 200 });

  } catch (error) {
    // 3. RASTREADOR DE ERROS (Grava a falha nos logs da Vercel)
    console.error("Falha Crítica no Raio-X Fim:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
