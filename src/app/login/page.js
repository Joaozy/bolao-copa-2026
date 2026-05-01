'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export default function Login() {
  const [loading, setLoading] = useState(false)
  const [authMode, setAuthMode] = useState('login') 
  const router = useRouter()

  // Estados
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [nickname, setNickname] = useState('')
  const [whatsapp, setWhatsapp] = useState('')

  // --- VIGIA DE SESSÃO (NOVO) ---
  // Se o usuário já estiver logado (ou acabar de logar), chuta ele para a página principal
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.push('/')
        router.refresh()
      }
    }
    checkUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || session) {
        router.push('/')
        router.refresh()
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  // --- LOGIN COM GOOGLE ---
  const handleSocialLogin = async (provider) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          prompt: 'select_account', 
          access_type: 'offline',
        },
      },
    })
    if (error) toast.error('Erro no login social: ' + error.message)
  }

  // --- LOGIN MANUAL / CADASTRO / ESQUECI SENHA ---
  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (authMode === 'login') {
        // LOGIN
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) throw error
        toast.success('Bem-vindo de volta!')
        router.push('/') // Força a ida para a principal
        router.refresh()

      } else if (authMode === 'register') {
        // CRIAR CONTA
        if (!fullName || !nickname || !whatsapp) {
          setLoading(false)
          return toast.error('Preencha todos os campos!')
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        })

        if (error) throw error

        if (data?.user) {
          const { error: profileError } = await supabase
            .from('profiles')
            .update({
              full_name: fullName,
              nickname: nickname,
              whatsapp: whatsapp,
            })
            .eq('id', data.user.id)

          if (profileError) console.error('Erro perfil:', profileError)
          
          toast.success('Conta criada! Bem-vindo!')
          router.push('/') // Joga para a principal
          router.refresh()
        }
      } else if (authMode === 'forgot') {
        // RECUPERAR SENHA
        if (!email) {
          setLoading(false)
          return toast.error('Digite seu email para recuperar a senha.')
        }

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        })

        if (error) throw error

        toast.success('Email de recuperação enviado! Verifique sua caixa de entrada (e o spam).', { duration: 6000 })
        setAuthMode('login') 
      }

    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4">
      <div className="w-full max-w-md bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden animate-fade-in">
        
        {authMode !== 'forgot' && (
            <div className="flex text-center font-bold">
            <button 
                onClick={() => setAuthMode('login')}
                className={`w-1/2 py-4 transition ${authMode === 'login' ? 'bg-gray-800 text-yellow-400 border-b-2 border-yellow-400' : 'bg-gray-900 text-gray-500 hover:text-gray-300'}`}
            >
                Entrar
            </button>
            <button 
                onClick={() => setAuthMode('register')}
                className={`w-1/2 py-4 transition ${authMode === 'register' ? 'bg-gray-800 text-yellow-400 border-b-2 border-yellow-400' : 'bg-gray-900 text-gray-500 hover:text-gray-300'}`}
            >
                Criar Conta
            </button>
            </div>
        )}

        <div className="p-8">
          <h1 className="text-2xl font-bold mb-6 text-center">
            {authMode === 'login' && 'Bem-vindo de volta! 👋'}
            {authMode === 'register' && 'Junte-se ao Bolão ⚽'}
            {authMode === 'forgot' && 'Recuperar Senha 🔑'}
          </h1>

          {authMode === 'forgot' && (
            <p className="text-sm text-gray-400 text-center mb-6">
                Digite o email cadastrado na sua conta. Enviaremos um link mágico para você criar uma nova senha.
            </p>
          )}

          {authMode !== 'forgot' && (
            <>
                <div className="flex gap-4 mb-6">
                <button 
                    type="button"
                    onClick={() => handleSocialLogin('google')}
                    className="w-full bg-white hover:bg-gray-100 text-black font-bold py-3 px-4 rounded flex items-center justify-center gap-2 transition shadow-md"
                >
                    <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="G" />
                    Entrar com Google
                </button>
                </div>

                <div className="relative flex py-2 items-center mb-6">
                <div className="flex-grow border-t border-gray-600"></div>
                <span className="flex-shrink mx-4 text-gray-500 text-sm">Ou continue com email</span>
                <div className="flex-grow border-t border-gray-600"></div>
                </div>
            </>
          )}

          <form onSubmit={handleAuth} className="flex flex-col gap-4">
            {authMode === 'register' && (
              <>
                <div>
                  <label className="block text-xs text-gray-400 mb-1 ml-1">Nome Completo</label>
                  <input type="text" className="w-full p-3 rounded bg-gray-700 border border-gray-600 focus:border-yellow-400 outline-none transition" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                </div>
                <div className="flex gap-4">
                  <div className="w-1/2">
                    <label className="block text-xs text-gray-400 mb-1 ml-1">Apelido</label>
                    <input type="text" className="w-full p-3 rounded bg-gray-700 border border-gray-600 focus:border-yellow-400 outline-none transition" value={nickname} onChange={(e) => setNickname(e.target.value)} required />
                  </div>
                  <div className="w-1/2">
                    <label className="block text-xs text-gray-400 mb-1 ml-1">WhatsApp</label>
                    <input type="tel" className="w-full p-3 rounded bg-gray-700 border border-gray-600 focus:border-yellow-400 outline-none transition" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} required />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs text-gray-400 mb-1 ml-1">Email</label>
              <input type="email" className="w-full p-3 rounded bg-gray-700 border border-gray-600 focus:border-yellow-400 outline-none transition" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            
            {authMode !== 'forgot' && (
                <div>
                <label className="block text-xs text-gray-400 mb-1 ml-1">Senha</label>
                <input type="password" className="w-full p-3 rounded bg-gray-700 border border-gray-600 focus:border-yellow-400 outline-none transition" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
            )}

            {authMode === 'login' && (
                <div className="text-right -mt-2">
                    <button 
                        type="button" 
                        onClick={() => setAuthMode('forgot')}
                        className="text-xs text-blue-400 hover:text-blue-300 font-bold transition"
                    >
                        Esqueceu a senha?
                    </button>
                </div>
            )}
            
            <button 
                type="submit" 
                disabled={loading} 
                className={`font-bold py-3 rounded transition shadow-lg mt-2 
                    ${authMode === 'login' ? 'bg-yellow-500 hover:bg-yellow-600 text-black' : 
                      authMode === 'register' ? 'bg-green-600 hover:bg-green-700 text-white' : 
                      'bg-blue-600 hover:bg-blue-700 text-white'}`
                }
            >
              {loading ? 'Processando...' : (
                  authMode === 'login' ? 'Entrar' : 
                  authMode === 'register' ? 'Criar Conta Grátis' : 
                  'Enviar Link de Recuperação'
              )}
            </button>

            {authMode === 'forgot' && (
                <button 
                    type="button" 
                    onClick={() => setAuthMode('login')}
                    className="text-sm text-gray-400 hover:text-white mt-4 transition"
                >
                    ← Voltar para o Login
                </button>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}