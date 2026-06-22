'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { loadCopaTimes } from '@/components/games/gameConstants';
import JOGADORES_COPA from '@/components/games/dados/jogadoresCopa.json';

const ORCAMENTO   = 880;
const POOL_SIZE   = 22;
const SQUAD_SIZE  = 11;
const LANCE_TEMPO = 10;

const POS_CAT = { GOL:'GOL', LD:'DEF', LE:'DEF', ZAG:'DEF', VOL:'MEI', MC:'MEI', MEI:'MEI', MD:'MEI', ME:'MEI', PD:'ATA', PE:'ATA', SA:'ATA', CA:'ATA' };
const POS_ALVO = { GOL:1, DEF:4, MEI:3, ATA:3 };

const AIS = [
  { id:'guloso',     nome:'Guloso',     cor:'#ef4444', emoji:'🔥', desc:'Entra em guerra por craques acima de 85' },
  { id:'equilibrado',nome:'Equilibrado',cor:'#3b82f6', emoji:'⚖️', desc:'Bids proporcionais, reforça posições que faltam' },
  { id:'economico',  nome:'Econômico',  cor:'#22c55e', emoji:'💰', desc:'Ignora estrelas, caça valor em OVRs médios' },
];

// ── Motor de IA ───────────────────────────────────────────────────────────────

function precisaPosicao(timeArr, pos1) {
  const cat = POS_CAT[pos1] || 'ATA';
  const atual = timeArr.filter(p => (POS_CAT[p.pos1] || 'ATA') === cat).length;
  return atual < (POS_ALVO[cat] || 3);
}

function calcDesejo(estrategia, jogador, budget, timeArr) {
  const ovr    = jogador.overall;
  const spots  = SQUAD_SIZE - timeArr.length;
  if (spots <= 0 || budget <= 0) return 0;
  const precisa = precisaPosicao(timeArr, jogador.pos1);

  switch (estrategia) {
    case 'guloso':
      if (ovr >= 91) return 1.0;
      if (ovr >= 88) return 0.90;
      if (ovr >= 84) return 0.65;
      if (ovr >= 80) return 0.35;
      return 0.10;
    case 'equilibrado': {
      let base = ovr >= 88 ? 0.70 : ovr >= 83 ? 0.60 : ovr >= 78 ? 0.52 : 0.35;
      if (precisa) base += 0.18;
      return Math.min(base, 1.0);
    }
    case 'economico': {
      if (ovr >= 89) return 0;
      if (ovr < 76)  return 0.10;
      let eco = ovr >= 84 ? 0.25 : ovr >= 79 ? 0.60 : 0.45;
      if (precisa) eco += 0.20;
      return Math.min(eco, 0.80);
    }
    default: return 0.4;
  }
}

function aiTeto(estrategia, jogador, budget, timeArr) {
  const desejo = calcDesejo(estrategia, jogador, budget, timeArr);
  if (desejo <= 0.05) return 0;
  const ovr      = jogador.overall;
  const spots    = Math.max(SQUAD_SIZE - timeArr.length, 1);
  const bPerSpot = budget / spots;
  let teto = Math.round(ovr * desejo * 0.9 + bPerSpot * desejo * 0.4);
  const limiteMax = { guloso: ovr + 18, equilibrado: ovr + 6, economico: ovr - 4 }[estrategia] ?? ovr + 5;
  return Math.min(teto, limiteMax, budget);
}

function aiIncremento(estrategia, desejo) {
  if (estrategia === 'guloso' && desejo >= 0.85) return Math.floor(Math.random() * 4) + 2;
  if (estrategia === 'guloso') return Math.floor(Math.random() * 2) + 1;
  return 1;
}

function calcForce(players) {
  return players.length ? Math.round(players.reduce((s, p) => s + p.overall, 0) / players.length) : 0;
}

