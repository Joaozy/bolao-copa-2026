'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  supabase, COMPETITION_ID_COPA,
  TIERS_FIXOS, SELECOES_COPA,
  loadCopaTimes
} from '@/components/games/gameConstants'; 

// 🗄️ IMPORTANDO O JSON LOCAL DIRETAMENTE
import todosJogadores from '@/components/games/dados/jogadoresCopa.json';

const SLOTS = [
  { id: 'PE',   label: 'PE',   req: ['PE', 'ATA', 'SA'], x: 18, y: 24 },
  { id: 'CA',   label: 'CA',   req: ['CA', 'ATA'],       x: 50, y: 10 },
  { id: 'PD',   label: 'PD',   req: ['PD', 'ATA', 'SA'], x: 82, y: 24 },
  { id: 'MEI',  label: 'MEI',  req: ['MEI', 'MC', 'M'],  x: 50, y: 38 },
  { id: 'MC1',  label: 'MC',   req: ['MC', 'VOL', 'MEI'],x: 30, y: 53 },
  { id: 'MC2',  label: 'MC',   req: ['MC', 'VOL', 'MEI'],x: 70, y: 53 },
  { id: 'LE',   label: 'LE',   req: ['LE', 'ADE'],       x: 12, y: 70 },
  { id: 'ZAG1', label: 'ZAG',  req: ['ZAG', 'Z'],        x: 36, y: 70 },
  { id: 'ZAG2', label: 'ZAG',  req: ['ZAG', 'Z'],        x: 64, y: 70 },
  { id: 'LD',   label: 'LD',   req: ['LD', 'ADD'],       x: 88, y: 70 },
  { id: 'GOL',  label: 'GOL',  req: ['GOL', 'GL'],       x: 50, y: 86 },
];

function slotAceita(slot, player) {
  const posicoesDoJogador = [player.pos1, player.pos2, player.pos3].filter(Boolean).map(p => p.toUpperCase());
  return posicoesDoJogador.some(pos => slot.req.includes(pos));
}

// 🎲 EMBARALHADOR 100% ALEATÓRIO
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function escolherPaisesAleatorios(allTeams, difficulty) {
  let pool;
  if (difficulty === 'easy') {
    const top   = allTeams.filter(t => TIERS_FIXOS.top.includes(t.name));
    const medio = shuffleArray(allTeams.filter(t => TIERS_FIXOS.medio.includes(t.name)));
    pool = [...top, ...medio].slice(0, 11);
  } else if (difficulty === 'normal') {
    const top   = allTeams.filter(t => TIERS_FIXOS.top.includes(t.name));
    const medio = allTeams.filter(t => TIERS_FIXOS.medio.includes(t.name));
    pool = shuffleArray([...top, ...medio]).slice(0, 11);
  } else {
    pool = shuffleArray(allTeams).slice(0, 11);
  }
  return shuffleArray(pool); 
}

