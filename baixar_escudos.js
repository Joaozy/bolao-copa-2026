const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. COLOQUE SUAS CHAVES AQUI (Pode pegar do seu .env)
const SUPABASE_URL = 'https://SUA_URL_AQUI.supabase.co';
const SUPABASE_KEY = 'SUA_SERVICE_ROLE_KEY_AQUI';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function baixarEscudos() {
  // Define o caminho: public/images/teams/
  const dir = path.join(process.cwd(), 'public', 'images', 'teams');

  // Cria as pastas automaticamente se não existirem
  if (!fs.existsSync(dir)){
      fs.mkdirSync(dir, { recursive: true });
  }

  console.log('Buscando times no banco de dados...');
  const { data: teams, error } = await supabase.from('teams').select('id, name, badge_url');

  if (error) {
    console.error('Erro ao buscar times:', error.message);
    return;
  }

  console.log(`Encontrados ${teams.length} times. Iniciando download...`);

  for (const team of teams) {
    // Se a URL já for local (começar com /) ou estiver vazia, ele pula
    if (!team.badge_url || team.badge_url.startsWith('/')) {
        console.log(`⏭️ Pulando ${team.name} (já atualizado ou sem imagem).`);
        continue;
    }

    try {
        const response = await fetch(team.badge_url);
        if (!response.ok) throw new Error(`Status ${response.status}`);
        
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // O nome do arquivo será protegido: "team-1.png", "team-2.png", etc.
        const fileName = `team-${team.id}.png`;
        const filePath = path.join(dir, fileName);

        fs.writeFileSync(filePath, buffer);
        console.log(`✅ Salvo: ${team.name} -> ${fileName}`);
    } catch (err) {
        console.error(`❌ Erro ao baixar ${team.name}:`, err.message);
    }
  }

  console.log('🎉 Operação concluída! Escudos salvos na pasta public/images/teams/.');
}

baixarEscudos();