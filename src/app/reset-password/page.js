'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Escuta o evento do Supabase para garantir que o link de recuperação foi válido
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        toast.success('Link validado! Digite sua nova senha.')
      }
    })
  }, [])

  const handleReset = async (e) => {
    e.preventDefault()
    
    if (password !== confirmPassword) {
      return toast.error('As senhas não coincidem.')
    }
    if (password.length < 6) {
      return toast.error('A senha deve ter no mínimo 6 caracteres.')
    }

    setLoading(true)
    
    try {
      // O link de recuperação já logou o usuário temporariamente nos bastidores.
      // Então só precisamos mandar a ordem para atualizar a senha.
      const { error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) throw error

      toast.success('Senha atualizada com sucesso! 🔐')
      router.push('/perfil') // Joga ele de volta pro app
    } catch (error) {
      toast.error('Erro ao atualizar senha: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4">
      <div className="w-full max-w-md bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden p-8 animate-fade-in">
        
        <div className="text-center mb-6">
            <div className="text-5xl mb-4">🔐</div>
            <h1 className="text-2xl font-bold text-yellow-400">Criar Nova Senha</h1>
            <p className="text-sm text-gray-400 mt-2">Digite sua nova senha abaixo para recuperar seu acesso ao bolão.</p>
        </div>
        
        <form onSubmit={handleReset} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1 ml-1">Nova Senha</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              className="w-full p-3 rounded bg-gray-700 border border-gray-600 focus:border-yellow-400 outline-none transition text-white" 
              required 
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1 ml-1">Confirmar Nova Senha</label>
            <input 
              type="password" 
              value={confirmPassword} 
              onChange={(e) => setConfirmPassword(e.target.value)} 
              className="w-full p-3 rounded bg-gray-700 border border-gray-600 focus:border-yellow-400 outline-none transition text-white" 
              required 
            />
          </div>
          <button 
            type="submit" 
            disabled={loading} 
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 rounded mt-4 transition shadow-lg"
          >
            {loading ? 'Salvando...' : 'Salvar Nova Senha'}
          </button>
        </form>
      </div>
    </div>
  )
}