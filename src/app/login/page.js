'use client'
import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast' // Usando as notificações bonitas

export default function Login() {
  const [loading, setLoading] = useState(false)
  const [isLogin, setIsLogin] = useState(true)
  const router = useRouter()

  // Estados
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [nickname, setNickname] = useState('')
  const [whatsapp, setWhatsapp] = useState('')

  // --- LOGIN COM GOOGLE (CORRIGIDO) ---
  const handleSocialLogin = async (provider) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // AQUI ESTÁ A MÁGICA:
        queryParams: {
          prompt: 'select_account', // Força o Google a mostrar a lista de contas
          access_type: 'offline',
        },
      },
    })
    if (error) toast.error('Erro no login social: ' + error.message)
  }

  // --- LOGIN MANUAL / CADASTRO ---
  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (isLogin) {
        // LOGIN
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) throw error
        
        // Sucesso
        toast.success('Bem-vindo de volta!')
        router.push('/perfil')

      } else {
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

        // Salva dados extras
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
          
          toast.success('Conta criada! Complete seu perfil.')
          router.push('/perfil')
        }
      }
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4">
      <div className="w-full max-w-md bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden">
        
        <div className="flex text-center font-bold">
          <button 
            onClick={() => setIsLogin(true)}
            className={`w-1/2 py-4 transition ${isLogin ? 'bg-gray-800 text-yellow-400 border-b-2 border-yellow-400' : 'bg-gray-900 text-gray-500 hover:text-gray-300'}`}
          >
            Entrar
          </button>
          <button 
            onClick={() => setIsLogin(false)}
            className={`w-1/2 py-4 transition ${!isLogin ? 'bg-gray-800 text-yellow-400 border-b-2 border-yellow-400' : 'bg-gray-900 text-gray-500 hover:text-gray-300'}`}
          >
            Criar Conta
          </button>
        </div>

        <div className="p-8">
          <h1 className="text-2xl font-bold mb-6 text-center">
            {isLogin ? 'Bem-vindo de volta! 👋' : 'Junte-se ao Bolão ⚽'}
          </h1>

          <div className="flex gap-4 mb-6">
            <button 
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

          <form onSubmit={handleAuth} className="flex flex-col gap-4">
            {!isLogin && (
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
            <div>
              <label className="block text-xs text-gray-400 mb-1 ml-1">Senha</label>
              <input type="password" className="w-full p-3 rounded bg-gray-700 border border-gray-600 focus:border-yellow-400 outline-none transition" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            
            <button type="submit" disabled={loading} className={`font-bold py-3 rounded transition shadow-lg mt-2 ${isLogin ? 'bg-yellow-500 hover:bg-yellow-600 text-black' : 'bg-green-600 hover:bg-green-700 text-white'}`}>
              {loading ? 'Processando...' : (isLogin ? 'Entrar' : 'Criar Conta Grátis')}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}