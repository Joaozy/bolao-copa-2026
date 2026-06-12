import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Força a rota a ser dinâmica para não usar cache na Vercel
export const dynamic = 'force-dynamic'; 

export async function GET(request) {
  try {
    // =======================================================
    // 1. TRAVA DE SEGURANÇA (O Leão de Chácara)
    // =======================================================
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    // Compara o token da URL com a sua variável de ambiente
    if (token !== process.env.CRON_SECRET) {
      return new Response(JSON.stringify({ error: 'Acesso negado. Tá achando que é festa?' }), { 
        status: 401, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    // =======================================================
    // 2. CONSULTA AO SUPABASE (Tem jogo agora?)
    // =======================================================
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL, 
      process.env.SUPABASE_SERVICE_ROLE_KEY // Recomendo a Service Role Key para garantir leitura
    );

    // Chama a função RPC que acabamos de criar no banco
    const { data: palpites, error } = await supabase.rpc('get_upcoming_match_bets');

    if (error) throw new Error(`Erro no Supabase: ${error.message}`);

    // Se o array vier vazio, não tem jogo nos próximos 15 minutos. Pode dormir.
    if (!palpites || palpites.length === 0) {
      return new Response(JSON.stringify({ message: 'Nenhum jogo na agulha. O bot vai tirar um cochilo.' }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    // Extrai o nome do jogo (ex: Canada x Bosnia) do primeiro item do array
    const mandante = palpites[0].mandante;
    const visitante = palpites[0].visitante;
    const jogo = `${mandante} x ${visitante}`;

    // =======================================================
    // 3. A MÁGICA DA RESENHA (Google Gemini)
    // =======================================================
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const systemPrompt = `
      Você é um administrador fanfarrão, sarcástico e especialista em futebol de um bolão de WhatsApp.
      Um jogo vai começar em instantes: ${jogo}.
      
      Aqui estão os palpites da galera em formato JSON: ${JSON.stringify(palpites)}.
      
      Sua missão:
      1. Crie um texto curto e empolgante para mandar no grupo de WhatsApp avisando que o jogo vai começar.
      2. Destaque qual foi o "placar modinha" (o que mais teve votos).
      3. Zoe, com muito humor e deboche, quem apostou em zebras ou placares absurdos (cite o "apelido" da pessoa e o placar).
      4. Use emojis, formatação do WhatsApp (*negrito*) e não invente dados que não estão no JSON.
      5. Seja direto, evite introduções longas.
    `;

    const result = await model.generateContent(systemPrompt);
    const textoResenha = result.response.text();

    // =======================================================
    // 4. O DISPARO (WhatsApp API)
    // =======================================================
    const instanceId = process.env.ZAPI_INSTANCE_ID;
    const instanceToken = process.env.ZAPI_INSTANCE_TOKEN;
    const clientToken = process.env.ZAPI_CLIENT_TOKEN;
    const grupoId = process.env.WHATSAPP_GRUPO_ID; // Aqui entra o 120363427683402567-group

    // A URL exata da Z-API para enviar texto
    const zapUrl = `https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/send-text`;

    await fetch(zapUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': clientToken 
      },
      body: JSON.stringify({
        phone: grupoId,
        message: textoResenha // O texto genial que o Gemini gerou
      })
    });

    return new Response(JSON.stringify({ 
      message: 'Golaço! Resenha gerada e disparada no grupo.',
      textoGerado: textoResenha 
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: 'Deu ruim no VAR', details: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}