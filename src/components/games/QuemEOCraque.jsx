'use client';
import { useState, useEffect, useRef } from 'react';
import { loadCopaTimes, TIERS_FIXOS } from '@/components/games/gameConstants';
import JOGADORES_COPA from '@/components/games/dados/jogadoresCopa.json';

const MAX_TENTATIVAS = 8;
const POS_CAT = { GOL:'GOL', LD:'DEF', LE:'DEF', ZAG:'DEF', VOL:'MEI', MC:'MEI', MD:'MEI', ME:'MEI', MEI:'MEI', PD:'ATA', PE:'ATA', SA:'ATA', CA:'ATA' };
const normalizarTexto = (texto) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

function compararPalpite(palpite, resposta) {
  const ovrDiff = palpite.overall - resposta.overall;
  return {
    selecao: { value: palpite.team_name, badge: palpite.badge_url, status: palpite.team_id === resposta.team_id ? 'ok' : 'erro' },
    posicao: { value: palpite.pos1 || '?', status: palpite.pos1 === resposta.pos1 ? 'ok' : POS_CAT[palpite.pos1] === POS_CAT[resposta.pos1] ? 'parcial' : 'erro' },
    overall: { value: palpite.overall, diff: ovrDiff, status: ovrDiff === 0 ? 'ok' : Math.abs(ovrDiff) <= 3 ? 'parcial' : 'erro', seta: ovrDiff > 0 ? '▼' : ovrDiff < 0 ? '▲' : null },
  };
}

