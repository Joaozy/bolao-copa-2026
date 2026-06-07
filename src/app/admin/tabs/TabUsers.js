'use client'
import { useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'

export default function TabUsers({ competitions, enrollments, fetchAllData }) {
  const [filterComp, setFilterComp] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [filterPaid, setFilterPaid] = useState('todos') // 'todos', 'pagos', 'pendentes'
  const [sortAlpha, setSortAlpha] = useState(false)

  const toggleEnrollmentPaid = async (id, s) => { await supabase.from('enrollments').update({is_paid:!s}).eq('id', id); fetchAllData() }
  const handleDeleteEnrollment = async (id) => { if(confirm('Remover?')) { await supabase.from('enrollments').delete().eq('id', id); fetchAllData() } }

  // Lógica de filtragem e ordenação
  const filteredEnrollments = enrollments
    .filter(e => {
        const matchesComp = !filterComp || (e.competition_id && e.competition_id.toString() === filterComp.toString())
        const searchLower = userSearch.toLowerCase()
        const p = e.profiles || {}
        const matchesUser = (p.nickname || '').toLowerCase().includes(searchLower) || (p.email || '').toLowerCase().includes(searchLower)
        const matchesPaid = filterPaid === 'todos' ? true : (filterPaid === 'pagos' ? e.is_paid : !e.is_paid)
        return matchesComp && matchesUser && matchesPaid
    })
    .sort((a, b) => {
        if (!sortAlpha) return 0
        const nameA = (a.profiles?.nickname || '').toLowerCase()
        const nameB = (b.profiles?.nickname || '').toLowerCase()
        return nameA.localeCompare(nameB)
    })

  return (
    <div className="space-y-6">
        {/* Painel de Filtros */}
        <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 grid md:grid-cols-4 gap-4">
            <select onChange={e => setFilterComp(e.target.value)} className="bg-gray-900 p-2 rounded text-sm border border-gray-600">
                <option value="">Todas Competições</option>
                {competitions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input 
                placeholder="Pesquisar por nome ou email..." 
                className="bg-gray-900 p-2 rounded text-sm border border-gray-600" 
                onChange={e => setUserSearch(e.target.value)} 
            />
            <select onChange={e => setFilterPaid(e.target.value)} className="bg-gray-900 p-2 rounded text-sm border border-gray-600">
                <option value="todos">Todos Pagamentos</option>
                <option value="pagos">Apenas Pagos</option>
                <option value="pendentes">Apenas Pendentes</option>
            </select>
            <button 
                onClick={() => setSortAlpha(!sortAlpha)} 
                className={`p-2 rounded text-sm font-bold border ${sortAlpha ? 'bg-blue-600 border-blue-500' : 'bg-gray-700 border-gray-600'}`}
            >
                {sortAlpha ? 'Ordenado A-Z' : 'Ordenar A-Z'}
            </button>
        </div>

        {/* Tabela de Inscritos */}
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
            <h2 className="text-2xl font-bold mb-6 text-white">📋 Lista de Inscritos ({filteredEnrollments.length})</h2>
            <div className="overflow-x-auto rounded-lg border border-gray-700">
                <table className="w-full text-left">
                    <thead className="bg-gray-900 text-gray-400 text-xs uppercase font-bold">
                        <tr><th className="p-4">Participante</th><th className="p-4">Competição</th><th className="p-4">Ações</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700 bg-gray-800/50">
                        {filteredEnrollments.map(e => (
                            <tr key={e.id}>
                                <td className="p-4 text-sm text-white">{e.profiles?.nickname || e.profiles?.email}</td>
                                <td className="p-4 text-xs text-yellow-200">{e.competitions?.name}</td>
                                <td className="p-4 flex gap-2">
                                    <button onClick={() => toggleEnrollmentPaid(e.id, e.is_paid)} className={`px-2 py-1 rounded text-xs ${e.is_paid ? 'bg-green-600' : 'bg-red-600'}`}>
                                        {e.is_paid ? 'Pago' : 'Pendente'}
                                    </button>
                                    <button onClick={() => handleDeleteEnrollment(e.id)} className="bg-red-900 p-1 rounded text-xs">🗑️</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  )
}