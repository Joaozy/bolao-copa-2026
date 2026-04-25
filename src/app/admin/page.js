'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useRouter } from 'next/navigation'

function getFlagEmoji(countryCode) {
  if (!countryCode) return '🏳️'
  return countryCode.toUpperCase().replace(/./g, char => String.fromCodePoint(char.charCodeAt(0) + 127397))
}

const formatDateForInput = (isoString) => {
  if (!isoString) return ''
  const date = new Date(isoString)
  const offset = date.getTimezoneOffset()
  const localDate = new Date(date.getTime() - (offset * 60 * 1000))
  return localDate.toISOString().slice(0, 16)
}

const formatDateForDb = (localString) => {
    if (!localString) return null
    return new Date(localString).toISOString()
}

const formatDateForDisplay = (isoString) => {
  if (!isoString) return 'Sem prazo definido'
  return new Date(isoString).toLocaleString('pt-BR', { 
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' 
  })
}

const TeamBadge = ({ team }) => {
  const [imgSrc, setImgSrc] = useState(team?.badge_url)
  useEffect(() => { setImgSrc(team?.badge_url) }, [team?.badge_url])
  const handleError = () => {
    if (team?.name) {
      const slug = team.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-').replace(/[^\w\-]+/g, '') 
      const localPath = `/badges/${slug}.png`
      if (imgSrc !== localPath) setImgSrc(localPath)
    }
  }
  if (!team) return null
  if (!imgSrc) return <span className="mr-1 text-xl">{getFlagEmoji(team.flag_code)}</span>
  return <img src={imgSrc} alt={team.name} className="w-5 h-5 inline mr-1 object-contain" onError={handleError} />
}

