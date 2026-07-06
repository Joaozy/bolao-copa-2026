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

    // Chama a função do banco focada no INÍCIO do jogo
    const { data: palpites, error } = await supabase.rpc('get_match_inicio');
    if (error) throw new Error(`Erro DB: ${error.message}`);
    if (!palpites || palpites.length === 0) return new Response(JSON.stringify({ message: 'Nenhum jogo prestes a começar.' }), { status: 200 });

    const evento = palpites[0];
    const { game_id: gameId, mandante, visitante } = evento;
    const palpitesDoJogo = palpites.filter(p => p.game_id === gameId);
    
    // --- LÓGICA DE ESTATÍSTICAS (Feita no JS para o Gemini não errar a conta) ---
    let apostasMandante = 0, apostasVisitante = 0, apostasEmpate = 0;
    let nomesMandante = [], nomesVisitante = [], nomesEmpate = [];

    palpitesDoJogo.forEach(p => {
        const ga = p.guess_score_a;
        const gb = p.guess_score_b;
        const nome = p.nickname || p.nome_exibicao || p.nome || 'Alguém';
        
        if (ga > gb) { apostasMandante++; nomesMandante.push(nome); }
        else if (ga < gb) { apostasVisitante++; nomesVisitante.push(nome); }
        else { apostasEmpate++; nomesEmpate.push(nome); }
    });

    const totalApostas = palpitesDoJogo.length;
    const resumoEstatisticas = `
      - Total de apostas: ${totalApostas}
      - Apostaram na vitória de ${mandante}: ${apostasMandante} pessoas (Ex: ${nomesMandante.slice(0,3).join(', ')}...)
      - Apostaram na vitória de ${visitante}: ${apostasVisitante} pessoas (Ex: ${nomesVisitante.slice(0,3).join(', ')}...)
      - Apostaram no Empate (decisão nos pênaltis): ${apostasEmpate} pessoas (Ex: ${nomesEmpate.slice(0,3).join(', ')}...)
    `;
    // -----------------------------------------------------------------------------

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // NOVO PROMPT ÉPICO E ESTATÍSTICO
    const systemPrompt = `
      Você é o "Rei da Resenha", o imperador sarcástico e analista tático do nosso bolão de WhatsApp.
      A bola vai rolar agora para: *${mandante} x ${visitante}* pelo Mata-Mata da Copa do Mundo 2026!
      
      DADOS DAS APOSTAS DA NOSSA GALERA:
      ${resumoEstatisticas}
      
      SUA MISSÃO - Crie um texto épico, informativo e debochado seguindo EXATAMENTE esta estrutura (PROIBIDO usar markdown de listas como '*' ou '-'):
      
      1. ⚔️ SANGUE NA ARENA: Anuncie o início do jogo criando um clima absurdo de tensão. Lembre a todos, em tom de esporro, que para o bolão SÓ CONTA O PLACAR DOS 90 MINUTOS (prorrogação e pênaltis não dão ponto pra ninguém).
      
      2. 📊 O VAR DAS APOSTAS: Analise as estatísticas que te passei. Zombe da galera que apostou no azarão (cite 1 ou 2 nomes reais passados nos dados). Se muita gente apostou no empate, chame-os de "covardes que ficaram em cima do muro esperando os pênaltis". Se tiver um lado muito favorito, diga que a galera foi "Maria vai com as outras".
      
      3. 🕵️ RAIO-X DO CONFRONTO: Faça uma análise tática de botequim. Aponte quem é o verdadeiro favorito, cite 1 ou 2 jogadores destaques reais de cada país que podem decidir o jogo, e lembre a todos o que tá em jogo (Ex: Quem vencer hoje sobrevive pra pegar uma pedreira nas Quartas de Final).
      
      4. 🧠 CULTURA INÚTIL: Para quebrar o gelo da tensão, solte uma curiosidade aleatória, histórica e muito bizarra sobre o país ${mandante} e outra sobre o país ${visitante}. (Exemplo: comida estranha, lei bizarra, história medieval).

      Use parágrafos curtos. Pule sempre uma linha em branco entre os blocos. NUNCA use marcadores de lista (* ou -). Os títulos devem estar em NEGRITO e MAIÚSCULO com emojis.
    `;

    // 2. A VASSOURA DE FORMATAÇÃO
    const textoResenha = (await model.generateContent(systemPrompt)).response.text()
      .replace(/\\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[\*\-]\s/g, ''); // Remove qualquer teimosia da IA de tentar criar listas

    // 3. DISPARO NO WHATSAPP
    const zapRes = await fetch(`https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE_ID}/token/${process.env.ZAPI_TOKEN}/send-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Client-Token': process.env.ZAPI_CLIENT_TOKEN },
      body: JSON.stringify({ phone: process.env.WHATSAPP_GRUPO_ID, message: textoResenha })
    });
    if (!zapRes.ok) throw new Error(`Falha Z-API: ${zapRes.status}`);

    // 4. ATUALIZA A FLAG DE INÍCIO NO BANCO
    await supabase.from('games').update({ raiox_inicio_enviado: true }).eq('id', gameId);

    return new Response(JSON.stringify({ message: `Início de ${mandante}x${visitante} enviado!`, gameId }), { status: 200 });

  } catch (error) {
    console.error("Falha Crítica no Raio-X Início:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}