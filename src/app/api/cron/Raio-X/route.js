// Exemplo de Rota de API (Node.js)
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'

export default async function handler(req, res) {
  // 1. TRAVA DE SEGURANÇA: Evita que curiosos rodem seu bot
  const { token } = req.query;
  if (token !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Acesso não autorizado' });
  }

  // 2. CONSULTA NO SUPABASE (Tem jogo começando agora?)
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  
  // Aqui entra aquela query SQL que montamos (via RPC ou adaptando com filtros do Supabase)
  const { data: jogos, error } = await supabase.rpc('buscar_palpites_proximo_jogo');

  // Se não tiver jogo nos próximos 15 min, encerra silenciosamente
  if (!jogos || jogos.length === 0) {
    return res.status(200).json({ message: 'Nenhum jogo no momento. Dormindo...' });
  }

  // 3. ENVIA OS DADOS PARA O GEMINI GERAR O TEXTO
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
    Você é um administrador de bolão sarcástico. 
    Transforme este JSON em uma mensagem de WhatsApp engraçada e zoe as zebras:
    ${JSON.stringify(jogos)}
  `;

  const result = await model.generateContent(prompt);
  const textoProGrupo = result.response.text();

  // 4. DISPARO PARA O WHATSAPP
  // Aqui você faz o fetch/axios para a sua API do WhatsApp (Evolution/Baileys)
  await fetch('URL_DA_SUA_API_DO_WHATSAPP', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
          number: "ID_DO_GRUPO@g.us",
          text: textoProGrupo
      })
  });

  return res.status(200).json({ message: 'Mensagem enviada com sucesso!' });
}