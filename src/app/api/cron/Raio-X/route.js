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

    // 2. CONSULTA AO SUPABASE (Busca jogo finalizado e não notificado)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL, 
      process.env.SUPABASE_SERVICE_ROLE_KEY 
    );

    const { data: palpites, error } = await supabase.rpc('get_finished_match_diagnostic');

    if (error) throw new Error(`Erro no Supabase: ${error.message}`);

    if (!palpites || palpites.length === 0) {
      return new Response(JSON.stringify({ message: 'Nenhum jogo recém-finalizado na fila. Cochilando...' }), { status: 200 });
    }

    // Extrai os dados do jogo real
    const gameId = palpites[0].game_id;
    const mandante = palpites[0].mandante;
    const visitante = palpites[0].visitante;
    const golsMandante = palpites[0].gols_mandante;
    const golsVisitante = palpites[0].gols_visitante;
    
    const placarReal = `${mandante} ${golsMandante} x ${golsVisitante} ${visitante}`;

    // 3. A MÁGICA DA RESENHA PÓS-JOGO (Modelo Validado)
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const systemPrompt = `
      Você é um administrador sarcástico, debochado e especialista em futebol de um bolão de WhatsApp.
      O juiz acabou de apitar o final do jogo! 
      
      PLACAR REAL DA PARTIDA: ${placarReal}
      
      Aqui estão os palpites da galera em JSON: ${JSON.stringify(palpites)}.
      
      Sua missão:
      1. Anuncie o fim do jogo e o placar real com empolgação.
      2. Faça um diagnóstico da rodada: exalte (ou chame de cagão/sortudo) quem CRAVOU o placar exato (gols exatos de cada time).
      3. Zoe sem dó quem apostou num placar bizarro, totalmente diferente da realidade ou na zebra errada (cite os nomes e os placares medonhos).
      4. Use formatação do WhatsApp (*negrito*, _itálico_) e emojis de futebol e risadas.
      5. Seja direto, como uma mensagem natural de grupo.
    `;

    const result = await model.generateContent(systemPrompt);
    const textoResenha = result.response.text();

    // 4. O DISPARO E A CONFIRMAÇÃO DA Z-API
    const zapUrl = `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE_ID}/token/${process.env.ZAPI_INSTANCE_TOKEN}/send-text`;

    const zapResponse = await fetch(zapUrl, {
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

    // Se a Z-API der erro (celular desconectado, token inválido, etc), ele para aqui e NÃO atualiza o banco
    if (!zapResponse.ok) {
        throw new Error(`Falha no envio Z-API. Status: ${zapResponse.status}`);
    }

    // 5. CARIMBA O BANCO (Só chega aqui se o zap confirmou)
    const { error: updateError } = await supabase
      .from('games')
      .update({ results_notified: true }) // Usa a coluna nativa que já existe
      .eq('id', gameId);

    if (updateError) throw new Error(`Enviado pro Zap, mas falhou ao atualizar banco: ${updateError.message}`);

    return new Response(JSON.stringify({ 
      message: `Golaço! Diagnóstico do jogo ${gameId} enviado e carimbado no banco.`
    }), { status: 200 });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: 'Erro interno', details: error.message }), { status: 500 });
  }
}