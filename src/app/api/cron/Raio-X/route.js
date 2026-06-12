import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic'; 

export async function GET(request) {
  try {
    // 1. TRAVA DE SEGURANÇA
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (token !== process.env.CRON_SECRET) {
      return new Response(JSON.stringify({ error: 'Acesso negado.' }), { status: 401 });
    }

    // 2. CONSULTA AO SUPABASE
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL, 
      process.env.SUPABASE_SERVICE_ROLE_KEY 
    );

    // Chama a NOVA função que busca os jogos que já começaram e não foram enviados
    const { data: palpites, error } = await supabase.rpc('get_started_match_bets');

    if (error) throw new Error(`Erro no Supabase: ${error.message}`);

    if (!palpites || palpites.length === 0) {
      return new Response(JSON.stringify({ message: 'Nenhum jogo rolando que já não tenha sido enviado. Cochilando...' }), { status: 200 });
    }

    // Extrai os dados do primeiro palpite retornado
    const gameId = palpites[0].game_id;
    const mandante = palpites[0].mandante;
    const visitante = palpites[0].visitante;
    const jogo = `${mandante} x ${visitante}`;

    // 3. A MÁGICA DA RESENHA
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });

    const systemPrompt = `
      Você é um administrador fanfarrão de um bolão de WhatsApp.
      A BOLA ACABOU DE ROLAR para o jogo: ${jogo}. Os palpites estão travados!
      
      Aqui estão os palpites em JSON: ${JSON.stringify(palpites)}.
      
      Missão:
      1. Crie um texto empolgante dizendo que a bola rolou e os mercados fecharam.
      2. Destaque o "placar modinha" da galera.
      3. Zoe (com apelido e placar) quem fez apostas malucas/zebras.
      4. Use formato de WhatsApp.
    `;

    const result = await model.generateContent(systemPrompt);
    const textoResenha = result.response.text();

    // 4. O DISPARO (Z-API)
    const zapUrl = `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE_ID}/token/${process.env.ZAPI_INSTANCE_TOKEN}/send-text`;

    await fetch(zapUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': process.env.ZAPI_CLIENT_TOKEN 
      },
      body: JSON.stringify({
        phone: process.env.WHATSAPP_GRUPO_ID,
        message: textoResenha
      })
    });

    // =======================================================
    // 5. CARIMBA O BANCO (NOVIDADE!)
    // =======================================================
    // Atualiza a coluna raiox_enviado para TRUE nesse jogo específico
    const { error: updateError } = await supabase
      .from('games')
      .update({ raiox_enviado: true })
      .eq('id', gameId);

    if (updateError) throw new Error(`Mensagem enviada, mas erro ao atualizar status do jogo: ${updateError.message}`);

    return new Response(JSON.stringify({ 
      message: `Sucesso! Resenha do jogo ID ${gameId} disparada e marcada como enviada.`
    }), { status: 200 });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: 'Erro interno', details: error.message }), { status: 500 });
  }
}