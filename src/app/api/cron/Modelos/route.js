import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // Lista todos os modelos que a sua chave consegue acessar
    // Isso vai buscar diretamente no servidor, resolvendo o mistério.
    const modelsResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
    const data = await modelsResponse.json();

    // Filtra para pegar só os modelos que suportam geração de texto
    const availableModels = data.models
      .filter(model => model.supportedGenerationMethods.includes('generateContent'))
      .map(model => ({
         name: model.name,
         displayName: model.displayName
      }));

    return new Response(JSON.stringify({
      mensagem: "Modelos encontrados para a sua chave",
      modelos_disponiveis: availableModels
    }, null, 2), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    return new Response(JSON.stringify({ erro: error.message }), { status: 500 });
  }
}