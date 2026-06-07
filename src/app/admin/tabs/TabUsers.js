'use client'
import { useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'

export default function TabUsers({ competitions, enrollments, allProfiles, fetchAllData }) {
  const [enrollForm, setEnrollForm] = useState({ user_id: '', competition_id: '' })
  const [enrollmentFilterComp, setEnrollmentFilterComp] = useState('')
  const [userSearch, setUserSearch] = useState('')

  const handleManualEnroll = async (e) => { 
    e.preventDefault(); 
    if(!enrollForm.user_id) return; 
    await supabase.from('enrollments').insert({user_id:enrollForm.user_id, competition_id:enrollForm.competition_id, is_paid:false}); 
    fetchAllData() 
  }
  
  const toggleEnrollmentPaid = async (id, s) => { await supabase.from('enrollments').update({is_paid:!s}).eq('id', id); fetchAllData() }
  const toggleActive = async (uid, s) => { await supabase.from('profiles').update({is_active:!s}).eq('id', uid); fetchAllData() }
  const handleDeleteEnrollment = async (id) => { if(confirm('Remover?')) { await supabase.from('enrollments').delete().eq('id', id); fetchAllData() } }

  const filteredEnrollments = enrollments.filter(e => {
    const matchesComp = !enrollmentFilterComp || (e.competition_id && e.competition_id.toString() === enrollmentFilterComp.toString())
    const searchLower = userSearch.toLowerCase()
    const p = e.profiles || {}
    return (p.nickname || '').toLowerCase().includes(searchLower) || (p.email || '').toLowerCase().includes(searchLower)
  })

  return (
    <div className="space-y-6">
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
                                    <button onClick={() => toggleEnrollmentPaid(e.id, e.is_paid)} className={`px-2 py-1 rounded text-xs ${e.is_paid ? 'bg-green-600' : 'bg-red-600'}`}>{e.is_paid ? 'Pago' : 'Pendente'}</button>
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