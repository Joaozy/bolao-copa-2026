import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// 1. TRAVAS ANTI-CACHE GLOBAIS DA VERCEL
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60; 

// Função auxiliar para embaralhar arrays (pegar pessoas aleatórias para zoar)
const pegarExemplosAleatorios = (array, quantidade) => {
    return array.sort(() => 0.5 - Math.random()).slice(0, quantidade);
};

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
        global: { fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }) }
      }
    );

    const { data: palpites, error } = await supabase.rpc('get_match_events');

    if (error) throw new Error(`Erro no Supabase: ${error.message}`);

    if (!palpites || palpites.length === 0) {
      return new Response(JSON.stringify({ message: 'Nenhum evento (início ou fim) na fila. Cochilando...' }), { status: 200 });
    }

    // Extrai os dados base do evento
    const evento = palpites[0];
    const gameId = evento.game_id;
    const tipoEvento = evento.event_type; // 'INICIO' ou 'FIM'
    const mandante = evento.mandante;
    const visitante = evento.visitante;
    const golsMandante = evento.gols_mandante;
    const golsVisitante = evento.gols_visitante;

    // 3. PROCESSAMENTO DE DADOS NO JAVASCRIPT (O cérebro da resenha)
    let resumoParaIA = "";

    if (tipoEvento === 'INICIO') {
        // Estatísticas Pré-Jogo
        let contagemPlacares = {};
        let votosMandante = 0;
        let votosVisitante = 0;
        let votosEmpate = 0;
        let palpitesOusados = []; // Placares elásticos (soma >= 4 gols ou diferença >= 3)

        palpites.forEach(p => {
            const placar = `${p.guess_score_a}x${p.guess_score_b}`;
            contagemPlacares[placar] = (contagemPlacares[placar] || 0) + 1;
            
            if (p.guess_score_a > p.guess_score_b) votosMandante++;
            else if (p.guess_score_b > p.guess_score_a) votosVisitante++;
            else votosEmpate++;
            
            const somaGols = p.guess_score_a + p.guess_score_b;
            const difGols = Math.abs(p.guess_score_a - p.guess_score_b);
            if (somaGols >= 5 || difGols >= 3) {
                 const nome = p.nome_exibicao || 'Anônimo';
                 palpitesOusados.push(`*${nome}* (${placar})`);
            }
        });

        // Placar mais votado
        const placarMaisComum = Object.keys(contagemPlacares).reduce((a, b) => contagemPlacares[a] > contagemPlacares[b] ? a : b);
        
        // Favorito
        let favorito = "Empate";
        if (votosMandante > votosVisitante && votosMandante > votosEmpate) favorito = mandante;
        if (votosVisitante > votosMandante && votosVisitante > votosEmpate) favorito = visitante;

        const listaOusados = palpitesOusados.length > 0 
            ? pegarExemplosAleatorios(palpitesOusados, 3).join(', ') 
            : 'Ninguém (todo mundo jogando no placar seguro)';

        resumoParaIA = `
          - Total de apostas: ${palpites.length}
          - O favorito da galera: ${favorito}
          - Placar mais apostado (efeito manada): ${placarMaisComum}
          - Palpites ousados/Zebras (Exemplos de quem apostou alto): ${listaOusados}
        `;

    } else {
        // Estatísticas Pós-Jogo
        let videntes = [];
        let naTrave = [];
        let iludidos = [];

        const saldoReal = golsMandante - golsVisitante;
        const vencedorReal = Math.sign(saldoReal);

        palpites.forEach(p => {
            const nome = p.nome_exibicao || 'Anônimo';
            const palpiteText = `${p.guess_score_a}x${p.guess_score_b}`;
            const vencedorPalpite = Math.sign(p.guess_score_a - p.guess_score_b);

            if (p.guess_score_a === golsMandante && p.guess_score_b === golsVisitante) {
                videntes.push(`*${nome}*`);
            } else if (vencedorPalpite === vencedorReal) {
                naTrave.push(`*${nome}* (${palpiteText})`);
            } else {
                iludidos.push(`*${nome}* (${palpiteText})`);
            }
        });

        const listaVidentes = videntes.length > 0 
            ? pegarExemplosAleatorios(videntes, 5).join(', ') + (videntes.length > 5 ? ` e mais ${videntes.length - 5} feras` : '') 
            : 'Ninguém (tá todo mundo cego!)';
            
        const listaNaTrave = naTrave.length > 0 ? pegarExemplosAleatorios(naTrave, 3).join(', ') : 'Ninguém';
        const listaIludidos = iludidos.length > 0 ? pegarExemplosAleatorios(iludidos, 3).join(', ') : 'Ninguém';

        resumoParaIA = `
          - Total de palpites: ${palpites.length}
          - "Mestres Videntes" (Cravaram exato): ${listaVidentes}
          - "Bateram na Trave" (Acertaram vencedor, mas erraram placar): Exemplo: ${listaNaTrave}
          - "Os Iludidos/Clubistas" (Erraram tudo): Exemplo de quem zicou: ${listaIludidos}
        `;
    }

    // 4. A MÁGICA DA RESENHA (Prompts Específicos)
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    let systemPrompt = "";

    if (tipoEvento === 'INICIO') {
        systemPrompt = `
          Você é o administrador de um bolão de WhatsApp, estilo "analista de boteco" e animador.
          O jogo *${mandante}* x *${visitante}* acabou de começar!
          
          Aqui estão as estatísticas das apostas da galera:
          ${resumoParaIA}
          
          Sua missão (mensagem curta para WhatsApp):
          1. Anuncie o início do jogo e avise que as apostas estão TRANCADAS 🔒.
          2. Traga uma curiosidade rápida sobre o jogo ou sobre um dos times.
          3. Fale sobre os palpites: revele qual é o favorito da galera, cite o placar mais comum (brincando com o "efeito manada") e, PRINCIPALMENTE, brinque com os nomes citados na lista de "Palpites ousados/Zebras".
          4. Use humor, emojis e formatação (*negrito*). Não faça textos gigantescos.
        `;
    } else {
        const placarReal = `${mandante} ${golsMandante} x ${golsVisitante} ${visitante}`;
        systemPrompt = `
          Você é o narrador sarcástico e divertido do nosso bolão de WhatsApp.
          Fim de papo! O placar final foi: *${placarReal}*.
          
          Resumo do desempenho da galera (USE OS NOMES CITADOS):
          ${resumoParaIA}
          
          Sua missão (seja criativo e direto):
          1. Anuncie o placar final com energia.
          2. Faça uma reverência aos "Mestres Videntes" (cite nomes). Se foi Ninguém, zombe do grupo.
          3. Tire um sarro leve de quem bateu "Na Trave" (cite nomes de exemplo).
          4. Convoque o VAR ou chame de "iludidos/clubistas" a galera que errou feio (cite os nomes da lista de iludidos).
          5. Use emojis e gírias de futebol. Mantenha tom de resenha de amigos.
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