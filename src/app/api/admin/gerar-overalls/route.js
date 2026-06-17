import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get('token') !== process.env.CRON_SECRET) {
      return new Response('Acesso negado', { status: 401 });
    }

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', generationConfig: { responseMimeType: "application/json" } });

    // Pega os jogadores que estão com a nota padrão (75) para processar em lotes
    const { data: players, error } = await supabase.from('players').select('id, name').eq('overall', 75).limit(40);
    if (error) throw error;
    if (!players || players.length === 0) return new Response(JSON.stringify({ message: "Todos os jogadores já avaliados!" }));

    const listaNomes = players.map(p => `ID ${p.id}: ${p.name}`).join('\n');

    const prompt = `
      Analise esta lista de jogadores de futebol e forneça um Overall (nota de 60 a 99) para cada um deles baseado estritamente no desempenho, nível técnico e momento real no ano de 2026.
      Exemplos de patamar: Craques mundiais ativos (Lamine Yamal, Vinicius Jr, Mbappe, Messi, Haaland) devem ficar entre 90-97. Jogadores excelentes de grandes ligas 82-89. Jogadores medianos 74-81. Jogadores mais limitados abaixo de 73.
      
      Retorne APENAS um array JSON no seguinte formato:
      [
        {"id": id_do_jogador, "overall": nota_gerada}
      ]

      LISTA DE JOGADORES:
      ${listaNomes}
    `;

    const result = await model.generateContent(prompt);
    const notasGeradas = JSON.parse(result.response.text());

    // Atualiza cada jogador no banco de dados com a nota real da IA
    for (const item of notasGeradas) {
      await supabase.from('players').update({ overall: item.overall }).eq('id', item.id);
    }

    return new Response(JSON.stringify({ sucesso: true, processados: notasGeradas.length, dados: notasGeradas }));
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}