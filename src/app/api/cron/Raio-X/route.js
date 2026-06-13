import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// 1. TRAVAS ANTI-CACHE GLOBAIS DA VERCEL
export const dynamic = 'force-dynamic';
export const revalidate = 0; 

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (token !== process.env.CRON_SECRET) {
      return new Response(JSON.stringify({ error: 'Acesso negado.' }), { status: 401 });
    }

    // 2. CONEXÃO SUPABASE COM CACHE DESLIGADO À FORÇA
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL, 
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: { persistSession: false },
        global: {
          fetch: (url, options) => {
            return fetch(url, { ...options, cache: 'no-store' }); // Proíbe o Next.js de guardar histórico
          }
        }
      }
    );

    // Chamamos a função nova que criamos no SQL
    const { data: palpites, error } = await supabase.rpc('get_match_events');

    if (error) throw new Error(`Erro no Supabase: ${error.message}`);

    if (!palpites || palpites.length === 0) {
      return new Response(JSON.stringify({ message: 'Nenhum evento (início ou fim) na fila. Cochilando...' }), { status: 200 });
    }

    // Extrai os dados do evento
    const evento = palpites[0];
    const gameId = evento.game_id;
    const tipoEvento = evento.event_type; // 'INICIO' ou 'FIM'
    const mandante = evento.mandante;
    const visitante = evento.visitante;
    const golsMandante = evento.gols_mandante;
    const golsVisitante = evento.gols_visitante;

    // 3. A MÁGICA DA RESENHA (Decide qual prompt usar)
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    let systemPrompt = "";

    if (tipoEvento === 'INICIO') {
        systemPrompt = `
          Você é um locutor de bolão de WhatsApp animado e gente boa. 
          O jogo ${mandante} x ${visitante} acabou de começar!
          
          Aqui estão os palpites: ${JSON.stringify(palpites)}
          
          Sua missão:
          1. Anuncie o início do jogo com empolgação e avise que os palpites estão trancados.
          2. Diga rapidamente quem é o favorito da galera (baseado no volume de apostas).
          3. Brinque levemente com quem apostou numa zebra ou num placar muito elástico.
          4. Seja educado, rápido, use formato do WhatsApp (*negrito*, _itálico_) e emojis de futebol.
        `;
    } else {
        const placarReal = `${mandante} ${golsMandante} x ${golsVisitante} ${visitante}`;
        systemPrompt = `
          Você é um comentarista de bolão de WhatsApp, gente boa e observador.
          O juiz encerrou a partida: ${placarReal}.
          
          Palpites da galera: ${JSON.stringify(palpites)}.
          
          Sua missão:
          1. Informe o placar final de forma clara.
          2. Destaque quem acertou o placar (o "vidente da rodada").
          3. Comente de forma bem-humorada, mas sem exageros, quem passou longe do resultado.
          4. Use emojis, mas de forma moderada.
          5. Seja um "analista de boteco": entendedor, e com tom de deboche de forma humoristica sem ofender ninguem.
        `;
    }

    const result = await model.generateContent(systemPrompt);
    const textoResenha = result.response.text();

    // 4. O DISPARO E A CONFIRMAÇÃO DA Z-API
    const zapUrl = `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE_ID}/token/${process.env.ZAPI_TOKEN}/send-text`;

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

    if (!zapResponse.ok) {
        throw new Error(`Falha no envio Z-API. Status: ${zapResponse.status}`);
    }

    // 5. CARIMBA O BANCO (Dependendo do tipo de evento)
    let updateData = tipoEvento === 'INICIO' 
        ? { raiox_enviado: true } 
        : { results_notified: true };

    const { error: updateError } = await supabase
      .from('games')
      .update(updateData)
      .eq('id', gameId);

    if (updateError) throw new Error(`Enviado pro Zap, mas falhou ao atualizar banco: ${updateError.message}`);

    return new Response(JSON.stringify({ 
      message: `Golaço! Evento de ${tipoEvento} do jogo ${gameId} enviado e carimbado no banco.`
    }), { status: 200 });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: 'Erro interno', details: error.message }), { status: 500 });
  }
}