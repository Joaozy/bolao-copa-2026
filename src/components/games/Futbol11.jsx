'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  supabase, COMPETITION_ID_COPA, POSICAO_COR, POSICAO_LABEL,
  classificarPosicao, TIERS_FIXOS, SELECOES_COPA,
  hashStr, seededShuffle, getTodaySeed, loadCopaTimes, loadJogadoresDoTime,
} from '@/components/games/gameConstants';

// ─── Formação fixa: 4-2-3-1 ────────────────────────────────────────────────
const SLOTS = [
  { id: 'ST',  label: 'ST',  x: 50, y: 10, onlyGol: false },
  { id: 'LW',  label: 'LW',  x: 18, y: 24, onlyGol: false },
  { id: 'RW',  label: 'RW',  x: 82, y: 24, onlyGol: false },
  { id: 'CAM', label: 'CAM', x: 50, y: 38, onlyGol: false },
  { id: 'CM1', label: 'CM',  x: 30, y: 53, onlyGol: false },
  { id: 'CM2', label: 'CM',  x: 70, y: 53, onlyGol: false },
  { id: 'LB',  label: 'LB',  x: 12, y: 70, onlyGol: false },
  { id: 'CB1', label: 'CB',  x: 36, y: 70, onlyGol: false },
  { id: 'CB2', label: 'CB',  x: 64, y: 70, onlyGol: false },
  { id: 'RB',  label: 'RB',  x: 88, y: 70, onlyGol: false },
  { id: 'GK',  label: 'GK',  x: 50, y: 86, onlyGol: true  },
];
const SLOT_IDS = SLOTS.map(s => s.id);

// 👇 AJUSTADO PARA LER pos1
function slotAceita(slot, player) {
  const cat = classificarPosicao(player.pos1);
  if (slot.onlyGol) return cat === 'GOL';
  return cat !== 'GOL';
}

// ─── Seed diário por dificuldade ────────────────────────────────────────────
function escolherPaisesHoje(allTeams, difficulty) {
  const seed = getTodaySeed() + difficulty;
  let pool;
  if (difficulty === 'easy') {
    const top   = allTeams.filter(t => TIERS_FIXOS.top.includes(t.name));
    const medio = seededShuffle(allTeams.filter(t => TIERS_FIXOS.medio.includes(t.name)), seed);
    pool = [...top, ...medio].slice(0, 11);
  } else if (difficulty === 'normal') {
    const top   = allTeams.filter(t => TIERS_FIXOS.top.includes(t.name));
    const medio = allTeams.filter(t => TIERS_FIXOS.medio.includes(t.name));
    pool = seededShuffle([...top, ...medio], seed).slice(0, 11);
  } else {
    pool = seededShuffle(allTeams, seed).slice(0, 11);
  }
  return seededShuffle(pool, seed + 'order');
}

