'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

// ─── Constantes ──────────────────────────────────────────────────────────────

const COMPETITION_ID = 7;
const MAX_TENTATIVAS = 8;

const GRUPOS_COPA = {
  A: ['Mexico','South Africa','South Korea','Czech Republic'],
  B: ['Canada','Bosnia & Herzegovina','Qatar','Switzerland'],
  C: ['Brazil','Morocco','Haiti','Scotland'],
  D: ['USA','Paraguay','Australia','Türkiye'],
  E: ['Germany','Curaçao','Ivory Coast','Ecuador'],
  F: ['Netherlands','Japan','Tunisia','Sweden'],
  G: ['Belgium','Egypt','Iran','New Zealand'],
  H: ['Spain','Cape Verde Islands','Saudi Arabia','Uruguay'],
  I: ['France','Senegal','Norway','Iraq'],
  J: ['Argentina','Algeria','Austria','Jordan'],
  K: ['Portugal','Uzbekistan','Colombia','Congo DR'],
  L: ['England','Croatia','Ghana','Panama'],
};

// Categoria ampla de posição (para match parcial)
const POS_CAT = {
  GOL:'GOL',
  LD:'DEF', LE:'DEF', ZAG:'DEF',
  VOL:'MEI', MC:'MEI', MD:'MEI', ME:'MEI', MEI:'MEI',
  PD:'ATA', PE:'ATA', SA:'ATA', CA:'ATA',
};

function getGrupo(teamName) {
  for (const [letra, times] of Object.entries(GRUPOS_COPA)) {
    if (times.includes(teamName)) return letra;
  }
  return '?';
}

