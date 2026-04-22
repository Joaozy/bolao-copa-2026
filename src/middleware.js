import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function middleware(request) {
  // Inicializa a resposta para podermos modificar os cookies, se necessário
  let supabaseResponse = NextResponse.next({
    request,
  })

  // Cria o cliente Supabase para o servidor intercetando os cookies do request
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Obtém o utilizador atual (valida o token)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const url = request.nextUrl.clone()
  
  // Define quais rotas são PÚBLICAS (qualquer pessoa pode aceder)
  const publicRoutes = ['/login', '/regras', '/noticias', '/contato']
  const isPublicRoute = publicRoutes.some(route => url.pathname.startsWith(route))

  // 1. Se o utilizador NÃO estiver logado e a rota NÃO for pública -> Redireciona para /login
  if (!user && !isPublicRoute && url.pathname !== '/login') {
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 2. Se o utilizador JÁ estiver logado e tentar aceder ao /login -> Redireciona para a Home (/)
  if (user && url.pathname === '/login') {
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

// O Matcher define em quais rotas este middleware vai correr
export const config = {
  matcher: [
    /*
     * Ignora caminhos internos do Next.js e ficheiros estáticos (imagens, favicons, etc)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}