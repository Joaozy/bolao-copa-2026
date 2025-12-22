import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  
  if (code) {
    // CORREÇÃO: Next.js 15 exige 'await' aqui
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          get(name) {
            return cookieStore.get(name)?.value
          },
          set(name, value, options) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name, options) {
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    )
    
    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) throw error
    } catch (error) {
      console.error('Erro na troca de sessão:', error)
      return NextResponse.redirect(`${origin}/login?erro=auth_failed`)
    }
  }

  // Redireciona para o Perfil se der tudo certo
  return NextResponse.redirect(`${origin}/perfil`)
}