function compararPalpite(palpite, resposta) {
  const grupoP = getGrupo(palpite.team_name);
  const grupoR = getGrupo(resposta.team_name);
  const ovrDiff = palpite.overall - resposta.overall;

  return {
    selecao: {
      value: palpite.team_name,
      badge: palpite.badge_url,
      status: palpite.team_name === resposta.team_name ? 'ok' : 'erro',
    },
    grupo: {
      value: grupoP,
      status: grupoP === grupoR ? 'ok' : 'erro',
    },
    posicao: {
      value: palpite.pos1 || '?',
      status:
        palpite.pos1 === resposta.pos1 ? 'ok'
        : POS_CAT[palpite.pos1] === POS_CAT[resposta.pos1] ? 'parcial'
        : 'erro',
    },
    overall: {
      value: palpite.overall,
      diff: ovrDiff,
      status: ovrDiff === 0 ? 'ok' : Math.abs(ovrDiff) <= 3 ? 'parcial' : 'erro',
      seta: ovrDiff > 0 ? '▼' : ovrDiff < 0 ? '▲' : null,
    },
  };
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function QuemEOCraque() {
  const [todosJogadores, setTodosJogadores] = useState([]);
  const [resposta, setResposta] = useState(null);
  const [palpites, setPalpites] = useState([]);       // [{ jogador, feedback }]
  const [input, setInput] = useState('');
  const [sugestoes, setSugestoes] = useState([]);
  const [idxSugestao, setIdxSugestao] = useState(-1);
  const [status, setStatus] = useState('jogando');   // 'jogando' | 'ganhou' | 'perdeu'
  const [carregando, setCarregando] = useState(true);
  const [revelando, setRevelando] = useState(false);

  const inputRef = useRef(null);
  const jaAdivinhados = useRef(new Set());

  // Carrega todos os jogadores uma única vez
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('players')
        .select('id, name, pos1, overall, team_id, teams(name, badge_url)')
        .eq('competition_id', COMPETITION_ID)
        .not('pos1', 'is', null)
        .gte('overall', 72)
        .order('overall', { ascending: false });

      const jogadores = (data || []).map(p => ({
        id: p.id,
        name: p.name,
        pos1: p.pos1,
        overall: p.overall,
        team_name: p.teams?.name || '',
        badge_url: p.teams?.badge_url || null,
      }));

      setTodosJogadores(jogadores);
      escolherResposta(jogadores);
      setCarregando(false);
    }
    load();
  }, []);

  const escolherResposta = useCallback((lista) => {
    const pool = lista || todosJogadores;
    if (!pool.length) return;
    const idx = Math.floor(Math.random() * pool.length);
    setResposta(pool[idx]);
    setPalpites([]);
    setInput('');
    setSugestoes([]);
    setStatus('jogando');
    jaAdivinhados.current = new Set();
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [todosJogadores]);

  // Autocomplete
  useEffect(() => {
    if (input.trim().length < 2) { setSugestoes([]); setIdxSugestao(-1); return; }
    const q = input.toLowerCase();
    const filtradas = todosJogadores
      .filter(j => j.name.toLowerCase().includes(q) && !jaAdivinhados.current.has(j.id))
      .slice(0, 8);
    setSugestoes(filtradas);
    setIdxSugestao(-1);
  }, [input, todosJogadores]);

  const confirmarPalpite = useCallback((jogador) => {
    if (!jogador || !resposta || status !== 'jogando' || revelando) return;
    if (jaAdivinhados.current.has(jogador.id)) return;

    jaAdivinhados.current.add(jogador.id);
    setRevelando(true);
    setInput('');
    setSugestoes([]);

    const feedback = compararPalpite(jogador, resposta);
    const novoPalpite = { jogador, feedback };

    setPalpites(prev => {
      const novos = [...prev, novoPalpite];
      const acertou = jogador.id === resposta.id;
      const esgotou = novos.length >= MAX_TENTATIVAS;

      setTimeout(() => {
        setRevelando(false);
        if (acertou) setStatus('ganhou');
        else if (esgotou) setStatus('perdeu');
        else inputRef.current?.focus();
      }, 400);

      return novos;
    });
  }, [resposta, status, revelando]);

  const handleKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdxSugestao(i => Math.min(i+1, sugestoes.length-1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setIdxSugestao(i => Math.max(i-1, -1)); }
    if (e.key === 'Enter' && idxSugestao >= 0) confirmarPalpite(sugestoes[idxSugestao]);
    if (e.key === 'Escape') { setSugestoes([]); setIdxSugestao(-1); }
  };

  const tentativasRestantes = MAX_TENTATIVAS - palpites.length;
  const pctAcerto = todosJogadores.length ? Math.round((1 / todosJogadores.length) * 100 * 1000) / 10 : 0;

  if (carregando) return (
    <div style={{ minHeight:'100vh', background:'#08111f', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <p style={{ color:'rgba(244,241,234,.5)', fontFamily:"'JetBrains Mono',monospace", letterSpacing:'.15em' }}>
        Carregando elencos...
      </p>
    </div>
  );

  return (
    <div style={{
      minHeight:'100vh',
      background:'#08111f',
      color:'#f4f1ea',
      fontFamily:"'Inter', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');
        *{box-sizing:border-box;}

        .crq-wrap{max-width:760px;margin:0 auto;padding:28px 16px 64px;}

        /* header */
        .crq-eyebrow{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.22em;
          text-transform:uppercase;color:#f2c14e;text-align:center;margin-bottom:4px;}
        .crq-h1{font-family:'Oswald',sans-serif;font-weight:700;text-transform:uppercase;
          font-size:clamp(32px,7vw,58px);text-align:center;margin:0;
          background:linear-gradient(160deg,#fff 30%,#f2c14e);
          -webkit-background-clip:text;background-clip:text;color:transparent;}
        .crq-sub{text-align:center;color:rgba(244,241,234,.5);font-size:14px;margin:6px 0 0;
          font-family:'JetBrains Mono',monospace;letter-spacing:.04em;}

        /* contador de tentativas */
        .crq-counter{display:flex;gap:6px;justify-content:center;margin:20px 0 0;}
        .crq-pip{width:10px;height:10px;border-radius:50%;transition:background .3s;}
        .crq-pip.feito{background:#f2c14e;}
        .crq-pip.atual{background:rgba(242,193,78,.35);border:2px solid #f2c14e;}
        .crq-pip.vazio{background:rgba(244,241,234,.12);}

        /* input */
        .crq-input-wrap{position:relative;margin:28px auto 0;max-width:460px;}
        .crq-input{width:100%;background:#0d1a2e;border:2px solid rgba(242,193,78,.35);
          border-radius:10px;padding:13px 16px 13px 44px;font-size:15px;font-family:'Inter',sans-serif;
          color:#f4f1ea;outline:none;transition:border-color .2s;}
        .crq-input:focus{border-color:#f2c14e;}
        .crq-input::placeholder{color:rgba(244,241,234,.3);}
        .crq-search-icon{position:absolute;left:14px;top:50%;transform:translateY(-50%);
          color:rgba(242,193,78,.6);font-size:16px;pointer-events:none;}

        /* autocomplete */
        .crq-dropdown{position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:50;
          background:#0d1a2e;border:1px solid rgba(242,193,78,.25);border-radius:10px;
          overflow:hidden;box-shadow:0 16px 48px rgba(0,0,0,.6);}
        .crq-sug{display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;
          transition:background .1s;border-bottom:1px solid rgba(244,241,234,.05);}
        .crq-sug:last-child{border-bottom:none;}
        .crq-sug:hover,.crq-sug.ativo{background:rgba(242,193,78,.1);}
        .crq-sug-flag{width:28px;height:18px;object-fit:cover;border-radius:3px;flex-shrink:0;}
        .crq-sug-flag-empty{width:28px;height:18px;background:rgba(244,241,234,.1);border-radius:3px;flex-shrink:0;}
        .crq-sug-name{flex:1;font-size:14px;font-weight:600;}
        .crq-sug-meta{font-family:'JetBrains Mono',monospace;font-size:11px;color:rgba(244,241,234,.45);}

        /* grid de palpites */
        .crq-grid{margin-top:28px;display:flex;flex-direction:column;gap:7px;}
        .crq-header{display:grid;grid-template-columns:1fr 140px 70px 70px 60px;gap:5px;
          padding:0 4px;margin-bottom:2px;}
        .crq-hcol{font-family:'JetBrains Mono',monospace;font-size:9px;text-transform:uppercase;
          letter-spacing:.12em;color:rgba(244,241,234,.35);text-align:center;}
        .crq-hcol:first-child{text-align:left;}

        .crq-row{display:grid;grid-template-columns:1fr 140px 70px 70px 60px;gap:5px;
          animation:crq-slide .35s ease;}
        @keyframes crq-slide{from{opacity:0;transform:translateY(-8px);}to{opacity:1;transform:translateY(0);}}

        .crq-cell{border-radius:8px;display:flex;align-items:center;justify-content:center;
          min-height:48px;padding:6px 8px;font-family:'JetBrains Mono',monospace;
          font-size:13px;font-weight:700;transition:background .3s;}
        .crq-cell:first-child{justify-content:flex-start;gap:8px;}
        .crq-cell-flag{width:24px;height:15px;object-fit:cover;border-radius:2px;flex-shrink:0;}
        .crq-cell-flag-empty{width:24px;height:15px;background:rgba(244,241,234,.1);border-radius:2px;flex-shrink:0;}
        .crq-cell-team{font-size:11px;font-family:'Inter',sans-serif;font-weight:600;
          white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}

        .crq-cell.ok    {background:rgba(34,197,94,.2);border:1px solid rgba(34,197,94,.5);color:#86efac;}
        .crq-cell.parcial{background:rgba(234,179,8,.18);border:1px solid rgba(234,179,8,.45);color:#fde68a;}
        .crq-cell.erro  {background:rgba(244,241,234,.05);border:1px solid rgba(244,241,234,.1);color:rgba(244,241,234,.5);}
        .crq-cell.nome  {background:rgba(244,241,234,.05);border:1px solid rgba(244,241,234,.1);
          color:#f4f1ea;font-family:'Inter',sans-serif;font-size:13px;font-weight:700;justify-content:flex-start;}

        .crq-seta{font-size:10px;margin-left:3px;opacity:.8;}

        /* resultado */
        .crq-result{margin-top:28px;padding:24px 20px;border-radius:14px;text-align:center;animation:crq-pop .4s ease;}
        .crq-result.ganhou{background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.3);}
        .crq-result.perdeu{background:rgba(215,38,61,.07);border:1px solid rgba(215,38,61,.3);}
        .crq-result-icon{font-size:40px;margin-bottom:8px;}
        .crq-result-title{font-family:'Oswald',sans-serif;font-size:24px;text-transform:uppercase;
          letter-spacing:.04em;margin:0 0 4px;}
        .crq-result-sub{color:rgba(244,241,234,.6);font-size:14px;margin:0 0 18px;}
        .crq-result-card{display:inline-flex;align-items:center;gap:12px;background:rgba(244,241,234,.05);
          border:1px solid rgba(244,241,234,.12);border-radius:10px;padding:12px 20px;margin-bottom:18px;}
        .crq-result-badge{width:44px;height:44px;object-fit:contain;}
        .crq-result-name{font-family:'Oswald',sans-serif;font-size:20px;text-align:left;}
        .crq-result-meta{font-family:'JetBrains Mono',monospace;font-size:11px;color:rgba(244,241,234,.45);text-align:left;}

        .crq-btn{font-family:'Oswald',sans-serif;font-size:17px;text-transform:uppercase;
          letter-spacing:.05em;padding:13px 32px;border-radius:10px;border:none;
          background:linear-gradient(135deg,#f2c14e,#c9941f);color:#1a1300;cursor:pointer;
          transition:transform .15s,box-shadow .15s;}
        .crq-btn:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(242,193,78,.3);}
        .crq-btn-ghost{background:transparent;border:1px solid rgba(244,241,234,.2);color:rgba(244,241,234,.7);
          margin-left:10px;}
        .crq-btn-ghost:hover{border-color:#f2c14e;color:#f2c14e;box-shadow:none;transform:none;}

        @keyframes crq-pop{from{opacity:0;transform:scale(.96);}to{opacity:1;transform:scale(1);}}

        /* vazia hint */
        .crq-hint{text-align:center;color:rgba(244,241,234,.25);font-family:'JetBrains Mono',monospace;
          font-size:12px;margin-top:24px;letter-spacing:.06em;}

        /* responsivo */
        @media(max-width:560px){
          .crq-header,.crq-row{grid-template-columns:1fr 100px 54px 54px 44px;}
          .crq-cell{min-height:42px;font-size:11px;}
          .crq-cell-team{font-size:10px;}
        }
        @media(max-width:420px){
          .crq-header,.crq-row{grid-template-columns:1fr 80px 46px 46px 38px;gap:4px;}
          .crq-cell{padding:4px 5px;font-size:10px;}
        }
        @media(prefers-reduced-motion:reduce){.crq-row,.crq-result{animation:none;}}
      `}</style>

      <div className="crq-wrap">
        {/* Cabeçalho */}
        <p className="crq-eyebrow">Copa do Mundo 2026</p>
        <h1 className="crq-h1">Quem é o Craque?</h1>
        <p className="crq-sub">
          {status === 'jogando'
            ? `${MAX_TENTATIVAS} tentativas · Descubra o jogador misterioso`
            : status === 'ganhou'
            ? '⚽ Acertou!'
            : '💀 Fim de jogo'}
        </p>

        {/* Pílulas de tentativas */}
        <div className="crq-counter">
          {Array.from({ length: MAX_TENTATIVAS }).map((_, i) => {
            const cls = i < palpites.length ? 'feito' : i === palpites.length && status === 'jogando' ? 'atual' : 'vazio';
            return <div key={i} className={`crq-pip ${cls}`} />;
          })}
        </div>

        {/* Input de busca */}
        {status === 'jogando' && (
          <div className="crq-input-wrap">
            <span className="crq-search-icon">🔍</span>
            <input
              ref={inputRef}
              className="crq-input"
              placeholder="Digite o nome do jogador..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              disabled={revelando}
              autoComplete="off"
            />
            {sugestoes.length > 0 && (
              <div className="crq-dropdown">
                {sugestoes.map((j, i) => (
                  <div
                    key={j.id}
                    className={`crq-sug ${i === idxSugestao ? 'ativo' : ''}`}
                    onMouseEnter={() => setIdxSugestao(i)}
                    onClick={() => confirmarPalpite(j)}
                  >
                    {j.badge_url
                      ? <img src={j.badge_url} alt={j.team_name} className="crq-sug-flag" />
                      : <div className="crq-sug-flag-empty" />
                    }
                    <span className="crq-sug-name">{j.name}</span>
                    <span className="crq-sug-meta">{j.team_name} · {j.pos1} · {j.overall}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Grid de palpites */}
        {palpites.length > 0 && (
          <div className="crq-grid">
            {/* Header */}
            <div className="crq-header">
              <span className="crq-hcol">Jogador</span>
              <span className="crq-hcol">Seleção</span>
              <span className="crq-hcol">Pos</span>
              <span className="crq-hcol">OVR</span>
              <span className="crq-hcol">Grupo</span>
            </div>

            {palpites.map(({ jogador, feedback }, idx) => (
              <div className="crq-row" key={idx}>
                {/* Nome */}
                <div className="crq-cell nome">
                  {jogador.name}
                </div>

                {/* Seleção */}
                <div className={`crq-cell ${feedback.selecao.status}`}>
                  {feedback.selecao.badge
                    ? <img src={feedback.selecao.badge} alt={feedback.selecao.value} className="crq-cell-flag" />
                    : <div className="crq-cell-flag-empty" />
                  }
                  <span className="crq-cell-team">{feedback.selecao.value.split(' ')[0]}</span>
                </div>

                {/* Posição */}
                <div className={`crq-cell ${feedback.posicao.status}`}>
                  {feedback.posicao.value}
                </div>

                {/* Overall */}
                <div className={`crq-cell ${feedback.overall.status}`}>
                  {feedback.overall.value}
                  {feedback.overall.seta && (
                    <span className="crq-seta">{feedback.overall.seta}</span>
                  )}
                </div>

                {/* Grupo */}
                <div className={`crq-cell ${feedback.grupo.status}`}>
                  {feedback.grupo.value}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Estado vazio */}
        {palpites.length === 0 && status === 'jogando' && (
          <p className="crq-hint">
            Comece a digitar um nome · {todosJogadores.length} jogadores disponíveis
          </p>
        )}

        {/* Resultado */}
        {(status === 'ganhou' || status === 'perdeu') && resposta && (
          <div className={`crq-result ${status}`}>
            <div className="crq-result-icon">{status === 'ganhou' ? '🏆' : '😔'}</div>
            <h2 className="crq-result-title" style={{ color: status === 'ganhou' ? '#86efac' : '#ff8a93' }}>
              {status === 'ganhou'
                ? `Acertou em ${palpites.length} tentativa${palpites.length > 1 ? 's' : ''}!`
                : 'Era este jogador:'}
            </h2>

            <div className="crq-result-card">
              {resposta.badge_url && (
                <img src={resposta.badge_url} alt={resposta.team_name} className="crq-result-badge" />
              )}
              <div>
                <div className="crq-result-name">{resposta.name}</div>
                <div className="crq-result-meta">
                  {resposta.team_name} · {resposta.pos1} · OVR {resposta.overall} · Grupo {getGrupo(resposta.team_name)}
                </div>
              </div>
            </div>

            <div>
              <button className="crq-btn" onClick={() => escolherResposta()}>
                🎲 Novo jogador
              </button>
            </div>
          </div>
        )}

        {/* Legenda */}
        {palpites.length > 0 && status === 'jogando' && (
          <div style={{
            display: 'flex', gap: 16, justifyContent: 'center', marginTop: 20,
            flexWrap: 'wrap',
          }}>
            {[['ok','✅ Correto'],['parcial','🟡 Próximo'],['erro','❌ Errado']].map(([s,l]) => (
              <div key={s} style={{ display:'flex', alignItems:'center', gap:6,
                fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:'rgba(244,241,234,.5)' }}>
                <div className={`crq-cell ${s}`} style={{
                  width:22, height:22, minHeight:'unset', borderRadius:5, padding:0
                }} />
                {l}
              </div>
            ))}
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:'rgba(244,241,234,.5)', display:'flex', alignItems:'center', gap:4 }}>
              <span>▲▼</span> OVR maior/menor
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
