'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'

// Importação das novas Tabs
import TabCompetitions from './tabs/TabCompetitions'
import TabStandings from './tabs/TabStandings'
import TabFinance from './tabs/TabFinance'
import TabRules from './tabs/TabRules'
import TabImport from './tabs/TabImport'
import TabGames from './tabs/TabGames'
import TabUsers from './tabs/TabUsers'
import TabTeams from './tabs/TabTeams'
import TabBanners from './tabs/TabBanners'
import TabSponsors from './tabs/TabSponsors'

export default function Admin() {
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('competitions')
  
  // DADOS GLOBAIS
  const [competitions, setCompetitions] = useState([])
  const [teams, setTeams] = useState([])
  const [games, setGames] = useState([])
  const [enrollments, setEnrollments] = useState([]) 
  const [allProfiles, setAllProfiles] = useState([]) 
  const [banners, setBanners] = useState([])
  const [sponsors, setSponsors] = useState([])

  useEffect(() => {
    async function checkAdminAccess() {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session || session.user.email !== 'eng.joaofrancisco@outlook.com') {
        alert('Acesso negado.')
        window.location.href = '/'
        return
      }

      const savedTab = localStorage.getItem('adminActiveTab')
      if (savedTab) setActiveTab(savedTab)
      fetchAllData().finally(() => setLoading(false))
    }
    checkAdminAccess()
  }, [])

  const changeTab = (tab) => {
    setActiveTab(tab)
    localStorage.setItem('adminActiveTab', tab)
  }

  async function fetchAllData() {
    const [c, t, g, eRaw, pRaw, b, s] = await Promise.all([
      supabase.from('competitions').select('*').order('id'),
      supabase.from('teams').select('*').order('name'),
      supabase.from('games').select(`*, competition:competitions(name), team_a:teams!team_a_id(name, badge_url, flag_code), team_b:teams!team_b_id(name, badge_url, flag_code)`).order('start_time', { ascending: false }),
      supabase.from('enrollments').select('*'), 
      supabase.from('profiles').select('*').order('email'),
      supabase.from('banners').select('*').order('order_index'),
      supabase.from('sponsors').select('*').order('order_index')
    ])
    
    setCompetitions(c.data || [])
    setTeams(t.data || [])
    setGames(g.data || [])
    setAllProfiles(pRaw.data || [])
    setBanners(b.data || [])
    setSponsors(s.data || [])

    const profilesMap = {}
    pRaw.data?.forEach(p => profilesMap[p.id] = p)
    const compsMap = {}
    c.data?.forEach(comp => compsMap[comp.id] = comp)

    const enrollmentsWithDetails = (eRaw.data || []).map(enroll => ({
        ...enroll,
        profiles: profilesMap[enroll.user_id] || {},
        competitions: compsMap[enroll.competition_id] || {}
    }))
    setEnrollments(enrollmentsWithDetails.reverse())
  }

  if (loading) return <div className="text-white p-10 text-center">Carregando Painel Administrativo...</div>

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 pb-20">
      <div className="flex justify-between items-center mb-8 border-b border-gray-700 pb-4">
        <h1 className="text-3xl font-bold text-red-500">Painel Admin V2 🛠️</h1>
      </div>

      <div className="flex overflow-x-auto gap-2 mb-6 border-b border-gray-700 pb-1">
        {[
            {id: 'competitions', label: 'Competições'}, {id: 'standings', label: '📊 Tabelas'}, 
            {id: 'finance', label: '💰 Financeiro'}, {id: 'rules', label: '⚙️ Regras'}, 
            {id: 'import', label: 'Importar'}, {id: 'games', label: 'Jogos'}, 
            {id: 'users', label: 'Inscritos'}, {id: 'teams', label: 'Times'}, 
            {id: 'banners', label: '🖼️ Banners'}, {id: 'sponsors', label: '🤝 Parceiros'}
        ].map(tab => (
            <button key={tab.id} onClick={() => changeTab(tab.id)} className={`px-4 py-2 font-bold rounded-t whitespace-nowrap ${activeTab === tab.id ? 'bg-blue-800 text-white' : 'text-gray-400 hover:text-white'}`}>
                {tab.label}
            </button>
        ))}
      </div>

      <div className="mt-6">
        {activeTab === 'competitions' && <TabCompetitions competitions={competitions} fetchAllData={fetchAllData} setLoading={setLoading} />}
        {activeTab === 'standings' && <TabStandings competitions={competitions} teams={teams} games={games} fetchAllData={fetchAllData} setLoading={setLoading} />}
        {activeTab === 'finance' && <TabFinance competitions={competitions} fetchAllData={fetchAllData} setLoading={setLoading} />}
        {activeTab === 'rules' && <TabRules competitions={competitions} teams={teams} games={games} fetchAllData={fetchAllData} setLoading={setLoading} />}
        {activeTab === 'import' && <TabImport competitions={competitions} fetchAllData={fetchAllData} />}
        {activeTab === 'games' && <TabGames competitions={competitions} teams={teams} games={games} fetchAllData={fetchAllData} />}
        {activeTab === 'users' && <TabUsers competitions={competitions} enrollments={enrollments} allProfiles={allProfiles} fetchAllData={fetchAllData} />}
        {activeTab === 'teams' && <TabTeams teams={teams} fetchAllData={fetchAllData} />}
        {activeTab === 'banners' && <TabBanners banners={banners} fetchAllData={fetchAllData} />}
        {activeTab === 'sponsors' && <TabSponsors sponsors={sponsors} fetchAllData={fetchAllData} />}
      </div>
    </div>
  )
}