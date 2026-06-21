'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { loadCopaTimes } from '@/components/games/gameConstants';
import JOGADORES_COPA from '@/components/games/dados/jogadoresCopa.json';

const ORCAMENTO = 880; const POOL_SIZE = 22; const SQUAD_SIZE = 11; const LANCE_TEMPO = 8;
const AIS = [
  { id:'guloso',     nome:'Guloso',     cor:'#ef4444', emoji:'🔥', desc:'Paga caro por estrelas' },
  { id:'equilibrado',nome:'Equilibrado',cor:'#3b82f6', emoji:'⚖️', desc:'Bids balanceados' },
  { id:'economico',  nome:'Econômico',  cor:'#22c55e', emoji:'💰', desc:'Conservador' },
];

function aiLance(estrategia, jogador, budget, timeSize) {
  if (budget <= 0 || timeSize >= SQUAD_SIZE) return 0;
  const ovr = jogador.overall;
  if (estrategia === 'guloso') return ovr >= 87 ? Math.min(ovr + 5, budget) : Math.max(0, ovr - 18);
  if (estrategia === 'equilibrado') return Math.min(ovr - 7, budget);
  if (estrategia === 'economico') return ovr >= 86 ? 0 : Math.min(ovr - 9, budget);
  return 0;
}
function calcForce(players) { return players.length ? Math.round(players.reduce((s, p) => s + p.overall, 0) / players.length) : 0; }

