import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'edge';

export async function GET(request) {
  try {
    // 1. FECHADURA DA VERCEL
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response(JSON.stringify({ error: 'Acesso negado. Cron Secret inválido.' }), { status: 401 });
    }

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
      global: { fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }) }
    });

    const { data: palpites, error } = await supabase.rpc('get_match_fim');
    if (error) throw new Error(`Erro DB: ${error.message}`);
    if (!palpites || palpites.length === 0) return new Response(JSON.stringify({ message: 'Nenhum jogo recém-finalizado.' }), { status: 200 });

    const evento = palpites[0];
    const { game_id: gameId, mandante, visitante, gols_mandante, gols_visitante } = evento;
    const placarReal = `${mandante} ${gols_mandante} x ${gols_visitante} ${visitante}`;
    const palpitesDoJogo = palpites.filter(p => p.game_id === gameId);

    // --- 1. SEPARANDO O JOIO DO TRIGO NO JAVASCRIPT ---
    const cravadas = [];
    const iludidos = [];
    
    palpitesDoJogo.forEach(p => {
        const nome = p.nickname || p.nome_exibicao || p.nome || 'Alguém';
        const pts = p.points_awarded || 0;
        
        if (pts >= 10) cravadas.push(nome);
        else if (pts === 0) iludidos.push(nome); // Só zomba de quem ZEROU!
    });

    // --- 2. CÁLCULO DA MONTANHA RUSSA NO RANKING ---
    const { data: activeComp } = await supabase.from('competitions').select('id').eq('is_active', true).single();
    let rankingStats = "";
    
    if (activeComp) {
        const { data: leaderboard } = await supabase.from('leaderboard').select('user_id, nome_exibicao, total_pontos').eq('competition_id', activeComp.id);
        
        if (leaderboard && leaderboard.length > 0) {
            // Monta o "Antes e Depois"
            const usersData = leaderboard.map(user => {
                const palpiteJogo = palpitesDoJogo.find(p => p.user_id === user.user_id);
                const pontosGanhos = palpiteJogo ? (palpiteJogo.points_awarded || 0) : 0;
                return {
                    nome: user.nome_exibicao,
                    pontosAtuais: user.total_pontos,
                    pontosAntes: user.total_pontos - pontosGanhos
                };
            });

            // Ordena o Ranking Velho e o Ranking Novo
            const rankAntes = [...usersData].sort((a, b) => b.pontosAntes - a.pontosAntes);
            const rankDepois = [...usersData].sort((a, b) => b.pontosAtuais - a.pontosAtuais);

            let maiorSalto = { nome: '', posicoes: 0 };
            let maiorQueda = { nome: '', posicoes: 0 };

            // Calcula a diferença de posições
            usersData.forEach(user => {
                const posAntes = rankAntes.findIndex(u => u.nome === user.nome) + 1;
                const posDepois = rankDepois.findIndex(u => u.nome === user.nome) + 1;
                const diff = posAntes - posDepois; // Positivo = Subiu na tabela

                if (diff > maiorSalto.posicoes) maiorSalto = { nome: user.nome, posicoes: diff };
                if (diff < maiorQueda.posicoes) maiorQueda = { nome: user.nome, posicoes: diff };
            });

            rankingStats = `
              - MAIOR SALTO: ${maiorSalto.posicoes > 0 ? `${maiorSalto.nome} subiu ${maiorSalto.posicoes} posições!` : 'Nenhum salto relevante.'}
              - MAIOR QUEDA: ${maiorQueda.posicoes < 0 ? `${maiorQueda.nome} despencou ${Math.abs(maiorQueda.posicoes)} posições!` : 'Nenhuma queda dramática.'}
            `;
        }
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // --- 3. PROMPT ESTRUTURADO PARA O GEMINI ---
    const systemPrompt = `
      Você é o "Rei da Resenha", narrador sarcástico e dono do bolão de WhatsApp (fase mata-mata).
      Fim de papo na arena! O placar final cravado nos 90 minutos foi: *${placarReal}*.
      
      📊 DADOS TRATADOS:
      - Videntes que CRAVARAM o placar: ${cravadas.length > 0 ? cravadas.join(', ') : 'Nenhum mito cravou!'}
      - Iludidos que ZERARAM (erraram tudo): ${iludidos.length > 0 ? iludidos.slice(0, 3).join(', ') + (iludidos.length > 3 ? ' e mais alguns azarados' : '') : 'Todo mundo pontuou algo!'}
      
      🎢 A MONTANHA RUSSA DO RANKING:
      ${rankingStats}
      
      SUA MISSÃO - Crie uma resenha curta, debochada e épica com os seguintes blocos (PROIBIDO usar markdown de listas como '*' ou '-', pule linhas duplas entre blocos e use negrito MAIÚSCULO nos títulos):
      
      1. 🏁 FIM DE PAPO: Informe o placar final como um verdadeiro decreto.
      2. 🔮 OS VIDENTES: Se alguém cravou, trate-os como Deuses intocáveis. Se ninguém cravou, diga que o bolão tá cheio de mortais fracassados.
      3. 🤡 OS ILUDIDOS: Zombe pesadamente de apenas 1 ou 2 nomes da lista de Iludidos. Diga que eles apostaram com a TV desligada. (Lembrando: você SÓ PODE zombar da lista de iludidos, pois todos os outros pontuaram algo e merecem respeito).
      4. 🎢 A MONTANHA RUSSA: Anuncie quem deu o Maior Salto na tabela e elogie. Anuncie quem teve a Maior Queda e dê seus pêsames sarcásticos.
    `;

    // A VASSOURA DE FORMATAÇÃO
    const textoResenha = (await model.generateContent(systemPrompt)).response.text()
      .replace(/\\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[\*\-]\s/g, ''); // Evita marcadores de lista indesejados

    // DISPARO
    const zapRes = await fetch(`https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE_ID}/token/${process.env.ZAPI_TOKEN}/send-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Client-Token': process.env.ZAPI_CLIENT_TOKEN },
      body: JSON.stringify({ phone: process.env.WHATSAPP_GRUPO_ID, message: textoResenha })
    });
    if (!zapRes.ok) throw new Error(`Falha Z-API: ${zapRes.status}`);

    await supabase.from('games').update({ raiox_fim_enviado: true }).eq('id', gameId);

    return new Response(JSON.stringify({ message: `Fim de ${mandante}x${visitante} enviado com sucesso!`, gameId }), { status: 200 });

  } catch (error) {
    console.error("Falha Crítica no Raio-X Fim:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}