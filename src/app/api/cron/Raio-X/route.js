import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// 1. TRAVAS E CONFIGURAÇÕES DA VERCEL
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60; // 👈 Tempo estendido para garantir que a IA analise todos os palpites com calma

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (token !== process.env.CRON_SECRET) {
      return new Response(JSON.stringify({ error: 'Acesso negado.' }), { status: 401 });
    }

    // 2. CONEXÃO SUPABASE
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL, 
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: { persistSession: false },
        global: { fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }) }
      }
    );

    // O RPC já traz os dados e os palpites SOMENTE do jogo em questão
    const { data: palpites, error } = await supabase.rpc('get_match_events');

    if (error) throw new Error(`Erro no Supabase: ${error.message}`);

    if (!palpites || palpites.length === 0) {
      return new Response(JSON.stringify({ message: 'Nenhum evento (início ou fim) na fila.' }), { status: 200 });
    }

    // Extrai os dados do jogo atual
    const evento = palpites[0];
    const gameId = evento.game_id;
    const tipoEvento = evento.event_type; // 'INICIO' ou 'FIM'
    const mandante = evento.mandante;
    const visitante = evento.visitante;
    const golsMandante = evento.gols_mandante;
    const golsVisitante = evento.gols_visitante;

    // 3. MONTA A LISTA COMPLETA DE PALPITES (A IA vai ler tudo)
    // Formato: "- João: 2x1", "- Maria: 0x0"
    const listaTodosPalpites = palpites.map(p => 
        `- ${p.nome_exibicao || 'Anônimo'}: ${p.guess_score_a}x${p.guess_score_b}`
    ).join('\n');

    // 4. A MÁGICA DA RESENHA (A IA faz a análise dos dados)
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    let systemPrompt = "";

    if (tipoEvento === 'INICIO') {
        systemPrompt = `
          Você é o "Rei da Resenha", o administrador sarcástico e zoeiro de um bolão de WhatsApp.
          A bola acabou de rolar para *${mandante}* x *${visitante}*!
          
          📋 LISTA COMPLETA DOS PALPITES (Total: ${palpites.length} apostas):
          ${listaTodosPalpites}
          
          SUA MISSÃO (Texto direto, formatado para WhatsApp):
          1. 📢 ANÚNCIO: Grite que começou e que as apostas estão TRANCADAS 🔒.
          2. 🤓 CURIOSIDADE: Solte uma (e apenas uma) curiosidade real e interessante sobre o confronto ou um dos países.
          3. 📊 ANÁLISE DOS PALPITES: Analise toda a lista acima. Revele qual foi o placar mais apostado pela galera (zombe do "efeito manada") e qual time é o favorito do grupo.
          4. 🦓 LOUCURAS E ZEBRAS: Vasculhe a lista e encontre os palpites mais diferentes, elásticos ou improváveis. Cite os nomes dessas pessoas e zombe da coragem (ou loucura) delas! Se todo mundo foi em placar chato (1x0, 1x1), zombe da falta de ousadia.
          5. ⚠️ REGRAS: Use apenas *negrito* e _itálico_ para destacar nomes e times. Não use hashtags (#). Use gírias de futebol raiz (bagre, retranca, zica).
        `;
    } else {
        const placarReal = `${mandante} ${golsMandante} x ${golsVisitante} ${visitante}`;
        systemPrompt = `
          Você é o "Rei da Resenha", o narrador sarcástico e zoeiro do nosso bolão de WhatsApp.
          Fim de papo! O placar final oficial foi: *${placarReal}*.
          
          📋 LISTA COMPLETA DOS PALPITES QUE A GALERA FEZ:
          ${listaTodosPalpites}
          
          SUA MISSÃO (Seja criativo, engraçado e direto):
          1. 🏁 ANÚNCIO: Informe o placar final com energia.
          2. 🔮 OS VIDENTES: Olhe a lista e encontre TODOS os participantes que acertaram EXATAMENTE o placar de ${golsMandante}x${golsVisitante}. Cite-os nominalmente e exalte-os como mestres. Se absolutamente ninguém acertou, chame o grupo de "cego" e "chutadores de vento".
          3. 🤡 OS ILUDIDOS E QUASE-LÁ: Escolha alguns nomes da lista que erraram o ganhador de forma bizarra para zombar pesado. Depois, cite alguns que "bateram na trave" (quase acertaram).
          4. ⚠️ REGRAS: Use emojis, gírias de futebol raiz e formatação do WhatsApp (*negrito*). Proibido usar hashtags (#).
        `;
    }

    const result = await model.generateContent(systemPrompt);
    const textoResenha = result.response.text();

    // 5. O DISPARO Z-API
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

    if (!zapResponse.ok) throw new Error(`Falha Z-API. Status: ${zapResponse.status}`);

    // 6. CARIMBA O BANCO
    let updateData = tipoEvento === 'INICIO' ? { raiox_enviado: true } : { results_notified: true };
    const { error: updateError } = await supabase.from('games').update(updateData).eq('id', gameId);

    if (updateError) throw new Error(`Falha banco: ${updateError.message}`);

    return new Response(JSON.stringify({ message: `Golaço! Evento de ${tipoEvento} enviado.` }), { status: 200 });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: 'Erro interno', details: error.message }), { status: 500 });
  }
}