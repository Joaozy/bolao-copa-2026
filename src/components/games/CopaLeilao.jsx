'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { COMPETITION_ID_COPA } from '@/components/games/gameConstants';
// Em seguida, role o código e onde tinha COMPETITION_ID, troque para COMPETITION_ID_COPA (ou apenas mude o nome da constante para COMPETITION_ID = COMPETITION_ID_COPA)

// ─── Constantes ───────────────────────────────────────────────────────────────
const COMPETITION_ID = COMPETITION_ID_COPA;
const ORCAMENTO = 880;     // OVR budget total por time
const POOL_SIZE  = 22;     // jogadores no leilão
const SQUAD_SIZE = 11;     // jogadores para montar o XI
const LANCE_TEMPO = 8;     // segundos por rodada de lance

const POS_CAT = { GOL:'GOL', LD:'DEF', LE:'DEF', ZAG:'DEF', VOL:'MEI', MC:'MEI', MEI:'MEI', MD:'MEI', ME:'MEI', PD:'ATA', PE:'ATA', SA:'ATA', CA:'ATA' };

const AIS = [
  { id:'guloso',     nome:'Guloso',     cor:'#ef4444', emoji:'🔥', desc:'Paga caro por estrelas, fica sem budget' },
  { id:'equilibrado',nome:'Equilibrado',cor:'#3b82f6', emoji:'⚖️', desc:'Bids balanceados, time consistente' },
  { id:'economico',  nome:'Econômico',  cor:'#22c55e', emoji:'💰', desc:'Conservador, ignora os tops' },
];

function aiLance(estrategia, jogador, budget, timeSize) {
  const ovr = jogador.overall;
  const precise = budget > 0 && timeSize < SQUAD_SIZE;
  if (!precise) return 0;

  switch (estrategia) {
    case 'guloso':
      if (ovr >= 89) return Math.min(ovr + 8, budget);
      if (ovr >= 83) return Math.min(ovr - 2, budget);
      return Math.max(0, ovr - 18);
    case 'equilibrado':
      return Math.min(ovr - 7, budget);
    case 'economico':
      if (ovr >= 88) return 0;
      if (ovr >= 80) return Math.min(ovr - 14, budget);
      return Math.min(ovr - 8, budget);
    default:
      return 0;
  }
}

function calcForce(players) {
  if (!players.length) return 0;
  return Math.round(players.reduce((s, p) => s + p.overall, 0) / players.length);
}

function forma(v, amp = 3) { return v + (Math.random() * amp * 2 - amp); }

function simularFinal(meuTime, advTime) {
  const meuOVR  = calcForce(meuTime);
  const advOVR  = calcForce(advTime);
  const mA = forma(meuOVR);
  const aA = forma(advOVR);
  const pEu  = Math.max(0.17, Math.min(0.50, 0.28 + (mA - aA) * 0.012));
  const pAdv = Math.max(0.10, Math.min(0.40, 0.23 + (aA - mA) * 0.012));
  const cEu  = 3 + Math.round(0.5 * 4);
  const cAdv = 3 + Math.round(0.5 * 4);
  const duelo = p => Math.random() < p;
  let gEu = 0, gAdv = 0;
  for (let i = 0; i < cEu; i++)  if (duelo(pEu))  gEu++;
  for (let i = 0; i < cAdv; i++) if (duelo(pAdv)) gAdv++;
  return { gEu, gAdv };
}

const delay = ms => new Promise(r => setTimeout(r, ms));

