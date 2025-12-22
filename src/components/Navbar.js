'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '../lib/supabaseClient'

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [session, setSession] = useState(null)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (!session && pathname !== '/login') {
         router.push('/login')
      }
    })
    return () => subscription.unsubscribe()
  }, [pathname, router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setIsOpen(false)
    router.push('/login')
    router.refresh()
  }

  const menuItems = [
    { name: '⚽ Palpitar', path: '/' },
    { name: '📅 Calendário', path: '/finalizados' },
    { name: '📊 Tabelas', path: '/tabelas' }, // <--- NOVO ITEM
    { name: '🏆 Ranking', path: '/ranking' },
    { name: '👤 Perfil', path: '/perfil' },
    { name: '📰 Notícias', path: '/noticias' },
    { name: '📜 Regras', path: '/regras' },
    { name: '🎁 Premiações', path: '/premiacoes' },
    { name: '📞 Contato', path: '/contato' },
  ]

  return (
    <nav className="bg-gray-800 border-b border-gray-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between h-16">
          
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold text-yellow-400">
              Copa 2026 🇧🇷
            </Link>
          </div>

          {/* MENU DESKTOP */}
          <div className="hidden lg:flex items-center space-x-1 xl:space-x-4">
            {menuItems.map((item) => (
              <Link 
                key={item.path} 
                href={item.path}
                className={`px-3 py-2 rounded-md text-sm font-medium transition whitespace-nowrap
                  ${pathname === item.path ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}
                `}
              >
                {item.name.slice(2)}
              </Link>
            ))}
            
            {session ? (
              <button 
                onClick={handleLogout}
                className="ml-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm transition"
              >
                Sair
              </button>
            ) : (
              <Link href="/login" className="ml-4 bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded text-sm font-bold">
                Entrar
              </Link>
            )}
          </div>

          {/* MENU MOBILE */}
          <div className="flex items-center lg:hidden">
            <button 
              onClick={() => setIsOpen(!isOpen)}
              className="text-gray-300 hover:text-white focus:outline-none"
            >
              <span className="text-3xl">{isOpen ? '✖️' : '☰'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* GAVETA MOBILE */}
      {isOpen && (
        <div className="lg:hidden bg-gray-800 border-t border-gray-700 pb-4 shadow-xl">
          <div className="px-2 pt-2 space-y-1">
            {menuItems.map((item) => (
              <Link 
                key={item.path}
                href={item.path}
                onClick={() => setIsOpen(false)}
                className={`block px-3 py-3 rounded-md text-base font-medium
                  ${pathname === item.path ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}
                `}
              >
                {item.name}
              </Link>
            ))}
             {session && (
              <button 
                onClick={handleLogout}
                className="w-full text-left block px-3 py-3 text-red-400 hover:bg-gray-700 font-bold"
              >
                🚪 Sair da Conta
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}