export default function QuemEOCraque() {
  const [step, setStep] = useState('setup');
  const [modo, setModo] = useState('tops'); // 'tops' | 'todos'
  const [todosJogadores, setTodosJogadores] = useState([]);
  const [resposta, setResposta] = useState(null);
  const [palpites, setPalpites] = useState([]);
  const [input, setInput] = useState('');
  const [sugestoes, setSugestoes] = useState([]);
  const [status, setStatus] = useState('jogando');
  
  const inputRef = useRef(null);
  const jaAdivinhados = useRef(new Set());
  const cacheJogadores = useRef([]); // Guarda o fetch inicial para não refazer

  useEffect(() => {
    async function load() {
      const times = await loadCopaTimes();
      const timesMap = {}; times.forEach(t => { timesMap[t.id] = t; });
      // Filtra jogadores >= 74 e anexa as infos do time
      cacheJogadores.current = JOGADORES_COPA.filter(p => p.overall >= 74).map(p => ({
        ...p, team_name: timesMap[p.team_id]?.name || 'Nação', badge_url: timesMap[p.team_id]?.badge_url || null
      }));
    }
    load();
  }, []);

  const iniciarJogo = () => {
    // Filtra pelo modo selecionado
    const poolFinal = modo === 'tops' 
      ? cacheJogadores.current.filter(p => TIERS_FIXOS.top.includes(p.team_name))
      : cacheJogadores.current;
    
    setTodosJogadores(poolFinal);
    const escolhido = poolFinal[Math.floor(Math.random() * poolFinal.length)];
    setResposta(escolhido);
    setPalpites([]); setInput(''); setSugestoes([]); setStatus('jogando');
    jaAdivinhados.current = new Set();
    setStep('playing');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const lidarComBusca = (texto) => {
    setInput(texto);
    if (texto.length >= 3) {
      const termo = normalizarTexto(texto);
      const filtradas = todosJogadores.filter(j => normalizarTexto(j.name).includes(termo) && !jaAdivinhados.current.has(j.id)).slice(0, 6);
      setSugestoes(filtradas);
    } else {
      setSugestoes([]);
    }
  };

  const confirmarPalpite = (jogador) => {
    if (!jogador || status !== 'jogando') return;
    jaAdivinhados.current.add(jogador.id);
    setInput(''); setSugestoes([]);

    const feedback = compararPalpite(jogador, resposta);
    setPalpites(prev => {
      const novos = [...prev, { jogador, feedback }];
      if (jogador.id === resposta.id) setStatus('ganhou');
      else if (novos.length >= MAX_TENTATIVAS) setStatus('perdeu');
      else setTimeout(() => inputRef.current?.focus(), 100);
      return novos;
    });
  };

  return (
    <div style={{ minHeight:'100vh', background:'#08111f', color:'#f4f1ea', fontFamily:"'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');
        *{box-sizing:border-box;} .crq-wrap{max-width:760px;margin:0 auto;padding:28px 16px 64px;}
        .crq-eyebrow{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.22em; text-transform:uppercase;color:#f2c14e;text-align:center;margin-bottom:4px;}
        .crq-h1{font-family:'Oswald',sans-serif;font-weight:700;text-transform:uppercase; font-size:clamp(32px,7vw,58px);text-align:center;margin:0; background:linear-gradient(160deg,#fff 30%,#f2c14e); -webkit-background-clip:text;background-clip:text;color:transparent;}
        .crq-sub{text-align:center;color:rgba(244,241,234,.5);font-size:14px;margin:6px 0 0;}
        .crq-counter{display:flex;gap:6px;justify-content:center;margin:20px 0 0;}
        .crq-pip{width:10px;height:10px;border-radius:50%;transition:background .3s;}
        .crq-pip.feito{background:#f2c14e;} .crq-pip.atual{background:rgba(242,193,78,.35);border:2px solid #f2c14e;} .crq-pip.vazio{background:rgba(244,241,234,.12);}
        .crq-input-wrap{position:relative;margin:28px auto 0;max-width:460px;}
        .crq-input{width:100%;background:#0d1a2e;border:2px solid rgba(242,193,78,.35); border-radius:10px;padding:13px 16px;font-size:15px;color:#f4f1ea;outline:none;}
        .crq-input:focus{border-color:#f2c14e;}
        .crq-dropdown{position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:50; background:#0d1a2e;border:1px solid rgba(242,193,78,.25);border-radius:10px;overflow:hidden;}
        .crq-sug{display:flex;align-items:center;gap:10px;padding:12px;cursor:pointer;border-bottom:1px solid rgba(244,241,234,.05);}
        .crq-sug:hover{background:rgba(242,193,78,.15);}
        .crq-grid{margin-top:28px;display:flex;flex-direction:column;gap:7px;}
        .crq-header{display:grid;grid-template-columns:1fr 120px 70px 70px;gap:5px;padding:0 4px;margin-bottom:2px;}
        .crq-hcol{font-family:'JetBrains Mono',monospace;font-size:9px;text-transform:uppercase;color:rgba(244,241,234,.35);text-align:center;}
        .crq-row{display:grid;grid-template-columns:1fr 120px 70px 70px;gap:5px;}
        .crq-cell{border-radius:8px;display:flex;align-items:center;justify-content:center;min-height:48px;padding:6px;font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;}
        .crq-cell.ok{background:rgba(34,197,94,.2);border:1px solid rgba(34,197,94,.5);color:#86efac;}
        .crq-cell.parcial{background:rgba(234,179,8,.18);border:1px solid rgba(234,179,8,.45);color:#fde68a;}
        .crq-cell.erro{background:rgba(244,241,234,.05);border:1px solid rgba(244,241,234,.1);color:rgba(244,241,234,.5);}
        .crq-cell.nome{background:rgba(244,241,234,.05);color:#f4f1ea;font-family:'Inter',sans-serif;justify-content:flex-start;}
        .crq-cell-flag{width:20px;margin-right:6px;border-radius:2px;}
        .crq-result{margin-top:28px;padding:24px;border-radius:14px;text-align:center;}
        .crq-btn{font-family:'Oswald',sans-serif;font-size:17px;text-transform:uppercase;padding:12px 24px;border-radius:8px;border:none;background:#f2c14e;color:#1a1300;cursor:pointer;margin-top:16px;}
        .setup-card{background:rgba(255,255,255,.05);border:1px solid rgba(244,241,234,.1);border-radius:12px;padding:24px;max-width:500px;margin:40px auto;text-align:center;}
        .setup-pill{font-family:'JetBrains Mono',monospace;font-size:14px;padding:10px 20px;border-radius:999px;border:1px solid rgba(244,241,234,.2);background:transparent;color:#f4f1ea;cursor:pointer;margin:0 6px;}
        .setup-pill.on{background:#f2c14e;color:#1a1300;border-color:#f2c14e;font-weight:bold;}
      `}</style>

      <div className="crq-wrap">
        <p className="crq-eyebrow">Copa do Mundo 2026</p>
        <h1 className="crq-h1">Quem é o Craque?</h1>
        
        {step === 'setup' && (
          <div className="setup-card">
            <p style={{fontFamily:"'Oswald',sans-serif", fontSize:20, textTransform:'uppercase', color:'#f2c14e'}}>Modo de Jogo</p>
            <div style={{margin:'20px 0'}}>
              <button className={`setup-pill ${modo === 'tops' ? 'on' : ''}`} onClick={() => setModo('tops')}>⭐ Só Seleções Tops</button>
              <button className={`setup-pill ${modo === 'todos' ? 'on' : ''}`} onClick={() => setModo('todos')}>🌍 Todas as Seleções</button>
            </div>
            <button className="crq-btn" onClick={iniciarJogo} style={{width:'100%'}}>Começar a Investigação</button>
          </div>
        )}

        {step === 'playing' && (
          <>
            <p className="crq-sub">{status === 'jogando' ? `${MAX_TENTATIVAS - palpites.length} tentativas restantes` : status === 'ganhou' ? '⚽ Acertou!' : '💀 Fim de jogo'}</p>

            <div className="crq-counter">
              {Array.from({ length: MAX_TENTATIVAS }).map((_, i) => (
                <div key={i} className={`crq-pip ${i < palpites.length ? 'feito' : i === palpites.length && status === 'jogando' ? 'atual' : 'vazio'}`} />
              ))}
            </div>

            {status === 'jogando' && (
              <div className="crq-input-wrap">
                <input ref={inputRef} className="crq-input" placeholder="Digite 3 letras do jogador..." value={input} onChange={e => lidarComBusca(e.target.value)} autoComplete="off" />
                {sugestoes.length > 0 && (
                  <div className="crq-dropdown">
                    {sugestoes.map(j => (
                      <div key={j.id} className="crq-sug" onClick={() => confirmarPalpite(j)}>
                        {j.badge_url && <img src={j.badge_url} alt="" style={{width:24, borderRadius:3}} />}
                        <span style={{flex:1}}>{j.name}</span>
                        <span style={{fontSize:10, color:'rgba(244,241,234,.4)'}}>{j.team_name} · {j.pos1}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {palpites.length > 0 && (
              <div className="crq-grid">
                <div className="crq-header"><span className="crq-hcol" style={{textAlign:'left'}}>Jogador</span><span className="crq-hcol">Nação</span><span className="crq-hcol">Pos</span><span className="crq-hcol">OVR</span></div>
                {palpites.map(({ jogador, feedback }, idx) => (
                  <div className="crq-row" key={idx}>
                    <div className="crq-cell nome">{jogador.name}</div>
                    <div className={`crq-cell ${feedback.selecao.status}`}>
                      {feedback.selecao.badge && <img src={feedback.selecao.badge} alt="" className="crq-cell-flag" />}
                      <span style={{fontSize:10, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{feedback.selecao.value}</span>
                    </div>
                    <div className={`crq-cell ${feedback.posicao.status}`}>{feedback.posicao.value}</div>
                    <div className={`crq-cell ${feedback.overall.status}`}>{feedback.overall.value} {feedback.overall.seta}</div>
                  </div>
                ))}
              </div>
            )}

            {(status === 'ganhou' || status === 'perdeu') && resposta && (
              <div className="crq-result" style={{ background: status === 'ganhou' ? 'rgba(34,197,94,.1)' : 'rgba(215,38,61,.1)' }}>
                <h2 style={{ fontFamily: "'Oswald',sans-serif", color: status === 'ganhou' ? '#86efac' : '#ff8a93', margin:0 }}>{status === 'ganhou' ? 'VITÓRIA!' : 'FIM DE JOGO'}</h2>
                <p style={{ margin:'8px 0 16px', color:'rgba(244,241,234,.7)' }}>O craque era <strong>{resposta.name}</strong></p>
                <button className="crq-btn" onClick={() => setStep('setup')}>🎲 Jogar Novamente</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}