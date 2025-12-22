import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    // Conecta com superpoderes (Service Role) para ler a lista de Auth
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // 1. Busca TODOS os usuários do sistema de Login (até 1000)
    const { data: { users }, error: authError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    })
    
    if (authError) throw authError

    // 2. Prepara os dados para a tabela profiles
    // Mapeia apenas o ID e Email, que são os dados base
    const profiles = users.map(user => ({
      id: user.id,
      email: user.email,
    }))

    // 3. Insere na tabela profiles
    // O segredo aqui é o `ignoreDuplicates: true`. 
    // Se o usuário JÁ existe no perfil, ele não faz nada (não apaga nome/zap).
    // Se NÃO existe, ele cria.
    const { error: upsertError } = await supabaseAdmin
      .from('profiles')
      .upsert(profiles, { onConflict: 'id', ignoreDuplicates: true })

    if (upsertError) throw upsertError

    return NextResponse.json({ message: `Sincronização concluída! ${users.length} usuários verificados.` })

  } catch (error) {
    console.error('Erro no sync:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}