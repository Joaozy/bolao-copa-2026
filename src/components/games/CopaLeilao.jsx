'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { loadCopaTimes } from '@/components/games/gameConstants';
import JOGADORES_COPA from '@/components/games/dados/jogadoresCopa.json';

// ─── Constantes ───────────────────────────────────────────────────────────────
const ORCAMENTO   = 880;
const SQUAD_SIZE  = 11;
const LANCE_TEMPO = 10;

const POS_CAT = { GOL:'GOL', LD:'DEF', LE:'DEF', ZAG:'DEF', VOL:'MEI', MC:'MEI', MEI:'MEI', MD:'MEI', ME:'MEI', PD:'ATA', PE:'ATA', SA:'ATA', CA:'ATA' };
const POS_ALVO = { GOL:1, DEF:4, MEI:3, ATA:3 };

const AIS = [
  { id:'guloso',     nome:'Guloso',     cor:'#ef4444', emoji:'🔥', desc:'Entra em guerra por craques acima de 85' },
  { id:'equilibrado',nome:'Equilibrado',cor:'#3b82f6', emoji:'⚖️', desc:'Bids proporcionais, reforça posições que faltam' },
  { id:'economico',  nome:'Econômico',  cor:'#22c55e', emoji:'💰', desc:'Ignora estrelas, caça valor em OVRs médios' },
];

// ─── Motor IA ─────────────────────────────────────────────────────────────────
function precisaPosicao(timeArr, pos1) {
  const cat = POS_CAT[pos1] || 'ATA';
  return timeArr.filter(p => (POS_CAT[p.pos1] || 'ATA') === cat).length < (POS_ALVO[cat] || 3);
}

function calcDesejo(estrategia, jogador, budget, timeArr) {
  const ovr = jogador.overall;
  const spots = SQUAD_SIZE - timeArr.length;
  if (spots <= 0 || budget <= 0) return 0;
  const precisa = precisaPosicao(timeArr, jogador.pos1);
  switch (estrategia) {
    case 'guloso':
      if (ovr >= 91) return 1.0; if (ovr >= 88) return 0.90;
      if (ovr >= 84) return 0.65; if (ovr >= 80) return 0.40;
      return precisa ? 0.35 : 0.15;
    case 'equilibrado': {
      let b = ovr >= 88 ? 0.70 : ovr >= 83 ? 0.60 : ovr >= 78 ? 0.52 : 0.40;
      return Math.min(b + (precisa ? 0.20 : 0), 1.0);
    }
    case 'economico': {
      if (ovr >= 89) return precisa ? 0.20 : 0;
      let e = ovr >= 84 ? 0.30 : ovr >= 79 ? 0.60 : 0.50;
      return Math.min(e + (precisa ? 0.25 : 0), 0.85);
    }
    default: return 0.4;
  }
}

function aiTeto(estrategia, jogador, budget, timeArr) {
  const desejo = calcDesejo(estrategia, jogador, budget, timeArr);
  if (desejo <= 0.05) return 0;
  const ovr = jogador.overall;
  const spots = Math.max(SQUAD_SIZE - timeArr.length, 1);
  const bPerSpot = budget / spots;
  let teto = Math.round(ovr * desejo * 0.85 + bPerSpot * desejo * 0.5);
  const limMax = { guloso: ovr + 18, equilibrado: ovr + 6, economico: ovr - 3 }[estrategia] ?? ovr + 5;
  return Math.min(teto, limMax, budget);
}

function aiIncremento(estrategia, desejo) {
  if (estrategia === 'guloso' && desejo >= 0.85) return Math.floor(Math.random() * 4) + 2;
  if (estrategia === 'guloso') return Math.floor(Math.random() * 2) + 1;
  return 1;
}

function calcForce(players) {
  return players.length ? Math.round(players.reduce((s, p) => s + p.overall, 0) / players.length) : 0;
}

const delay = ms => new Promise(r => setTimeout(r, ms));

