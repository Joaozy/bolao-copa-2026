'use client'
import { useState, useEffect, Suspense } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'

// Componente interno que usa useSearchParams
function PagamentoContent() {
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [checking, setChecking] = useState(false)
  
  const [user, setUser] = useState(null)
  const [competition, setCompetition] = useState(null)
  const [isPaid, setIsPaid] = useState(false)
  
  const [pixData, setPixData] = useState(null)
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const competitionId = searchParams.get('competitionId')

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      if (!competitionId) {
        toast.error('Competição não especificada.')
        router.push('/perfil')
        return
      }

      // 1. Busca a Competição (Nome e Preço)
      const { data: comp } = await supabase.from('competitions').select('*').eq('id', competitionId).single()
      if (!comp) {
        toast.error('Competição não encontrada.')
        router.push('/perfil')
        return
      }
      setCompetition(comp)

      // 2. Verifica se JÁ PAGOU ESSA COMPETIÇÃO ESPECÍFICA
      const { data: enroll } = await supabase
        .from('enrollments')
        .select('is_paid')
        .eq('user_id', user.id)
        .eq('competition_id', competitionId)
        .single()

      if (enroll?.is_paid) {
        setIsPaid(true)
      }
      
      setLoading(false)
    }
    init()
  }, [competitionId])

  // GERAR PIX (Envia competitionId para a API saber o valor correto)
  const handleGerarPix = async () => {
    setGenerating(true)
    try {
      const response = await fetch('/api/pix/criar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: user.email,
          firstName: user.user_metadata?.full_name?.split(' ')[0],
          competitionId: competitionId // <--- ESSENCIAL PARA COBRAR O VALOR CERTO
        })
      })
      
      const data = await response.json()
      if (data.error) throw new Error(data.error)
      
      setPixData(data) 

    } catch (error) {
      toast.error('Erro ao gerar Pix: ' + error.message)
    } finally {
      setGenerating(false)
    }
  }

  const handleVerificarPagamento = async () => {
    if (!pixData?.id) return
    setChecking(true)
    try {
      const response = await fetch('/api/pix/verificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId: pixData.id })
      })

      const data = await response.json()
      
      if (data.status === 'approved') {
        toast.success('Pagamento Confirmado! 🎉')
        setIsPaid(true)
        setPixData(null)
        // Redireciona de volta para o perfil após 2s
        setTimeout(() => router.push('/perfil'), 2000)
      } else {
        toast('Ainda não identificamos o pagamento. Aguarde alguns segundos.', { icon: '⏳' })
      }
    } catch (error) {
      console.error(error)
      toast.error('Erro ao verificar.')
    } finally {
      setChecking(false)
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(pixData.qr_code)
    toast.success('Código Pix copiado!')
  }

  if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Carregando...</div>

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <div className="bg-gray-800 p-8 rounded-xl border border-gray-700 max-w-md w-full text-center shadow-2xl">
        
        {isPaid ? (
          <div className="bg-green-900/30 text-green-400 p-6 rounded-lg border border-green-500/50 animate-bounce-in">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-2xl font-bold">Tudo Certo!</h2>
            <p className="mt-2">Você já está participando do<br/><strong className="text-white">{competition?.name}</strong></p>
            <button onClick={() => router.push('/perfil')} className="mt-6 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded-full transition">Voltar para Perfil</button>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold text-gray-300 mb-2">Inscrição para:</h1>
            <h2 className="text-2xl font-bold text-yellow-400 mb-6">{competition?.name}</h2>
            
            <div className="text-5xl font-black text-white mb-2">
              {Number(competition?.entry_fee).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
            <p className="text-xs text-gray-500 mb-8">Pagamento via Pix (Instantâneo)</p>

            {!pixData && (
              <button 
                onClick={handleGerarPix}
                disabled={generating}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-lg text-lg transition flex items-center justify-center gap-2 shadow-lg"
              >
                {generating ? 'Gerando...' : 'Gerar Pix Agora 💠'}
              </button>
            )}

            {pixData && (
              <div className="mt-4 animate-fade-in">
                <div className="bg-white p-4 rounded-lg inline-block mb-4">
                  <img src={`data:image/png;base64,${pixData.qr_code_base64}`} alt="QR Code Pix" className="w-48 h-48" />
                </div>
                
                <p className="text-xs text-gray-400 mb-2">Escaneie o QR Code ou copie o código:</p>
                <div className="flex gap-2 mb-6">
                  <input readOnly value={pixData.qr_code} className="w-full bg-gray-900 border border-gray-600 rounded px-3 text-xs text-gray-400" />
                  <button onClick={copyToClipboard} className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded text-xs font-bold">Copiar</button>
                </div>

                <div className="bg-yellow-900/20 border border-yellow-600/30 p-4 rounded-lg">
                  <p className="text-yellow-200 text-sm font-bold mb-2">Já fez o pagamento?</p>
                  <button onClick={handleVerificarPagamento} disabled={checking} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded transition">{checking ? 'Verificando...' : 'Sim, já paguei! ✅'}</button>
                </div>
              </div>
            )}
            
            <button onClick={() => router.push('/perfil')} className="mt-6 text-gray-500 hover:text-white underline text-sm block mx-auto">Cancelar</button>
          </>
        )}
      </div>
    </div>
  )
}

// Exportação com Suspense (Correção Crítica para build)
export default function Pagamento() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">Carregando pagamento...</div>}>
      <PagamentoContent />
    </Suspense>
  )
}