export default function Admin() {
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('competitions')
  const [syncing, setSyncing] = useState(false)
  const [importing, setImporting] = useState(false)

  // DADOS
  const [competitions, setCompetitions] = useState([])
  const [teams, setTeams] = useState([])
  const [games, setGames] = useState([])
  const [enrollments, setEnrollments] = useState([]) 
  const [allProfiles, setAllProfiles] = useState([]) 
  const [allPlayers, setAllPlayers] = useState([]) 

  // FINANCEIRO E REGRAS
  const [financeCompId, setFinanceCompId] = useState('')
  const [entryFee, setEntryFee] = useState('0')
  const [prizeRules, setPrizeRules] = useState([])
  const [rulesCompId, setRulesCompId] = useState('')
  const [roundSettings, setRoundSettings] = useState([]) 
  const [specialRules, setSpecialRules] = useState([])
  const [specialsDeadline, setSpecialsDeadline] = useState('')
  const [isEditingDeadline, setIsEditingDeadline] = useState(false)
  
  // O SEGREDO DO ARTILHEIRO AQUI:
  const [scorerTeamFilter, setScorerTeamFilter] = useState('')

  // TABELAS E IMPORTAÇÃO
  const [standingsCompId, setStandingsCompId] = useState('')
  const [standings, setStandings] = useState([])
  const [tableImportForm, setTableImportForm] = useState({ leagueId: '71', season: '2025' })
  const [standingsForm, setStandingsForm] = useState({ team_id: '', group_name: 'Grupo A', points: 0, played: 0, won: 0, drawn: 0, lost: 0, goals_diff: 0 })
  const [filterCompId, setFilterCompId] = useState('')
  const [enrollmentFilterComp, setEnrollmentFilterComp] = useState('')
  const [userSearch, setUserSearch] = useState('')

  // ESTADOS FORMULÁRIOS
  const [editingCompId, setEditingCompId] = useState(null)
  const [editingTeamId, setEditingTeamId] = useState(null)
  const [editingGameId, setEditingGameId] = useState(null)
  const [compForm, setCompForm] = useState({ name: '', slug: '', type: 'pontos_corridos', entry_fee: 50, is_active: true })
  const [teamForm, setTeamForm] = useState({ name: '', flag_code: '' })
  const [gameForm, setGameForm] = useState({ competition_id: '', round: '', team_a: '', team_b: '', start_time: '', score_a: '', score_b: '', status_short: '', elapsed: '' })
  const [enrollForm, setEnrollForm] = useState({ user_id: '', competition_id: '' })
  const [availableRounds, setAvailableRounds] = useState([]) 
  const [fetchingRounds, setFetchingRounds] = useState(false)
  const [importPlayerTeamId, setImportPlayerTeamId] = useState('') 
  const [importForm, setImportForm] = useState({ leagueId: '71', season: '2025', round: '', competitionId: '', resetData: false })

  useEffect(() => {
    const savedTab = localStorage.getItem('adminActiveTab')
    if (savedTab) setActiveTab(savedTab)
    fetchAllData().finally(() => setLoading(false))
  }, [])

  const changeTab = (tab) => {
    setActiveTab(tab)
    localStorage.setItem('adminActiveTab', tab)
  }

  // EFEITO MÁGICO PARA BUSCAR ARTILHEIROS DINAMICAMENTE
  useEffect(() => {
    if (scorerTeamFilter) {
        supabase.from('players').select('*').eq('team_id', scorerTeamFilter).order('name')
            .then(({ data }) => setAllPlayers(data || []))
    } else {
        supabase.from('players').select('*').limit(500).order('name')
            .then(({ data }) => setAllPlayers(data || []))
    }
  }, [scorerTeamFilter])

  useEffect(() => { if (activeTab === 'finance' && financeCompId) fetchFinanceData(financeCompId) }, [financeCompId, activeTab])
  useEffect(() => { if (activeTab === 'rules' && rulesCompId) fetchRulesData(rulesCompId) }, [rulesCompId, activeTab])
  useEffect(() => { if (activeTab === 'standings' && standingsCompId) fetchStandingsData(standingsCompId) }, [standingsCompId, activeTab])

  // BUSCA DE DADOS À PROVA DE FALHAS (Não esconde os robôs)
  async function fetchAllData() {
    const [c, t, g, eRaw, pRaw] = await Promise.all([
      supabase.from('competitions').select('*').order('id'),
      supabase.from('teams').select('*').order('name'),
      supabase.from('games').select(`*, competition:competitions(name), team_a:teams!team_a_id(name, badge_url, flag_code), team_b:teams!team_b_id(name, badge_url, flag_code)`).order('start_time', { ascending: false }),
      supabase.from('enrollments').select('*'), // Busca pura sem joins perigosos
      supabase.from('profiles').select('*').order('email')
    ])
    
    setCompetitions(c.data || [])
    setTeams(t.data || [])
    setGames(g.data || [])
    setAllProfiles(pRaw.data || [])

    // Cruzamento manual para garantir que todos apareçam
    const profilesMap = {}
    pRaw.data?.forEach(p => profilesMap[p.id] = p)
    const compsMap = {}
    c.data?.forEach(comp => compsMap[comp.id] = comp)

    const enrollmentsWithDetails = (eRaw.data || []).map(enroll => ({
        ...enroll,
        profiles: profilesMap[enroll.user_id] || { email: 'simulador@teste.com', nickname: 'Robô Fictício', whatsapp: '-', is_active: true },
        competitions: compsMap[enroll.competition_id] || { name: 'Desconhecida' }
    }))
    
    setEnrollments(enrollmentsWithDetails.reverse())

    if (c.data && c.data.length > 0) {
        if (!financeCompId) setFinanceCompId(c.data[0].id)
        if (!rulesCompId) setRulesCompId(c.data[0].id)
        if (!standingsCompId) setStandingsCompId(c.data[0].id)
    }
  }

  const filteredEnrollments = enrollments.filter(e => {
    const matchesComp = !enrollmentFilterComp || (e.competition_id && e.competition_id.toString() === enrollmentFilterComp.toString())
    const searchLower = userSearch.toLowerCase()
    const p = e.profiles || {}
    const matchesUser = (p.nickname || '').toLowerCase().includes(searchLower) || (p.full_name || '').toLowerCase().includes(searchLower) || (p.email || '').toLowerCase().includes(searchLower)
    return matchesComp && matchesUser
  })

  const filteredGames = games.filter(g => !filterCompId || g.competition_id == filterCompId)
  const competitionTeams = teams.filter(t => !rulesCompId ? false : games.some(g => g.competition_id == rulesCompId && (g.team_a_id === t.id || g.team_b_id === t.id)))

  // FUNÇÕES REGRAS EXTRAS (Corrigindo o Bug do NULL)
  async function fetchRulesData(compId) { 
    const { data: savedMultipliers } = await supabase.from('round_settings').select('*').eq('competition_id', compId); 
    const compGames = games.filter(g => g.competition_id == compId); 
    const uniqueRounds = [...new Set(compGames.map(g => g.round))].filter(Boolean).sort(); 
    const mergedSettings = uniqueRounds.map(r => { const saved = savedMultipliers?.find(sm => sm.round_name === r); return { round_name: r, multiplier: saved ? saved.multiplier : 1.0 } }); 
    setRoundSettings(mergedSettings); 
    
    const { data: savedSpecials } = await supabase.from('special_rules').select('*').eq('competition_id', compId); 
    const existingDeadline = savedSpecials?.find(s => s.deadline)?.deadline; 
    setSpecialsDeadline(existingDeadline ? formatDateForInput(existingDeadline) : ''); 
    setIsEditingDeadline(false); 
    
    const baseSpecials = [{ type: 'champion', label: '🏆 Campeão', points: 50 }, { type: 'vice', label: '🥈 Vice-Campeão', points: 30 }, { type: 'third', label: '🥉 3º Lugar', points: 20 }, { type: 'fourth', label: '🏅 Quarto Lugar', points: 10 }, { type: 'top_scorer', label: '⚽ Artilheiro', points: 40 }]; 
    const mergedSpecials = baseSpecials.map(base => { const saved = savedSpecials?.find(s => s.type === base.type); return { ...base, ...saved } }); 
    setSpecialRules(mergedSpecials) 
  }
  
  const handleSaveRules = async () => { 
    if (!rulesCompId) return alert('Selecione!'); 
    setLoading(true); 
    try { 
        const multi = roundSettings.map(rs => ({ competition_id: parseInt(rulesCompId), round_name: rs.round_name, multiplier: parseFloat(rs.multiplier) })); 
        if (multi.length) await supabase.from('round_settings').upsert(multi, { onConflict: 'competition_id, round_name' }); 
        
        const dIso = specialsDeadline ? formatDateForDb(specialsDeadline) : null; 
        
        // CORREÇÃO CRÍTICA AQUI: Garante conversão de String para Int perfeita no Gabarito
        const specs = specialRules.map(sr => ({ 
            competition_id: parseInt(rulesCompId), 
            type: sr.type, 
            points: parseInt(sr.points), 
            is_active: sr.is_active, 
            correct_team_id: (sr.correct_team_id && String(sr.correct_team_id).trim() !== '') ? parseInt(sr.correct_team_id) : null, 
            correct_value: (sr.correct_value && String(sr.correct_value).trim() !== '') ? sr.correct_value : null, 
            deadline: dIso 
        })); 
        
        if (specs.length) await supabase.from('special_rules').upsert(specs, { onConflict: 'competition_id, type' }); 
        
        await supabase.rpc('calculate_points'); 
        await supabase.rpc('calculate_special_points'); 
        
        setIsEditingDeadline(false); 
        alert('Regras Salvas e Ranking Atualizado!'); 
        fetchRulesData(rulesCompId);
    } catch(e) {
        alert('Erro: ' + e.message);
    } finally {
        setLoading(false);
    } 
  }
  
  const updateRoundMultiplier = (rn, v) => { setRoundSettings(prev => prev.map(r => r.round_name === rn ? { ...r, multiplier: v } : r)) }
  const updateSpecialRule = (t, f, v) => { setSpecialRules(prev => prev.map(s => s.type === t ? { ...s, [f]: v } : s)) }

  // RESTANTE DAS FUNÇÕES
  const fetchStandingsData = async (compId) => { const { data } = await supabase.from('standings').select('*, teams(*)').eq('competition_id', compId).order('group_name', {ascending:true}).order('position', {ascending:true}); setStandings(data || []) }
  const handleSaveStanding = async (e) => { e.preventDefault(); if (!standingsCompId || !standingsForm.team_id) return alert('Preencha os dados!'); const payload = { ...standingsForm, competition_id: standingsCompId }; const { error } = await supabase.from('standings').upsert(payload, { onConflict: 'competition_id, team_id' }); if (error) alert('Erro: ' + error.message); else { alert('Time salvo!'); fetchStandingsData(standingsCompId); setStandingsForm(prev => ({ ...prev, team_id: '', points: 0, played: 0, won: 0, drawn: 0, lost: 0, goals_diff: 0 })) } }
  const handleDeleteStanding = async (id) => { if(!confirm('Remover?')) return; await supabase.from('standings').delete().eq('id', id); fetchStandingsData(standingsCompId) }
  const handleClearTable = async () => { if (!standingsCompId) return alert('Selecione uma competição!'); if (!confirm('ATENÇÃO: Apagar tabela toda?')) return; setLoading(true); try { const { error } = await supabase.from('standings').delete().eq('competition_id', standingsCompId); if (error) throw error; alert('Limpa!'); fetchStandingsData(standingsCompId) } catch (error) { alert('Erro: ' + error.message) } finally { setLoading(false) } }
  const handleImportTableData = async (type) => { if (!tableImportForm.leagueId || !tableImportForm.season || !standingsCompId) return alert('Preencha importação!'); setImporting(true); try { let endpoint = type === 'standings' ? '/api/admin/import-standings' : '/api/admin/import-games'; let body = { leagueId: tableImportForm.leagueId, season: tableImportForm.season, competitionId: standingsCompId, round: '', resetData: false }; const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const data = await res.json(); if (res.ok) { alert(`Sucesso! ${data.message}`); fetchStandingsData(standingsCompId); if (type === 'bracket') fetchAllData() } else alert('Erro: ' + JSON.stringify(data)) } catch(e) { alert('Erro rede: ' + e.message) } finally { setImporting(false) } }

  async function fetchFinanceData(c) { const { data: comp } = await supabase.from('competitions').select('entry_fee').eq('id', c).single(); if (comp) setEntryFee(comp.entry_fee); const { data: rules } = await supabase.from('prize_rules').select('*').eq('competition_id', c).order('position', { ascending: true }); setPrizeRules(rules || []) }
  const handleSaveConfig = async () => { if (!financeCompId) return; setLoading(true); try { await supabase.from('competitions').update({ entry_fee: entryFee }).eq('id', financeCompId); await supabase.from('prize_rules').delete().eq('competition_id', financeCompId); const rs = prizeRules.map(r => ({ competition_id: parseInt(financeCompId), position: parseInt(r.position), percentage: parseFloat(r.percentage||0), fixed_value: parseFloat(r.fixed_value||0) })); if (rs.length) await supabase.from('prize_rules').insert(rs); alert('Salvo!'); fetchAllData() } catch(e){alert(e.message)} finally{setLoading(false)} }
  const addPrizeRule = () => setPrizeRules([...prizeRules, { position: prizeRules.length + 1, percentage: 0, fixed_value: 0 }])
  const removePrizeRule = (i) => setPrizeRules(prizeRules.filter((_, idx) => idx !== i).map((r, idx) => ({ ...r, position: idx + 1 })))
  const updatePrizeRule = (i, f, v) => { const n = [...prizeRules]; n[i][f] = v; setPrizeRules(n) }

  const handleSaveComp = async (e) => { e.preventDefault(); const q = editingCompId ? supabase.from('competitions').update(compForm).eq('id', editingCompId) : supabase.from('competitions').insert(compForm); const {error} = await q; if(error) alert(error.message); else { alert('Salvo'); setCompForm({name:'',slug:'',type:'pontos_corridos',entry_fee:50,is_active:true}); setEditingCompId(null); fetchAllData() } }
  const handleEditComp = (c) => { setCompForm(c); setEditingCompId(c.id); changeTab('competitions') }
  const handleToggleCompStatus = async (c) => { await supabase.from('competitions').update({is_active:!c.is_active}).eq('id',c.id); fetchAllData() }
  
  const handleDeleteComp = async (id) => {
    if(confirm('Tem certeza que deseja apagar TUDO desta competição? (Ação irreversível)')) {
      setLoading(true);
      try {
        const { data: gData } = await supabase.from('games').select('id').eq('competition_id', id);
        const gIds = gData?.map(i => i.id) || [];
        if(gIds.length) {
          await supabase.from('bets').delete().in('game_id', gIds);
          await supabase.from('games').delete().eq('competition_id', id);
        }
        const { data: srData } = await supabase.from('special_rules').select('id').eq('competition_id', id);
        const srIds = srData?.map(i => i.id) || [];
        if (srIds.length) {
           await supabase.from('special_bets').delete().in('special_rule_id', srIds);
           await supabase.from('special_rules').delete().eq('competition_id', id);
        }
        await supabase.from('enrollments').delete().eq('competition_id', id);
        await supabase.from('prize_rules').delete().eq('competition_id', id);
        await supabase.from('round_settings').delete().eq('competition_id', id);
        await supabase.from('standings').delete().eq('competition_id', id);
        const { error } = await supabase.from('competitions').delete().eq('id', id);
        if (error) throw error; 
        alert('Competição excluída com sucesso!');
        fetchAllData();
      } catch(e) { alert('Erro ao excluir: ' + e.message); } finally { setLoading(false); }
    }
  }

  const handleSaveTeam = async (e) => { e.preventDefault(); const q = editingTeamId ? supabase.from('teams').update(teamForm).eq('id', editingTeamId) : supabase.from('teams').insert(teamForm); await q; fetchAllData(); setEditingTeamId(null) }
  const handleEditTeam = (t) => { setTeamForm(t); setEditingTeamId(t.id); window.scrollTo(0,0) }
  
  const handleSaveGame = async (e) => {
    e.preventDefault();
    setLoading(true);
    const payload = {
        competition_id: gameForm.competition_id, round: gameForm.round, start_time: gameForm.start_time,
        score_a: gameForm.score_a !== '' ? parseInt(gameForm.score_a) : null,
        score_b: gameForm.score_b !== '' ? parseInt(gameForm.score_b) : null,
        status_short: gameForm.status_short, elapsed: gameForm.elapsed,
        team_a_id: parseInt(gameForm.team_a), team_b_id: parseInt(gameForm.team_b)
    };
    const q = editingGameId ? supabase.from('games').update(payload).eq('id', editingGameId) : supabase.from('games').insert(payload);
    const { error } = await q;
    if (error) { alert('Erro do Supabase: ' + error.message); } else {
      await supabase.rpc('calculate_points'); 
      fetchAllData(); setEditingGameId(null); alert('Placar Salvo e Ranking Atualizado!');
    }
    setLoading(false);
  }

  const handleEditGame = (g) => { const d = new Date(g.start_time); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); setGameForm({ competition_id:g.competition_id, round:g.round, team_a:g.team_a_id, team_b:g.team_b_id, start_time: d.toISOString().slice(0,16), score_a:g.score_a??'', score_b:g.score_b??'', status_short:g.status_short||'', elapsed:g.elapsed||'' }); setEditingGameId(g.id); changeTab('games'); window.scrollTo(0,0) }
  const handleDeleteGame = async (id) => { if(confirm('Apagar?')) { await supabase.from('bets').delete().eq('game_id', id); await supabase.from('games').delete().eq('id', id); fetchAllData() } }
  const handleCancelEditGame = () => { setGameForm({competition_id:'', round:'', team_a:'', team_b:'', start_time:'', score_a:'', score_b:'', status_short:'', elapsed:''}); setEditingGameId(null) }
  const toggleEnrollmentPaid = async (id, s) => { await supabase.from('enrollments').update({is_paid:!s}).eq('id', id); fetchAllData() }
  const toggleActive = async (uid, s) => { await supabase.from('profiles').update({is_active:!s}).eq('id', uid); fetchAllData() }
  const handleManualEnroll = async (e) => { e.preventDefault(); if(!enrollForm.user_id) return; await supabase.from('enrollments').insert({user_id:enrollForm.user_id, competition_id:enrollForm.competition_id, is_paid:false}); fetchAllData() }
  const handleDeleteEnrollment = async (id) => { if(confirm('Remover?')) { await supabase.from('enrollments').delete().eq('id', id); fetchAllData() } }
  const handleImportGames = async (e) => { e.preventDefault(); setImporting(true); try { const r = await fetch('/api/admin/import-games', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(importForm)}); const d = await r.json(); alert(d.message); fetchAllData() } catch(e){alert(e.message)} finally{setImporting(false)} }
  const handleFetchRounds = async () => { setFetchingRounds(true); try { const r = await fetch(`/api/admin/fetch-rounds?leagueId=${importForm.leagueId}&season=${importForm.season}`); const d = await r.json(); if(d.rounds) { setAvailableRounds(d.rounds); if(d.rounds.length) setImportForm(p=>({...p, round:d.rounds[d.rounds.length-1]})) } } catch(e){alert(e.message)} finally{setFetchingRounds(false)} }
  const handleImportPlayers = async (e) => { e.preventDefault(); if(!importForm.competitionId) return; if(!confirm('Importar jogadores?')) return; setImporting(true); try{ const r = await fetch('/api/admin/import-players', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({leagueId:importForm.leagueId, season:importForm.season, competitionId:importForm.competitionId, specificTeamId:importPlayerTeamId})}); const d = await r.json(); alert(d.message) } catch(e){alert(e.message)} finally{setImporting(false)} }
  const handleSyncUsers = async () => { setSyncing(true); await fetch('/api/admin/sync-users', {method:'POST'}); fetchAllData(); setSyncing(false); alert('OK') }
  
  const getGamesForComp = (compId) => games.filter(g => g.competition_id == compId)

  if (loading) return <div className="text-white p-10 text-center">Carregando Painel V2...</div>

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 border-b border-gray-700 pb-4 gap-4">
        <h1 className="text-3xl font-bold text-red-500">Painel Admin V2 🛠️</h1>
        <select className="bg-gray-800 border border-gray-600 p-2 rounded text-white" value={filterCompId} onChange={e => setFilterCompId(e.target.value)}><option value="">Todas as Competições</option>{competitions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      </div>

      <div className="flex overflow-x-auto gap-2 mb-6 border-b border-gray-700 pb-1">
        {['competitions', 'standings', 'finance', 'rules', 'import', 'games', 'users', 'teams'].map(tab => (
            <button key={tab} onClick={() => changeTab(tab)} className={`px-4 py-2 font-bold rounded-t capitalize ${activeTab === tab ? 'bg-blue-800 text-white' : 'text-gray-400 hover:text-white'}`}>
                {tab === 'finance' ? '💰 Financeiro' : tab === 'rules' ? '⚙️ Regras' : tab === 'users' ? 'Inscritos' : tab === 'standings' ? '📊 Tabelas' : tab}
            </button>
        ))}
      </div>

      {activeTab === 'standings' && (
        <div className="space-y-6">
            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
                <h3 className="text-xl font-bold mb-4 text-green-400">Gerenciar Dados Oficiais</h3>
                <p className="text-gray-400 text-sm mb-4">Competição selecionada no topo: <strong>{competitions.find(c=>c.id==standingsCompId)?.name}</strong></p>
                <div className="mb-4"><select className="w-full p-3 bg-gray-900 rounded border border-gray-600 text-white" value={standingsCompId} onChange={e => setStandingsCompId(e.target.value)}><option value="" disabled>Selecione...</option>{competitions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                {standingsCompId && (
                    <div className="space-y-6">
                        <div className="bg-gray-900/50 p-4 rounded border border-blue-500/30">
                            <h4 className="font-bold text-blue-300 mb-2">Importar da API</h4>
                            <div className="flex gap-4 items-end">
                                <div className="flex-1"><label className="text-xs text-gray-500">ID Liga</label><input className="w-full p-2 bg-gray-800 rounded border border-gray-600 text-xs" value={tableImportForm.leagueId} onChange={e => setTableImportForm({...tableImportForm, leagueId: e.target.value})} placeholder="71" /></div>
                                <div className="flex-1"><label className="text-xs text-gray-500">Ano</label><input className="w-full p-2 bg-gray-800 rounded border border-gray-600 text-xs" value={tableImportForm.season} onChange={e => setTableImportForm({...tableImportForm, season: e.target.value})} placeholder="2025" /></div>
                                <button onClick={() => handleImportTableData('standings')} disabled={importing} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded text-xs font-bold text-white shadow">{importing ? '...' : '📥 Importar Tabela (Pontos)'}</button>
                                <button onClick={() => handleImportTableData('bracket')} disabled={importing} className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded text-xs font-bold text-white shadow ml-2">{importing ? '...' : '📥 Importar Jogos (Mata-mata)'}</button>
                                <button onClick={handleClearTable} disabled={importing} className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded text-xs font-bold text-white shadow ml-2">🗑️ Limpar Tabela</button>
                            </div>
                        </div>
                        <form onSubmit={handleSaveStanding} className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-700/30 rounded"><div className="col-span-2"><label className="text-xs text-gray-400">Time</label><select className="w-full p-2 bg-gray-900 rounded border border-gray-600 text-white" value={standingsForm.team_id} onChange={e => setStandingsForm({...standingsForm, team_id: e.target.value})} required><option value="">Selecione...</option>{teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div><div className="col-span-2"><label className="text-xs text-gray-400">Grupo</label><input className="w-full p-2 bg-gray-900 rounded border border-gray-600 text-white" value={standingsForm.group_name} onChange={e => setStandingsForm({...standingsForm, group_name: e.target.value})} /></div><div><label className="text-xs">Pos</label><input type="number" className="w-full p-2 bg-gray-900 rounded" value={standingsForm.position} onChange={e => setStandingsForm({...standingsForm, position: e.target.value})} /></div><div><label className="text-xs">Pts</label><input type="number" className="w-full p-2 bg-gray-900 rounded" value={standingsForm.points} onChange={e => setStandingsForm({...standingsForm, points: e.target.value})} /></div><div><label className="text-xs">J</label><input type="number" className="w-full p-2 bg-gray-900 rounded" value={standingsForm.played} onChange={e => setStandingsForm({...standingsForm, played: e.target.value})} /></div><div><label className="text-xs">SG</label><input type="number" className="w-full p-2 bg-gray-900 rounded" value={standingsForm.goals_diff} onChange={e => setStandingsForm({...standingsForm, goals_diff: e.target.value})} /></div><button className="col-span-2 md:col-span-4 bg-green-600 py-2 rounded font-bold mt-2">Salvar na Tabela</button></form>
                        <div><h4 className="font-bold text-white mb-2">Tabela Atual</h4><div className="overflow-x-auto bg-gray-900 rounded border border-gray-700"><table className="w-full text-left text-xs"><thead className="bg-gray-800 text-gray-400 uppercase"><tr><th className="p-2">Grupo</th><th className="p-2">Pos</th><th className="p-2">Time</th><th className="p-2 text-center">Pts</th><th className="p-2">Ação</th></tr></thead><tbody>{standings.map(s => (<tr key={s.id} className="border-b border-gray-700 hover:bg-gray-800"><td className="p-2 text-yellow-500 font-bold">{s.group_name}</td><td className="p-2">{s.position}º</td><td className="p-2 flex items-center gap-2"><TeamBadge team={s.teams}/> {s.teams?.name}</td><td className="p-2 text-center font-bold">{s.points}</td><td className="p-2"><button onClick={() => handleDeleteStanding(s.id)} className="text-red-400 hover:text-white">🗑️</button></td></tr>))}</tbody></table>{standings.length === 0 && <p className="text-gray-500 text-center py-4">Tabela vazia.</p>}</div></div>
                        <div className="mt-8"><h4 className="font-bold text-white mb-2 flex items-center gap-2">Jogos Cadastrados <span className="text-xs bg-gray-700 px-2 rounded">{getGamesForComp(standingsCompId).length}</span></h4><div className="overflow-y-auto max-h-[300px] bg-gray-900 rounded border border-gray-700 p-2 space-y-1">{getGamesForComp(standingsCompId).length > 0 ? getGamesForComp(standingsCompId).map(g => (<div key={g.id} className="flex justify-between items-center bg-gray-800/50 p-2 rounded text-xs hover:bg-gray-800"><div className="flex gap-2 items-center"><span className="text-yellow-500 font-bold w-20 truncate">{g.round}</span><span>{g.team_a?.name} <span className="text-gray-400">vs</span> {g.team_b?.name}</span></div><div className="text-gray-400">{new Date(g.start_time).toLocaleDateString('pt-BR')} {g.score_a!==null ? `(${g.score_a}x${g.score_b})` : ''}</div></div>)) : <p className="text-gray-500 text-center py-4">Nenhum jogo cadastrado.</p>}</div></div>
                    </div>
                )}
            </div>
        </div>
      )}

      {/* --- OUTRAS ABAS --- */}
      {activeTab === 'competitions' && (<div className="space-y-4"><form onSubmit={handleSaveComp} className="bg-gray-800 p-4 rounded border border-gray-700 flex gap-4"><input placeholder="Nome" className="flex-1 p-2 bg-gray-900 rounded text-white" value={compForm.name} onChange={e => setCompForm({...compForm, name: e.target.value})} /><button className="bg-green-600 px-4 rounded font-bold text-white">Salvar</button></form>{competitions.map(c => <div key={c.id} className="bg-gray-800 p-4 rounded flex justify-between items-center border border-gray-700"><div><div className="font-bold text-lg flex items-center gap-2">{c.name} {!c.is_active && <span className="text-[10px] bg-red-900 px-2 rounded">OCULTA</span>}</div><div className="text-xs text-gray-500">{c.slug} • R$ {c.entry_fee}</div></div><div className="flex gap-2"><button onClick={() => handleToggleCompStatus(c)} className={`text-xs border px-3 py-1 rounded font-bold ${c.is_active ? 'border-gray-600 text-gray-400' : 'border-green-600 text-green-400'}`}>{c.is_active ? 'Ocultar' : 'Mostrar'}</button><button onClick={() => handleEditComp(c)} className="bg-gray-700 px-3 py-1 rounded text-sm">✏️</button><button onClick={() => handleDeleteComp(c.id)} className="bg-red-900/30 text-red-400 border border-red-900 px-3 py-1 rounded text-sm">🗑️</button></div></div>)}</div>)}
      
      {activeTab === 'finance' && (<div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-xl mb-12"><h2 className="text-2xl font-bold mb-6 text-yellow-400 flex items-center gap-2">💰 Configuração Financeira</h2><div className="mb-6 p-4 bg-gray-900 rounded border border-gray-600"><label className="block text-sm text-gray-400 mb-2">Selecione o campeonato:</label><select className="w-full p-3 bg-gray-800 rounded border border-gray-500 text-white font-bold" value={financeCompId} onChange={(e) => setFinanceCompId(e.target.value)}><option value="" disabled>Selecione...</option>{competitions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>{financeCompId && (<div className="flex flex-col md:flex-row gap-8"><div className="w-full md:w-1/3"><label className="block text-sm text-gray-400 mb-2">Valor da Inscrição (R$)</label><input type="number" className="w-full p-3 bg-gray-700 rounded border border-gray-600 focus:border-yellow-400 text-xl font-bold text-white" value={entryFee} onChange={(e) => setEntryFee(e.target.value)} /></div><div className="w-full md:w-2/3"><label className="block text-sm text-gray-400 mb-2">Prêmios</label><div className="space-y-3">{prizeRules.map((rule, index) => (<div key={index} className="flex items-center gap-4 bg-gray-700/50 p-3 rounded"><span className="font-bold text-yellow-400 w-8 text-lg">{rule.position}º</span><div className="flex-1"><input type="number" className="w-full p-2 bg-gray-900 rounded border border-gray-600" value={rule.percentage} onChange={(e) => updatePrizeRule(index, 'percentage', e.target.value)} placeholder="%" /></div><span className="text-gray-400 text-sm font-bold">OU</span><div className="flex-1"><input type="number" className="w-full p-2 bg-gray-900 rounded border border-gray-600" value={rule.fixed_value} onChange={(e) => updatePrizeRule(index, 'fixed_value', e.target.value)} placeholder="R$" /></div><button onClick={() => removePrizeRule(index)} className="text-red-400 text-xs font-bold uppercase">Remover</button></div>))}</div><div className="mt-4 flex gap-4"><button onClick={addPrizeRule} className="bg-gray-700 px-4 py-2 rounded text-sm font-bold">+ Posição</button><button onClick={handleSaveConfig} className="bg-green-600 px-6 py-2 rounded text-sm font-bold ml-auto">💾 Salvar Config</button></div></div></div>)}</div>)}
      
      {activeTab === 'rules' && (<div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-xl mb-12"><h2 className="text-2xl font-bold mb-6 text-blue-400 flex items-center gap-2">⚙️ Regras & Resultados Extras</h2><div className="mb-6 p-4 bg-gray-900 rounded border border-gray-600"><label className="block text-sm text-gray-400 mb-2">Selecione o campeonato:</label><select className="w-full p-3 bg-gray-800 rounded border border-gray-500 text-white font-bold" value={rulesCompId} onChange={(e) => setRulesCompId(e.target.value)}><option value="" disabled>Selecione...</option>{competitions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>{rulesCompId && (<div className="grid md:grid-cols-2 gap-8"><div className="md:col-span-2 bg-gray-900/50 p-4 rounded border border-gray-600"><div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-yellow-400">📅 Prazo e Gabarito</h3>{!isEditingDeadline ? (<button onClick={() => setIsEditingDeadline(true)} className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded border border-gray-500">✏️ Editar Prazo</button>) : (<span className="text-xs text-green-400 font-bold">Editando...</span>)}</div><div className="flex flex-col gap-2 mb-6"><label className="text-xs text-gray-400 font-bold uppercase">Prazo Final:</label>{isEditingDeadline ? (<input type="datetime-local" className="w-full p-2 bg-gray-800 rounded border border-yellow-500 text-white text-sm" value={specialsDeadline} onChange={(e) => setSpecialsDeadline(e.target.value)} />) : (<div className="p-2 bg-gray-800 rounded border border-gray-700 text-gray-300 text-sm font-mono">{specialsDeadline ? formatDateForDisplay(formatDateForDb(specialsDeadline)) : 'Nenhum prazo definido'}</div>)}</div></div><div><h3 className="text-lg font-bold text-yellow-400 mb-4 border-b border-gray-700 pb-2">✖️ Multiplicadores</h3><div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">{roundSettings.length > 0 ? (roundSettings.map((rs, idx) => (<div key={idx} className="flex items-center justify-between bg-gray-700/50 p-3 rounded"><span className="font-bold text-sm">{rs.round_name}</span><div className="flex items-center gap-2"><span className="text-gray-400 text-xs">x</span><input type="number" step="0.1" min="1" className="w-16 p-1 bg-gray-900 rounded border border-gray-600 text-center font-bold text-yellow-400" value={rs.multiplier} onChange={(e) => updateRoundMultiplier(rs.round_name, e.target.value)}/></div></div>))) : <p className="text-gray-500 text-sm">Nenhuma rodada encontrada.</p>}</div></div><div><h3 className="text-lg font-bold text-purple-400 mb-4 border-b border-gray-700 pb-2">🏆 Opções de Aposta</h3><div className="space-y-4">{specialRules.map((sr, idx) => (<div key={idx} className={`p-4 rounded border transition ${sr.is_active ? 'bg-purple-900/20 border-purple-500' : 'bg-gray-700/30 border-gray-700 opacity-70'}`}><div className="flex justify-between items-center mb-2"><span className="font-bold">{sr.label}</span><button onClick={() => updateSpecialRule(sr.type, 'is_active', !sr.is_active)} className={`text-xs px-3 py-1 rounded-full font-bold ${sr.is_active ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'}`}>{sr.is_active ? 'ATIVADO' : 'DESATIVADO'}</button></div>{sr.is_active && (<div className="space-y-3"><div className="flex items-center gap-2"><label className="text-xs text-gray-400 w-16">Pontos:</label><input type="number" className="w-20 p-1 bg-gray-900 rounded border border-gray-600 text-center font-bold text-white" value={sr.points} onChange={(e) => updateSpecialRule(sr.type, 'points', e.target.value)}/><span className="text-xs text-yellow-400 font-bold">pts</span></div><div className="flex flex-col gap-2 mt-2 pt-2 border-t border-gray-700"><label className="text-xs text-green-400 font-bold">Vencedor Oficial:</label>{sr.type === 'top_scorer' ? (<div className="flex flex-col gap-2"><select className="w-full p-2 bg-gray-800 rounded border border-gray-600 text-xs text-white" value={scorerTeamFilter} onChange={e => setScorerTeamFilter(e.target.value)}><option value="">Filtre pelo Time...</option>{competitionTeams.length > 0 ? competitionTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>) : teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select><select className="w-full p-2 bg-gray-900 rounded border border-gray-500 text-white text-sm font-bold" value={sr.correct_value || ''} onChange={(e) => updateSpecialRule(sr.type, 'correct_value', e.target.value)} disabled={!scorerTeamFilter && !sr.correct_value}><option value="">Selecione o Jogador...</option>{sr.correct_value && !scorerTeamFilter && <option value={sr.correct_value}>{sr.correct_value}</option>}{allPlayers.filter(p => !scorerTeamFilter || p.team_id == scorerTeamFilter).map(p => <option key={p.id} value={p.name}>{p.name}</option>)}</select></div>) : (<select className="flex-1 p-2 bg-gray-900 rounded border border-gray-500 text-white text-sm" value={sr.correct_team_id || ''} onChange={(e) => updateSpecialRule(sr.type, 'correct_team_id', e.target.value)}><option value="">Selecione o Time...</option>{competitionTeams.length > 0 ? competitionTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>) : teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>)}</div></div>)}</div>))}</div></div></div>)}{rulesCompId && <div className="mt-8 pt-4 border-t border-gray-700 flex justify-end"><button onClick={handleSaveRules} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-lg font-bold shadow-lg">💾 Salvar Regras & Resultados</button></div>}</div>)}
      
      {activeTab === 'import' && (<div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg"><h3 className="text-xl font-bold mb-4 text-blue-400">Importar da API-Football</h3><form onSubmit={handleImportGames} className="space-y-4 max-w-lg"><select className="w-full p-3 bg-gray-900 rounded border border-gray-600 text-white" value={importForm.competitionId} onChange={e => setImportForm({...importForm, competitionId: e.target.value})} required><option value="">Selecione Competição...</option>{competitions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><div className="flex gap-4 items-end"><input className="w-1/3 p-3 bg-gray-900 rounded border border-gray-600 text-white" value={importForm.leagueId} onChange={e => setImportForm({...importForm, leagueId: e.target.value})} placeholder="71" required /><input className="w-1/3 p-3 bg-gray-900 rounded border border-gray-600 text-white" value={importForm.season} onChange={e => setImportForm({...importForm, season: e.target.value})} placeholder="2025" required /><button type="button" onClick={handleFetchRounds} disabled={fetchingRounds} className="w-1/3 p-3 bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded text-xs">{fetchingRounds ? '...' : '🔍 Rodadas'}</button></div>{availableRounds.length > 0 ? <select className="w-full p-3 bg-gray-900 rounded border border-gray-600 text-white font-bold" value={importForm.round} onChange={e => setImportForm({...importForm, round: e.target.value})}><option value="">Todas</option>{availableRounds.map(r => <option key={r} value={r}>{r}</option>)}</select> : <input className="w-full p-3 bg-gray-900 rounded border border-gray-600 text-white opacity-50" placeholder="Busque rodadas..." disabled value={importForm.round} />}<div className="flex items-center gap-2 mt-2 bg-red-900/20 p-3 rounded border border-red-900/50"><input type="checkbox" checked={importForm.resetData} onChange={e => setImportForm({...importForm, resetData: e.target.checked})} /><label className="text-sm text-red-300 font-bold">Limpar jogos antes?</label></div><div className="grid grid-cols-2 gap-4"><button disabled={importing} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded shadow-lg">{importing ? '...' : '📥 Importar Jogos'}</button><button onClick={handleImportPlayers} disabled={importing} className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded shadow-lg">{importing ? '...' : '🏃‍♂️ Importar Jogadores'}</button></div></form></div>)}
      
      {activeTab === 'games' && (<div className="grid md:grid-cols-3 gap-6"><div className="bg-gray-800 p-6 rounded-xl border border-gray-700 h-fit sticky top-4"><h3 className="text-lg font-bold mb-4 text-green-400">{editingGameId ? 'Editar' : 'Novo'} Jogo</h3><form onSubmit={handleSaveGame} className="space-y-3"><select className="w-full p-2 bg-gray-900 rounded border border-gray-600 text-white" value={gameForm.competition_id} onChange={e => setGameForm({...gameForm, competition_id: e.target.value})} required><option value="">Competição...</option>{competitions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><input className="w-full p-2 bg-gray-900 rounded border border-gray-600 text-white" placeholder="Rodada" value={gameForm.round} onChange={e => setGameForm({...gameForm, round: e.target.value})} required /><div className="flex gap-2"><select className="w-1/2 p-2 bg-gray-900 rounded border border-gray-600 text-white" value={gameForm.team_a} onChange={e => setGameForm({...gameForm, team_a: e.target.value})} required><option value="">Casa...</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select><select className="w-1/2 p-2 bg-gray-900 rounded border border-gray-600 text-white" value={gameForm.team_b} onChange={e => setGameForm({...gameForm, team_b: e.target.value})} required><option value="">Visitante...</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></div><input type="datetime-local" className="w-full p-2 bg-gray-900 rounded border border-gray-600 text-white" value={gameForm.start_time} onChange={e => setGameForm({...gameForm, start_time: e.target.value})} required /><div className="border-t border-gray-700 pt-3 mt-3"><label className="text-xs text-yellow-400 font-bold mb-1 block">Simular Ao Vivo (Admin)</label><div className="flex gap-2 mb-2"><input type="number" placeholder="Gol A" className="w-1/2 p-2 bg-gray-900 rounded border border-gray-600 text-white font-bold text-center" value={gameForm.score_a} onChange={e => setGameForm({...gameForm, score_a: e.target.value})} /><span className="text-white pt-2">x</span><input type="number" placeholder="Gol B" className="w-1/2 p-2 bg-gray-900 rounded border border-gray-600 text-white font-bold text-center" value={gameForm.score_b} onChange={e => setGameForm({...gameForm, score_b: e.target.value})} /></div><div className="flex gap-2"><select className="w-1/2 p-2 bg-gray-900 rounded border border-gray-600 text-white text-xs" value={gameForm.status_short} onChange={e => setGameForm({...gameForm, status_short: e.target.value})}><option value="">Não Iniciado</option><option value="1H">1º Tempo</option><option value="HT">Intervalo</option><option value="2H">2º Tempo</option><option value="FT">Fim de Jogo</option></select><input type="number" placeholder="Minutos (ex: 35)" className="w-1/2 p-2 bg-gray-900 rounded border border-gray-600 text-white text-xs" value={gameForm.elapsed} onChange={e => setGameForm({...gameForm, elapsed: e.target.value})} /></div></div><div className="flex gap-2 mt-4"><button className="flex-1 bg-green-600 rounded text-white">Salvar</button>{editingGameId && <button type="button" onClick={handleCancelEditGame} className="px-4 bg-gray-600 rounded text-white">Cancelar</button>}</div></form></div><div className="md:col-span-2 bg-gray-800 p-4 rounded-xl border border-gray-700 max-h-[80vh] overflow-y-auto">{filteredGames.map(g => (<div key={g.id} className="flex justify-between items-center bg-gray-700/30 p-3 mb-2 rounded hover:bg-gray-700/50"><div><div className="text-[10px] text-yellow-500 font-bold uppercase">{g.competition?.name} • {g.round}</div><div className="flex items-center gap-2 font-bold text-sm mt-1"><TeamBadge team={g.team_a} /> {g.team_a?.name} <span className="mx-2 bg-gray-900 px-2 py-0.5 rounded text-yellow-400">{g.score_a ?? '-'} x {g.score_b ?? '-'}</span><TeamBadge team={g.team_b} /> {g.team_b?.name}</div><div className="text-xs text-gray-500 flex gap-2 mt-1"><span>📅 {new Date(g.start_time).toLocaleString('pt-BR')}</span>{g.status_short && <span className="text-green-400 font-bold">[{g.status_short} {g.elapsed ? g.elapsed+"'" : ''}]</span>}</div></div><div className="flex gap-2"><button onClick={() => handleEditGame(g)} className="text-lg bg-gray-700 p-2 rounded hover:bg-white hover:text-black transition">✏️</button><button onClick={() => handleDeleteGame(g.id)} className="text-lg text-red-500 hover:bg-red-900/30 p-2 rounded transition">🗑️</button></div></div>))}</div></div>)}
      
      {activeTab === 'users' && (<div className="space-y-6"><div className="grid md:grid-cols-2 gap-6"><div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg"><h3 className="text-lg font-bold mb-4 text-blue-300">⚙️ Sincronização & Busca</h3><div className="flex gap-2 mb-4"><button onClick={handleSyncUsers} disabled={syncing} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold shadow text-sm whitespace-nowrap flex-1">{syncing?'...':'🔄 Sincronizar Base'}</button></div><div><label className="text-xs text-gray-400 mb-1 block">Buscar usuário (Global):</label><input placeholder="Nome, Apelido ou Email..." className="w-full p-3 bg-gray-900 rounded border border-gray-600 text-white text-sm" value={userSearch} onChange={e => setUserSearch(e.target.value)} /></div></div><div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg"><h3 className="text-lg font-bold mb-4 text-green-400">📝 Nova Inscrição</h3><div className="space-y-3"><select className="w-full p-2 bg-gray-900 rounded text-white border border-gray-600 text-sm" onChange={e => setEnrollForm({...enrollForm, user_id: e.target.value})}><option value="">Selecione Usuário...</option>{allProfiles.map(p => <option key={p.id} value={p.id}>{p.nickname || p.email}</option>)}</select><select className="w-full p-2 bg-gray-900 rounded text-white border border-gray-600 text-sm" onChange={e => setEnrollForm({...enrollForm, competition_id: e.target.value})}><option value="">Selecione Competição...</option>{competitions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><button onClick={handleManualEnroll} className="w-full bg-green-600 hover:bg-green-500 py-2 rounded font-bold text-sm text-white shadow">+ Inscrever Agora</button></div></div></div><div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-xl"><div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4"><h2 className="text-2xl font-bold text-white flex items-center gap-2">📋 Lista de Inscritos <span className="text-sm bg-gray-700 px-2 py-1 rounded text-gray-300">{filteredEnrollments.length}</span></h2><div className="flex items-center gap-2"><label className="text-sm text-gray-400 font-bold">Filtrar:</label><select className="bg-gray-900 border border-gray-600 p-2 rounded text-white text-sm min-w-[200px]" value={enrollmentFilterComp} onChange={e => setEnrollmentFilterComp(e.target.value)}><option value="">Todas as Competições</option>{competitions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div></div><div className="overflow-x-auto rounded-lg border border-gray-700"><table className="w-full text-left"><thead className="bg-gray-900 text-gray-400 text-xs uppercase font-bold tracking-wider"><tr><th className="p-4">Participante</th><th className="p-4">Competição</th><th className="p-4 text-center">Pagamento</th><th className="p-4 text-center">Visibilidade</th><th className="p-4 text-center">Ações</th></tr></thead><tbody className="divide-y divide-gray-700 bg-gray-800/50">{filteredEnrollments.length > 0 ? (filteredEnrollments.map(e => (<tr key={e.id} className="hover:bg-gray-700/50 transition"><td className="p-4"><div className="font-bold text-white text-sm">{e.profiles?.nickname || e.profiles?.full_name || 'Sem nome'}</div><div className="text-xs text-gray-500">{e.profiles?.email}</div><div className="text-xs text-gray-500">{e.profiles?.whatsapp || '-'}</div></td><td className="p-4"><span className="text-xs font-bold bg-gray-700 px-2 py-1 rounded text-yellow-200 border border-yellow-500/20">{e.competitions?.name}</span></td><td className="p-4 text-center"><button onClick={() => toggleEnrollmentPaid(e.id, e.is_paid)} className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition shadow-sm w-28 border ${e.is_paid ? 'bg-green-500/20 text-green-400 border-green-500 hover:bg-green-500 hover:text-black' : 'bg-red-500/10 text-red-400 border-red-500 hover:bg-red-500 hover:text-white'}`}>{e.is_paid ? 'Pago' : 'Pendente'}</button></td><td className="p-4 text-center"><button onClick={() => toggleActive(e.user_id, e.profiles?.is_active)} className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition shadow-sm w-28 border ${e.profiles?.is_active ? 'bg-blue-600/20 text-blue-400 border-blue-500 hover:bg-blue-600 hover:text-white' : 'bg-gray-700 text-gray-500 border-gray-600 hover:bg-gray-600 hover:text-gray-300'}`}>{e.profiles?.is_active ? 'Visível' : 'Oculto'}</button></td><td className="p-4 text-center"><button onClick={() => handleDeleteEnrollment(e.id)} className="text-red-500 hover:bg-red-900/30 p-2 rounded" title="Remover Inscrição">🗑️</button></td></tr>))) : <tr><td colSpan="5" className="p-12 text-center text-gray-500 italic">Nenhum inscrito encontrado com os filtros atuais.</td></tr>}</tbody></table></div></div></div>)}
      
      {activeTab === 'teams' && (<div className="bg-gray-800 p-6 rounded-xl border border-gray-700"><h3 className="text-xl font-bold mb-4 text-white">Gerenciar Times</h3><form onSubmit={handleSaveTeam} className="flex gap-4 mb-6"><input className="p-3 bg-gray-900 rounded border border-gray-600 flex-1 text-white" placeholder="Nome" value={teamForm.name} onChange={e => setTeamForm({...teamForm, name: e.target.value})} /><input className="p-3 bg-gray-900 rounded border border-gray-600 w-24 uppercase text-white" placeholder="Sigla" maxLength={2} value={teamForm.flag_code} onChange={e => setTeamForm({...teamForm, flag_code: e.target.value.toUpperCase()})} /><button className="bg-blue-600 px-6 rounded font-bold text-white">Salvar</button></form><div className="grid grid-cols-2 md:grid-cols-4 gap-2">{teams.map(t => (<button key={t.id} onClick={() => handleEditTeam(t)} className="bg-gray-900 p-2 rounded text-left text-sm hover:bg-gray-700 flex items-center gap-2 truncate text-white"><TeamBadge team={t} /> {t.name}</button>))}</div></div>)}

    </div>
  )
}