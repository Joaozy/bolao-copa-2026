import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// 1. TRAVAS ANTI-CACHE GLOBAIS DA VERCEL
export const dynamic = 'force-dynamic';
export const revalidate = 0; 

// Função auxiliar para embaralhar arrays (pegar pessoas aleatórias do meio da tabela)
const pegarExemplosAleatorios = (array, quantidade) => {
    return array.sort(() => 0.5 - Math.random()).slice(0, quantidade);
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    // Validação de segurança do Cron
    if (token !== process.env.CRON_SECRET) {
      return new Response(JSON.stringify({ error: 'Acesso negado.' }), { status: 401 });
    }

    // 2. CONEXÃO SUPABASE (Sem cache)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL, 
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: { persistSession: false },
        global: { fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }) }
      }
    );

    // A. Busca a competição ativa
    const { data: comps } = await supabase
      .from('competitions')
      .select('id')
      .eq('is_active', true)
      .limit(1);

    const compId = comps?.[0]?.id;
    if (!compId) {
        return new Response(JSON.stringify({ message: 'Nenhuma competição ativa encontrada.' }), { status: 200 });
    }

    // 3. BUSCA OS JOGOS DO DIA ATUAL
    const agora = new Date();
    const inicioDia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0).toISOString();
    const fimDia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59).toISOString();

    const { data: gamesHoje } = await supabase
      .from('games')
      .select(`
        id, start_time, round,
        team_a:teams!team_a_id(name),
        team_b:teams!team_b_id(name)
      `)
      .eq('competition_id', compId)
      .gte('start_time', inicioDia)
      .lte('start_time', fimDia)
      .order('start_time', { ascending: true });

    // 4. BUSCA O RANKING DO BOLÃO
    const { data: leaderboard } = await supabase
      .from('leaderboard')
      .select('*')
      .eq('competition_id', compId)
      .order('total_pontos', { ascending: false });

    // 5. MONTA O RESUMO MASTIGADO COM A NOVA LÓGICA DE FILTRAGEM
    let resumoJogos = "";
    if (gamesHoje && gamesHoje.length > 0) {
        resumoJogos = gamesHoje.map(g => {
            const horaLocal = new Date(g.start_time).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'America/Sao_Paulo'
            });
            return `- *${g.team_a?.name}* x *${g.team_b?.name}* às ${horaLocal}`;
        }).join('\n');
    } else {
        resumoJogos = "Nenhum jogo agendado para hoje!";
    }

    let resumoRanking = "Sem dados suficientes no ranking.";
    if (leaderboard && leaderboard.length > 0) {
        const totalUsers = leaderboard.length;

        // A. Os 3 Primeiros
        const top3Text = leaderboard.slice(0, 3).map((u, i) => {
            return `${i + 1}º *${u.nome_exibicao}* (${u.total_pontos} pts)`;
        }).join('\n');

        // B. Os 3 Últimos (Lanternas)
        const ultimos3 = leaderboard.slice(Math.max(3, totalUsers - 3));
        const lanternasText = ultimos3.map(u => {
            const posReal = leaderboard.findIndex(x => x.user_id === u.user_id) + 1;
            return `${posReal}º *${u.nome_exibicao}* (${u.total_pontos} pts)`;
        }).reverse().join('\n');

        // C. Sorteio de 3 jogadores do Meio de Tabela (Limbo)
        const inicioMeio = 3;
        const fimMeio = Math.max(3, totalUsers - 3);
        const poolMeio = leaderboard.slice(inicioMeio, fimMeio);
        
        const sorteadosMeio = pegarExemplosAleatorios(poolMeio, 3);
        const meioText = sorteadosMeio.map(u => {
            const posReal = leaderboard.findIndex(x => x.user_id === u.user_id) + 1;
            return `${posReal}º *${u.nome_exibicao}* (${u.total_pontos} pts)`;
        }).join('\n');

        resumoRanking = `
          [OS 3 PRIMEIROS COLOCADOS]
          ${top3Text}

          [3 PARTICIPANTES DO MEIO DA TABELA]
          ${meioText || 'Nenhum jogador no meio termo.'}

          [OS 3 ÚLTIMOS COLOCADOS]
          ${lanternasText}
        `;
    }

    // 6. SOLICITA A GERAÇÃO DO TEXTO AO GEMINI
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const promptSistema = `
      Você é o organizador oficial de um grupo de bolão de WhatsApp de futebol. Seu tom é carismático, limpo e direto.
      Sua missão é gerar o boletim diário focado em engajamento dos membros.
      
      Aqui estão as informações reais do banco de dados:
      
      JOGOS DE HOJE:
      ${resumoJogos}
      
      SITUAÇÃO DO RANKING:
      ${resumoRanking}
      
      REGRAS CRÍTICAS DE FORMATAÇÃO E CONTEÚDO:
      1. PROIBIDO usar títulos em Markdown como '#', '##', '-' para seções ou listas numeradas complexas. Use apenas quebras de linhas duplas para dar espaço, emojis e palavras em MAIÚSCULO em negrito para dividir o texto (ex: *⚽ JOGOS DE HOJE*).
      2. JOGOS DO DIA: Liste as partidas de hoje. Para CADA jogo, traga uma curiosidade REAL, rápida e interessante sobre o confronto histórico das duas seleções ou sobre a cultura/futebol de um dos países. NÃO FAÇA PIADAS NESTA PARTE. Seja puramente informativo e interessante.
      3. RESENHA DO RANKING: Aqui sim você usará humor inteligente e sarcasmo de grupo de amigos:
         - Faça uma breve exaltação aos 3 primeiros (Os líderes espirituais).
         - Dê um empurrão moral ou faça uma brincadeira com os 3 sorteados do meio de tabela (Os invisíveis, nem sobem nem descem).
         - Zombe amigavelmente dos 3 últimos colocados (Inimigos da previsão do tempo, lanternas oficiais).
         - Sempre cite nominalmente as pessoas fornecidas no resumo.
      4. Mantenha a mensagem compacta, bem espaçada e perfeitamente legível na tela de um celular.
    `;

    const result = await model.generateContent(promptSistema);
    const textoBoletim = result.response.text();

    // 7. DISPARO VIA Z-API
    const zapUrl = `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE_ID}/token/${process.env.ZAPI_TOKEN}/send-text`;
    
    const zapResponse = await fetch(zapUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': process.env.ZAPI_CLIENT_TOKEN 
      },
      body: JSON.stringify({
        phone: process.env.WHATSAPP_GRUPO_ID, // 🔄 Retornado para o ID do grupo oficial
        message: textoBoletim
      })
    });

    if (!zapResponse.ok) {
        throw new Error(`Falha Z-API ao enviar Bom Dia. Status: ${zapResponse.status}`);
    }

    return new Response(JSON.stringify({ message: 'Boletim matinal enviado com sucesso!' }), { status: 200 });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: 'Erro interno', details: error.message }), { status: 500 });
  }
}