// ─── Componente ───────────────────────────────────────────────────────────────
export default function CopaLeilao() {
  const [step, setStep] = useState('setup');   // setup | leilao | resultado
  const [pool, setPool] = useState([]);
  const [leilaoIdx, setLeilaoIdx] = useState(0);
  const [lanceAtual, setLanceAtual] = useState(0);
  const [liderAtual, setLiderAtual] = useState(null);  // 'eu' | 'guloso' | 'equilibrado' | 'economico'
  const [timer, setTimer] = useState(LANCE_TEMPO);
  const [esperandoLance, setEsperandoLance] = useState(false);
  const [meuBudget, setMeuBudget] = useState(ORCAMENTO);
  const [aiBudgets, setAiBudgets] = useState({ guloso: ORCAMENTO, equilibrado: ORCAMENTO, economico: ORCAMENTO });
  const [meuTime, setMeuTime] = useState([]);
  const [aiTimes, setAiTimes] = useState({ guloso: [], equilibrado: [], economico: [] });
  const [historico, setHistorico] = useState([]);  // jogadores já leiloados
  const [resultado, setResultado] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [lanceProcessando, setLanceProcessando] = useState(false);

  const timerRef = useRef(null);
  const lanceRef = useRef({ atual: 0, lider: null, meuBudget: ORCAMENTO, aiBudgets: { guloso: ORCAMENTO, equilibrado: ORCAMENTO, economico: ORCAMENTO }, meuTime: [], aiTimes: { guloso: [], equilibrado: [], economico: [] } });
  const resolverRef = useRef(null);

  // Sincroniza ref com state
  useEffect(() => { lanceRef.current.meuBudget = meuBudget; }, [meuBudget]);
  useEffect(() => { lanceRef.current.aiBudgets = aiBudgets; }, [aiBudgets]);
  useEffect(() => { lanceRef.current.meuTime = meuTime; }, [meuTime]);
  useEffect(() => { lanceRef.current.aiTimes = aiTimes; }, [aiTimes]);

  const iniciar = async () => {
    setCarregando(true);
    // Busca jogadores: mix de tiers
    const { data: tops }  = await supabase.from('players').select('id,name,pos1,position,overall,teams(name,badge_url)').eq('competition_id', COMPETITION_ID).gte('overall', 88).order('overall', { ascending: false }).limit(6);
    const { data: mids }  = await supabase.from('players').select('id,name,pos1,position,overall,teams(name,badge_url)').eq('competition_id', COMPETITION_ID).gte('overall', 79).lt('overall', 88).order('overall', { ascending: false }).limit(10);
    const { data: lows }  = await supabase.from('players').select('id,name,pos1,position,overall,teams(name,badge_url)').eq('competition_id', COMPETITION_ID).gte('overall', 72).lt('overall', 79).order('overall', { ascending: false }).limit(12);

    const todos = [...(tops||[]), ...(mids||[]), ...(lows||[])].map(p => ({
      id: p.id, name: p.name, pos1: p.pos1, position: p.position, overall: p.overall,
      team_name: p.teams?.name || '', badge_url: p.teams?.badge_url || null,
    }));

    // Embaralha e pega 22
    const embaralhado = todos.sort(() => Math.random() - 0.5).slice(0, POOL_SIZE);
    setPool(embaralhado);
    setMeuBudget(ORCAMENTO); setAiBudgets({ guloso: ORCAMENTO, equilibrado: ORCAMENTO, economico: ORCAMENTO });
    setMeuTime([]); setAiTimes({ guloso: [], equilibrado: [], economico: [] });
    setHistorico([]); setLeilaoIdx(0); setResultado(null);
    lanceRef.current = { atual: 0, lider: null, meuBudget: ORCAMENTO, aiBudgets: { guloso: ORCAMENTO, equilibrado: ORCAMENTO, economico: ORCAMENTO }, meuTime: [], aiTimes: { guloso: [], equilibrado: [], economico: [] } };
    setCarregando(false);
    setStep('leilao');
  };

  // Roda um leilão de 1 jogador
  const leiloarJogador = useCallback(async (jogador, idx) => {
    const lance0 = Math.max(jogador.overall - 20, 50);
    let lanceC = lance0;
    let liderC = null;

    setLanceAtual(lance0); setLiderAtual(null); setTimer(LANCE_TEMPO);

    // Lance inicial dos AIs
    for (const ai of AIS) {
      const aiB = lanceRef.current.aiBudgets[ai.id];
      const aiT = lanceRef.current.aiTimes[ai.id];
      const aiL = aiLance(ai.id, jogador, aiB, aiT.length);
      if (aiL > lanceC && aiL <= aiB) { lanceC = aiL; liderC = ai.id; }
    }

    setLanceAtual(lanceC); setLiderAtual(liderC);
    lanceRef.current.atual = lanceC; lanceRef.current.lider = liderC;

    // Timer countdown — espera input do usuário
    await new Promise((resolve) => {
      resolverRef.current = resolve;
      setEsperandoLance(true);

      let t = LANCE_TEMPO;
      setTimer(t);
      timerRef.current = setInterval(() => {
        t--;
        setTimer(t);
        if (t <= 0) {
          clearInterval(timerRef.current);
          setEsperandoLance(false);
          resolve('timeout');
        }
      }, 1000);
    });

    // Atribui jogador ao vencedor
    const vencedor = lanceRef.current.lider;
    const lanceFinal = lanceRef.current.atual;

    setHistorico(prev => [...prev, { jogador, vencedor, lance: lanceFinal }]);

    if (!vencedor || vencedor === 'eu') {
      // Eu venci (ou ninguém lançou)
      if (vencedor === 'eu') {
        setMeuBudget(b => b - lanceFinal);
        setMeuTime(t => [...t, jogador]);
        lanceRef.current.meuTime = [...lanceRef.current.meuTime, jogador];
        lanceRef.current.meuBudget = lanceRef.current.meuBudget - lanceFinal;
      }
    } else {
      // IA venceu
      setAiBudgets(b => ({ ...b, [vencedor]: b[vencedor] - lanceFinal }));
      setAiTimes(t => ({ ...t, [vencedor]: [...t[vencedor], jogador] }));
      lanceRef.current.aiBudgets = { ...lanceRef.current.aiBudgets, [vencedor]: lanceRef.current.aiBudgets[vencedor] - lanceFinal };
      lanceRef.current.aiTimes = { ...lanceRef.current.aiTimes, [vencedor]: [...lanceRef.current.aiTimes[vencedor], jogador] };
    }

    await delay(400);
  }, []);

  // Orquestra o leilão completo
  useEffect(() => {
    if (step !== 'leilao' || pool.length === 0) return;

    (async () => {
      for (let i = 0; i < pool.length; i++) {
        setLeilaoIdx(i);
        await leiloarJogador(pool[i], i);
        if (lanceRef.current.meuTime.length >= SQUAD_SIZE) break;
      }
      // Preenche o time com IAs se não chegou a 11
      setStep('resultado');
      const melhorAI = AIS.reduce((best, ai) => {
        const force = calcForce(lanceRef.current.aiTimes[ai.id]);
        const bestForce = calcForce(lanceRef.current.aiTimes[best.id] || []);
        return force > bestForce ? ai : best;
      }, AIS[0]);

      const sim = simularFinal(lanceRef.current.meuTime, lanceRef.current.aiTimes[melhorAI.id]);
      setResultado({ sim, melhorAI, meuForce: calcForce(lanceRef.current.meuTime), advForce: calcForce(lanceRef.current.aiTimes[melhorAI.id]) });
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, pool]);

  const darLance = () => {
    if (!esperandoLance || lanceProcessando) return;
    const novo = lanceRef.current.atual + 2;
    if (novo > lanceRef.current.meuBudget) return;

    setLanceProcessando(true);
    clearInterval(timerRef.current);

    // Verifica se AI contra-lança
    let lanceC = novo; let liderC = 'eu';
    for (const ai of AIS) {
      const aiB = lanceRef.current.aiBudgets[ai.id];
      const jogadorAtual = pool[leilaoIdx];
      const aiL = aiLance(ai.id, jogadorAtual, aiB, lanceRef.current.aiTimes[ai.id].length);
      if (aiL > lanceC && aiL <= aiB) { lanceC = aiL; liderC = ai.id; }
    }

    lanceRef.current.atual = lanceC; lanceRef.current.lider = liderC;
    setLanceAtual(lanceC); setLiderAtual(liderC);

    // Reinicia timer
    let t = LANCE_TEMPO; setTimer(t);
    timerRef.current = setInterval(() => {
      t--; setTimer(t);
      if (t <= 0) {
        clearInterval(timerRef.current);
        setEsperandoLance(false);
        if (resolverRef.current) { resolverRef.current('timeout'); resolverRef.current = null; }
      }
    }, 1000);
    setLanceProcessando(false);
  };

  const passarVez = () => {
    if (!esperandoLance) return;
    clearInterval(timerRef.current);
    setEsperandoLance(false);
    if (resolverRef.current) { resolverRef.current('pass'); resolverRef.current = null; }
  };

  const reiniciar = () => { setStep('setup'); setPool([]); setHistorico([]); setResultado(null); };

  const jogadorAtual = pool[leilaoIdx];
  const meuTimeSize = meuTime.length;
  const timerPct = (timer / LANCE_TEMPO) * 100;
  const timerCor = timer <= 3 ? '#ef4444' : timer <= 5 ? '#f2c14e' : '#6fd17a';

  return (
    <div style={{ minHeight: '100vh', background: '#08111f', color: '#f4f1ea', fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');
        *{box-sizing:border-box;}
        .lei{max-width:820px;margin:0 auto;padding:26px 16px 60px;}
        .lei-eye{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#f2c14e;text-align:center;margin-bottom:4px;}
        .lei-h1{font-family:'Oswald',sans-serif;font-weight:700;font-size:clamp(30px,6vw,52px);text-transform:uppercase;text-align:center;margin:0;background:linear-gradient(160deg,#fff 30%,#f2c14e);-webkit-background-clip:text;background-clip:text;color:transparent;}
        .lei-sub{text-align:center;color:rgba(244,241,234,.5);font-size:13px;margin:6px 0 0;font-family:'JetBrains Mono',monospace;}
        .lei-card{background:rgba(255,255,255,.03);border:1px solid rgba(244,241,234,.1);border-radius:14px;}
        .lei-btn{font-family:'Oswald',sans-serif;font-size:17px;text-transform:uppercase;padding:13px 32px;border-radius:10px;border:none;background:linear-gradient(135deg,#f2c14e,#c9941f);color:#1a1300;cursor:pointer;transition:transform .15s;display:block;margin:16px auto 0;}
        .lei-btn:hover{transform:translateY(-2px);}
        .lei-btn:disabled{opacity:.4;cursor:not-allowed;transform:none;}

        /* Placar de budgets */
        .lei-budgets{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-bottom:14px;}
        .lei-budget-card{border-radius:10px;padding:10px 12px;text-align:center;border:2px solid transparent;transition:all .2s;}
        .lei-budget-card.ativo{transform:scale(1.04);}
        .lei-budget-nome{font-family:'Oswald',sans-serif;font-size:13px;text-transform:uppercase;margin-bottom:2px;}
        .lei-budget-val{font-family:'JetBrains Mono',monospace;font-size:18px;font-weight:700;}
        .lei-budget-count{font-family:'JetBrains Mono',monospace;font-size:10px;opacity:.6;margin-top:2px;}

        /* Player card do leilão */
        .lei-player-card{background:#0d1a2e;border:2px solid rgba(242,193,78,.4);border-radius:16px;padding:24px;text-align:center;margin-bottom:14px;animation:lei-pop .3s ease;}
        @keyframes lei-pop{from{opacity:0;transform:scale(.97);}to{opacity:1;transform:scale(1);}}
        .lei-player-flag{width:54px;height:36px;object-fit:cover;border-radius:5px;margin:0 auto 10px;display:block;}
        .lei-player-name{font-family:'Oswald',sans-serif;font-size:22px;text-transform:uppercase;margin:0 0 4px;}
        .lei-player-meta{font-family:'JetBrains Mono',monospace;font-size:12px;color:rgba(244,241,234,.5);}
        .lei-player-ovr{font-family:'Oswald',sans-serif;font-size:40px;font-weight:700;color:#f2c14e;display:block;margin:4px 0;}

        /* Lance em andamento */
        .lei-lance-box{background:#070a12;border-radius:12px;padding:16px;text-align:center;margin-bottom:12px;}
        .lei-lance-atual{font-family:'Oswald',sans-serif;font-size:34px;font-weight:700;color:#f4f1ea;}
        .lei-lance-lider{font-family:'JetBrains Mono',monospace;font-size:12px;margin-top:4px;}
        .lei-timer-bar{height:5px;background:rgba(244,241,234,.1);border-radius:999px;margin-top:10px;overflow:hidden;}
        .lei-timer-fill{height:100%;border-radius:999px;transition:width .9s linear,background .3s;}

        /* Botões de lance */
        .lei-lance-btns{display:flex;gap:10px;justify-content:center;margin-bottom:14px;}
        .lei-bid-btn{font-family:'Oswald',sans-serif;font-size:18px;text-transform:uppercase;padding:14px 28px;border-radius:10px;border:none;cursor:pointer;transition:all .15s;}
        .lei-bid-btn.dar{background:linear-gradient(135deg,#f2c14e,#c9941f);color:#1a1300;flex:2;}
        .lei-bid-btn.dar:hover{transform:scale(1.03);}
        .lei-bid-btn.dar:disabled{opacity:.35;cursor:not-allowed;transform:none;}
        .lei-bid-btn.pass{background:rgba(244,241,234,.06);border:1px solid rgba(244,241,234,.2);color:rgba(244,241,234,.7);flex:1;}
        .lei-bid-btn.pass:hover{background:rgba(244,241,234,.1);}

        /* Progress */
        .lei-progress{font-family:'JetBrains Mono',monospace;font-size:11px;text-align:center;color:rgba(244,241,234,.4);margin-bottom:10px;}

        /* Histórico */
        .lei-hist{max-height:180px;overflow-y:auto;display:flex;flex-direction:column;gap:5px;}
        .lei-hist-item{display:flex;align-items:center;gap:8px;padding:7px 10px;background:rgba(255,255,255,.03);border-radius:7px;font-size:12px;}
        .lei-hist-flag{width:22px;height:14px;object-fit:cover;border-radius:2px;flex-shrink:0;}
        .lei-hist-nome{flex:1;font-weight:600;}
        .lei-hist-lider{font-family:'JetBrains Mono',monospace;font-size:10px;padding:2px 6px;border-radius:4px;}

        /* Resultado */
        .lei-result-teams{display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:center;margin:16px 0;}
        .lei-result-team{text-align:center;}
        .lei-result-team-name{font-family:'Oswald',sans-serif;font-size:16px;text-transform:uppercase;margin-bottom:6px;}
        .lei-result-players{display:flex;flex-direction:column;gap:4px;}
        .lei-result-player{font-size:11px;font-family:'JetBrains Mono',monospace;background:rgba(255,255,255,.04);border-radius:5px;padding:4px 8px;display:flex;justify-content:space-between;}
        .lei-scorebox{font-family:'Oswald',sans-serif;font-size:48px;font-weight:700;text-align:center;line-height:1;}

        @media(max-width:560px){.lei-budgets{grid-template-columns:1fr 1fr;} .lei-result-teams{grid-template-columns:1fr;} .lei-scorebox{font-size:36px;}}
      `}</style>

      <div className="lei">
        <p className="lei-eye">Copa do Mundo 2026</p>
        <h1 className="lei-h1">Copa Leilão</h1>
        <p className="lei-sub">Dispute 22 craques em leilão · Monte o melhor XI · Enfrente a melhor IA</p>

        {/* ── Setup ── */}
        {step === 'setup' && (
          <div style={{ marginTop: 28, maxWidth: 560, margin: '28px auto 0' }}>
            <div className="lei-card" style={{ padding: 24 }}>
              <p style={{ fontFamily: "'Oswald',sans-serif", fontSize: 18, textTransform: 'uppercase', marginBottom: 16, letterSpacing: '.04em' }}>Como funciona</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                {[
                  ['🎰', '22 jogadores são leiloados um a um'],
                  ['💰', `Orçamento: ${ORCAMENTO} pontos de OVR por time`],
                  ['🤖', '3 IAs com estratégias diferentes vão disputar cada jogador'],
                  ['⚡', `${LANCE_TEMPO} segundos por rodada de lance — ou você perde o jogador`],
                  ['⚽', 'Ao final, seu XI enfrenta o melhor time das IAs'],
                ].map(([icon, txt]) => (
                  <div key={txt} style={{ display: 'flex', gap: 10, fontSize: 13 }}>
                    <span style={{ fontSize: 16 }}>{icon}</span>
                    <span style={{ color: 'rgba(244,241,234,.7)' }}>{txt}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                {AIS.map(ai => (
                  <div key={ai.id} style={{ flex: 1, minWidth: 140, background: ai.cor + '14', border: `1px solid ${ai.cor}44`, borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 14, textTransform: 'uppercase', color: ai.cor, marginBottom: 3 }}>{ai.emoji} {ai.nome}</div>
                    <div style={{ fontSize: 11, color: 'rgba(244,241,234,.55)' }}>{ai.desc}</div>
                  </div>
                ))}
              </div>
              <button className="lei-btn" onClick={iniciar} disabled={carregando}>
                {carregando ? 'Carregando...' : '🔨 Começar o Leilão'}
              </button>
            </div>
          </div>
        )}

        {/* ── Leilão ── */}
        {step === 'leilao' && jogadorAtual && (
          <div style={{ marginTop: 16 }}>
            {/* Budgets */}
            <div className="lei-budgets">
              <div className="lei-budget-card" style={{ background: 'rgba(242,193,78,.08)', border: liderAtual === 'eu' ? '2px solid #f2c14e' : '2px solid rgba(242,193,78,.2)' }}>
                <div className="lei-budget-nome" style={{ color: '#f2c14e' }}>🧑 Você</div>
                <div className="lei-budget-val">{meuBudget}</div>
                <div className="lei-budget-count">{meuTimeSize} jogadores</div>
              </div>
              {AIS.map(ai => (
                <div key={ai.id} className={`lei-budget-card ${liderAtual === ai.id ? 'ativo' : ''}`}
                  style={{ background: ai.cor + '0f', border: liderAtual === ai.id ? `2px solid ${ai.cor}` : `2px solid ${ai.cor}22` }}>
                  <div className="lei-budget-nome" style={{ color: ai.cor }}>{ai.emoji} {ai.nome}</div>
                  <div className="lei-budget-val">{aiBudgets[ai.id]}</div>
                  <div className="lei-budget-count">{aiTimes[ai.id]?.length || 0} jogadores</div>
                </div>
              ))}
            </div>

            <p className="lei-progress">Leilão {leilaoIdx + 1}/{pool.length} · Seu time: {meuTimeSize}/{SQUAD_SIZE}</p>

            {/* Player card */}
            <div className="lei-player-card">
              {jogadorAtual.badge_url
                ? <img src={jogadorAtual.badge_url} alt={jogadorAtual.team_name} className="lei-player-flag" />
                : <div className="lei-player-flag" style={{ background: 'rgba(244,241,234,.1)' }} />
              }
              <h2 className="lei-player-name">{jogadorAtual.name}</h2>
              <p className="lei-player-meta">{jogadorAtual.team_name} · {jogadorAtual.pos1 || jogadorAtual.position}</p>
              <span className="lei-player-ovr">⭐ {jogadorAtual.overall}</span>
            </div>

            {/* Lance atual */}
            <div className="lei-lance-box">
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, textTransform: 'uppercase', letterSpacing: '.15em', color: 'rgba(244,241,234,.4)', marginBottom: 4 }}>Lance atual</div>
              <div className="lei-lance-atual">{lanceAtual} OVR</div>
              <div className="lei-lance-lider">
                {liderAtual === 'eu' ? <span style={{ color: '#f2c14e' }}>🏆 Você está na liderança</span>
                  : liderAtual ? <span style={{ color: AIS.find(a => a.id === liderAtual)?.cor }}>{AIS.find(a => a.id === liderAtual)?.emoji} {AIS.find(a => a.id === liderAtual)?.nome} está liderando</span>
                  : <span style={{ color: 'rgba(244,241,234,.4)' }}>Nenhum lance ainda</span>}
              </div>
              <div className="lei-timer-bar">
                <div className="lei-timer-fill" style={{ width: `${timerPct}%`, background: timerCor }} />
              </div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: timerCor, marginTop: 4 }}>
                {esperandoLance ? `⏱ ${timer}s restantes` : 'Aguardando...'}
              </div>
            </div>

            {/* Botões de lance */}
            <div className="lei-lance-btns">
              <button className="lei-bid-btn dar"
                onClick={darLance}
                disabled={!esperandoLance || (lanceAtual + 2) > meuBudget || meuTimeSize >= SQUAD_SIZE || lanceProcessando}>
                🔨 Dar Lance ({lanceAtual + 2} OVR)
              </button>
              <button className="lei-bid-btn pass" onClick={passarVez} disabled={!esperandoLance}>
                Passar
              </button>
            </div>

            {/* Histórico */}
            {historico.length > 0 && (
              <div className="lei-card" style={{ padding: 12 }}>
                <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(244,241,234,.3)', marginBottom: 8 }}>Lotes encerrados</p>
                <div className="lei-hist">
                  {[...historico].reverse().map((h, i) => {
                    const aiInfo = AIS.find(a => a.id === h.vencedor);
                    const cor = h.vencedor === 'eu' ? '#f2c14e' : aiInfo?.cor || '#666';
                    return (
                      <div key={i} className="lei-hist-item">
                        {h.jogador.badge_url ? <img src={h.jogador.badge_url} alt="" className="lei-hist-flag" /> : <div className="lei-hist-flag" style={{ background: 'rgba(244,241,234,.1)' }} />}
                        <span className="lei-hist-nome">{h.jogador.name}</span>
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: 'rgba(244,241,234,.4)' }}>OVR {h.jogador.overall}</span>
                        <span className="lei-hist-lider" style={{ background: cor + '22', color: cor }}>
                          {h.vencedor === 'eu' ? `✓ Você — ${h.lance}` : h.vencedor ? `${aiInfo?.emoji} ${aiInfo?.nome} — ${h.lance}` : 'Sem lance'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Resultado ── */}
        {step === 'resultado' && resultado && (
          <div style={{ marginTop: 20 }}>
            <div className="lei-card" style={{ padding: 20 }}>
              <p style={{ fontFamily: "'Oswald',sans-serif", fontSize: 20, textTransform: 'uppercase', textAlign: 'center', marginBottom: 16, color: '#f2c14e' }}>
                ⚽ Simulação Final
              </p>

              <div className="lei-result-teams">
                <div className="lei-result-team">
                  <div className="lei-result-team-name">Seu Time <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: 'rgba(244,241,234,.5)' }}>OVR {resultado.meuForce}</span></div>
                  <div className="lei-result-players">
                    {meuTime.sort((a, b) => b.overall - a.overall).map(p => (
                      <div key={p.id} className="lei-result-player">
                        <span>{p.name}</span>
                        <span style={{ color: '#f2c14e' }}>{p.overall}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="lei-scorebox" style={{ color: resultado.sim.gEu > resultado.sim.gAdv ? '#86efac' : resultado.sim.gEu < resultado.sim.gAdv ? '#ff8a93' : '#f4f1ea' }}>
                    {resultado.sim.gEu}<br/>×<br/>{resultado.sim.gAdv}
                  </div>
                  <p style={{ textAlign: 'center', fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: 'rgba(244,241,234,.4)', marginTop: 8 }}>
                    {resultado.sim.gEu > resultado.sim.gAdv ? '🏆 VOCÊ VENCEU' : resultado.sim.gEu < resultado.sim.gAdv ? '😔 VOCÊ PERDEU' : '🤝 EMPATE'}
                  </p>
                </div>

                <div className="lei-result-team">
                  <div className="lei-result-team-name">{resultado.melhorAI.emoji} {resultado.melhorAI.nome} <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: 'rgba(244,241,234,.5)' }}>OVR {resultado.advForce}</span></div>
                  <div className="lei-result-players">
                    {(aiTimes[resultado.melhorAI.id] || []).sort((a, b) => b.overall - a.overall).map(p => (
                      <div key={p.id} className="lei-result-player">
                        <span>{p.name}</span>
                        <span style={{ color: resultado.melhorAI.cor }}>{p.overall}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <button className="lei-btn" onClick={reiniciar}>🔄 Novo Leilão</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
