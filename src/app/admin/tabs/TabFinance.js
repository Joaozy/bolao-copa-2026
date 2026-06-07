'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabaseClient'

export default function TabFinance({ competitions, fetchAllData, setLoading }) {
  const [financeCompId, setFinanceCompId] = useState('')
  const [entryFee, setEntryFee] = useState('0')
  const [prizeRules, setPrizeRules] = useState([])

  useEffect(() => {
    if (competitions.length > 0 && !financeCompId) setFinanceCompId(competitions[0].id)
  }, [competitions])

  useEffect(() => {
    if (financeCompId) fetchFinanceData(financeCompId)
  }, [financeCompId])

  async function fetchFinanceData(c) { 
    const { data: comp } = await supabase.from('competitions').select('entry_fee').eq('id', c).single(); 
    if (comp) setEntryFee(comp.entry_fee); 
    const { data: rules } = await supabase.from('prize_rules').select('*').eq('competition_id', c).order('position', { ascending: true }); 
    setPrizeRules(rules || []) 
  }

  const handleSaveConfig = async () => { 
    if (!financeCompId) return; 
    setLoading(true); 
    try { 
        await supabase.from('competitions').update({ entry_fee: entryFee }).eq('id', financeCompId); 
        await supabase.from('prize_rules').delete().eq('competition_id', financeCompId); 
        const rs = prizeRules.map(r => ({ competition_id: parseInt(financeCompId), position: parseInt(r.position), percentage: parseFloat(r.percentage||0), fixed_value: parseFloat(r.fixed_value||0) })); 
        if (rs.length) await supabase.from('prize_rules').insert(rs); 
        alert('Salvo com sucesso!'); 
        fetchAllData() 
    } catch(e) { alert(e.message) } finally { setLoading(false) } 
  }

  const addPrizeRule = () => setPrizeRules([...prizeRules, { position: prizeRules.length + 1, percentage: 0, fixed_value: 0 }])
  const removePrizeRule = (i) => setPrizeRules(prizeRules.filter((_, idx) => idx !== i).map((r, idx) => ({ ...r, position: idx + 1 })))
  const updatePrizeRule = (i, f, v) => { const n = [...prizeRules]; n[i][f] = v; setPrizeRules(n) }

  return (
    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-xl mb-12">
      <h2 className="text-2xl font-bold mb-6 text-yellow-400 flex items-center gap-2">💰 Configuração Financeira</h2>
      <div className="mb-6 p-4 bg-gray-900 rounded border border-gray-600">
        <label className="block text-sm text-gray-400 mb-2">Selecione o campeonato:</label>
        <select className="w-full p-3 bg-gray-800 rounded border border-gray-500 text-white font-bold" value={financeCompId} onChange={(e) => setFinanceCompId(e.target.value)}>
          <option value="" disabled>Selecione...</option>
          {competitions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      
      {financeCompId && (
        <div className="flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-1/3">
            <label className="block text-sm text-gray-400 mb-2">Valor da Inscrição (R$)</label>
            <input type="number" className="w-full p-3 bg-gray-700 rounded border border-gray-600 focus:border-yellow-400 text-xl font-bold text-white" value={entryFee} onChange={(e) => setEntryFee(e.target.value)} />
          </div>
          <div className="w-full md:w-2/3">
            <label className="block text-sm text-gray-400 mb-2">Prêmios</label>
            <div className="space-y-3">
              {prizeRules.map((rule, index) => (
                <div key={index} className="flex items-center gap-4 bg-gray-700/50 p-3 rounded">
                  <span className="font-bold text-yellow-400 w-8 text-lg">{rule.position}º</span>
                  <div className="flex-1">
                    <input type="number" className="w-full p-2 bg-gray-900 rounded border border-gray-600" value={rule.percentage} onChange={(e) => updatePrizeRule(index, 'percentage', e.target.value)} placeholder="%" />
                  </div>
                  <span className="text-gray-400 text-sm font-bold">OU</span>
                  <div className="flex-1">
                    <input type="number" className="w-full p-2 bg-gray-900 rounded border border-gray-600" value={rule.fixed_value} onChange={(e) => updatePrizeRule(index, 'fixed_value', e.target.value)} placeholder="R$" />
                  </div>
                  <button onClick={() => removePrizeRule(index)} className="text-red-400 text-xs font-bold uppercase">Remover</button>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-4">
              <button onClick={addPrizeRule} className="bg-gray-700 px-4 py-2 rounded text-sm font-bold hover:bg-gray-600">+ Posição</button>
              <button onClick={handleSaveConfig} className="bg-green-600 px-6 py-2 rounded text-sm font-bold ml-auto hover:bg-green-500">💾 Salvar Config</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}