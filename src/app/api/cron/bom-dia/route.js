import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'edge';
export const maxDuration = 60; 

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get('token') !== process.env.CRON_SECRET) {
      return new Response(JSON.stringify({ error: 'Acesso negado.' }), { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL, 
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false }, global: { fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }) } }
    );

    // 1. DATA E FUSO HORÁRIO (Brasil)
    const formatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
    const [dia, mes, ano] = formatter.format(new Date()).split('/');
    const hojeDataStr = `${ano}-${mes}-${dia}`; // Formato YYYY-MM-DD para o banco
    
    const ontemDate = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Sao_Paulo"}));
    ontemDate.setDate(ontemDate.getDate() - 1);
    const [diaO, mesO, anoO] = formatter.format(ontemDate).split('/');

    const inicioHoje = `${ano}-${mes}-${dia}T00:00:00-03:00`;
    const fimHoje = `${ano}-${mes}-${dia}T23:59:59-03:00`;
    const inicioOntem = `${anoO}-${mesO}-${diaO}T00:00:00-03:00`;
    const fimOntem = `${anoO}-${mesO}-${diaO}T23:59:59-03:00`;

    // 2. BUSCA COMPETIÇÃO E TRAVA DE SEGURANÇA
    const { data: comps } = await supabase.from('competitions').select('id, last_bulletin_date').eq('is_active', true).limit(1);
    const comp = comps?.[0];
    
    if (!comp) return new Response(JSON.stringify({ message: 'Nenhuma competição ativa.' }), { status: 200 });
    
    // A MÁGICA DO RETRY: Se já mandou hoje, cancela a operação silenciosamente
    if (comp.last_bulletin_date === hojeDataStr) {
        return new Response(JSON.stringify({ message: 'Boletim de hoje já foi enviado com sucesso mais cedo. Dormindo...' }), { status: 200 });
    }

    // 3. RANKING GERAL (Necessário para pegar os nomes da galera)
    const { data: leaderboard } = await supabase.from('leaderboard').select('*').eq('competition_id', comp.id).order('total_pontos', { ascending: false });

    // 4. ANÁLISE DE ONTEM (Quem mitou e quem afundou)
    const { data: gamesOntem } = await supabase.from('games').select('id').eq('competition_id', comp.id).gte('start_time', inicioOntem).lte('start_time', fimOntem);
    
    let resumoOntem = "Nenhum jogo ocorreu ontem.";
    if (gamesOntem && gamesOntem.length > 0) {
        const gameIdsOntem = gamesOntem.map(g => g.id);
        
        // ATENÇÃO: Verifique se sua coluna de pontos se chama 'points'. Se for 'pontos', altere abaixo.
        const { data: betsOntem } = await supabase.from('bets').select('user_id, points_awarded').in('game_id', gameIdsOntem);
        
        if (betsOntem && betsOntem.length > 0) {
            // Soma os pontos de ontem por usuário
            const pontosPorUsuario = {};
            betsOntem.forEach(bet => {
                if (!pontosPorUsuario[bet.user_id]) pontosPorUsuario[bet.user_id] = 0;
                pontosPorUsuario[bet.user_id] += (bet.points_awarded || 0);
            });

            // Transforma em array e ordena do maior pro menor
            const rankingOntem = Object.entries(pontosPorUsuario)
                .map(([user_id, pts]) => {
                    const userDb = leaderboard?.find(u => u.user_id === user_id);
                    return { nome: userDb?.nome_exibicao || 'Desconhecido', pts };
                })
                .sort((a, b) => b.pts - a.pts);

            const top2 = rankingOntem.slice(0, 2).map(u => `*${u.nome}* (+${u.pts} pts)`).join(', ');
            const bottom2 = rankingOntem.slice(-2).map(u => `*${u.nome}* (+${u.pts} pts)`).join(', ');

            resumoOntem = `[OS MITOS DE ONTEM]\nOs 2 que mais pontuaram: ${top2}\n\n[OS DECEPCIONANTES DE ONTEM]\nOs 2 que menos pontuaram: ${bottom2}`;
        }
    }

    // 5. JOGOS DE HOJE
    const { data: gamesHoje } = await supabase.from('games').select('id, start_time, team_a:teams!team_a_id(name), team_b:teams!team_b_id(name)').eq('competition_id', comp.id).gte('start_time', inicioHoje).lte('start_time', fimHoje).order('start_time', { ascending: true });

    let resumoJogos = "Nenhum jogo agendado para hoje!";
    if (gamesHoje && gamesHoje.length > 0) {
        resumoJogos = gamesHoje.map(g => {
            const horaLocal = new Date(g.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
            return `- *${g.team_a?.name}* x *${g.team_b?.name}* às ${horaLocal}`;
        }).join('\n');
    }

    // 6. RESUMO DO RANKING ATUAL
    let resumoRanking = "Sem dados no ranking.";
    if (leaderboard && leaderboard.length > 0) {
        const top3Text = leaderboard.slice(0, 3).map((u, i) => `${i + 1}º *${u.nome_exibicao}* (${u.total_pontos} pts)`).join('\n');
        const ultimos3 = leaderboard.slice(Math.max(3, leaderboard.length - 3));
        const lanternasText = ultimos3.map(u => {
            const posReal = leaderboard.findIndex(x => x.user_id === u.user_id) + 1;
            return `${posReal}º *${u.nome_exibicao}* (${u.total_pontos} pts)`;
        }).reverse().join('\n');

        resumoRanking = `[OS 3 LÍDERES GERAIS]\n${top3Text}\n\n[OS 3 ÚLTIMOS (LANTERNAS)]\n${lanternasText}`;
    }

    // 7. INTELIGÊNCIA ARTIFICIAL
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const promptSistema = `
      Você é o "Rei da Resenha", organizador de um bolão de WhatsApp de futebol. 
      Sua missão é gerar o boletim matinal focado em engajamento. Seja sarcástico, direto e muito criativo nas piadas.
      
      DADOS REAIS DE HOJE:
      
      RETROSPECTIVA DE ONTEM:
      ${resumoOntem}
      
      JOGOS DE HOJE:
      ${resumoJogos}
      
      RANKING GERAL ATUAL:
      ${resumoRanking}
      
      REGRAS DE FORMATAÇÃO E CONTEÚDO:
      1. PROIBIDO usar Markdown como '#', '##' ou listas. Use apenas quebras de linhas duplas, emojis e texto em MAIÚSCULO em negrito para os títulos (ex: *⚽ JOGOS DE HOJE*).
      2. RETROSPECTIVA: Exalte absurdamente como gênios os 2 que mais pontuaram ontem. Zombe sem dó dos 2 que menos pontuaram. Use os nomes reais passados nos dados.
      3. JOGOS DO DIA: Liste as partidas de hoje. Para CADA jogo, solte uma (e apenas uma) curiosidade real e interessante sobre o confronto ou os países.
      4. RANKING: Faça uma saudação de respeito aos 3 líderes gerais. Dê uma "pedrada" moral e piadas para os 3 últimos colocados da tabela geral.
      5. Mantenha espaçado para facilitar a leitura no celular.
    `;

    const textoBoletim = (await model.generateContent(promptSistema)).response.text()
      .replace(/\\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n');

    // 8. DISPARO Z-API

    const zapUrl = `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE_ID}/token/${process.env.ZAPI_TOKEN}/send-text`;
    // const numeroDestinatario = ""; Para testes
    const zapResponse = await fetch(zapUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Client-Token': process.env.ZAPI_CLIENT_TOKEN },
      body: JSON.stringify({ phone: process.env.WHATSAPP_GRUPO_ID, message: textoBoletim })
    });

    if (!zapResponse.ok) throw new Error(`Falha Z-API. Status: ${zapResponse.status}`);

    // 9. FECHA A TRAVA DE SEGURANÇA (Carimba que hoje já foi)
    // if (numeroDestinatario !== "") {} para testes
    await supabase.from('competitions').update({ last_bulletin_date: hojeDataStr }).eq('id', comp.id);
    

    return new Response(JSON.stringify({ message: 'Bom dia enviado com sucesso e trava ativada!', texto_enviado: textoBoletim }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}