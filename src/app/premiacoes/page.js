'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function Premiacoes() {
  const [competitionsData, setCompetitionsData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      setLoading(true)

      // 1. Busca todas as regras de premiação (agora têm competition_id)
      const { data: allRules } = await supabase.from('prize_rules').select('*').order('position')
      
      // 2. Busca competições ativas
      const { data: comps } = await supabase
        .from('competitions')
        .select('*')
        .eq('is_active', true)
        .order('id')

      if (comps) {
        // 3. Monta o objeto completo para cada competição
        // Usamos Promise.all para buscar a contagem de pagantes de todas as competições em paralelo
        const compsWithData = await Promise.all(comps.map(async (c) => {
          // Conta quantos participantes estão com is_paid = true NESTA competição
          const { count } = await supabase
            .from('enrollments')
            .select('*', { count: 'exact', head: true })
            .eq('competition_id', c.id)
            .eq('is_paid', true)
          
          const totalPool = (count || 0) * (c.entry_fee || 0)
          
          // Filtra as regras que pertencem a esta competição específica
          const myRules = allRules?.filter(r => r.competition_id === c.id) || []

          return {
            ...c,
            paid_count: count || 0,
            total_pool: totalPool,
            rules: myRules
          }
        }))
        
        setCompetitionsData(compsWithData)
      }
      
      setLoading(false)
    }
    loadData()
  }, [])

  const calcularPremio = (rule, totalPool) => {
    // Se a regra tiver valor fixo, usa ele. Senão, calcula a porcentagem do total arrecadado.
    if (rule.fixed_value > 0) return rule.fixed_value
    return totalPool * (rule.percentage / 100)
  }

  // Define cores para o pódio (1º Ouro, 2º Prata, 3º Bronze, Resto Azul)
  const getPodiumColor = (pos) => {
    if (pos === 1) return 'text-yellow-400 border-l-yellow-400'
    if (pos === 2) return 'text-gray-300 border-l-gray-300'
    if (pos === 3) return 'text-orange-400 border-l-orange-700'
    return 'text-blue-300 border-l-blue-500'
  }

  const getEmoji = (pos) => {
    if (pos === 1) return '🥇'
    if (pos === 2) return '🥈'
    if (pos === 3) return '🥉'
    return `🏅 ${pos}º`
  }

  if (loading) return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">Carregando premiações...</div>

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 flex flex-col items-center pb-20">
      <h1 className="text-3xl font-bold text-yellow-400 mb-2 mt-4 text-center">🎁 Premiações Oficiais</h1>
      <p className="text-gray-400 mb-8 text-center text-sm">Confira os valores acumulados em cada campeonato!</p>

      {/* GRADE DE COMPETIÇÕES */}
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-8">
        {competitionsData.map(comp => (
          <div key={comp.id} className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden shadow-2xl flex flex-col hover:border-gray-500 transition duration-300">
            
            {/* CABEÇALHO DO CAMPEONATO */}
            <div className="bg-gradient-to-r from-gray-800 to-gray-750 p-6 text-center border-b border-gray-600 relative">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-500 to-yellow-700"></div>
              <h2 className="text-xl font-bold text-white mb-1 tracking-wide">{comp.name}</h2>
              
              <div className="text-4xl font-black text-yellow-400 drop-shadow-md my-3">
                {comp.total_pool.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              
              <div className="inline-flex items-center gap-2 bg-black/30 px-3 py-1 rounded-full text-xs text-gray-300 border border-gray-600">
                <span>👥 {comp.paid_count} pagantes</span>
                <span>•</span>
                <span>Entrada: {Number(comp.entry_fee).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
            </div>

            {/* LISTA DE PRÊMIOS */}
            <div className="p-4 space-y-3 flex-1 bg-gray-800/50">
              {comp.rules && comp.rules.length > 0 ? (
                comp.rules.map((rule) => {
                  const valorPremio = calcularPremio(rule, comp.total_pool)
                  const corClass = getPodiumColor(rule.position)
                  
                  return (
                    <div key={rule.id} className="bg-gray-900 p-4 rounded-xl border border-gray-700 flex items-center justify-between relative overflow-hidden group">
                      <div className={`absolute top-0 left-0 w-1.5 h-full ${corClass.split(' ')[1].replace('text-', 'bg-')}`}></div> {/* Faixa Lateral Colorida */}
                      <div>
                        <div className={`text-lg font-bold ${corClass.split(' ')[0]}`}>
                          {getEmoji(rule.position)} <span className="text-white ml-1">{rule.position}º Lugar</span>
                        </div>
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">
                          {rule.fixed_value > 0 ? 'Valor Fixo' : `${rule.percentage}% do pote`}
                        </div>
                      </div>
                      <div className={`text-xl font-bold ${corClass.split(' ')[0]}`}>
                        {valorPremio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="text-center text-gray-500 py-8 text-sm italic border border-gray-700 border-dashed rounded-lg mx-4">
                  Regras de premiação ainda não definidas pelo administrador.
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {competitionsData.length === 0 && (
        <div className="text-gray-500 text-center p-10 bg-gray-800 rounded-xl border border-gray-700 border-dashed">
            Nenhuma competição ativa no momento.
        </div>
      )}

      <p className="mt-12 text-xs text-gray-500 max-w-sm text-center">
        * Os valores são atualizados automaticamente em tempo real com base nos pagamentos confirmados.
      </p>
    </div>
  )
}