export default function CopaLeilao() {
  const [step, setStep] = useState('setup');
  const [pool, setPool] = useState([]);
  const [leilaoIdx, setLeilaoIdx] = useState(0);
  const [lanceAtual, setLanceAtual] = useState(0);
  const [liderAtual, setLiderAtual] = useState(null);
  const [timer, setTimer] = useState(LANCE_TEMPO);
  const [esperandoLance, setEsperandoLance] = useState(false);
  
  const [meuBudget, setMeuBudget] = useState(ORCAMENTO);
  const [aiBudgets, setAiBudgets] = useState({ guloso: ORCAMENTO, equilibrado: ORCAMENTO, economico: ORCAMENTO });
  const [meuTime, setMeuTime] = useState([]);
  const [aiTimes, setAiTimes] = useState({ guloso: [], equilibrado: [], economico: [] });
  const [historico, setHistorico] = useState([]);
  const [resultado, setResultado] = useState(null);

  const timerRef = useRef(null);
  const lanceRef = useRef({ atual: 0, lider: null });
  const gameRef = useRef({ meuBudget: ORCAMENTO, aiBudgets: { guloso: ORCAMENTO, equilibrado: ORCAMENTO, economico: ORCAMENTO }, meuTime: [], aiTimes: { guloso: [], equilibrado: [], economico: [] }});
  const resolverRef = useRef(null);

  // Sincroniza estado com REF para a IA poder ler atualizado
  useEffect(() => { gameRef.current = { meuBudget, aiBudgets, meuTime, aiTimes }; }, [meuBudget, aiBudgets, meuTime, aiTimes]);

  const iniciar = async () => {
    const times = await loadCopaTimes();
    const timesMap = {}; times.forEach(t => { timesMap[t.id] = t; });

    // Pega jogadores do JSON local
    const base = JOGADORES_COPA.map(p => ({ ...p, team_name: timesMap[p.team_id]?.name || 'Nação', badge_url: timesMap[p.team_id]?.badge_url || null }));
    const tops = base.filter(p => p.overall >= 87).sort(() => Math.random() - 0.5).slice(0, 5);
    const mids = base.filter(p => p.overall >= 80 && p.overall < 87).sort(() => Math.random() - 0.5).slice(0, 10);
    const lows = base.filter(p => p.overall >= 74 && p.overall < 80).sort(() => Math.random() - 0.5).slice(0, 7);
    
    setPool([...tops, ...mids, ...lows].sort(() => Math.random() - 0.5));
    setMeuBudget(ORCAMENTO); setAiBudgets({ guloso: ORCAMENTO, equilibrado: ORCAMENTO, economico: ORCAMENTO });
    setMeuTime([]); setAiTimes({ guloso: [], equilibrado: [], economico: [] });
    setHistorico([]); setResultado(null); setStep('leilao');
  };

  const leiloarJogador = useCallback(async (jogador) => {
    const lance0 = Math.max(jogador.overall - 18, 50);
    let lanceC = lance0; let liderC = null;
    
    // IA faz o lance inicial
    for (const ai of AIS) {
      const b = gameRef.current.aiBudgets[ai.id];
      const t = gameRef.current.aiTimes[ai.id].length;
      const l = aiLance(ai.id, jogador, b, t);
      if (l > lanceC && l <= b) { lanceC = l; liderC = ai.id; }
    }

    setLanceAtual(lanceC); setLiderAtual(liderC);
    lanceRef.current = { atual: lanceC, lider: liderC };

    // Aguarda o usuário
    await new Promise((resolve) => {
      resolverRef.current = resolve;
      setEsperandoLance(true);
      let t = LANCE_TEMPO; setTimer(t);
      timerRef.current = setInterval(() => {
        t--; setTimer(t);
        if (t <= 0) { clearInterval(timerRef.current); setEsperandoLance(false); resolve('timeout'); }
      }, 1000);
    });

    const vencedor = lanceRef.current.lider;
    const preco = lanceRef.current.atual;

    setHistorico(prev => [...prev, { jogador, vencedor, lance: preco }]);

    if (!vencedor || vencedor === 'eu') {
      if (vencedor === 'eu') { setMeuBudget(b => b - preco); setMeuTime(t => [...t, jogador]); }
    } else {
      setAiBudgets(b => ({ ...b, [vencedor]: b[vencedor] - preco }));
      setAiTimes(t => ({ ...t, [vencedor]: [...t[vencedor], jogador] }));
    }
    await new Promise(r => setTimeout(r, 600)); // Pausa dramática entre lances
  }, []);

  useEffect(() => {
    if (step !== 'leilao' || pool.length === 0) return;
    (async () => {
      for (let i = 0; i < pool.length; i++) {
        setLeilaoIdx(i);
        await leiloarJogador(pool[i]);
        if (gameRef.current.meuTime.length >= SQUAD_SIZE) break;
      }
      setStep('resultado');
      const melhorAI = AIS.reduce((best, ai) => calcForce(gameRef.current.aiTimes[ai.id]) > calcForce(gameRef.current.aiTimes[best.id] || []) ? ai : best, AIS[0]);
      setResultado({ melhorAI, meuForce: calcForce(gameRef.current.meuTime), advForce: calcForce(gameRef.current.aiTimes[melhorAI.id]) });
    })();
  }, [step, pool, leiloarJogador]);

  const darLance = () => {
    if (!esperandoLance) return;
    clearInterval(timerRef.current);
    const novo = lanceRef.current.atual + 2;
    if (novo > meuBudget) return;

    let lanceC = novo; let liderC = 'eu';
    // IA rebate
    for (const ai of AIS) {
      const b = gameRef.current.aiBudgets[ai.id];
      const t = gameRef.current.aiTimes[ai.id].length;
      const l = aiLance(ai.id, pool[leilaoIdx], b, t);
      if (l > lanceC && l <= b) { lanceC = l; liderC = ai.id; }
    }

    setLanceAtual(lanceC); setLiderAtual(liderC);
    lanceRef.current = { atual: lanceC, lider: liderC };

    let t = LANCE_TEMPO; setTimer(t);
    timerRef.current = setInterval(() => {
      t--; setTimer(t);
      if (t <= 0) { clearInterval(timerRef.current); setEsperandoLance(false); resolverRef.current?.('timeout'); }
    }, 1000);
  };

  const passarVez = () => {
    if (!esperandoLance) return;
    clearInterval(timerRef.current);
    setEsperandoLance(false);
    resolverRef.current?.('pass');
  };

  const timerPct = (timer / LANCE_TEMPO) * 100;
  
  // RENDERIZAÇÃO MANTIDA IGUAL AO SEU (Mudei apenas o CSS de grid e botão pra não estourar a tela)
  return (
    <div style={{ minHeight: '100vh', background: '#08111f', color: '#f4f1ea', fontFamily: "'Inter', sans-serif", padding:'40px 16px' }}>
      <h1 style={{ fontFamily: "'Oswald',sans-serif", fontSize: 40, textAlign: 'center', color: '#f2c14e', margin:0 }}>Copa Leilão</h1>
      {step === 'setup' && (
        <div style={{ textAlign: 'center', marginTop: 40 }}>
          <button onClick={iniciar} style={{ padding: '16px 32px', fontSize: 20, background: '#f2c14e', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: "'Oswald',sans-serif" }}>🔨 Começar o Leilão</button>
        </div>
      )}

      {step === 'leilao' && pool[leilaoIdx] && (
        <div style={{ maxWidth: 600, margin: '20px auto' }}>
          {/* Status */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:20 }}>
            <div style={{ background:'rgba(242,193,78,.1)', padding:16, borderRadius:8, textAlign:'center', border:'1px solid #f2c14e' }}>
              <div style={{fontSize:12, color:'#f2c14e'}}>MEU SALDO</div><div style={{fontSize:24, fontWeight:'bold'}}>{meuBudget}</div>
            </div>
            <div style={{ background:'rgba(255,255,255,.05)', padding:16, borderRadius:8, textAlign:'center' }}>
              <div style={{fontSize:12, opacity:.6}}>MAIOR RIVAL</div><div style={{fontSize:24, fontWeight:'bold'}}>{Math.max(...AIS.map(a => aiBudgets[a.id]))}</div>
            </div>
          </div>

          {/* Card Jogador */}
          <div style={{ background:'#0d1a2e', padding:32, borderRadius:12, textAlign:'center', border:'2px solid rgba(244,241,234,.2)' }}>
            <h2 style={{ margin:0, fontSize:32, fontFamily:"'Oswald',sans-serif" }}>{pool[leilaoIdx].name}</h2>
            <p style={{ color:'rgba(244,241,234,.5)' }}>OVR {pool[leilaoIdx].overall} · {pool[leilaoIdx].team_name}</p>
            
            <div style={{ marginTop:24, background:'#08111f', padding:20, borderRadius:8 }}>
              <div style={{ fontSize:40, fontWeight:'bold', color: liderAtual === 'eu' ? '#6fd17a' : '#ff8a93' }}>{lanceAtual}</div>
              <div style={{ fontSize:14, opacity:.6 }}>{liderAtual === 'eu' ? '🏆 Você lidera' : liderAtual ? '🤖 IA lidera' : 'Sem lance'}</div>
              <div style={{ height:6, background:'rgba(255,255,255,.1)', marginTop:12, borderRadius:4 }}><div style={{ height:'100%', width:`${timerPct}%`, background:'#f2c14e', transition:'width 1s linear' }}/></div>
            </div>

            <div style={{ display:'flex', gap:10, marginTop:24 }}>
              <button onClick={darLance} disabled={!esperandoLance} style={{ flex:2, padding:16, background:'#f2c14e', border:'none', borderRadius:8, fontWeight:'bold', fontSize:18, cursor: esperandoLance ? 'pointer' : 'not-allowed', opacity: esperandoLance ? 1 : 0.5 }}>🔨 LANCE (+2)</button>
              <button onClick={passarVez} disabled={!esperandoLance} style={{ flex:1, padding:16, background:'transparent', border:'1px solid rgba(255,255,255,.2)', color:'#fff', borderRadius:8, cursor:'pointer' }}>PASSAR</button>
            </div>
          </div>
        </div>
      )}

      {step === 'resultado' && resultado && (
         <div style={{ textAlign: 'center', marginTop: 40 }}>
           <h2 style={{ fontFamily: "'Oswald',sans-serif", fontSize: 32, color: resultado.meuForce > resultado.advForce ? '#6fd17a' : '#ff8a93' }}>
             {resultado.meuForce > resultado.advForce ? '🏆 VOCÊ VENCEU O LEILÃO!' : '😔 A IA MONTOU UM TIME MELHOR'}
           </h2>
           <p style={{ fontSize: 20 }}>Força do seu time: <strong>{resultado.meuForce}</strong></p>
           <p style={{ fontSize: 20 }}>Força da IA ({resultado.melhorAI.nome}): <strong>{resultado.advForce}</strong></p>
           <button onClick={iniciar} style={{ padding: '12px 24px', marginTop: 24, background: '#f2c14e', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: "'Oswald',sans-serif", fontSize: 18 }}>Jogar Novamente</button>
         </div>
      )}
    </div>
  );
}