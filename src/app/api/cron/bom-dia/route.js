import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// 1. TRAVAS ANTI-CACHE GLOBAIS DA VERCEL
export const dynamic = 'force-dynamic';
export const revalidate = 0; 

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

    // 5. MONTA O RESUMO MASTIGADO PARA A IA
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
        resumoJogos = "Nenhum jogo agendado para hoje! Dia de folga para os jogadores, mas dia de secar os rivais na tabela.";
    }

    let resumoRanking = "Sem dados de ranking suficientes no momento.";
    if (leaderboard && leaderboard.length > 0) {
        const top5 = leaderboard.slice(0, 5).map((u, i) => {
            return `${i + 1}º *${u.nome_exibicao}* (${u.total_pontos} pts | ${u.qtd_cv} Cravadas)`;
        }).join('\n');

        const totalUsers = leaderboard.length;
        const lanternas = leaderboard.slice(Math.max(0, totalUsers - 3)).reverse().map((u, i) => {
            return `${totalUsers - i}º *${u.nome_exibicao}* (${u.total_pontos} pts)`;
        }).join('\n');

        resumoRanking = `
          --- TOP 5 DO BOLÃO (OS ILUMINADOS) ---
          ${top5}

          --- LANTERNAS DO BOLÃO (INIMIGOS DO ACERTO) ---
          ${lanternas}
        `;
    }

    // 6. SOLICITA A GERAÇÃO DO TEXTO AO GEMINI
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const promptSistema = `
      Você é o "Resenheiro do Bolão", o administrador mais bem-humorado, sarcástico e carismático de um grupo de WhatsApp de amigos.
      Sua missão é enviar o boletim matinal oficial do dia.
      
      Aqui estão as informações reais extraídas do nosso sistema:
      
      [JOGOS DE HOJE]
      ${resumoJogos}
      
      [SITUAÇÃO DA TABELA DO BOLÃO]
      ${resumoRanking}
      
      Sua missão (Seja criativo, engraçado e direto):
      1. Dê um bom dia animado e zoeiro para o grupo.
      2. Apresente os jogos de hoje. Para CADA jogo listado, invente ou traga uma curiosidade engraçada, boba ou estatística sarcástica.
      3. Analise o Ranking do Bolão com piadas:
         - Exalte os líderes do TOP 5 (chame de videntes, cheios de sorte).
         - Martele e tire muito sarro dos Lanternas citados.
      4. Faça um aviso final lembrando a todos de salvarem seus palpites antes que o primeiro jogo do dia comece.
      5. Use emoticons de futebol, cerveja, óculos escuros, risadas e a formatação do WhatsApp (*negrito*, _itálico_).
      6. Mantenha o texto dinâmico e bem espaçado (nada de blocos gigantes).
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
        // 👇 ALTERAÇÃO AQUI PARA O SEU TESTE 👇
        phone: "5579991159138", // Troque pelos seus números reais (55 + DDD + Número)
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