// ─── Componente ─────────────────────────────────────────────────────────────
export default function Futbol11() {
  const [step, setStep]             = useState('setup');   // setup | playing | finished | timeout
  const [difficulty, setDifficulty] = useState('normal');
  const [timerMode, setTimerMode]   = useState(0);         // 0 = sem timer

  const [allTeams, setAllTeams]     = useState([]);
  const [countries, setCountries]   = useState([]);        // 11 países do dia
  const [curIdx, setCurIdx]         = useState(0);         // qual país está na vez
  const [players, setPlayers]       = useState([]);        // jogadores do país atual
  const [loadingPlayers, setLoadingPlayers] = useState(false);

  const [slots, setSlots]           = useState({});        // { slotId: { player, team } }
  const [picking, setPicking]       = useState(null);      // jogador aguardando slot
  const [msg, setMsg]               = useState('');        // feedback temporário
  const [timeLeft, setTimeLeft]     = useState(0);

  const timerRef = useRef(null);
  const skipped  = useRef(new Set());                      // países que o user pulou

  // Carrega times
  useEffect(() => {
    loadCopaTimes().then(setAllTeams);
  }, []);

  // Countdown
  useEffect(() => {
    if (step !== 'playing' || timerMode === 0) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); setStep('timeout'); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [step, timerMode]);

  // Carrega jogadores do país atual
  useEffect(() => {
    if (step !== 'playing' || !countries[curIdx]) return;
    setLoadingPlayers(true);
    setPlayers([]);
    loadJogadoresDoTime(countries[curIdx].id)
      .then(data => { setPlayers(data); setLoadingPlayers(false); });
  }, [step, curIdx, countries]);

  const iniciar = () => {
    if (!allTeams.length) return;
    const chosen = escolherPaisesHoje(allTeams, difficulty);
    setCountries(chosen);
    setCurIdx(0);
    setSlots({});
    setPicking(null);
    setMsg('');
    skipped.current.clear();
    if (timerMode > 0) setTimeLeft(timerMode);
    setStep('playing');
  };

  const selecionarJogador = useCallback(p => {
    // Verifica se há algum slot disponível para esse jogador
    const slotsLivres = SLOTS.filter(s => !slots[s.id] && slotAceita(s, p));
    if (!slotsLivres.length) {
      setMsg(`Não há vaga disponível para ${p.name} (${classificarPosicao(p.pos1)}) nessa formação.`);
      return;
    }
    setPicking(p);
    setMsg('');
  }, [slots]);

  const confirmarSlot = useCallback(slotId => {
    if (!picking) return;
    const slot = SLOTS.find(s => s.id === slotId);
    if (!slot || slots[slotId]) return;
    if (!slotAceita(slot, picking)) {
      setMsg('Esse jogador não pode jogar nessa posição.');
      return;
    }
    setSlots(prev => ({ ...prev, [slotId]: { player: picking, team: countries[curIdx] } }));
    setPicking(null);
    setMsg('');
    // Avança para o próximo país
    avancarPais();
  }, [picking, slots, countries, curIdx]);

  const avancarPais = useCallback(() => {
    const proximo = curIdx + 1;
    if (proximo >= countries.length) {
      clearInterval(timerRef.current);
      setStep('finished');
    } else {
      setCurIdx(proximo);
    }
  }, [curIdx, countries]);

  const pular = useCallback(() => {
    skipped.current.add(curIdx);
    setPicking(null);
    setMsg('');
    avancarPais();
  }, [curIdx, avancarPais]);

  const encerrar = () => {
    clearInterval(timerRef.current);
    setStep('finished');
  };

  const reiniciar = () => {
    clearInterval(timerRef.current);
    setStep('setup');
    setSlots({});
    setPlayers([]);
    setCurIdx(0);
    setPicking(null);
    setMsg('');
  };

  // ── Render helpers ─────────────────────────────────────────────────────────
  const preenchidos    = Object.keys(slots).length;
  const pct            = Math.round((preenchidos / 11) * 100);
  const paisAtual      = countries[curIdx];
  const timerCor       = timeLeft <= 10 ? '#ff5252' : timeLeft <= 30 ? '#ffe17a' : '#6fd17a';
  const slotsPicking   = picking ? SLOTS.filter(s => !slots[s.id] && slotAceita(s, picking)) : [];
  const jogadoresLista = players.filter(p =>
    // Só mostra jogadores cuja posição cabe em pelo menos um slot vazio
    SLOTS.some(s => !slots[s.id] && slotAceita(s, p))
  );

  const miniTime = t => `${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`;

  return (
    <div style={{
      minHeight:'100vh', background:'#0a0f1a', color:'#f4f1ea',
      fontFamily:"'Inter', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');
        *{box-sizing:border-box;} body{margin:0;}
        .f11{max-width:960px;margin:0 auto;padding:24px 16px 60px;}
        @media(max-width:480px){.f11{padding:14px 10px 50px;}}

        .f11-h1{font-family:'Oswald',sans-serif;font-weight:700;text-transform:uppercase;
          letter-spacing:.04em;text-align:center;font-size:clamp(26px,5vw,48px);
          background:linear-gradient(180deg,#fff,#f2c14e);-webkit-background-clip:text;
          background-clip:text;color:transparent;margin:4px 0 0;}
        .f11-sub{text-align:center;color:rgba(244,241,234,.6);font-size:14px;margin:6px 0 0;}

        /* setup */
        .f11-card{background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.01));
          border:1px solid rgba(244,241,234,.1);border-radius:14px;}
        .f11-pills{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;}
        .f11-pill{font-family:'JetBrains Mono',monospace;font-size:12px;padding:8px 16px;
          border-radius:999px;border:1px solid rgba(244,241,234,.22);background:transparent;
          color:#f4f1ea;cursor:pointer;transition:all .15s;}
        .f11-pill.on{background:#f2c14e;color:#1a1300;border-color:#f2c14e;font-weight:700;}

        .f11-startbtn{font-family:'Oswald',sans-serif;font-size:20px;font-weight:700;
          text-transform:uppercase;padding:18px 48px;border-radius:10px;border:none;
          background:linear-gradient(135deg,#f2c14e,#c9941f);color:#1a1300;cursor:pointer;
          transition:transform .15s,box-shadow .15s;display:block;margin:24px auto 0;}
        .f11-startbtn:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(242,193,78,.3);}

        /* campo */
        .f11-pitch{position:relative;width:100%;aspect-ratio:7/10;border-radius:16px;overflow:hidden;
          background:repeating-linear-gradient(0deg,#123524 0 44px,#1d5c3c 44px 88px);
          border:3px solid rgba(244,241,234,.45);}
        .f11-pitch::before{content:'';position:absolute;left:50%;top:50%;width:28%;aspect-ratio:1;
          border:2px solid rgba(244,241,234,.28);border-radius:50%;transform:translate(-50%,-50%);}
        .f11-pitch::after{content:'';position:absolute;left:0;top:50%;width:100%;height:0;
          border-top:2px solid rgba(244,241,234,.28);}

        .f11-slot{position:absolute;transform:translate(-50%,-50%);text-align:center;
          width:clamp(52px,13vw,72px);}
        .f11-slot-empty{width:clamp(44px,11vw,64px);height:clamp(28px,7vw,36px);margin:0 auto;
          border:2px dashed rgba(244,241,234,.35);border-radius:6px;display:flex;
          align-items:center;justify-content:center;transition:all .15s;cursor:default;}
        .f11-slot-empty.available{border-color:#f2c14e;background:rgba(242,193,78,.12);
          cursor:pointer;animation:f11pulse .8s ease-in-out infinite;}
        .f11-slot-empty label{font-family:'JetBrains Mono',monospace;font-size:clamp(8px,2.2vw,11px);
          color:rgba(244,241,234,.7);font-weight:700;letter-spacing:.05em;pointer-events:none;}
        .f11-slot-filled{display:flex;flex-direction:column;align-items:center;gap:2px;}
        .f11-slot-flag{width:clamp(28px,8vw,40px);height:clamp(18px,5vw,26px);border-radius:4px;
          object-fit:cover;border:1px solid rgba(244,241,234,.3);}
        .f11-slot-name{font-size:clamp(6px,1.6vw,9px);font-weight:700;font-family:'Oswald',sans-serif;
          text-transform:uppercase;letter-spacing:.03em;line-height:1.1;
          white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:clamp(52px,13vw,72px);}

        @keyframes f11pulse{0%,100%{box-shadow:0 0 0 0 rgba(242,193,78,.4);}
          50%{box-shadow:0 0 0 5px rgba(242,193,78,0);}}

        /* barra de progresso */
        .f11-progbar{height:4px;background:rgba(244,241,234,.1);border-radius:999px;margin:12px 0;}
        .f11-progfill{height:100%;border-radius:999px;background:linear-gradient(90deg,#f2c14e,#ffe17a);
          transition:width .4s ease;}

        /* painel inferior */
        .f11-bottom{display:grid;grid-template-columns:200px 1fr;gap:16px;margin-top:16px;align-items:start;}
        @media(max-width:600px){.f11-bottom{grid-template-columns:1fr;}}

        .f11-country-card{background:#070a12;border:2px solid rgba(244,241,234,.15);border-radius:12px;
          padding:16px;text-align:center;}
        .f11-country-flag{width:80px;height:52px;object-fit:cover;border-radius:6px;
          border:1px solid rgba(244,241,234,.25);margin-bottom:8px;}
        .f11-country-name{font-family:'Oswald',sans-serif;font-size:16px;text-transform:uppercase;
          letter-spacing:.06em;color:#f2c14e;}
        .f11-country-sub{font-family:'JetBrains Mono',monospace;font-size:10px;
          color:rgba(244,241,234,.45);margin-top:2px;}

        .f11-skip{width:100%;margin-top:10px;padding:7px;font-family:'JetBrains Mono',monospace;
          font-size:11px;border:1px dashed rgba(215,38,61,.5);border-radius:6px;
          background:transparent;color:#ff8a93;cursor:pointer;}
        .f11-skip:hover{background:rgba(215,38,61,.08);}

        /* lista de jogadores */
        .f11-playerlist{max-height:220px;overflow-y:auto;background:#070a12;border-radius:10px;
          border:1px solid rgba(244,241,234,.1);}
        .f11-prow{display:flex;justify-content:space-between;align-items:center;
          padding:8px 12px;border-bottom:1px solid rgba(244,241,234,.06);cursor:pointer;transition:background .12s;}
        .f11-prow:hover{background:rgba(242,193,78,.08);}
        .f11-prow.selected{background:rgba(242,193,78,.16);border-left:2px solid #f2c14e;}
        .f11-prow.disabled{opacity:.3;cursor:not-allowed;}
        .f11-ptag{font-family:'JetBrains Mono',monospace;font-size:9px;padding:1px 5px;
          border-radius:4px;color:#06090f;font-weight:700;margin-left:4px;}

        .f11-msg{font-family:'JetBrains Mono',monospace;font-size:12px;color:#ffe17a;
          text-align:center;padding:8px;min-height:32px;}

        /* timer */
        .f11-timer{font-family:'JetBrains Mono',monospace;font-weight:700;font-size:22px;
          text-align:center;margin-bottom:4px;}

        /* resultado */
        .f11-result-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;margin-top:16px;}
        .f11-result-slot{background:#070a12;border-radius:8px;padding:10px;text-align:center;
          border:1px solid rgba(244,241,234,.1);}
        .f11-result-slot.filled{border-color:rgba(242,193,78,.3);}
        .f11-result-slot.empty{border-color:rgba(215,38,61,.3);}
        .f11-result-slotlabel{font-family:'JetBrains Mono',monospace;font-size:9px;
          text-transform:uppercase;letter-spacing:.1em;color:rgba(244,241,234,.4);margin-bottom:4px;}
        .f11-result-flag{width:36px;height:24px;object-fit:cover;border-radius:3px;margin:0 auto 4px;}
        .f11-result-name{font-size:11px;font-weight:600;font-family:'Oswald',sans-serif;
          text-transform:uppercase;letter-spacing:.03em;}
        .f11-result-ovr{font-family:'JetBrains Mono',monospace;font-size:10px;color:#f2c14e;margin-top:2px;}

        .f11-reset{font-family:'JetBrains Mono',monospace;font-size:12px;background:transparent;
          border:1px solid rgba(244,241,234,.25);color:#f4f1ea;padding:8px 18px;border-radius:8px;cursor:pointer;}
        .f11-reset:hover{border-color:#f2c14e;color:#f2c14e;}

        .f11-eyebrow{font-family:'JetBrains Mono',monospace;letter-spacing:.22em;text-transform:uppercase;
          font-size:11px;color:#f2c14e;text-align:center;}

        @media(prefers-reduced-motion:reduce){.f11-slot-empty.available{animation:none!important;}}
      `}</style>

      <div className="f11">
        <p className="f11-eyebrow">Desafio Diário</p>
        <h1 className="f11-h1">Futbol 11 — Copa 2026</h1>
        <p className="f11-sub">Monte um XI com jogadores de 11 seleções diferentes, um por vez.</p>

        {/* ── SETUP ── */}
        {step === 'setup' && (
          <div style={{ maxWidth: 520, margin: '36px auto 0' }}>
            <div className="f11-card" style={{ padding: 24 }}>
              <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '.12em',
                textTransform: 'uppercase', color: 'rgba(244,241,234,.5)', textAlign: 'center', marginBottom: 10 }}>
                Dificuldade
              </p>
              <div className="f11-pills" style={{ marginBottom: 28 }}>
                {[['easy','⭐ Fácil','Só seleções top'],['normal','⚽ Normal','Top + médias'],['hard','💀 Difícil','Todas as 48']].map(([v,l,d])=>(
                  <button key={v} className={`f11-pill ${difficulty===v?'on':''}`} onClick={() => setDifficulty(v)}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 18px' }}>
                    <span>{l}</span>
                    <span style={{ fontSize: 10, opacity: .7, fontWeight: 400, marginTop: 2 }}>{d}</span>
                  </button>
                ))}
              </div>

              <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '.12em',
                textTransform: 'uppercase', color: 'rgba(244,241,234,.5)', textAlign: 'center', marginBottom: 10 }}>
                Cronômetro
              </p>
              <div className="f11-pills" style={{ marginBottom: 8 }}>
                {[[0,'⏳ Sem limite'],[90,'90s'],[60,'60s'],[40,'40s']].map(([v,l])=>(
                  <button key={v} className={`f11-pill ${timerMode===v?'on':''}`} onClick={() => setTimerMode(v)}>{l}</button>
                ))}
              </div>

              <p style={{ textAlign: 'center', fontFamily: "'JetBrains Mono',monospace", fontSize: 11,
                color: 'rgba(244,241,234,.4)', marginTop: 8 }}>
                🗓️ Países do dia: {getTodaySeed()} · {difficulty}
              </p>
            </div>

            <button className="f11-startbtn" onClick={iniciar} disabled={!allTeams.length}>
              {allTeams.length ? '⚽ Começar' : 'Carregando banco de dados...'}
            </button>
          </div>
        )}

        {/* ── PLAYING ── */}
        {step === 'playing' && paisAtual && (
          <div style={{ marginTop: 20 }}>
            {/* header: progresso + timer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: 'rgba(244,241,234,.6)' }}>
                País {curIdx + 1} de {countries.length} · {preenchidos}/11 jogadores
              </span>
              {timerMode > 0 && (
                <span className="f11-timer" style={{ color: timerCor, fontSize: 18 }}>
                  ⏱ {miniTime(timeLeft)}
                </span>
              )}
            </div>
            <div className="f11-progbar">
              <div className="f11-progfill" style={{ width: `${pct}%` }} />
            </div>

            {/* campo */}
            <div className="f11-pitch">
              {SLOTS.map(slot => {
                const filled    = slots[slot.id];
                const isAvail   = !!picking && !filled && slotAceita(slot, picking);
                return (
                  <div key={slot.id} className="f11-slot"
                    style={{ left: `${slot.x}%`, top: `${slot.y}%` }}>
                    {filled ? (
                      <div className="f11-slot-filled">
                        {filled.team.badge_url
                          ? <img src={filled.team.badge_url} alt={filled.team.name} className="f11-slot-flag"/>
                          : <div style={{ width: 38, height: 24, background: 'rgba(244,241,234,.15)', borderRadius: 4, margin: '0 auto' }} />
                        }
                        <span className="f11-slot-name" style={{ color: '#f4f1ea' }}>
                          {filled.player.name.split(' ').pop()}
                        </span>
                      </div>
                    ) : (
                      <div className={`f11-slot-empty ${isAvail ? 'available' : ''}`}
                        onClick={() => isAvail && confirmarSlot(slot.id)}>
                        <label>{slot.label}</label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* painel inferior */}
            <div className="f11-bottom">
              {/* País da vez */}
              <div>
                <div className="f11-country-card">
                  {paisAtual.badge_url
                    ? <img src={paisAtual.badge_url} alt={paisAtual.name} className="f11-country-flag"/>
                    : <div style={{ width: 80, height: 52, background: 'rgba(244,241,234,.1)', borderRadius: 6, margin: '0 auto 8px' }}/>
                  }
                  <div className="f11-country-name">{paisAtual.name}</div>
                  <div className="f11-country-sub">
                    Escolha 1 jogador
                  </div>
                </div>
                <button className="f11-skip" onClick={pular}>🏳️ Pular esta seleção</button>
                <button className="f11-skip" style={{ marginTop: 6, borderColor: 'rgba(215,38,61,.7)', color: '#ff5252' }}
                  onClick={encerrar}>⏹ Encerrar jogo</button>
              </div>

              {/* Lista de jogadores */}
              <div>
                {picking && (
                  <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#f2c14e',
                    marginBottom: 8, textAlign: 'center' }}>
                    ✅ {picking.name} selecionado — clique numa vaga dourada no campo
                  </p>
                )}
                <div className="f11-msg">{msg}</div>
                {loadingPlayers
                  ? <p style={{ textAlign: 'center', color: 'rgba(244,241,234,.4)', fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>
                      Carregando jogadores...
                    </p>
                  : jogadoresLista.length === 0
                    ? <p style={{ textAlign: 'center', color: 'rgba(244,241,234,.4)', fontFamily: "'JetBrains Mono',monospace", fontSize: 12, padding: 16 }}>
                        Nenhum jogador disponível para as vagas restantes.
                      </p>
                    : (
                      <div className="f11-playerlist">
                        {jogadoresLista.map(p => {
                          const cat   = classificarPosicao(p.pos1);
                          const isSel = picking?.id === p.id;
                          return (
                            <div key={p.id}
                              className={`f11-prow ${isSel ? 'selected' : ''}`}
                              onClick={() => picking?.id === p.id ? setPicking(null) : selecionarJogador(p)}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <strong style={{ fontSize: 13 }}>{p.name}</strong>
                                <span className="f11-ptag" style={{ background: POSICAO_COR[cat] }}>{cat}</span>
                              </div>
                              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700,
                                color: '#f2c14e', fontSize: 13 }}>{p.overall}</span>
                            </div>
                          );
                        })}
                      </div>
                    )
                }
              </div>
            </div>
          </div>
        )}

        {/* ── TIMEOUT ── */}
        {step === 'timeout' && (
          <div style={{ textAlign: 'center', marginTop: 40 }}>
            <p style={{ fontFamily: "'Oswald',sans-serif", fontSize: 32, textTransform: 'uppercase', color: '#ff5252' }}>
              ⏱ Tempo esgotado!
            </p>
            <p style={{ color: 'rgba(244,241,234,.6)', marginBottom: 20 }}>
              Você preencheu {preenchidos}/11 posições.
            </p>
            <ResultGrid slots={slots} />
            <button className="f11-reset" style={{ marginTop: 24 }} onClick={reiniciar}>🔄 Jogar de novo</button>
          </div>
        )}

        {/* ── FINISHED ── */}
        {step === 'finished' && (
          <div style={{ marginTop: 28 }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              {preenchidos === 11 ? (
                <>
                  <p style={{ fontFamily: "'Oswald',sans-serif", fontSize: 32, textTransform: 'uppercase', color: '#f2c14e' }}>
                    🏆 XI Completo!
                  </p>
                  <p style={{ color: 'rgba(244,241,234,.6)' }}>
                    Você montou um XI com jogadores de {new Set(Object.values(slots).map(s => s.team.id)).size} países diferentes.
                  </p>
                </>
              ) : (
                <>
                  <p style={{ fontFamily: "'Oswald',sans-serif", fontSize: 28, textTransform: 'uppercase', color: '#ffe17a' }}>
                    Jogo encerrado · {preenchidos}/11
                  </p>
                  <p style={{ color: 'rgba(244,241,234,.6)' }}>
                    Você preencheu {preenchidos} de 11 posições.
                  </p>
                </>
              )}
            </div>
            <ResultGrid slots={slots} />
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <button className="f11-reset" onClick={reiniciar}>🔄 Novo desafio</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Subcomponente: grade de resultado ────────────────────────────────────────
function ResultGrid({ slots }) {
  return (
    <div className="f11-result-grid">
      {SLOTS.map(slot => {
        const filled = slots[slot.id];
        return (
          <div key={slot.id} className={`f11-result-slot ${filled ? 'filled' : 'empty'}`}>
            <div className="f11-result-slotlabel">{slot.label}</div>
            {filled ? (
              <>
                {filled.team.badge_url
                  ? <img src={filled.team.badge_url} alt={filled.team.name} className="f11-result-flag"/>
                  : <div className="f11-result-flag" style={{ background: 'rgba(244,241,234,.1)' }}/>
                }
                <div className="f11-result-name">{filled.player.name.split(' ').pop()}</div>
                <div className="f11-result-ovr">⭐{filled.player.overall}</div>
                <div style={{ fontSize: 9, fontFamily: "'JetBrains Mono',monospace",
                  color: 'rgba(244,241,234,.4)', marginTop: 2 }}>{filled.team.name}</div>
              </>
            ) : (
              <div style={{ color: 'rgba(215,38,61,.6)', fontSize: 20, margin: '8px 0' }}>—</div>
            )}
          </div>
        );
      })}
    </div>
  );
}