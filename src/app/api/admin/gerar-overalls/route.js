import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 segundos é tempo de sobra para o loop processar centenas de jogadores de uma vez

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get('token') !== process.env.CRON_SECRET) {
      return new Response('Acesso negado', { status: 401 });
    }

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', generationConfig: { responseMimeType: "application/json" } });

    let totalProcessados = 0;
    let continuaLoop = true;
    const lotesProcessados = [];

    // O loop vai rodar até limpar o banco
    while (continuaLoop) {
      // 1. Busca um lote de 30 jogadores que ainda estão com overall igual a 0
      const { data: players, error } = await supabase
        .from('players')
        .select('id, name')
        .eq('overall', 0)
        .limit(30);

      if (error) throw error;

      // Se o banco não devolver nenhum jogador com 0, significa que acabou tudo!
      if (!players || players.length === 0) {
        continuaLoop = false;
        break;
      }

      const listaNomes = players.map(p => `ID ${p.id}: ${p.name}`).join('\n');

      const prompt = `
        Analise esta lista de jogadores de futebol e forneça um Overall (nota de 60 a 99) para cada um deles baseado estritamente no desempenho, nível técnico e momento real no ano de 2026.
        Exemplos de patamar: Craques mundiais ativos (Lamine Yamal, Vinicius Jr, Mbappe, Messi, Haaland) devem ficar entre 90-97. Jogadores excelentes de grandes ligas 82-89. Jogadores medianos 74-81. Jogadores mais limitados abaixo de 73.
        
        Retorne APENAS um array JSON no seguinte formato:
        [
          {"id": id_do_jogador, "overall": nota_generated}
        ]

        LISTA DE JOGADORES:
        ${listaNomes}
      `;

      // 2. Chama a inteligência artificial para avaliar o lote atual
      const result = await model.generateContent(prompt);
      const notasGeradas = JSON.parse(result.response.text());

      // 3. Atualiza os jogadores avaliados no Supabase
      for (const item of notasGeradas) {
        await supabase.from('players').update({ overall: item.overall }).eq('id', item.id);
      }

      totalProcessados += notasGeradas.length;
      lotesProcessados.push(`Lote com ${notasGeradas.length} jogadores salvo com sucesso.`);

      // 4. Uma pausa de 1 segundo entre as chamadas para respeitar os limites de requisições da IA
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return new Response(JSON.stringify({
      sucesso: true,
      mensagem: "Automação concluída! Todos os jogadores foram avaliados.",
      total_processados: totalProcessados,
      historico: lotesProcessados
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}