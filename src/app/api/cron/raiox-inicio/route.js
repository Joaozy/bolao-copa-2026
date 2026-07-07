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

    const { data: palpites, error } = await supabase.rpc('get_match_inicio');
    if (error) throw new Error(`Erro DB: ${error.message}`);
    if (!palpites || palpites.length === 0) return new Response(JSON.stringify({ message: 'Nenhum jogo prestes a começar.' }), { status: 200 });

    const evento = palpites[0];
    const { game_id: gameId, mandante, visitante } = evento;
    const palpitesDoJogo = palpites.filter(p => p.game_id === gameId);
    
    // --- LÓGICA DE ESTATÍSTICAS POR PLACAR ---
    const placares = {};
    let totalApostas = 0;

    palpitesDoJogo.forEach(p => {
        const placar = `${p.guess_score_a}x${p.guess_score_b}`;
        const nome = p.nickname || p.nome_exibicao || p.nome || 'Alguém';
        
        if (!placares[placar]) placares[placar] = { count: 0, nomes: [] };
        placares[placar].count++;
        placares[placar].nomes.push(nome);
        totalApostas++;
    });

    const topPlacares = Object.entries(placares)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 3)
        .map(([placar, data]) => `Placar ${placar}: ${data.count} apostas (Ex: ${data.nomes.slice(0,2).join(', ')})`)
        .join('\n');

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const systemPrompt = `
      Você é o "Rei da Resenha", o analista tático e sarcástico do nosso bolão de WhatsApp.
      A bola vai rolar para: *${mandante} x ${visitante}* pelo Mata-Mata da Copa!
      
      DADOS DAS APOSTAS (PLACARES EXATOS):
      Total de palpites: ${totalApostas}
      ${topPlacares}
      
      SUA MISSÃO - Crie um texto épico, leve e debochado seguindo EXATAMENTE esta estrutura (PROIBIDO usar markdown de listas como asteriscos ou traços):
      
      1. ⚔️ SANGUE NA ARENA: Anuncie o início do jogo. Lembre a todos, de forma rápida, que para o bolão SÓ CONTA O PLACAR DOS 90 MINUTOS (prorrogação e pênaltis não dão ponto).
      
      2. 📊 O VAR DAS APOSTAS: SEJA CURTO E DIRETO. Zombe da falta de criatividade de quem apostou no placar mais repetido (cite 1 ou 2 nomes). Pegue o placar menos votado da lista e brinque com a ilusão (ou genialidade) desses apostadores.
      
      3. 🕵️ RAIO-X DO CONFRONTO: Faça uma análise tática rápida de botequim. Aponte quem é o verdadeiro favorito, cite 1 ou 2 craques reais do confronto, e lembre que quem passar sobrevive para a próxima pedreira.
      
      4. 🧠 CULTURA INÚTIL: Solte uma curiosidade aleatória, histórica e curiosa sobre o país ${mandante} e outra sobre ${visitante}.
      
      ATENÇÃO PARA O FINAL: Encerre o último bloco com uma despedida MUITO LEVE, amigável e em clima de festa (Ex: "Aproveitem pra pegar aquele kit churrasco e uma gelada no Mota Supermercado, sentem no sofá e boa sorte!"). É ESTRITAMENTE PROIBIDO usar xingamentos irritados.

      Use parágrafos curtos. Pule sempre uma linha em branco entre os blocos. Os títulos devem estar em NEGRITO e MAIÚSCULO com emojis.
    `;

    const textoResenha = (await model.generateContent(systemPrompt)).response.text()
      .replace(/\\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[\*\-]\s/g, ''); 

    const zapRes = await fetch(`https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE_ID}/token/${process.env.ZAPI_TOKEN}/send-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Client-Token': process.env.ZAPI_CLIENT_TOKEN },
      body: JSON.stringify({ phone: process.env.WHATSAPP_GRUPO_ID, message: textoResenha })
    });
    if (!zapRes.ok) throw new Error(`Falha Z-API: ${zapRes.status}`);

    // CORRIGIDO PARA O NOME EXATO DO SEU BANCO DE DADOS
    const { error: updateError } = await supabase
      .from('games')
      .update({ raiox_enviado: true }) 
      .eq('id', gameId);

    if (updateError) console.error("ERRO AO ATUALIZAR FLAG NO BANCO:", updateError.message);

    return new Response(JSON.stringify({ message: `Início de ${mandante}x${visitante} enviado!`, gameId }), { status: 200 });

  } catch (error) {
    console.error("Falha Crítica no Raio-X Início:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
