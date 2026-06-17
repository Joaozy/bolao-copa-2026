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

    // Busca APENAS os jogadores de seleção (ignorando os que estão com -1)
    const { data: players, error } = await supabase
      .from('players')
      .select('id, name')
      .eq('overall', 0)
      .limit(40);

    if (error) throw error;

    if (!players || players.length === 0) {
      return new Response(`
        <html>
          <body style="background:#111; color:#00e676; font-family:sans-serif; text-align:center; padding:50px;">
            <h1>✅ Automação Concluída!</h1>
            <p>Todos os atletas da Copa do Mundo receberam suas notas reais.</p>
          </body>
        </html>
      `, { headers: { 'Content-Type': 'text/html' } });
    }

    const listaNomes = players.map(p => `ID ${p.id}: ${p.name}`).join('\n');

    const prompt = `
      Analise esta lista de jogadores e forneça um Overall (nota de 60 a 99) baseado no nível técnico real no ano de 2026.
      Craques mundiais: 90-97. Excelentes: 82-89. Medianos: 74-81. Limitados: abaixo de 73.
      Retorne APENAS um array JSON: [{"id": id, "overall": nota}]
      LISTA:
      ${listaNomes}
    `;

    const result = await model.generateContent(prompt);
    const notasGeradas = JSON.parse(result.response.text());

    for (const item of notasGeradas) {
      await supabase.from('players').update({ overall: item.overall }).eq('id', item.id);
    }

    const { count } = await supabase.from('players').select('*', { count: 'exact', head: true }).eq('overall', 0);

    return new Response(`
      <html>
        <head><meta http-equiv="refresh" content="1"></head>
        <body style="background:#222; color:#fff; font-family:sans-serif; text-align:center; padding:50px;">
          <h2 style="color:#0288d1">⚙️ IA Trabalhando...</h2>
          <p>Mais um lote atualizado com sucesso!</p>
          <p style="color:#ffeb3b; font-size: 20px;">Faltam avaliar apenas: <b>${count}</b> jogadores das seleções.</p>
          <script>setTimeout(() => window.location.reload(), 1500);</script>
        </body>
      </html>
    `, { headers: { 'Content-Type': 'text/html' } });

  } catch (err) {
    return new Response(`
      <html>
        <head><meta http-equiv="refresh" content="2"></head>
        <body style="background:#222; color:#ff5252; text-align:center; padding:50px;">
          <h3>Engasgo na IA. Tentando de novo...</h3>
          <p>${err.message}</p>
        </body>
      </html>
    `, { headers: { 'Content-Type': 'text/html' } });
  }
}