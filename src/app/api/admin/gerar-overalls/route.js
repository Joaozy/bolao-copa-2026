import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; 

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get('token') !== process.env.CRON_SECRET) {
      return new Response('Acesso negado', { status: 401 });
    }

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', generationConfig: { responseMimeType: "application/json" } });

    // 1. Busca exatamente um lote seguro (40 jogadores) que não vai dar timeout
    const { data: players, error } = await supabase
      .from('players')
      .select('id, name')
      .eq('overall', 0)
      .limit(40);

    if (error) throw error;

    // 2. Se a busca retornar vazia, o trabalho acabou!
    if (!players || players.length === 0) {
      return new Response(`
        <html>
          <body style="background:#111; color:#00e676; font-family:sans-serif; text-align:center; padding:50px;">
            <h1>✅ Automação Concluída!</h1>
            <p>Todos os jogadores do banco já receberam suas notas reais.</p>
            <p>Você já pode fechar esta aba e ir jogar o Draft!</p>
          </body>
        </html>
      `, { headers: { 'Content-Type': 'text/html' } });
    }

    const listaNomes = players.map(p => `ID ${p.id}: ${p.name}`).join('\n');

    const prompt = `
      Analise esta lista de jogadores de futebol e forneça um Overall (nota de 60 a 99) para cada um deles baseado estritamente no desempenho, nível técnico e momento real no ano de 2026.
      Exemplos de patamar: Craques mundiais ativos (Lamine Yamal, Vinicius Jr, Mbappe, Messi, Haaland) devem ficar entre 90-97. Jogadores excelentes de grandes ligas 82-89. Jogadores medianos 74-81. Jogadores limitados abaixo de 73.
      
      Retorne APENAS um array JSON no seguinte formato:
      [
        {"id": id_do_jogador, "overall": nota_gerada}
      ]

      LISTA DE JOGADORES:
      ${listaNomes}
    `;

    // 3. IA processa o lote
    const result = await model.generateContent(prompt);
    const notasGeradas = JSON.parse(result.response.text());

    // 4. Salva no banco de dados
    for (const item of notasGeradas) {
      await supabase.from('players').update({ overall: item.overall }).eq('id', item.id);
    }

    // 5. Calcula quantos ainda faltam no banco geral para te mostrar no painel
    const { count } = await supabase.from('players').select('*', { count: 'exact', head: true }).eq('overall', 0);

    // 6. O TRUQUE DE MESTRE: Retorna um HTML que força a página a recarregar sozinha!
    return new Response(`
      <html>
        <head>
          <meta http-equiv="refresh" content="1"> </head>
        <body style="background:#222; color:#fff; font-family:sans-serif; text-align:center; padding:50px;">
          <h2 style="color:#0288d1">⚙️ Robô Trabalhando...</h2>
          <p>Mais um lote de <b>${notasGeradas.length}</b> jogadores atualizado com sucesso!</p>
          <p style="color:#ffeb3b; font-size: 20px;">Faltam avaliar aproximadamente: <b>${count}</b> jogadores.</p>
          <p style="color:#aaa; margin-top:30px;">A página vai recarregar sozinha para processar o próximo lote.<br/>Não feche o navegador e não aperte F5.</p>
          <script>
            // Segurança extra: se a meta tag falhar, o JavaScript atualiza a página
            setTimeout(() => window.location.reload(), 1500);
          </script>
        </body>
      </html>
    `, { headers: { 'Content-Type': 'text/html' } });

  } catch (err) {
    // Se der erro de JSON na IA, ele recarrega sozinho pra tentar o lote de novo sem você fazer nada
    return new Response(`
      <html>
        <head><meta http-equiv="refresh" content="2"></head>
        <body style="background:#222; color:#ff5252; text-align:center; padding:50px;">
          <h3>Pequeno engasgo da IA. Tentando novamente em 2 segundos...</h3>
          <p>${err.message}</p>
        </body>
      </html>
    `, { headers: { 'Content-Type': 'text/html' } });
  }
}