// ── Componente ────────────────────────────────────────────────────────────────
export default function CopaLeilao() {
  const [step, setStep]       = useState('setup');
  const [pool, setPool]       = useState([]);
  const [leilaoIdx, setLeilaoIdx] = useState(0);
  const [lanceAtual, setLanceAtual] = useState(0);
  const [liderAtual, setLiderAtual] = useState(null);
  const [timer, setTimer]     = useState(LANCE_TEMPO);
  const [esperando, setEsperando] = useState(false);
  const [aiPensando, setAiPensando] = useState(null);
  const [historicoLance, setHistoricoLance] = useState([]);

  const [meuBudget, setMeuBudget] = useState(ORCAMENTO);
  const [aiBudgets, setAiBudgets] = useState({ guloso:ORCAMENTO, equilibrado:ORCAMENTO, economico:ORCAMENTO });
  const [meuTime, setMeuTime] = useState([]);
  const [aiTimes, setAiTimes] = useState({ guloso:[], equilibrado:[], economico:[] });
  const [historico, setHistorico] = useState([]);
  const [resultado, setResultado] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [torneio, setTorneio] = useState([]); // [{ fase, adversario, placar, venceu }]
  const [torneioLogs, setTorneioLogs] = useState([]);
  const [torneioRodada, setTorneioRodada] = useState(0); // 0=quartas,1=semi,2=final
  const [torneioStatus, setTorneioStatus] = useState('jogando'); // 'jogando'|'ganhou'|'perdeu'

  const timerRef    = useRef(null);
  const ativoRef    = useRef(false);
  const lanceRef    = useRef({ atual:0, lider:null });
  const gameRef     = useRef({ meuBudget:ORCAMENTO, aiBudgets:{ guloso:ORCAMENTO, equilibrado:ORCAMENTO, economico:ORCAMENTO }, meuTime:[], aiTimes:{ guloso:[], equilibrado:[], economico:[] } });
  const resolverRef = useRef(null);
  const poolRef     = useRef([]);
  const idxRef      = useRef(0);

  useEffect(() => {
    gameRef.current = { meuBudget, aiBudgets, meuTime, aiTimes };
  }, [meuBudget, aiBudgets, meuTime, aiTimes]);

  const iniciar = async () => {
    setCarregando(true);
    const times = await loadCopaTimes();
    const timesMap = {};
    times.forEach(t => { timesMap[t.id] = t; });
    const base = JOGADORES_COPA
      .filter(p => p.overall >= 74 && p.pos1)
      .map(p => ({ ...p, team_name: timesMap[p.team_id]?.name || '–', badge_url: timesMap[p.team_id]?.badge_url || null }));

    const tops = base.filter(p => p.overall >= 88).sort(() => Math.random() - 0.5).slice(0, 5);
    const mids = base.filter(p => p.overall >= 80 && p.overall < 88).sort(() => Math.random() - 0.5).slice(0, 10);
    const lows = base.filter(p => p.overall >= 74 && p.overall < 80).sort(() => Math.random() - 0.5).slice(0, 7);
    const novoPool = [...tops, ...mids, ...lows].sort(() => Math.random() - 0.5);

    poolRef.current = novoPool;
    setPool(novoPool);
    setMeuBudget(ORCAMENTO);
    setAiBudgets({ guloso:ORCAMENTO, equilibrado:ORCAMENTO, economico:ORCAMENTO });
    setMeuTime([]); setAiTimes({ guloso:[], equilibrado:[], economico:[] });
    setHistorico([]); setResultado(null);
    setCarregando(false); setStep('leilao');
  };

  /**
   * Guerra de lances da IA:
   * Loop sequencial — cada IA avalia o lance corrente e decide se cobre.
   * Se cobrir, outra IA pode contra-atacar. Para quando ninguém mais quer ou o leilão expirou.
   */
  const executarGuerraIA = useCallback(async (lanceInicial, liderInicial, jogador) => {
    let lanceC = lanceInicial;
    let liderC = liderInicial;
    let houveReacao = true;

    while (houveReacao && ativoRef.current) {
      houveReacao = false;
      const ordem = [...AIS].sort(() => Math.random() - 0.5);

      for (const ai of ordem) {
        if (!ativoRef.current) break;
        if (ai.id === liderC) continue;

        const budget = gameRef.current.aiBudgets[ai.id];
        const time   = gameRef.current.aiTimes[ai.id];
        const teto   = aiTeto(ai.id, jogador, budget, time);
        const desejo = calcDesejo(ai.id, jogador, budget, time);

        if (teto <= lanceC) continue;

        // Delay de "pensamento" — cada estratégia tem ritmo diferente
        const ms = ai.id === 'guloso'
          ? 300 + Math.random() * 500
          : ai.id === 'equilibrado'
          ? 600 + Math.random() * 900
          : 1000 + Math.random() * 1400;

        if (!ativoRef.current) break;
        setAiPensando(ai.id);
        await new Promise(r => setTimeout(r, ms));
        if (!ativoRef.current) break;
        setAiPensando(null);

        const incr   = aiIncremento(ai.id, desejo);
        const novoBid = Math.min(lanceC + incr, teto, budget);
        if (novoBid <= lanceC) continue;

        lanceC = novoBid;
        liderC = ai.id;
        lanceRef.current = { atual: lanceC, lider: liderC };
        setLanceAtual(lanceC);
        setLiderAtual(liderC);
        setHistoricoLance(prev => [...prev, { quem: ai.id, valor: lanceC, emoji: ai.emoji }]);
        houveReacao = true;  // outra IA pode contra-atacar
      }
    }
    if (!ativoRef.current) setAiPensando(null);
  }, []);

  const leiloarJogador = useCallback(async (jogador) => {
    const lance0 = Math.max(jogador.overall - 18, 50);
    setLanceAtual(lance0); setLiderAtual(null);
    setHistoricoLance([]);
    setTimer(LANCE_TEMPO);
    lanceRef.current = { atual: lance0, lider: null };
    ativoRef.current = true;

    // Avaliação inicial das IAs antes do timer começar
    await executarGuerraIA(lance0, null, jogador);
    if (!ativoRef.current) return;

    // Timer countdown
    await new Promise((resolve) => {
      resolverRef.current = resolve;
      setEsperando(true);
      let t = LANCE_TEMPO; setTimer(t);
      timerRef.current = setInterval(() => {
        t--; setTimer(t);
        if (t <= 0) {
          clearInterval(timerRef.current);
          ativoRef.current = false;
          setEsperando(false);
          setAiPensando(null);
          resolve('timeout');
        }
      }, 1000);
    });

    ativoRef.current = false;
    setAiPensando(null);

    const vencedor = lanceRef.current.lider;
    const preco    = lanceRef.current.atual;

    setHistorico(prev => [...prev, { jogador, vencedor, lance: preco }]);

    if (vencedor === 'eu') {
      setMeuBudget(b => b - preco);
      setMeuTime(t => [...t, jogador]);
    } else if (vencedor) {
      setAiBudgets(b => ({ ...b, [vencedor]: b[vencedor] - preco }));
      setAiTimes(t  => ({ ...t, [vencedor]: [...t[vencedor], jogador] }));
    }

    await new Promise(r => setTimeout(r, 800));
  }, [executarGuerraIA]);

  // ── Simula um jogo do torneio e retorna { gEu, gAdv } ─────────────────────
  const simJogo = (meuOVR, advOVR) => {
    const pEu  = Math.max(0.18, Math.min(0.62, 0.38 + (meuOVR - advOVR) * 0.018));
    const pAdv = Math.max(0.10, Math.min(0.50, 0.28 + (advOVR - meuOVR) * 0.018));
    const cEu  = 3 + Math.round(pEu * 3);
    const cAdv = 2 + Math.round(pAdv * 3);
    let gEu = 0, gAdv = 0;
    for (let i = 0; i < cEu; i++)  if (Math.random() < pEu)  gEu++;
    for (let i = 0; i < cAdv; i++) if (Math.random() < pAdv) gAdv++;
    if (gEu === gAdv) { if (Math.random() < 0.55) gEu++; else gAdv++; } // golden goal - sem pênaltis
    return { gEu, gAdv };
  };

  useEffect(() => {
    if (step !== 'leilao' || pool.length === 0) return;
    (async () => {
      // ── Leilão: continua ATÉ o jogador ter 11 ──────────────────────────────
      const allPoolIds = new Set();
      for (let i = 0; i < pool.length; i++) {
        setLeilaoIdx(i); idxRef.current = i;
        allPoolIds.add(pool[i].id);
        await leiloarJogador(pool[i]);
        if (gameRef.current.meuTime.length >= SQUAD_SIZE) break;
      }

      // Se o jogador ainda não tem 11 (pool esgotou), preenche com sobras
      if (gameRef.current.meuTime.length < SQUAD_SIZE) {
        const usados = new Set([
          ...gameRef.current.meuTime.map(p => p.id),
          ...Object.values(gameRef.current.aiTimes).flat().map(p => p.id),
        ]);
        const sobras = pool.filter(p => !usados.has(p.id));
        let idx = 0;
        while (gameRef.current.meuTime.length < SQUAD_SIZE && idx < sobras.length) {
          const p = sobras[idx++];
          gameRef.current.meuTime = [...gameRef.current.meuTime, p];
          setMeuTime(t => [...t, p]);
        }
      }

      // ── Preenche times das IAs com jogadores aleatórios se necessário ──────
      const usadosGlobal = new Set([
        ...gameRef.current.meuTime.map(p => p.id),
        ...Object.values(gameRef.current.aiTimes).flat().map(p => p.id),
      ]);
      const disponiveis = pool.filter(p => !usadosGlobal.has(p.id));
      let fillIdx = 0;
      for (const ai of AIS) {
        const needed = SQUAD_SIZE - gameRef.current.aiTimes[ai.id].length;
        if (needed > 0) {
          const extras = [];
          for (let k = 0; k < needed && fillIdx < disponiveis.length; k++) {
            extras.push(disponiveis[fillIdx++]);
          }
          if (extras.length) {
            gameRef.current.aiTimes[ai.id] = [...gameRef.current.aiTimes[ai.id], ...extras];
            setAiTimes(t => ({ ...t, [ai.id]: [...t[ai.id], ...extras] }));
          }
        }
      }

      // ── Ordena as 3 IAs por força para o torneio ───────────────────────────
      const aisOrdenados = [...AIS].sort(
        (a, b) => calcForce(gameRef.current.aiTimes[a.id]) - calcForce(gameRef.current.aiTimes[b.id])
      );
      // Quartas: vs fraco | Semi: vs médio | Final: vs forte
      const fases = ['⚔️ Quartas de Final', '🔥 Semifinal', '🏆 Grande Final'];
      const meuOVR = calcForce(gameRef.current.meuTime);
      const jogos = [];
      let vivo = true;

      for (let f = 0; f < 3; f++) {
        const ai    = aisOrdenados[f];
        const advOVR = calcForce(gameRef.current.aiTimes[ai.id]);
        const { gEu, gAdv } = simJogo(meuOVR, advOVR);
        const venceu = gEu > gAdv;
        jogos.push({ fase: fases[f], ai, gEu, gAdv, meuOVR, advOVR, venceu });
        if (!venceu) { vivo = false; break; }
      }

      setResultado({
        meuTime: [...gameRef.current.meuTime],
        aiTimes: { ...gameRef.current.aiTimes },
        jogos,
        campeao: vivo,
        meuOVR,
      });
      setStep('resultado');
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, pool]);

  const darLance = useCallback(() => {
    if (!esperando || !ativoRef.current) return;
    const novo = lanceRef.current.atual + 2;
    if (novo > meuBudget) return;

    clearInterval(timerRef.current);
    lanceRef.current = { atual: novo, lider: 'eu' };
    setLanceAtual(novo); setLiderAtual('eu');
    setHistoricoLance(prev => [...prev, { quem:'eu', valor: novo, emoji:'🧑' }]);

    const jogador = poolRef.current[idxRef.current];
    const reiniciarTimer = () => {
      if (!ativoRef.current) return;
      let t = LANCE_TEMPO; setTimer(t);
      timerRef.current = setInterval(() => {
        t--; setTimer(t);
        if (t <= 0) {
          clearInterval(timerRef.current);
          ativoRef.current = false;
          setEsperando(false);
          setAiPensando(null);
          resolverRef.current?.('timeout');
        }
      }, 1000);
    };

    if (jogador) {
      // IAs reagem de forma assíncrona e ao terminar reiniciam o timer
      executarGuerraIA(novo, 'eu', jogador).then(reiniciarTimer);
    } else {
      reiniciarTimer();
    }
  }, [esperando, meuBudget, executarGuerraIA]);

  const passarVez = useCallback(() => {
    if (!esperando) return;
    clearInterval(timerRef.current);
    ativoRef.current = false;
    setEsperando(false); setAiPensando(null);
    resolverRef.current?.('pass');
  }, [esperando]);

  const reiniciar = () => { setStep('setup'); setPool([]); setHistorico([]); setResultado(null); };

  const jogadorAtual = pool[leilaoIdx];
  const timerPct = (timer / LANCE_TEMPO) * 100;
  const timerCor = timer <= 3 ? '#ef4444' : timer <= 5 ? '#f59e0b' : '#22c55e';
  const liderInfo = liderAtual === 'eu'
    ? { nome:'Você', cor:'#f2c14e', emoji:'🧑' }
    : AIS.find(a => a.id === liderAtual) || null;
  const meuTimeSize = meuTime.length;

  return (
    <div style={{ minHeight:'100vh', background:'#08111f', color:'#f4f1ea', fontFamily:"'Inter',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');
        *{box-sizing:border-box;}
        .lei{max-width:700px;margin:0 auto;padding:24px 14px 60px;}
        .lei-h1{font-family:'Oswald',sans-serif;font-weight:700;font-size:clamp(28px,6vw,48px);text-transform:uppercase;text-align:center;margin:0;background:linear-gradient(160deg,#fff 30%,#f2c14e);-webkit-background-clip:text;background-clip:text;color:transparent;}
        .lei-card{background:rgba(255,255,255,.035);border:1px solid rgba(244,241,234,.1);border-radius:12px;}
        .lei-budgets{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:7px;margin-bottom:12px;}
        .lei-bcard{border-radius:10px;padding:10px;text-align:center;border:2px solid transparent;transition:all .25s;}
        @keyframes lei-pulse{0%,100%{opacity:.65;}50%{opacity:1;}}
        .lei-bcard-nome{font-family:'Oswald',sans-serif;font-size:11px;text-transform:uppercase;margin-bottom:2px;}
        .lei-bcard-val{font-family:'JetBrains Mono',monospace;font-size:18px;font-weight:700;}
        .lei-bcard-info{font-family:'JetBrains Mono',monospace;font-size:9px;opacity:.45;margin-top:2px;}
        .lei-player{background:#0d1a2e;border:2px solid rgba(242,193,78,.35);border-radius:14px;padding:18px;text-align:center;margin-bottom:12px;animation:lei-entrou .3s ease;}
        @keyframes lei-entrou{from{opacity:0;transform:translateY(-8px);}to{opacity:1;transform:translateY(0);}}
        .lei-player-name{font-family:'Oswald',sans-serif;font-size:22px;text-transform:uppercase;margin:6px 0 2px;}
        .lei-player-meta{font-family:'JetBrains Mono',monospace;font-size:11px;color:rgba(244,241,234,.4);margin:0 0 10px;}
        .lei-player-ovr{font-family:'Oswald',sans-serif;font-size:48px;font-weight:700;color:#f2c14e;line-height:1;}
        .lei-lbox{background:#070a12;border-radius:12px;padding:14px 16px;margin-bottom:10px;}
        .lei-lbox-label{font-family:'JetBrains Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.15em;color:rgba(244,241,234,.3);margin-bottom:4px;}
        .lei-lbox-valor{font-family:'Oswald',sans-serif;font-size:40px;font-weight:700;line-height:1;transition:color .2s;}
        .lei-lbox-lider{font-family:'JetBrains Mono',monospace;font-size:12px;margin-top:4px;min-height:18px;}
        .lei-pensando{font-family:'JetBrains Mono',monospace;font-size:11px;color:rgba(244,241,234,.35);margin-top:3px;min-height:16px;animation:lei-pulse .7s ease-in-out infinite;}
        .lei-timer-bar{height:5px;background:rgba(244,241,234,.08);border-radius:999px;margin-top:10px;}
        .lei-timer-fill{height:100%;border-radius:999px;transition:width 1s linear,background .4s;}
        .lei-bid-hist{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px;min-height:24px;}
        .lei-bid-chip{font-family:'JetBrains Mono',monospace;font-size:10px;padding:3px 8px;border-radius:999px;animation:lei-chip .2s ease;}
        @keyframes lei-chip{from{opacity:0;transform:scale(.75);}to{opacity:1;transform:scale(1);}}
        .lei-btns{display:flex;gap:10px;margin-bottom:12px;}
        .lei-bid-btn{font-family:'Oswald',sans-serif;font-size:17px;text-transform:uppercase;padding:14px;border-radius:10px;border:none;cursor:pointer;transition:all .15s;}
        .lei-bid-btn.dar{flex:2;background:linear-gradient(135deg,#f2c14e,#c9941f);color:#1a1300;}
        .lei-bid-btn.dar:not(:disabled):hover{transform:scale(1.03);}
        .lei-bid-btn.dar:disabled{opacity:.35;cursor:not-allowed;}
        .lei-bid-btn.pass{flex:1;background:rgba(244,241,234,.06);border:1px solid rgba(244,241,234,.18);color:rgba(244,241,234,.65);}
        .lei-myteam{border:1px solid rgba(242,193,78,.22);border-radius:10px;padding:10px 12px;margin-bottom:12px;background:rgba(242,193,78,.03);}
        .lei-myteam-row{display:flex;gap:5px;flex-wrap:wrap;margin-top:6px;}
        .lei-myteam-chip{font-size:11px;padding:3px 8px;background:rgba(242,193,78,.1);border:1px solid rgba(242,193,78,.2);border-radius:5px;font-family:'JetBrains Mono',monospace;white-space:nowrap;}
        .lei-slot-vazio{width:34px;height:22px;background:rgba(244,241,234,.04);border:1px dashed rgba(244,241,234,.12);border-radius:5px;}
        .lei-hist{max-height:150px;overflow-y:auto;display:flex;flex-direction:column;gap:4px;}
        .lei-hist-row{display:flex;align-items:center;gap:7px;padding:5px 8px;background:rgba(255,255,255,.025);border-radius:6px;font-size:11px;}
        .lei-hist-flag{width:20px;height:13px;object-fit:cover;border-radius:2px;flex-shrink:0;}
        .lei-hist-tag{font-family:'JetBrains Mono',monospace;font-size:9px;padding:2px 6px;border-radius:3px;flex-shrink:0;}
        .lei-btn-main{display:block;width:100%;padding:14px;font-family:'Oswald',sans-serif;font-size:18px;text-transform:uppercase;border:none;border-radius:10px;background:linear-gradient(135deg,#f2c14e,#c9941f);color:#1a1300;cursor:pointer;transition:transform .15s;}
        .lei-btn-main:hover{transform:translateY(-2px);}
        .lei-result-grid{display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:start;margin:14px 0;}
        .lei-result-col{display:flex;flex-direction:column;gap:3px;}
        .lei-result-player{font-size:11px;font-family:'JetBrains Mono',monospace;background:rgba(255,255,255,.04);border-radius:5px;padding:4px 8px;display:flex;justify-content:space-between;}
        .lei-score{font-family:'Oswald',sans-serif;font-size:50px;font-weight:700;text-align:center;line-height:1.1;}
        @media(max-width:520px){.lei-budgets{grid-template-columns:1fr 1fr;} .lei-player-ovr{font-size:38px;} .lei-result-grid{grid-template-columns:1fr;} .lei-score{font-size:36px;}}
      `}</style>

      <div className="lei">
        <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, letterSpacing:'.22em', textTransform:'uppercase', color:'#f2c14e', textAlign:'center', marginBottom:4 }}>Copa do Mundo 2026</p>
        <h1 className="lei-h1">Copa Leilão</h1>
        <p style={{ textAlign:'center', color:'rgba(244,241,234,.4)', fontSize:12, fontFamily:"'JetBrains Mono',monospace", margin:'6px 0 0' }}>
          22 craques em disputa · Monte o melhor XI contra 3 IAs com estratégias diferentes
        </p>

        {/* Setup */}
        {step === 'setup' && (
          <div style={{ maxWidth:500, margin:'28px auto 0' }}>
            <div className="lei-card" style={{ padding:22, marginBottom:14 }}>
              <p style={{ fontFamily:"'Oswald',sans-serif", fontSize:16, textTransform:'uppercase', marginBottom:14 }}>As IAs rivais</p>
              {AIS.map(ai => (
                <div key={ai.id} style={{ display:'flex', gap:10, padding:'10px 0', borderBottom:'1px solid rgba(244,241,234,.06)' }}>
                  <span style={{ fontSize:20 }}>{ai.emoji}</span>
                  <div>
                    <div style={{ fontFamily:"'Oswald',sans-serif", fontSize:14, textTransform:'uppercase', color:ai.cor }}>{ai.nome}</div>
                    <div style={{ fontSize:12, color:'rgba(244,241,234,.45)', marginTop:2 }}>{ai.desc}</div>
                  </div>
                </div>
              ))}
              <div style={{ marginTop:14, fontSize:12, color:'rgba(244,241,234,.45)', lineHeight:1.7 }}>
                💰 Orçamento: <strong style={{ color:'#f2c14e' }}>{ORCAMENTO} OVR</strong> por time &nbsp;·&nbsp;
                ⏱ {LANCE_TEMPO}s por lote &nbsp;·&nbsp;
                🎯 {SQUAD_SIZE} jogadores para completar o squad
              </div>
            </div>
            <button className="lei-btn-main" onClick={iniciar} disabled={carregando}>
              {carregando ? 'Carregando...' : '🔨 Começar o Leilão'}
            </button>
          </div>
        )}

        {/* Leilão */}
        {step === 'leilao' && jogadorAtual && (
          <div style={{ marginTop:14 }}>
            {/* Budgets */}
            <div className="lei-budgets">
              <div className="lei-bcard" style={{
                background:'rgba(242,193,78,.07)',
                border: liderAtual === 'eu' ? '2px solid #f2c14e' : '2px solid rgba(242,193,78,.18)',
                transform: liderAtual === 'eu' ? 'scale(1.06)' : 'none',
                boxShadow: liderAtual === 'eu' ? '0 0 16px rgba(242,193,78,.22)' : 'none',
              }}>
                <div className="lei-bcard-nome" style={{ color:'#f2c14e' }}>🧑 Você</div>
                <div className="lei-bcard-val">{meuBudget}</div>
                <div className="lei-bcard-info">{meuTimeSize} jog.</div>
              </div>
              {AIS.map(ai => (
                <div key={ai.id} className="lei-bcard" style={{
                  background: ai.cor + '0d',
                  border: liderAtual === ai.id ? `2px solid ${ai.cor}` : `2px solid ${ai.cor}22`,
                  transform: liderAtual === ai.id ? 'scale(1.06)' : 'none',
                  boxShadow: liderAtual === ai.id ? `0 0 16px ${ai.cor}33` : 'none',
                  animation: aiPensando === ai.id ? 'lei-pulse .6s ease-in-out infinite' : 'none',
                }}>
                  <div className="lei-bcard-nome" style={{ color:ai.cor }}>{ai.emoji} {ai.nome}</div>
                  <div className="lei-bcard-val">{aiBudgets[ai.id]}</div>
                  <div className="lei-bcard-info">{aiTimes[ai.id]?.length} jog.</div>
                </div>
              ))}
            </div>

            <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, textAlign:'center', color:'rgba(244,241,234,.28)', marginBottom:10 }}>
              Lote {leilaoIdx + 1}/{pool.length} · Seu squad: {meuTimeSize}/{SQUAD_SIZE}
            </p>

            {/* Player card */}
            <div className="lei-player">
              {jogadorAtual.badge_url
                ? <img src={jogadorAtual.badge_url} alt="" style={{ width:46, height:28, objectFit:'cover', borderRadius:4, margin:'0 auto', display:'block' }} />
                : <div style={{ width:46, height:28, background:'rgba(244,241,234,.1)', borderRadius:4, margin:'0 auto' }} />
              }
              <h2 className="lei-player-name">{jogadorAtual.name}</h2>
              <p className="lei-player-meta">{jogadorAtual.team_name} · {jogadorAtual.pos1}</p>
              <div className="lei-player-ovr">⭐ {jogadorAtual.overall}</div>
            </div>

            {/* Lance */}
            <div className="lei-lbox">
              <div className="lei-lbox-label">Lance atual</div>
              <div className="lei-lbox-valor" style={{ color: liderInfo ? liderInfo.cor : 'rgba(244,241,234,.25)' }}>{lanceAtual}</div>
              <div className="lei-lbox-lider">
                {liderInfo
                  ? <span style={{ color:liderInfo.cor }}>{liderInfo.emoji} {liderInfo.nome} lidera</span>
                  : <span style={{ color:'rgba(244,241,234,.25)' }}>Sem lance</span>}
              </div>
              <div className="lei-pensando">
                {aiPensando ? `${AIS.find(a => a.id === aiPensando)?.emoji} ${AIS.find(a => a.id === aiPensando)?.nome} pensando...` : '\u00a0'}
              </div>
              <div className="lei-timer-bar">
                <div className="lei-timer-fill" style={{ width:`${timerPct}%`, background:timerCor }} />
              </div>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:timerCor, marginTop:4, textAlign:'right' }}>
                {esperando ? `${timer}s` : ''}
              </div>
            </div>

            {/* Histórico de lances desta rodada */}
            {historicoLance.length > 0 && (
              <div className="lei-bid-hist">
                {historicoLance.slice(-9).map((h, i) => {
                  const inf = h.quem === 'eu' ? { cor:'#f2c14e', emoji:'🧑' } : AIS.find(a => a.id === h.quem);
                  return (
                    <div key={i} className="lei-bid-chip"
                      style={{ background: inf.cor + '1a', border:`1px solid ${inf.cor}44`, color:inf.cor }}>
                      {inf.emoji} {h.valor}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Botões */}
            <div className="lei-btns">
              <button className="lei-bid-btn dar" onClick={darLance}
                disabled={!esperando || (lanceAtual + 2) > meuBudget || meuTimeSize >= SQUAD_SIZE}>
                🔨 Lance +2 &nbsp;({lanceAtual + 2})
              </button>
              <button className="lei-bid-btn pass" onClick={passarVez} disabled={!esperando}>Passar</button>
            </div>

            {/* Meu time ao vivo */}
            <div className="lei-myteam">
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, textTransform:'uppercase', letterSpacing:'.12em', color:'#f2c14e' }}>
                Seu elenco ({meuTimeSize}/{SQUAD_SIZE})
              </div>
              <div className="lei-myteam-row">
                {meuTime.map((p, i) => (
                  <div key={i} className="lei-myteam-chip">
                    <span style={{ color:'#f2c14e', marginRight:3 }}>{p.overall}</span>{p.name.split(' ').pop()}
                  </div>
                ))}
                {Array.from({ length: SQUAD_SIZE - meuTimeSize }).map((_, i) => <div key={i} className="lei-slot-vazio" />)}
              </div>
            </div>

            {/* Lotes encerrados */}
            {historico.length > 0 && (
              <div className="lei-card" style={{ padding:10 }}>
                <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, textTransform:'uppercase', letterSpacing:'.1em', color:'rgba(244,241,234,.28)', margin:'0 0 7px' }}>Lotes encerrados</p>
                <div className="lei-hist">
                  {[...historico].reverse().map((h, i) => {
                    const w = h.vencedor === 'eu' ? { nome:'Você', cor:'#f2c14e', emoji:'🧑' } : AIS.find(a => a.id === h.vencedor);
                    return (
                      <div key={i} className="lei-hist-row">
                        {h.jogador.badge_url ? <img src={h.jogador.badge_url} alt="" className="lei-hist-flag" /> : <div className="lei-hist-flag" style={{ background:'rgba(244,241,234,.1)' }} />}
                        <span style={{ flex:1, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{h.jogador.name}</span>
                        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:'rgba(244,241,234,.3)' }}>OVR {h.jogador.overall}</span>
                        {w
                          ? <span className="lei-hist-tag" style={{ background:w.cor+'1a', color:w.cor }}>{w.emoji} {w.nome} · {h.lance}</span>
                          : <span className="lei-hist-tag" style={{ background:'rgba(244,241,234,.04)', color:'rgba(244,241,234,.28)' }}>sem lance</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Resultado — 3 jogos do torneio */}
        {step === 'resultado' && resultado && (
          <div style={{ marginTop:16 }}>
            {/* Cabeçalho */}
            <div style={{ textAlign:'center', marginBottom:18 }}>
              {resultado.campeao ? (
                <>
                  <div style={{ fontSize:54 }}>🏆</div>
                  <h2 style={{ fontFamily:"'Oswald',sans-serif", fontSize:32, textTransform:'uppercase', color:'#f2c14e', margin:'6px 0 4px' }}>CAMPEÃO!</h2>
                  <p style={{ color:'rgba(244,241,234,.55)', fontSize:13 }}>Você venceu os 3 confrontos e levantou a taça!</p>
                </>
              ) : (
                <>
                  <div style={{ fontSize:48 }}>😔</div>
                  <h2 style={{ fontFamily:"'Oswald',sans-serif", fontSize:28, textTransform:'uppercase', color:'#ff8a93', margin:'6px 0 4px' }}>Eliminado</h2>
                  <p style={{ color:'rgba(244,241,234,.55)', fontSize:13 }}>
                    Eliminado na {resultado.jogos[resultado.jogos.length - 1]?.fase}
                  </p>
                </>
              )}
            </div>

            {/* Jogos */}
            <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:14 }}>
              {resultado.jogos.map((jogo, i) => (
                <div key={i} className="lei-card" style={{ padding:'14px 16px' }}>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, textTransform:'uppercase', letterSpacing:'.14em', color: jogo.venceu ? '#6fd17a' : '#ff5252', marginBottom:6 }}>
                    {jogo.fase} · {jogo.venceu ? '✓ Classificado' : '✗ Eliminado'}
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', alignItems:'center', gap:8 }}>
                    <div>
                      <div style={{ fontFamily:"'Oswald',sans-serif", fontSize:14, fontWeight:700, color:'#f2c14e' }}>Você</div>
                      <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:'rgba(244,241,234,.4)' }}>OVR {jogo.meuOVR}</div>
                    </div>
                    <div style={{ textAlign:'center' }}>
                      <div style={{ fontFamily:"'Oswald',sans-serif", fontSize:28, fontWeight:700, color: jogo.venceu ? '#86efac' : '#ff8a93', lineHeight:1 }}>
                        {jogo.gEu} × {jogo.gAdv}
                      </div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontFamily:"'Oswald',sans-serif", fontSize:14, fontWeight:700, color: jogo.ai.cor }}>
                        {jogo.ai.emoji} {jogo.ai.nome}
                      </div>
                      <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:'rgba(244,241,234,.4)' }}>OVR {jogo.advOVR}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Meu time */}
            <div className="lei-card" style={{ padding:14, marginBottom:14 }}>
              <p style={{ fontFamily:"'Oswald',sans-serif", fontSize:13, textTransform:'uppercase', color:'#f2c14e', margin:'0 0 8px' }}>
                Seu XI · OVR {resultado.meuOVR}
              </p>
              <div className="lei-result-col">
                {resultado.meuTime.sort((a, b) => b.overall - a.overall).map(p => (
                  <div key={p.id} className="lei-result-player">
                    <span>{p.name}</span>
                    <span style={{ color:'#f2c14e' }}>{p.overall}</span>
                  </div>
                ))}
              </div>
            </div>

            <button className="lei-btn-main" onClick={reiniciar}>🔄 Novo Leilão</button>
          </div>
        )}
      </div>
    </div>
  );
}