export default function Futbol11() {
  const [step, setStep]             = useState('setup');
  const [difficulty, setDifficulty] = useState('normal');
  const [timerMode, setTimerMode]   = useState(0);

  const [allTeams, setAllTeams]     = useState([]);
  const [countries, setCountries]   = useState([]);
  const [curIdx, setCurIdx]         = useState(0);
  
  const [skipsDisponiveis, setSkipsDisponiveis] = useState(1);
  const inputRef                    = useRef(null);

  // ⚡ Estados da Dinâmica de Jogo
  const [busca, setBusca]                                 = useState('');
  const [opcoes, setOpcoes]                               = useState([]);
  const [jogadorSendoEscalado, setJogadorSendoEscalado]   = useState(null); 

  const [slots, setSlots]           = useState({});
  const [msg, setMsg]               = useState({ texto: '', tipo: '' });
  const [timeLeft, setTimeLeft]     = useState(0);

  const timerRef = useRef(null);

  useEffect(() => {
    loadCopaTimes().then(setAllTeams);
  }, []);

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

  useEffect(() => {
    if (step === 'playing' && !jogadorSendoEscalado && inputRef.current) {
      inputRef.current.focus();
    }
  }, [curIdx, step, jogadorSendoEscalado]);

  const iniciar = () => {
    if (!allTeams.length) return;
    const chosen = escolherPaisesAleatorios(allTeams, difficulty); 
    setCountries(chosen);
    setCurIdx(0);
    setSlots({});
    setBusca('');
    setOpcoes([]);
    setJogadorSendoEscalado(null);
    setMsg({ texto: '', tipo: '' });
    setSkipsDisponiveis(1);
    if (timerMode > 0) setTimeLeft(timerMode);
    setStep('playing');
  };

  // ⚡ NOVA BUSCA LOCAL (Instantânea)
  const lidarComBusca = (texto) => {
    setBusca(texto);
    setMsg({ texto: '', tipo: '' });

    if (texto.length >= 3) {
      const termo = texto.toLowerCase().trim();
      const resultados = todosJogadores
        .filter(jog => jog.name.toLowerCase().includes(termo))
        .slice(0, 10); // Mostra no máximo 10 opções
        
      setOpcoes(resultados);
    } else {
      setOpcoes([]);
    }
  };

  const clicarNoAutocomplete = (jogador) => {
    const paisAtualObj = countries[curIdx];

    // Verifica País garantindo que ambos sejam avaliados como texto (evita bugs de número vs string)
    if (String(jogador.team_id) !== String(paisAtualObj.id)) {
      setMsg({ texto: `❌ Errou! ${jogador.name} não joga pela seleção de ${paisAtualObj.name}.`, tipo: 'erro' });
      setBusca('');
      setOpcoes([]);
      return;
    }

    // Verifica se já está no campo
    const jaEscalado = Object.values(slots).find(s => s.player.id === jogador.id);
    if (jaEscalado) {
      setMsg({ texto: `⚠️ Você já escalou ${jogador.name}!`, tipo: 'aviso' });
      return;
    }

    // Verifica posições
    const slotsDisponiveisParaEle = SLOTS.filter(s => !slots[s.id] && slotAceita(s, jogador));
    
    if (slotsDisponiveisParaEle.length === 0) {
      setMsg({ 
        texto: `❌ Sem espaço! Todas as posições que ${jogador.name} joga já foram preenchidas no seu time.`, 
        tipo: 'erro' 
      });
      return;
    }

    // Sucesso inicial
    setJogadorSendoEscalado({ jogador, slotsPossiveis: slotsDisponiveisParaEle });
    setOpcoes([]); 
    setMsg({ texto: '', tipo: '' });
  };

  const confirmarPosicao = (slotId) => {
    const { jogador } = jogadorSendoEscalado;
    const paisAtualObj = countries[curIdx];

    setSlots(prev => ({ ...prev, [slotId]: { player: jogador, team: paisAtualObj } }));
    setMsg({ texto: `✅ ${jogador.name} escalado com sucesso!`, tipo: 'sucesso' });
    
    setJogadorSendoEscalado(null);
    setBusca('');
    avancarPais();
  };

  const cancelarEscalacao = () => {
    setJogadorSendoEscalado(null);
    setBusca('');
    if(inputRef.current) inputRef.current.focus();
  };

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
    if (skipsDisponiveis <= 0) return;
    setSkipsDisponiveis(prev => prev - 1);
    setJogadorSendoEscalado(null);
    setBusca('');
    setOpcoes([]);
    setMsg({ texto: '', tipo: '' });
    avancarPais();
  }, [curIdx, avancarPais, skipsDisponiveis]);

  const encerrar = () => {
    clearInterval(timerRef.current);
    setStep('finished');
  };

  const reiniciar = () => {
    clearInterval(timerRef.current);
    setStep('setup');
    setSlots({});
    setCurIdx(0);
    setJogadorSendoEscalado(null);
    setBusca('');
    setOpcoes([]);
    setMsg({ texto: '', tipo: '' });
  };

  const preenchidos    = Object.keys(slots).length;
  const pct            = Math.round((preenchidos / 11) * 100);
  const paisAtual      = countries[curIdx];
  const timerCor       = timeLeft <= 10 ? '#ff5252' : timeLeft <= 30 ? '#ffe17a' : '#6fd17a';

  const miniTime = t => `${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`;

  return (
    <div style={{ minHeight:'100vh', background:'#0a0f1a', color:'#f4f1ea', fontFamily:"'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');
        *{box-sizing:border-box;} body{margin:0;}
        .f11{max-width:960px;margin:0 auto;padding:24px 16px 60px;}
        @media(max-width:480px){.f11{padding:14px 10px 50px;}}

        .f11-h1{font-family:'Oswald',sans-serif;font-weight:700;text-transform:uppercase; letter-spacing:.04em;text-align:center;font-size:clamp(26px,5vw,48px); background:linear-gradient(180deg,#fff,#f2c14e);-webkit-background-clip:text; background-clip:text;color:transparent;margin:4px 0 0;}
        .f11-sub{text-align:center;color:rgba(244,241,234,.6);font-size:14px;margin:6px 0 0;}

        .f11-card{background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.01)); border:1px solid rgba(244,241,234,.1);border-radius:14px;}
        .f11-pills{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;}
        .f11-pill{font-family:'JetBrains Mono',monospace;font-size:12px;padding:8px 16px; border-radius:999px;border:1px solid rgba(244,241,234,.22);background:transparent; color:#f4f1ea;cursor:pointer;transition:all .15s;}
        .f11-pill.on{background:#f2c14e;color:#1a1300;border-color:#f2c14e;font-weight:700;}

        .f11-startbtn{font-family:'Oswald',sans-serif;font-size:20px;font-weight:700; text-transform:uppercase;padding:18px 48px;border-radius:10px;border:none; background:linear-gradient(135deg,#f2c14e,#c9941f);color:#1a1300;cursor:pointer; transition:transform .15s,box-shadow .15s;display:block;margin:24px auto 0;}
        .f11-startbtn:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(242,193,78,.3);}

        .f11-pitch{position:relative;width:100%;aspect-ratio:7/10;border-radius:16px;overflow:hidden; background:repeating-linear-gradient(0deg,#123524 0 44px,#1d5c3c 44px 88px); border:3px solid rgba(244,241,234,.45);}
        .f11-pitch::before{content:'';position:absolute;left:50%;top:50%;width:28%;aspect-ratio:1; border:2px solid rgba(244,241,234,.28);border-radius:50%;transform:translate(-50%,-50%);}
        .f11-pitch::after{content:'';position:absolute;left:0;top:50%;width:100%;height:0; border-top:2px solid rgba(244,241,234,.28);}

        .f11-slot{position:absolute;transform:translate(-50%,-50%);text-align:center; width:clamp(52px,13vw,72px);}
        .f11-slot-empty{width:clamp(44px,11vw,64px);height:clamp(28px,7vw,36px);margin:0 auto; border:2px dashed rgba(244,241,234,.35);border-radius:6px;display:flex; align-items:center;justify-content:center;background:rgba(0,0,0,0.2);}
        .f11-slot-empty.highlight{border-color:#f2c14e; background:rgba(242,193,78,.2); box-shadow: 0 0 10px rgba(242,193,78,.4);}
        .f11-slot-empty label{font-family:'JetBrains Mono',monospace;font-size:clamp(8px,2.2vw,11px); color:rgba(244,241,234,.6);font-weight:700;letter-spacing:.05em;}
        
        .f11-slot-filled{display:flex;flex-direction:column;align-items:center;gap:2px;}
        .f11-slot-flag{width:clamp(28px,8vw,40px);height:clamp(18px,5vw,26px);border-radius:4px; object-fit:cover;border:1px solid rgba(244,241,234,.3);}
        .f11-slot-name{font-size:clamp(6px,1.6vw,9px);font-weight:700;font-family:'Oswald',sans-serif; text-transform:uppercase;letter-spacing:.03em;line-height:1.1; white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:clamp(52px,13vw,72px);}

        .f11-progbar{height:4px;background:rgba(244,241,234,.1);border-radius:999px;margin:12px 0;}
        .f11-progfill{height:100%;border-radius:999px;background:linear-gradient(90deg,#f2c14e,#ffe17a); transition:width .4s ease;}

        .f11-bottom{display:grid;grid-template-columns:200px 1fr;gap:16px;margin-top:16px;align-items:start;}
        @media(max-width:600px){.f11-bottom{grid-template-columns:1fr;}}

        .f11-country-card{background:#070a12;border:2px solid rgba(244,241,234,.15);border-radius:12px; padding:16px;text-align:center;}
        .f11-country-flag{width:80px;height:52px;object-fit:cover;border-radius:6px; border:1px solid rgba(244,241,234,.25);margin-bottom:8px;}
        .f11-country-name{font-family:'Oswald',sans-serif;font-size:16px;text-transform:uppercase; color:#f2c14e;}
        
        .f11-search-container{position:relative; width:100%;}
        .f11-search-input{width:100%;padding:14px;border-radius:8px;border:2px solid rgba(244,241,234,.2); background:#070a12;color:#f4f1ea;font-family:'Inter',sans-serif;font-size:14px;outline:none;transition:border .2s;}
        .f11-search-input:focus{border-color:#f2c14e;}
        .f11-search-input::placeholder{color:rgba(244,241,234,.3);}
        
        .f11-autocomplete{position:absolute;top:100%;left:0;width:100%;background:#0a0f1a; border:1px solid rgba(244,241,234,.2);border-radius:8px;margin-top:4px;z-index:50; max-height:200px;overflow-y:auto;box-shadow: 0 10px 25px rgba(0,0,0,0.5);}
        .f11-auto-item{padding:12px;border-bottom:1px solid rgba(244,241,234,.1);cursor:pointer; display:flex;justify-content:space-between;align-items:center;transition:background .2s;}
        .f11-auto-item:hover{background:rgba(242,193,78,.15);}
        .f11-ptag{font-family:'JetBrains Mono',monospace;font-size:9px;padding:2px 6px; border-radius:4px;color:#06090f;font-weight:700;background:#f2c14e;margin-left:6px;}

        .f11-skip{width:100%;margin-top:10px;padding:7px;font-family:'JetBrains Mono',monospace; font-size:11px;border:1px dashed rgba(215,38,61,.5);border-radius:6px; background:transparent;cursor:pointer;}
        .f11-skip:hover:not(:disabled){background:rgba(215,38,61,.08);}
        .f11-skip:disabled{opacity: 0.4; cursor: not-allowed; border-color: rgba(244,241,234,.2); color: rgba(244,241,234,.4);}

        .f11-timer{font-family:'JetBrains Mono',monospace;font-weight:700;font-size:22px; text-align:center;margin-bottom:4px;}

        .f11-result-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;margin-top:16px;}
        .f11-result-slot{background:#070a12;border-radius:8px;padding:10px;text-align:center; border:1px solid rgba(244,241,234,.1);}
        .f11-result-slot.filled{border-color:rgba(242,193,78,.3);}
        .f11-result-slot.empty{border-color:rgba(215,38,61,.3);}
        .f11-result-slotlabel{font-family:'JetBrains Mono',monospace;font-size:9px; text-transform:uppercase;letter-spacing:.1em;color:rgba(244,241,234,.4);margin-bottom:4px;}
        .f11-result-flag{width:36px;height:24px;object-fit:cover;border-radius:3px;margin:0 auto 4px;}
        .f11-result-name{font-size:11px;font-weight:600;font-family:'Oswald',sans-serif; text-transform:uppercase;letter-spacing:.03em;}
        .f11-result-ovr{font-family:'JetBrains Mono',monospace;font-size:10px;color:#f2c14e;margin-top:2px;}

        .f11-reset{font-family:'JetBrains Mono',monospace;font-size:12px;background:transparent; border:1px solid rgba(244,241,234,.25);color:#f4f1ea;padding:8px 18px;border-radius:8px;cursor:pointer;}
        .f11-reset:hover{border-color:#f2c14e;color:#f2c14e;}
      `}</style>

      <div className="f11">
        <h1 className="f11-h1">Futbol 11 — Copa 2026</h1>
        <p className="f11-sub">Mostre o seu conhecimento tático puxando jogadores da memória.</p>

        {/* ── SETUP ── */}
        {step === 'setup' && (
          <div style={{ maxWidth: 520, margin: '36px auto 0' }}>
            <div className="f11-card" style={{ padding: 24 }}>
              <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(244,241,234,.5)', textAlign: 'center', marginBottom: 10 }}>Dificuldade</p>
              <div className="f11-pills" style={{ marginBottom: 28 }}>
                {[['easy','⭐ Fácil','Só seleções top'],['normal','⚽ Normal','Top + médias'],['hard','💀 Difícil','Todas as 48']].map(([v,l,d])=>(
                  <button key={v} className={`f11-pill ${difficulty===v?'on':''}`} onClick={() => setDifficulty(v)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 18px' }}>
                    <span>{l}</span><span style={{ fontSize: 10, opacity: .7, fontWeight: 400, marginTop: 2 }}>{d}</span>
                  </button>
                ))}
              </div>

              <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(244,241,234,.5)', textAlign: 'center', marginBottom: 10 }}>Cronômetro</p>
              <div className="f11-pills" style={{ marginBottom: 8 }}>
                {[[0,'⏳ Sem limite'],[90,'90s'],[60,'60s'],[40,'40s']].map(([v,l])=>(
                  <button key={v} className={`f11-pill ${timerMode===v?'on':''}`} onClick={() => setTimerMode(v)}>{l}</button>
                ))}
              </div>
            </div>

            <button className="f11-startbtn" onClick={iniciar} disabled={!allTeams.length}>
              {allTeams.length ? '⚽ Começar o Draft' : 'Carregando banco de dados...'}
            </button>
          </div>
        )}

        {/* ── PLAYING ── */}
        {step === 'playing' && paisAtual && (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: 'rgba(244,241,234,.6)' }}>
                País {curIdx + 1} de {countries.length} · {preenchidos}/11
              </span>
              {timerMode > 0 && (
                <span className="f11-timer" style={{ color: timerCor, fontSize: 18 }}>⏱ {miniTime(timeLeft)}</span>
              )}
            </div>
            <div className="f11-progbar"><div className="f11-progfill" style={{ width: `${pct}%` }} /></div>

            <div className="f11-pitch">
              {SLOTS.map(slot => {
                const filled = slots[slot.id];
                const isHighlight = jogadorSendoEscalado && jogadorSendoEscalado.slotsPossiveis.find(s => s.id === slot.id);
                return (
                  <div key={slot.id} className="f11-slot" style={{ left: `${slot.x}%`, top: `${slot.y}%` }}>
                    {filled ? (
                      <div className="f11-slot-filled">
                        {filled.team.badge_url
                          ? <img src={filled.team.badge_url} alt={filled.team.name} className="f11-slot-flag"/>
                          : <div style={{ width: 38, height: 24, background: 'rgba(244,241,234,.15)', borderRadius: 4, margin: '0 auto' }} />
                        }
                        <span className="f11-slot-name" style={{ color: '#f4f1ea' }}>{filled.player.name.split(' ').pop()}</span>
                      </div>
                    ) : (
                      <div className={`f11-slot-empty ${isHighlight ? 'highlight' : ''}`}>
                        <label style={{ color: isHighlight ? '#1a1300' : '' }}>{slot.label}</label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="f11-bottom">
              <div>
                <div className="f11-country-card">
                  {paisAtual.badge_url
                    ? <img src={paisAtual.badge_url} alt={paisAtual.name} className="f11-country-flag"/>
                    : <div style={{ width: 80, height: 52, background: 'rgba(244,241,234,.1)', borderRadius: 6, margin: '0 auto 8px' }}/>
                  }
                  <div className="f11-country-name">{paisAtual.name}</div>
                </div>
                
                <button 
                  className="f11-skip" 
                  onClick={pular} 
                  disabled={skipsDisponiveis === 0}
                  style={{ color: skipsDisponiveis === 0 ? '' : '#ff8a93' }}
                >
                  🏳️ Pular seleção ({skipsDisponiveis} restante)
                </button>
                <button className="f11-skip" style={{ marginTop: 6, borderColor: 'rgba(215,38,61,.7)', color: '#ff5252' }}
                  onClick={encerrar}>⏹ Encerrar jogo</button>
              </div>

              <div>
                {msg.texto && (
                  <div style={{
                    padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 13, fontWeight: 'bold', textAlign: 'center',
                    background: msg.tipo === 'erro' ? 'rgba(215,38,61,.2)' : msg.tipo === 'sucesso' ? 'rgba(111,209,122,.2)' : 'rgba(242,193,78,.2)',
                    color: msg.tipo === 'erro' ? '#ff8a93' : msg.tipo === 'sucesso' ? '#6fd17a' : '#ffe17a',
                    border: `1px solid ${msg.tipo === 'erro' ? 'rgba(215,38,61,.5)' : msg.tipo === 'sucesso' ? 'rgba(111,209,122,.5)' : 'rgba(242,193,78,.5)'}`
                  }}>
                    {msg.texto}
                  </div>
                )}

                {jogadorSendoEscalado ? (
                  <div style={{ background: '#1c180e', border: '2px solid #f2c14e', borderRadius: 8, padding: 16, textAlign: 'center' }}>
                    <p style={{ color: '#f2c14e', fontWeight: 'bold', marginBottom: 12 }}>
                      Onde você quer escalar {jogadorSendoEscalado.jogador.name}?
                    </p>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
                      {jogadorSendoEscalado.slotsPossiveis.map(s => (
                        <button 
                          key={s.id} 
                          onClick={() => confirmarPosicao(s.id)}
                          style={{ background: '#f2c14e', color: '#1a1300', padding: '8px 16px', borderRadius: 6, fontWeight: 'bold', border: 'none', cursor: 'pointer' }}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                    <button onClick={cancelarEscalacao} style={{ color: '#ff8a93', background: 'transparent', border: 'none', textDecoration: 'underline', cursor: 'pointer', fontSize: 13 }}>
                      Escolher outro jogador
                    </button>
                  </div>
                ) : (
                  <div className="f11-search-container">
                    <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'rgba(244,241,234,.7)', marginBottom: 8 }}>
                      👇 Digite o nome de um jogador de {paisAtual.name}
                    </p>
                    <input 
                      ref={inputRef}
                      type="text" 
                      className="f11-search-input"
                      placeholder="Busque por pelo menos 3 letras..."
                      value={busca}
                      onChange={(e) => lidarComBusca(e.target.value)}
                    />

                    {opcoes.length > 0 && (
                      <div className="f11-autocomplete">
                        {opcoes.map(jog => {
                          // Note que usamos == para lidar com caso o allTeams use string
                          const timeDoJog = allTeams.find(t => t.id == jog.team_id);
                          return (
                            <div key={jog.id} className="f11-auto-item" onClick={() => clicarNoAutocomplete(jog)}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                {timeDoJog?.badge_url && (
                                  <img src={timeDoJog.badge_url} style={{ width: 24, borderRadius: 3 }} alt="" />
                                )}
                                <strong>{jog.name}</strong>
                                <span className="f11-ptag">{jog.pos1}</span>
                              </div>
                              <span style={{ fontSize: 12, color: 'rgba(244,241,234,.5)' }}>⭐ {jog.overall}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── TIMEOUT & FINISHED ── */}
        {step === 'timeout' && (
          <div style={{ textAlign: 'center', marginTop: 40 }}>
            <p style={{ fontFamily: "'Oswald',sans-serif", fontSize: 32, textTransform: 'uppercase', color: '#ff5252' }}>⏱ Tempo esgotado!</p>
            <p style={{ color: 'rgba(244,241,234,.6)', marginBottom: 20 }}>Você preencheu {preenchidos}/11 posições.</p>
            <ResultGrid slots={slots} />
            <button className="f11-reset" style={{ marginTop: 24 }} onClick={reiniciar}>🔄 Jogar de novo</button>
          </div>
        )}

        {step === 'finished' && (
          <div style={{ marginTop: 28 }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              {preenchidos === 11 ? (
                <>
                  <p style={{ fontFamily: "'Oswald',sans-serif", fontSize: 32, textTransform: 'uppercase', color: '#f2c14e' }}>🏆 XI Completo!</p>
                  <p style={{ color: 'rgba(244,241,234,.6)' }}>Você montou um XI com jogadores de {new Set(Object.values(slots).map(s => s.team.id)).size} países.</p>
                </>
              ) : (
                <>
                  <p style={{ fontFamily: "'Oswald',sans-serif", fontSize: 28, textTransform: 'uppercase', color: '#ffe17a' }}>Jogo encerrado</p>
                  <p style={{ color: 'rgba(244,241,234,.6)' }}>Você preencheu {preenchidos} de 11 posições.</p>
                </>
              )}
            </div>
            <ResultGrid slots={slots} />
            <div style={{ textAlign: 'center', marginTop: 24 }}><button className="f11-reset" onClick={reiniciar}>🔄 Novo desafio</button></div>
          </div>
        )}
      </div>
    </div>
  );
}

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
                <div style={{ fontSize: 9, fontFamily: "'JetBrains Mono',monospace", color: 'rgba(244,241,234,.4)', marginTop: 2 }}>{filled.team.name}</div>
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