// ─── Componente ───────────────────────────────────────────────────────────────
export default function CopaLeilao() {
  const [step, setStep]           = useState('setup');
  const [pool, setPool]           = useState([]);
  const [leilaoIdx, setLeilaoIdx] = useState(0);
  const [lanceAtual, setLanceAtual] = useState(0);
  const [liderAtual, setLiderAtual] = useState(null);
  const [timer, setTimer]         = useState(LANCE_TEMPO);
  const [esperando, setEsperando] = useState(false);
  const [aiPensando, setAiPensando] = useState(null);
  const [historicoLance, setHistoricoLance] = useState([]);
  const [meuBudget, setMeuBudget] = useState(ORCAMENTO);
  const [aiBudgets, setAiBudgets] = useState({ guloso:ORCAMENTO, equilibrado:ORCAMENTO, economico:ORCAMENTO });
  const [meuTime, setMeuTime]     = useState([]);
  const [aiTimes, setAiTimes]     = useState({ guloso:[], equilibrado:[], economico:[] });
  const [historico, setHistorico] = useState([]);
  const [carregando, setCarregando] = useState(false);

  // Simulação ─────────────────────────────────────────────────────────────────
  const [simFase, setSimFase]     = useState(0);   // 0=quartas,1=semi,2=final
  const [simLogs, setSimLogs]     = useState([]);
  const [simPlacar, setSimPlacar] = useState({ eu:0, adv:0 });
  const [simMinuto, setSimMinuto] = useState(0);
  const [simCurrentAI, setSimCurrentAI] = useState(null);
  const [simResults, setSimResults] = useState([]);
  const [simRunning, setSimRunning] = useState(false);
  const [simCampeao, setSimCampeao] = useState(false);
  const [simElim, setSimElim]     = useState(false);
  const logRef     = useRef(null);
  const simPRef    = useRef({ eu:0, adv:0 });
  const aisOrdemRef = useRef([]);

  // Refs do leilão ─────────────────────────────────────────────────────────────
  const timerRef    = useRef(null);
  const ativoRef    = useRef(false);
  const lanceRef    = useRef({ atual:0, lider:null });
  const gameRef     = useRef({
    meuBudget: ORCAMENTO,
    aiBudgets: { guloso:ORCAMENTO, equilibrado:ORCAMENTO, economico:ORCAMENTO },
    meuTime: [], aiTimes: { guloso:[], equilibrado:[], economico:[] },
  });
  const resolverRef = useRef(null);
  const poolRef     = useRef([]);
  const idxRef      = useRef(0);

  // Sync gameRef com state
  useEffect(() => {
    gameRef.current = { meuBudget, aiBudgets, meuTime, aiTimes };
  }, [meuBudget, aiBudgets, meuTime, aiTimes]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [simLogs]);

  // ── Iniciar ─────────────────────────────────────────────────────────────────
  const iniciar = async () => {
    setCarregando(true);
    const times = await loadCopaTimes();
    const timesMap = {};
    times.forEach(t => { timesMap[t.id] = t; });

    // FIX 1: Pool ILIMITADO — embaralha TODOS os jogadores
    const allPlayers = JOGADORES_COPA
      .filter(p => p.overall >= 74 && p.pos1)
      .map(p => ({
        ...p,
        team_name: timesMap[p.team_id]?.name || '–',
        badge_url: timesMap[p.team_id]?.badge_url || null,
      }))
      .sort(() => Math.random() - 0.5); // Embaralha tudo

    poolRef.current = allPlayers;
    setPool(allPlayers);
    setMeuBudget(ORCAMENTO);
    setAiBudgets({ guloso:ORCAMENTO, equilibrado:ORCAMENTO, economico:ORCAMENTO });
    setMeuTime([]); setAiTimes({ guloso:[], equilibrado:[], economico:[] });
    setHistorico([]); setSimResults([]); setSimLogs([]);
    setSimCampeao(false); setSimElim(false); setSimFase(0);
    gameRef.current = {
      meuBudget: ORCAMENTO,
      aiBudgets: { guloso:ORCAMENTO, equilibrado:ORCAMENTO, economico:ORCAMENTO },
      meuTime: [], aiTimes: { guloso:[], equilibrado:[], economico:[] },
    };
    setCarregando(false);
    setStep('leilao');
  };

  // ── Guerra de lances das IAs ─────────────────────────────────────────────────
  // FIX 2: SEMPRE mostra pensando — mesmo que não vá dar lance (suspense)
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

        // SEMPRE mostra "pensando" — independente se vai dar lance
        const ms = ai.id === 'guloso'   ? 300 + Math.random() * 600
                 : ai.id === 'equilibrado' ? 600 + Math.random() * 1000
                 : 900 + Math.random() * 1500;

        if (!ativoRef.current) break;
        setAiPensando(ai.id);
        await new Promise(r => setTimeout(r, ms));
        if (!ativoRef.current) break;
        setAiPensando(null);

        // Decide DEPOIS de pensar
        if (teto <= lanceC) continue; // pensou e passou

        // Dá lance!
        const incr    = aiIncremento(ai.id, desejo);
        const novoBid = Math.min(lanceC + incr, teto, budget);
        if (novoBid <= lanceC) continue;

        lanceC = novoBid;
        liderC = ai.id;
        lanceRef.current = { atual:lanceC, lider:liderC };
        setLanceAtual(lanceC);
        setLiderAtual(liderC);
        setHistoricoLance(prev => [...prev, { quem:ai.id, valor:lanceC, emoji:ai.emoji }]);
        houveReacao = true;
      }
    }
    if (!ativoRef.current) setAiPensando(null);
  }, []);

  // ── Leiloar um jogador ───────────────────────────────────────────────────────
  const leiloarJogador = useCallback(async (jogador) => {
    const lance0 = Math.max(jogador.overall - 18, 50);
    setLanceAtual(lance0);
    setLiderAtual(null);
    setHistoricoLance([]);
    setTimer(LANCE_TEMPO);
    lanceRef.current = { atual:lance0, lider:null };
    ativoRef.current = true;

    // Reações iniciais das IAs
    await executarGuerraIA(lance0, null, jogador);
    if (!ativoRef.current) return;

    // Timer countdown
    await new Promise(resolve => {
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

    // FIX 3: Determina vencedor — se ninguém deu lance (lider null), dá ao IA mais necessitado
    let vencedor = lanceRef.current.lider;
    let preco    = lanceRef.current.atual;

    if (!vencedor) {
      // Acha a IA que mais precisa de jogadores
      const aiNeediest = [...AIS]
        .filter(ai => gameRef.current.aiTimes[ai.id].length < SQUAD_SIZE && gameRef.current.aiBudgets[ai.id] >= preco)
        .sort((a, b) => gameRef.current.aiTimes[a.id].length - gameRef.current.aiTimes[b.id].length)[0];
      if (aiNeediest) {
        vencedor = aiNeediest.id;
        // Limita ao budget
        preco = Math.min(preco, gameRef.current.aiBudgets[aiNeediest.id]);
      }
    }

    setHistorico(prev => [...prev, { jogador, vencedor, lance:preco }]);

    // FIX 3 cont: Atualiza gameRef DIRETAMENTE além do state (evita stale closure)
    if (vencedor === 'eu') {
      const nb = gameRef.current.meuBudget - preco;
      const nt = [...gameRef.current.meuTime, jogador];
      gameRef.current.meuBudget = nb;
      gameRef.current.meuTime   = nt;
      setMeuBudget(nb);
      setMeuTime(nt);
    } else if (vencedor) {
      const nb = { ...gameRef.current.aiBudgets, [vencedor]: gameRef.current.aiBudgets[vencedor] - preco };
      const nt = { ...gameRef.current.aiTimes,   [vencedor]: [...gameRef.current.aiTimes[vencedor], jogador] };
      gameRef.current.aiBudgets = nb;
      gameRef.current.aiTimes   = nt;
      setAiBudgets(nb);
      setAiTimes(nt);
    }

    await delay(800);
  }, [executarGuerraIA]);

  // FIX 1: Loop do leilão — continua até player ter 11
  useEffect(() => {
    if (step !== 'leilao' || pool.length === 0) return;
    (async () => {
      let i = 0;
      while (gameRef.current.meuTime.length < SQUAD_SIZE && i < pool.length) {
        setLeilaoIdx(i);
        idxRef.current = i;
        await leiloarJogador(pool[i]);
        i++;
      }

      // Preenche IAs que não completaram o squad com os jogadores restantes
      const usados = new Set([
        ...gameRef.current.meuTime.map(p => p.id),
        ...Object.values(gameRef.current.aiTimes).flat().map(p => p.id),
      ]);
      const sobras = pool.filter(p => !usados.has(p.id)).sort(() => Math.random() - 0.5);
      let fillIdx = 0;

      for (const ai of AIS) {
        const need = SQUAD_SIZE - gameRef.current.aiTimes[ai.id].length;
        if (need > 0) {
          const extras = sobras.slice(fillIdx, fillIdx + need);
          fillIdx += extras.length;
          if (extras.length) {
            const nt = [...gameRef.current.aiTimes[ai.id], ...extras];
            gameRef.current.aiTimes[ai.id] = nt;
            setAiTimes(t => ({ ...t, [ai.id]: nt }));
          }
        }
      }

      // Ordena AIs por força para o torneio
      aisOrdemRef.current = [...AIS].sort(
        (a, b) => calcForce(gameRef.current.aiTimes[a.id]) - calcForce(gameRef.current.aiTimes[b.id])
      );

      setStep('simulacao');
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, pool]);

  // ── Dar lance ────────────────────────────────────────────────────────────────
  const darLance = useCallback(() => {
    if (!esperando || !ativoRef.current) return;
    const novo = lanceRef.current.atual + 2;
    if (novo > gameRef.current.meuBudget) return;

    clearInterval(timerRef.current);
    lanceRef.current = { atual:novo, lider:'eu' };
    setLanceAtual(novo); setLiderAtual('eu');
    setHistoricoLance(prev => [...prev, { quem:'eu', valor:novo, emoji:'🧑' }]);

    const jogador = poolRef.current[idxRef.current];
    const reiniciarTimer = () => {
      if (!ativoRef.current) return;
      let t = LANCE_TEMPO; setTimer(t);
      timerRef.current = setInterval(() => {
        t--; setTimer(t);
        if (t <= 0) {
          clearInterval(timerRef.current);
          ativoRef.current = false; setEsperando(false); setAiPensando(null);
          resolverRef.current?.('timeout');
        }
      }, 1000);
    };
    if (jogador) executarGuerraIA(novo, 'eu', jogador).then(reiniciarTimer);
    else reiniciarTimer();
  }, [esperando, executarGuerraIA]);

  const passarVez = useCallback(() => {
    if (!esperando) return;
    clearInterval(timerRef.current);
    ativoRef.current = false; setEsperando(false); setAiPensando(null);
    resolverRef.current?.('pass');
  }, [esperando]);

  // FIX 4: Simulação animada — estilo TecnicoPorUmDia ─────────────────────────
  const addSimLog = useCallback(async (txt, tipo='normal', ms=300) => {
    setSimLogs(prev => [...prev, { txt, tipo, key:Date.now()+Math.random() }]);
    await delay(ms);
  }, []);

  const rodarJogo = useCallback(async (meuOVR, advOVR, nomeAdv) => {
    const eventos = [];
    for (let m = 1; m <= 90; m++) {
      const chEu   = Math.max(0.005, 0.016 + (meuOVR - advOVR) * 0.0016);
      const chAdv  = Math.max(0.005, 0.016 + (advOVR - meuOVR) * 0.0016);
      const chAtm  = 0.028;
      const r = Math.random();
      if      (r < chEu)               eventos.push({ m, tipo:'gol_eu' });
      else if (r < chEu + chAdv)       eventos.push({ m, tipo:'gol_adv' });
      else if (r < chEu + chAdv + chAtm) {
        const atm = ['💨 Chute pra fora!','🚩 Escanteio!','🧤 Goleiro salva!','💥 Na trave!'];
        eventos.push({ m, tipo:'atmos', txt:`${m}' ${atm[Math.floor(Math.random()*atm.length)]}` });
      }
    }
    simPRef.current = { eu:0, adv:0 };
    setSimPlacar({ eu:0, adv:0 }); setSimMinuto(0);

    if (!eventos.length) {
      setSimMinuto(90);
      await addSimLog('⏱ Jogo travado. Nenhum gol.', 'dim', 500);
    }
    for (const ev of eventos) {
      setSimMinuto(ev.m);
      if (ev.tipo === 'gol_eu') {
        simPRef.current = { eu:simPRef.current.eu+1, adv:simPRef.current.adv };
        setSimPlacar({ ...simPRef.current });
        await addSimLog(`⚽ ${ev.m}' GOOOOL! Seu time! (${simPRef.current.eu}×${simPRef.current.adv})`, 'gol_eu', 1300);
      } else if (ev.tipo === 'gol_adv') {
        simPRef.current = { eu:simPRef.current.eu, adv:simPRef.current.adv+1 };
        setSimPlacar({ ...simPRef.current });
        await addSimLog(`⚽ ${ev.m}' Gol de ${nomeAdv}! (${simPRef.current.eu}×${simPRef.current.adv})`, 'gol_adv', 1300);
      } else {
        await addSimLog(ev.txt, 'atmos', 280);
      }
    }
    setSimMinuto(90);
    return { ...simPRef.current };
  }, [addSimLog]);

  useEffect(() => {
    if (step !== 'simulacao') return;
    const aisOrdem = aisOrdemRef.current;
    if (!aisOrdem.length) return;

    setSimRunning(true);
    setSimLogs([]); setSimResults([]); setSimFase(0);
    const fases = ['⚔️ Quartas de Final','🔥 Semifinal','🏆 Grande Final'];
    const meuOVR = calcForce(gameRef.current.meuTime);
    const results = [];

    (async () => {
      for (let f = 0; f < 3; f++) {
        const ai     = aisOrdem[f];
        const advOVR = calcForce(gameRef.current.aiTimes[ai.id]);

        setSimFase(f);
        setSimCurrentAI(ai);
        setSimLogs([]);
        setSimPlacar({ eu:0, adv:0 });
        setSimMinuto(0);

        await addSimLog(`${fases[f]}`, 'titulo', 900);
        await addSimLog(`Seu Time (OVR ${meuOVR}) × ${ai.emoji} ${ai.nome} (OVR ${advOVR})`, 'subtitulo', 600);

        const pf = await rodarJogo(meuOVR, advOVR, ai.nome);
        await addSimLog(`🏁 APITO FINAL!`, 'titulo', 1200);

        // Pênaltis se empate
        let venceu = pf.eu > pf.adv;
        if (pf.eu === pf.adv) {
          await addSimLog('⚖️ EMPATE! PÊNALTIS!', 'aviso', 1200);
          venceu = Math.random() > 0.45;
          await addSimLog(venceu ? '⚽⚽ VITÓRIA NOS PÊNALTIS!' : '❌ Derrota nos pênaltis...', venceu ? 'gol_eu' : 'gol_adv', 1400);
        }

        const res = { fase:fases[f], ai, gEu:pf.eu, gAdv:pf.adv, venceu, meuOVR, advOVR };
        results.push(res);
        setSimResults([...results]);

        if (!venceu) {
          setSimElim(true); setSimRunning(false); return;
        }
        if (f < 2) {
          await addSimLog(`✅ CLASSIFICADO! Próxima fase: ${fases[f+1]}`, 'bom', 1600);
          await delay(800);
        }
      }
      setSimCampeao(true); setSimRunning(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const reiniciar = () => {
    setStep('setup'); setPool([]); setHistorico([]); setSimResults([]);
    setSimCampeao(false); setSimElim(false);
  };

  const jogadorAtual  = pool[leilaoIdx];
  const timerPct      = (timer / LANCE_TEMPO) * 100;
  const timerCor      = timer <= 3 ? '#ef4444' : timer <= 5 ? '#f59e0b' : '#22c55e';
  const liderInfo     = liderAtual === 'eu' ? { nome:'Você', cor:'#f2c14e', emoji:'🧑' }
                      : AIS.find(a => a.id === liderAtual) || null;
  const meuTimeSize   = meuTime.length;

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
        .lei-player{background:#0d1a2e;border:2px solid rgba(242,193,78,.35);border-radius:14px;padding:18px;text-align:center;margin-bottom:12px;animation:lei-entrou .3s ease;}
        @keyframes lei-entrou{from{opacity:0;transform:translateY(-8px);}to{opacity:1;transform:translateY(0);}}
        .lei-player-name{font-family:'Oswald',sans-serif;font-size:22px;text-transform:uppercase;margin:6px 0 2px;}
        .lei-player-meta{font-family:'JetBrains Mono',monospace;font-size:11px;color:rgba(244,241,234,.4);margin:0 0 10px;}
        .lei-player-ovr{font-family:'Oswald',sans-serif;font-size:46px;font-weight:700;color:#f2c14e;line-height:1;}
        .lei-lbox{background:#070a12;border-radius:12px;padding:14px 16px;margin-bottom:10px;}
        .lei-pensando{font-family:'JetBrains Mono',monospace;font-size:11px;color:rgba(244,241,234,.4);min-height:16px;animation:lei-pulse .7s ease-in-out infinite;}
        @keyframes lei-pulse{0%,100%{opacity:.5;}50%{opacity:1;}}
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
        .lei-btn-main{display:block;width:100%;padding:14px;font-family:'Oswald',sans-serif;font-size:18px;text-transform:uppercase;border:none;border-radius:10px;background:linear-gradient(135deg,#f2c14e,#c9941f);color:#1a1300;cursor:pointer;transition:transform .15s;}
        .lei-btn-main:hover{transform:translateY(-2px);}
        /* Simulação */
        .sim-sb{background:#070a12;border:1px solid rgba(244,241,234,.1);border-radius:12px;padding:14px 18px;margin-bottom:12px;}
        .sim-sb-fase{font-family:'JetBrains Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.18em;color:#f2c14e;text-align:center;margin-bottom:6px;}
        .sim-sb-score{font-family:'Oswald',sans-serif;font-size:clamp(32px,8vw,52px);font-weight:700;text-align:center;line-height:1;}
        .sim-sb-teams{font-family:'JetBrains Mono',monospace;font-size:10px;color:rgba(244,241,234,.4);text-align:center;margin-top:4px;}
        .sim-tl{height:4px;background:rgba(244,241,234,.07);border-radius:999px;margin-top:8px;}
        .sim-tl-fill{height:100%;background:linear-gradient(90deg,#f2c14e,#ffe17a);border-radius:999px;transition:width .8s ease;}
        .sim-log{background:#070a12;border:1px solid rgba(244,241,234,.08);border-radius:12px;padding:12px;max-height:280px;overflow-y:auto;margin-bottom:12px;}
        .sim-log::-webkit-scrollbar{width:4px;}.sim-log::-webkit-scrollbar-thumb{background:rgba(244,241,234,.15);border-radius:3px;}
        .sim-logline{padding:5px 0 5px 12px;border-left:2px solid rgba(244,241,234,.15);margin-bottom:7px;font-size:12px;animation:lfade .3s ease;}
        @keyframes lfade{from{opacity:0;transform:translateY(4px);}to{opacity:1;}}
        .sim-logline.gol_eu{border-left-color:#6fd17a;color:#b9f3bf;font-family:'Oswald',sans-serif;font-size:15px;text-transform:uppercase;}
        .sim-logline.gol_adv{border-left-color:#ff5252;color:#ffc5c5;font-family:'Oswald',sans-serif;font-size:15px;text-transform:uppercase;}
        .sim-logline.titulo{border-left-color:#f2c14e;color:#f2c14e;font-family:'Oswald',sans-serif;text-transform:uppercase;}
        .sim-logline.subtitulo{border-left-color:rgba(244,241,234,.3);color:rgba(244,241,234,.45);font-family:'JetBrains Mono',monospace;font-size:10px;}
        .sim-logline.aviso{border-left-color:#5fa8d3;color:#a8d8f0;}
        .sim-logline.bom{border-left-color:#6fd17a;color:#86efac;}
        .sim-logline.atmos{border-left-color:rgba(244,241,234,.15);color:rgba(244,241,234,.35);font-size:11px;}
        .sim-logline.dim{border-left-color:rgba(244,241,234,.1);color:rgba(244,241,234,.25);}
        .sim-result-card{border-radius:10px;padding:12px 14px;margin-bottom:8px;}
        .sim-result-row{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;}
        @media(max-width:520px){.lei-budgets{grid-template-columns:1fr 1fr;} .sim-result-row{grid-template-columns:1fr;} .sim-sb-score{font-size:36px;}}
      `}</style>

      <div className="lei">
        <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, letterSpacing:'.22em', textTransform:'uppercase', color:'#f2c14e', textAlign:'center', marginBottom:4 }}>Copa do Mundo 2026</p>
        <h1 className="lei-h1">Copa Leilão</h1>
        <p style={{ textAlign:'center', color:'rgba(244,241,234,.4)', fontSize:12, fontFamily:"'JetBrains Mono',monospace", margin:'6px 0 0' }}>
          Lances até completar 11 · Monte o melhor XI · Torneio de 3 jogos
        </p>

        {/* ── Setup ── */}
        {step === 'setup' && (
          <div style={{ maxWidth:480, margin:'28px auto 0' }}>
            <div className="lei-card" style={{ padding:22, marginBottom:14 }}>
              {AIS.map(ai => (
                <div key={ai.id} style={{ display:'flex', gap:10, padding:'10px 0', borderBottom:'1px solid rgba(244,241,234,.06)' }}>
                  <span style={{ fontSize:20 }}>{ai.emoji}</span>
                  <div>
                    <div style={{ fontFamily:"'Oswald',sans-serif", fontSize:14, textTransform:'uppercase', color:ai.cor }}>{ai.nome}</div>
                    <div style={{ fontSize:12, color:'rgba(244,241,234,.45)', marginTop:2 }}>{ai.desc}</div>
                  </div>
                </div>
              ))}
              <div style={{ marginTop:14, fontSize:12, color:'rgba(244,241,234,.45)', lineHeight:1.8 }}>
                💰 Orçamento: <strong style={{ color:'#f2c14e' }}>{ORCAMENTO} OVR</strong> &nbsp;·&nbsp;
                ⏱ {LANCE_TEMPO}s por lote &nbsp;·&nbsp;
                🎯 Leilão até você ter 11 jogadores
              </div>
            </div>
            <button className="lei-btn-main" onClick={iniciar} disabled={carregando}>
              {carregando ? 'Carregando...' : '🔨 Começar o Leilão'}
            </button>
          </div>
        )}

        {/* ── Leilão ── */}
        {step === 'leilao' && jogadorAtual && (
          <div style={{ marginTop:14 }}>
            <div className="lei-budgets">
              <div className="lei-bcard" style={{ background:'rgba(242,193,78,.07)', border: liderAtual==='eu' ? '2px solid #f2c14e' : '2px solid rgba(242,193,78,.18)', transform: liderAtual==='eu' ? 'scale(1.06)' : 'none', boxShadow: liderAtual==='eu' ? '0 0 16px rgba(242,193,78,.2)' : 'none' }}>
                <div style={{ fontFamily:"'Oswald',sans-serif", fontSize:11, textTransform:'uppercase', color:'#f2c14e', marginBottom:2 }}>🧑 Você</div>
                <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:18, fontWeight:700 }}>{meuBudget}</div>
                <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, opacity:.45, marginTop:2 }}>{meuTimeSize} jog.</div>
              </div>
              {AIS.map(ai => (
                <div key={ai.id} className="lei-bcard" style={{ background:ai.cor+'0d', border: liderAtual===ai.id ? `2px solid ${ai.cor}` : `2px solid ${ai.cor}22`, transform: liderAtual===ai.id ? 'scale(1.06)' : 'none', boxShadow: liderAtual===ai.id ? `0 0 16px ${ai.cor}33` : 'none', animation: aiPensando===ai.id ? 'lei-pulse .6s ease-in-out infinite' : 'none' }}>
                  <div style={{ fontFamily:"'Oswald',sans-serif", fontSize:11, textTransform:'uppercase', color:ai.cor, marginBottom:2 }}>{ai.emoji} {ai.nome}</div>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:18, fontWeight:700 }}>{aiBudgets[ai.id]}</div>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, opacity:.45, marginTop:2 }}>{aiTimes[ai.id]?.length} jog.</div>
                </div>
              ))}
            </div>

            <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, textAlign:'center', color:'rgba(244,241,234,.28)', marginBottom:10 }}>
              Jogador {leilaoIdx+1} · Seu squad: {meuTimeSize}/{SQUAD_SIZE}
            </p>

            <div className="lei-player">
              {jogadorAtual.badge_url ? <img src={jogadorAtual.badge_url} alt="" style={{ width:46, height:28, objectFit:'cover', borderRadius:4, margin:'0 auto', display:'block' }} /> : <div style={{ width:46, height:28, background:'rgba(244,241,234,.1)', borderRadius:4, margin:'0 auto' }} />}
              <h2 className="lei-player-name">{jogadorAtual.name}</h2>
              <p className="lei-player-meta">{jogadorAtual.team_name} · {jogadorAtual.pos1}</p>
              <div className="lei-player-ovr">⭐ {jogadorAtual.overall}</div>
            </div>

            <div className="lei-lbox">
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, textTransform:'uppercase', letterSpacing:'.15em', color:'rgba(244,241,234,.3)', marginBottom:4 }}>Lance atual</div>
              <div style={{ fontFamily:"'Oswald',sans-serif", fontSize:40, fontWeight:700, lineHeight:1, color: liderInfo ? liderInfo.cor : 'rgba(244,241,234,.25)', transition:'color .2s' }}>{lanceAtual}</div>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, marginTop:4, minHeight:18 }}>
                {liderInfo ? <span style={{ color:liderInfo.cor }}>{liderInfo.emoji} {liderInfo.nome} lidera</span> : <span style={{ color:'rgba(244,241,234,.25)' }}>Sem lance</span>}
              </div>
              <div className="lei-pensando">
                {aiPensando ? `${AIS.find(a=>a.id===aiPensando)?.emoji} ${AIS.find(a=>a.id===aiPensando)?.nome} pensando...` : '\u00a0'}
              </div>
              <div className="lei-timer-bar">
                <div className="lei-timer-fill" style={{ width:`${timerPct}%`, background:timerCor }} />
              </div>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:timerCor, marginTop:4, textAlign:'right' }}>
                {esperando ? `${timer}s` : ''}
              </div>
            </div>

            {historicoLance.length > 0 && (
              <div className="lei-bid-hist">
                {historicoLance.slice(-9).map((h, i) => {
                  const inf = h.quem === 'eu' ? { cor:'#f2c14e', emoji:'🧑' } : AIS.find(a=>a.id===h.quem);
                  return <div key={i} className="lei-bid-chip" style={{ background:inf.cor+'1a', border:`1px solid ${inf.cor}44`, color:inf.cor }}>{inf.emoji} {h.valor}</div>;
                })}
              </div>
            )}

            <div className="lei-btns">
              <button className="lei-bid-btn dar" onClick={darLance}
                disabled={!esperando || (lanceAtual+2) > meuBudget || meuTimeSize >= SQUAD_SIZE}>
                🔨 Lance +2 ({lanceAtual+2})
              </button>
              <button className="lei-bid-btn pass" onClick={passarVez} disabled={!esperando}>Passar</button>
            </div>

            <div className="lei-myteam">
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, textTransform:'uppercase', letterSpacing:'.12em', color:'#f2c14e' }}>Seu elenco ({meuTimeSize}/{SQUAD_SIZE})</div>
              <div className="lei-myteam-row">
                {meuTime.map((p,i) => <div key={i} className="lei-myteam-chip"><span style={{ color:'#f2c14e', marginRight:3 }}>{p.overall}</span>{p.name.split(' ').pop()}</div>)}
                {Array.from({length:SQUAD_SIZE-meuTimeSize}).map((_,i) => <div key={i} className="lei-slot-vazio" />)}
              </div>
            </div>

            {historico.length > 0 && (
              <div className="lei-card" style={{ padding:10 }}>
                <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, textTransform:'uppercase', letterSpacing:'.1em', color:'rgba(244,241,234,.28)', margin:'0 0 7px' }}>Lotes encerrados</p>
                <div className="lei-hist">
                  {[...historico].reverse().map((h,i) => {
                    const w = h.vencedor==='eu' ? { nome:'Você', cor:'#f2c14e', emoji:'🧑' } : AIS.find(a=>a.id===h.vencedor);
                    return (
                      <div key={i} className="lei-hist-row">
                        {h.jogador.badge_url ? <img src={h.jogador.badge_url} alt="" className="lei-hist-flag" /> : <div className="lei-hist-flag" style={{ background:'rgba(244,241,234,.1)' }} />}
                        <span style={{ flex:1, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{h.jogador.name}</span>
                        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:'rgba(244,241,234,.3)' }}>OVR {h.jogador.overall}</span>
                        {w ? <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, padding:'2px 6px', borderRadius:3, background:w.cor+'1a', color:w.cor, flexShrink:0 }}>{w.emoji} {w.nome} · {h.lance}</span>
                           : <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:'rgba(244,241,234,.25)' }}>sem lance</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Simulação ── */}
        {step === 'simulacao' && simCurrentAI && (
          <div style={{ marginTop:14 }}>
            <div className="sim-sb">
              <div className="sim-sb-fase">
                {['⚔️ Quartas','🔥 Semifinal','🏆 Final'][simFase]} · {simFase+1}/3
              </div>
              <div className="sim-sb-score" style={{ color: simPlacar.eu > simPlacar.adv ? '#86efac' : simPlacar.eu < simPlacar.adv ? '#ff8a93' : '#f4f1ea' }}>
                {simPlacar.eu} × {simPlacar.adv}
              </div>
              <div className="sim-sb-teams">Você × {simCurrentAI.emoji} {simCurrentAI.nome}</div>
              <div className="sim-tl"><div className="sim-tl-fill" style={{ width:`${Math.min(100,(simMinuto/90)*100)}%` }} /></div>
            </div>

            {/* Resultados anteriores */}
            {simResults.length > 0 && (
              <div style={{ display:'flex', gap:6, marginBottom:10 }}>
                {simResults.map((r,i) => (
                  <div key={i} style={{ flex:1, background: r.venceu ? 'rgba(34,197,94,.07)' : 'rgba(239,68,68,.07)', border:`1px solid ${r.venceu?'rgba(34,197,94,.3)':'rgba(239,68,68,.3)'}`, borderRadius:8, padding:'6px 8px', textAlign:'center' }}>
                    <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:8, textTransform:'uppercase', color:'rgba(244,241,234,.4)', marginBottom:2 }}>{r.ai.emoji} {r.ai.nome}</div>
                    <div style={{ fontFamily:"'Oswald',sans-serif", fontSize:16, fontWeight:700, color: r.venceu?'#86efac':'#ff8a93' }}>{r.gEu}×{r.gAdv}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="sim-log" ref={logRef}>
              {simLogs.map(l => <div key={l.key} className={`sim-logline ${l.tipo}`}>{l.txt}</div>)}
              {simRunning && <div style={{ color:'rgba(244,241,234,.2)', fontSize:10, fontFamily:"'JetBrains Mono',monospace" }}>···</div>}
            </div>

            {/* Campeão */}
            {simCampeao && (
              <div style={{ background:'rgba(242,193,78,.07)', border:'1px solid rgba(242,193,78,.3)', borderRadius:14, padding:22, textAlign:'center' }}>
                <div style={{ fontSize:54, marginBottom:8 }}>🏆</div>
                <h2 style={{ fontFamily:"'Oswald',sans-serif", fontSize:30, textTransform:'uppercase', color:'#f2c14e', margin:'0 0 6px' }}>CAMPEÃO!</h2>
                <p style={{ fontSize:13, color:'rgba(244,241,234,.55)', margin:'0 0 16px' }}>Venceu os 3 confrontos e levantou a taça!</p>
                <button className="lei-btn-main" onClick={reiniciar}>🔄 Novo Leilão</button>
              </div>
            )}

            {/* Eliminado */}
            {simElim && (
              <div style={{ background:'rgba(239,68,68,.07)', border:'1px solid rgba(239,68,68,.25)', borderRadius:14, padding:22, textAlign:'center' }}>
                <div style={{ fontSize:48, marginBottom:8 }}>😔</div>
                <h2 style={{ fontFamily:"'Oswald',sans-serif", fontSize:26, textTransform:'uppercase', color:'#ff8a93', margin:'0 0 4px' }}>Eliminado</h2>
                <p style={{ fontSize:13, color:'rgba(244,241,234,.5)', margin:'0 0 16px' }}>
                  Caiu na {simResults[simResults.length-1]?.fase}
                </p>
                <button className="lei-btn-main" onClick={reiniciar}>🔄 Novo Leilão</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
