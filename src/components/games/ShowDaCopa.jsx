'use client';
import { useState, useRef, useCallback } from 'react';
import PERGUNTAS from './dados/perguntasCopa.json';

// ─── Prêmios ────────────────────────────────────────────────────────────────
const PREMIOS = [
  { q:1,  val:'R$ 1.000',    num:1000,    seguro:false },
  { q:2,  val:'R$ 2.000',    num:2000,    seguro:false },
  { q:3,  val:'R$ 3.000',    num:3000,    seguro:false },
  { q:4,  val:'R$ 5.000',    num:5000,    seguro:false },
  { q:5,  val:'R$ 10.000',   num:10000,   seguro:true  },
  { q:6,  val:'R$ 20.000',   num:20000,   seguro:false },
  { q:7,  val:'R$ 30.000',   num:30000,   seguro:false },
  { q:8,  val:'R$ 50.000',   num:50000,   seguro:false },
  { q:9,  val:'R$ 75.000',   num:75000,   seguro:false },
  { q:10, val:'R$ 100.000',  num:100000,  seguro:true  },
  { q:11, val:'R$ 200.000',  num:200000,  seguro:false },
  { q:12, val:'R$ 300.000',  num:300000,  seguro:false },
  { q:13, val:'R$ 500.000',  num:500000,  seguro:false },
  { q:14, val:'R$ 750.000',  num:750000,  seguro:false },
  { q:15, val:'R$ 1.000.000',num:1000000, seguro:false },
];

const LETRAS = ['A','B','C','D'];
const UNI_NOMES = ['Marcos • Hist. do Futebol','Carla • Estatística','Rafael • Jornalismo','Fernanda • Ed. Física'];

const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);

function makeConfetti() {
  const colors = ['#f2c14e','#22c55e','#3b82f6','#ef4444','#a855f7','#fff','#f97316','#06b6d4'];
  return Array.from({ length: 70 }, (_, i) => ({
    id: i, x: Math.random() * 100,
    delay: Math.random() * 2.5,
    dur: 2.5 + Math.random() * 2.5,
    color: colors[Math.floor(Math.random() * colors.length)],
    size: 7 + Math.random() * 13,
    isCircle: Math.random() > 0.5,
  }));
}

function selectQuestions() {
  const easy = shuffle(PERGUNTAS.filter(p => p.nivel === 'facil'));
  const mid  = shuffle(PERGUNTAS.filter(p => p.nivel === 'medio'));
  const hard = shuffle(PERGUNTAS.filter(p => p.nivel === 'dificil'));
  return [
    ...easy.slice(0, 5),
    ...mid.slice(0, 5),
    ...hard.slice(0, 5),
  ];
}

// ─── Componente ─────────────────────────────────────────────────────────────
export default function ShowDaCopa() {
  // Game phases: intro | game | gameover | million
  const [gamePhase, setGamePhase] = useState('intro');
  // Answer phases: null | selected | suspense | correct | wrong
  const [answerPhase, setAnswerPhase] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [qIdx, setQIdx] = useState(0);
  const [selectedLetter, setSelectedLetter] = useState(null);
  const [eliminatedLetters, setEliminatedLetters] = useState([]);
  const [earnedPrize, setEarnedPrize] = useState(0);
  const [lifelines, setLifelines] = useState({ pulo:3, cartas:true, uni:true, var:true });
  const [uniData, setUniData] = useState(null);
  const [loadingUni, setLoadingUni] = useState(false);
  const [varDica, setVarDica] = useState(null);
  const [activeModal, setActiveModal] = useState(null); // 'uni' | 'var' | null
  const [screenFlash, setScreenFlash] = useState(null); // 'green' | 'red'
  const [confetti, setConfetti] = useState([]);
  const [wrongAnswer, setWrongAnswer] = useState(null); // For game over reveal
  const [pularAnim, setPularAnim] = useState(false);

  const timerRef = useRef(null);
  const reserveRef = useRef({ facil:[], medio:[], dificil:[] });

  const currentQ = questions[qIdx];
  const premioAtual = PREMIOS[qIdx];
  const safePrize = PREMIOS.slice(0, qIdx).filter(p => p.seguro).pop() || null;
  const safePrizeVal = safePrize?.val || 'R$ 0';
  const safePrizeNum = safePrize?.num || 0;

  // ── Iniciar ──────────────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    const allFacil  = shuffle(PERGUNTAS.filter(p => p.nivel === 'facil'));
    const allMedio  = shuffle(PERGUNTAS.filter(p => p.nivel === 'medio'));
    const allDificil= shuffle(PERGUNTAS.filter(p => p.nivel === 'dificil'));
    reserveRef.current = { facil:allFacil.slice(5), medio:allMedio.slice(5), dificil:allDificil.slice(5) };
    setQuestions([...allFacil.slice(0,5), ...allMedio.slice(0,5), ...allDificil.slice(0,5)]);
    setQIdx(0); setSelectedLetter(null); setEliminatedLetters([]);
    setEarnedPrize(0); setAnswerPhase(null); setScreenFlash(null);
    setUniData(null); setVarDica(null); setActiveModal(null);
    setWrongAnswer(null); setConfetti([]);
    setLifelines({ pulo:3, cartas:true, uni:true, var:true });
    setGamePhase('game');
  }, []);

  // ── Selecionar resposta ───────────────────────────────────────────────────
  const handleSelect = (letter) => {
    if (answerPhase && answerPhase !== 'selected') return;
    if (eliminatedLetters.includes(letter)) return;
    setSelectedLetter(letter);
    setAnswerPhase('selected');
  };

  // ── Confirmar resposta (começa o suspense) ────────────────────────────────
  const handleConfirm = () => {
    if (answerPhase !== 'selected' || !selectedLetter || !currentQ) return;
    clearTimeout(timerRef.current);
    setAnswerPhase('suspense');

    timerRef.current = setTimeout(() => {
      const correct = selectedLetter === currentQ.resposta;
      if (correct) {
        setAnswerPhase('correct');
        setScreenFlash('green');
        setTimeout(() => setScreenFlash(null), 800);
        if (qIdx === 14) {
          setTimeout(() => {
            setEarnedPrize(1000000);
            setConfetti(makeConfetti());
            setGamePhase('million');
          }, 2200);
        } else {
          setTimeout(() => {
            setEarnedPrize(PREMIOS[qIdx].num);
            setQIdx(i => i + 1);
            setSelectedLetter(null);
            setEliminatedLetters([]);
            setAnswerPhase(null);
            setUniData(null);
            setVarDica(null);
          }, 2000);
        }
      } else {
        setWrongAnswer(selectedLetter);
        setAnswerPhase('wrong');
        setScreenFlash('red');
        setTimeout(() => setScreenFlash(null), 800);
        setTimeout(() => {
          setEarnedPrize(safePrizeNum);
          setGamePhase('gameover');
        }, 2800);
      }
    }, 2200); // ← suspense de 2.2 segundos
  };

  // ── Desistir ─────────────────────────────────────────────────────────────
  const desistir = () => {
    clearTimeout(timerRef.current);
    setEarnedPrize(PREMIOS[qIdx]?.num || earnedPrize);
    setGamePhase('gameover');
  };

  // ── Pulo ─────────────────────────────────────────────────────────────────
  const usarPulo = () => {
    if (lifelines.pulo <= 0 || answerPhase === 'suspense') return;
    const nivel = currentQ?.nivel;
    const pool  = reserveRef.current[nivel] || [];
    if (!pool.length) return;
    const nova = pool.pop();
    reserveRef.current[nivel] = pool;
    setPularAnim(true);
    setTimeout(() => {
      setQuestions(qs => { const n = [...qs]; n[qIdx] = nova; return n; });
      setSelectedLetter(null); setEliminatedLetters([]);
      setAnswerPhase(null); setUniData(null); setVarDica(null);
      setLifelines(l => ({ ...l, pulo: l.pulo - 1 }));
      setPularAnim(false);
    }, 350);
  };

  // ── Cartas (50/50) ────────────────────────────────────────────────────────
  const usarCartas = () => {
    if (!lifelines.cartas || !currentQ || answerPhase === 'suspense') return;
    const erradas = LETRAS.filter(l => l !== currentQ.resposta && !eliminatedLetters.includes(l));
    const eliminar = shuffle(erradas).slice(0, 2);
    setEliminatedLetters(prev => [...prev, ...eliminar]);
    if (selectedLetter && eliminar.includes(selectedLetter)) setSelectedLetter(null);
    setLifelines(l => ({ ...l, cartas: false }));
  };

  // ── Universitários ────────────────────────────────────────────────────────
  const usarUni = async () => {
    if (!lifelines.uni || !currentQ) return;
    setLifelines(l => ({ ...l, uni: false }));
    setActiveModal('uni');
    setLoadingUni(true);
    try {
      const optText = LETRAS.map(l => `${l}) ${currentQ.opcoes[l]}`).join('\n');
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6', max_tokens: 600,
          system: `Você é 4 estudantes universitários de futebol. Responda APENAS JSON, sem markdown:
[{"nome":"Nome Área","resposta":"A","certeza":75,"comentario":"comentário curto (max 12 palavras)"}]
Faça opiniões divergentes — não 100% certeiros. Os nomes são: ${UNI_NOMES.join(', ')}.`,
          messages: [{ role:'user', content:`Pergunta: ${currentQ.pergunta}\n${optText}\nQual resposta?` }]
        })
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || '[]';
      setUniData(JSON.parse(text.replace(/```json|```/g,'').trim()));
    } catch {
      const ans = currentQ.resposta;
      const outras = LETRAS.filter(l => l !== ans);
      setUniData([
        { nome:UNI_NOMES[0], resposta:ans,     certeza:80, comentario:'Tenho certeza, vi isso na faculdade.' },
        { nome:UNI_NOMES[1], resposta:outras[0],certeza:52, comentario:'Acho que é essa... talvez.' },
        { nome:UNI_NOMES[2], resposta:ans,     certeza:70, comentario:'Lembro de ter estudado isso.' },
        { nome:UNI_NOMES[3], resposta:outras[1],certeza:45, comentario:'Não tenho certeza, chuto essa.' },
      ]);
    }
    setLoadingUni(false);
  };

  // ── VAR ───────────────────────────────────────────────────────────────────
  const usarVAR = () => {
    if (!lifelines.var || !currentQ) return;
    setLifelines(l => ({ ...l, var: false }));
    setVarDica(currentQ.dica);
    setActiveModal('var');
  };

  // ── Helpers de cor de opção ────────────────────────────────────────────────
  const getOptClass = (letter) => {
    if (answerPhase === 'correct') {
      if (letter === currentQ?.resposta) return 'opt-correct';
      if (letter === selectedLetter) return 'opt-dim';
      return 'opt-dim';
    }
    if (answerPhase === 'wrong') {
      if (letter === selectedLetter) return 'opt-wrong';
      if (letter === currentQ?.resposta) return 'opt-correct-reveal';
      return 'opt-dim';
    }
    if (answerPhase === 'suspense' && letter === selectedLetter) return 'opt-suspense';
    if (letter === selectedLetter) return 'opt-selected';
    if (eliminatedLetters.includes(letter)) return 'opt-eliminated';
    return 'opt-default';
  };

  const fmtNum = n => n.toLocaleString('pt-BR');

  const nivelAtual = qIdx < 5 ? 'fácil' : qIdx < 10 ? 'médio' : 'difícil';
  const nivelCor   = qIdx < 5 ? '#22c55e' : qIdx < 10 ? '#f59e0b' : '#ef4444';

  return (
    <div
      style={{ minHeight:'100vh', background:'#060c16', color:'#f4f1ea', fontFamily:"'Inter',sans-serif", position:'relative', overflow:'hidden' }}
    >
      {/* ── FLASH DE TELA ── */}
      {screenFlash && (
        <div style={{
          position:'fixed', inset:0, zIndex:999, pointerEvents:'none',
          background: screenFlash === 'green' ? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.22)',
          animation: 'screenFlashAnim 0.8s ease forwards',
        }} />
      )}

      {/* ── CONFETES (MILHÃO) ── */}
      {confetti.map(c => (
        <div key={c.id} style={{
          position:'fixed', top:0, left:`${c.x}%`, zIndex:1000, pointerEvents:'none',
          width: c.size, height: c.size,
          background: c.color,
          borderRadius: c.isCircle ? '50%' : '2px',
          animation: `confettiFall ${c.dur}s ${c.delay}s ease-in forwards`,
          opacity:0,
        }} />
      ))}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');
        *{box-sizing:border-box;}

        @keyframes screenFlashAnim{0%{opacity:0}20%{opacity:1}100%{opacity:0}}
        @keyframes confettiFall{0%{transform:translateY(-80px) rotate(0deg);opacity:1}100%{transform:translateY(110vh) rotate(800deg);opacity:0}}
        @keyframes trophyFloat{0%,100%{transform:translateY(0) rotate(-6deg) scale(1)}50%{transform:translateY(-18px) rotate(6deg) scale(1.05)}}
        @keyframes selectedGlow{0%,100%{box-shadow:0 0 10px rgba(242,193,78,.3);border-color:#f2c14e}50%{box-shadow:0 0 28px rgba(242,193,78,.75);border-color:#fff;background:rgba(242,193,78,.12)}}
        @keyframes suspenseFlash{0%,100%{background:rgba(242,193,78,.06);border-color:rgba(242,193,78,.6)}50%{background:rgba(242,193,78,.28);border-color:#fff;box-shadow:0 0 35px rgba(242,193,78,.6)}}
        @keyframes correctReveal{0%{transform:scale(1)}30%{transform:scale(1.04);box-shadow:0 0 35px rgba(34,197,94,.7)}60%{transform:scale(1.02)}100%{transform:scale(1)}}
        @keyframes wrongShake{0%,100%{transform:translateX(0)}12%,62%{transform:translateX(-11px)}37%,87%{transform:translateX(11px)}}
        @keyframes correctRevealOther{from{background:rgba(34,197,94,.05)}to{background:rgba(34,197,94,.2);border-color:#22c55e;box-shadow:0 0 20px rgba(34,197,94,.3)}}
        @keyframes optSlideIn{from{opacity:0;transform:translateX(-16px)}to{opacity:1;transform:translateX(0)}}
        @keyframes qSlideIn{from{opacity:0;transform:translateY(-14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes gameOverSlam{0%{transform:scale(4) rotate(-5deg);opacity:0}50%{transform:scale(.9);opacity:1}70%{transform:scale(1.05)}100%{transform:scale(1)}}
        @keyframes gameOverText{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
        @keyframes millionExplode{0%{transform:scale(0.4) rotate(-10deg);opacity:0}55%{transform:scale(1.12) rotate(4deg);opacity:1}75%{transform:scale(0.96)}100%{transform:scale(1) rotate(0)}}
        @keyframes millionText{0%{opacity:0;transform:scale(.5) skewX(-5deg)}60%{opacity:1;transform:scale(1.08)}100%{transform:scale(1)}}
        @keyframes pularAnim{0%{opacity:1;transform:translateX(0)}50%{opacity:0;transform:translateX(40px)}51%{opacity:0;transform:translateX(-40px)}100%{opacity:1;transform:translateX(0)}}
        @keyframes introFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
        @keyframes introGlow{0%,100%{text-shadow:0 0 30px rgba(242,193,78,.3)}50%{text-shadow:0 0 60px rgba(242,193,78,.7),0 0 100px rgba(242,193,78,.3)}}
        @keyframes prizeHighlight{0%{transform:scaleX(1)}50%{transform:scaleX(1.04)}100%{transform:scaleX(1)}}
        @keyframes uniSlide{from{opacity:0;transform:translateX(-20px)}to{opacity:1;transform:translateX(0)}}
        @keyframes varEntry{from{opacity:0;transform:scale(.9)}to{opacity:1;transform:scale(1)}}
        @keyframes dotBlink{0%,80%,100%{opacity:0}40%{opacity:1}}

        .sm-main{max-width:900px;margin:0 auto;padding:20px 14px 80px;}

        /* Options */
        .opt-default{background:rgba(255,255,255,.03);border:2px solid rgba(255,255,255,.1);cursor:pointer;transition:all .15s;}
        .opt-default:hover{background:rgba(255,255,255,.07);border-color:rgba(242,193,78,.4);transform:scale(1.01);}
        .opt-selected{background:rgba(242,193,78,.1);border:2px solid #f2c14e;animation:selectedGlow 1.1s ease-in-out infinite;}
        .opt-suspense{background:rgba(242,193,78,.08);border:2px solid #f2c14e;animation:suspenseFlash .28s ease-in-out infinite;}
        .opt-correct{background:rgba(34,197,94,.2);border:2px solid #22c55e;animation:correctReveal .6s ease;cursor:default;}
        .opt-correct-reveal{background:rgba(34,197,94,.2);border:2px solid #22c55e;animation:correctRevealOther .5s ease forwards;cursor:default;}
        .opt-wrong{background:rgba(239,68,68,.2);border:2px solid #ef4444;animation:wrongShake .55s ease;cursor:default;}
        .opt-eliminated{opacity:.18;pointer-events:none;border:2px solid transparent;text-decoration:line-through;}
        .opt-dim{opacity:.3;border:2px solid transparent;cursor:default;}
        .opt-base{display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:12px;font-size:14px;color:#f4f1ea;text-align:left;width:100%;transition:all .18s;}

        /* Prize ladder */
        .prize-row{display:flex;align-items:center;justify-content:space-between;padding:4px 10px;border-radius:8px;transition:all .2s;}
        .prize-row.current{background:rgba(242,193,78,.15);border:1px solid rgba(242,193,78,.4);animation:prizeHighlight .6s ease;}
        .prize-row.earned{background:rgba(34,197,94,.07);border:1px solid rgba(34,197,94,.2);}
        .prize-row.safe{border-left:3px solid #3b82f6!important;}

        /* Ajudas */
        .lifeline{display:flex;flex-direction:column;align-items:center;gap:3px;padding:9px 12px;border:1px solid rgba(244,241,234,.15);border-radius:10px;cursor:pointer;transition:all .15s;background:rgba(255,255,255,.025);min-width:68px;}
        .lifeline:hover:not(:disabled){background:rgba(255,255,255,.07);border-color:rgba(244,241,234,.35);transform:scale(1.05);}
        .lifeline:disabled,.lifeline.used{opacity:.25;cursor:not-allowed;text-decoration:line-through;}
        .lifeline-icon{font-size:22px;}
        .lifeline-label{font-family:'JetBrains Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:rgba(244,241,234,.5);}
        .lifeline-count{font-family:'Oswald',sans-serif;font-size:14px;color:#f2c14e;}

        /* Botões */
        .btn-main{display:block;width:100%;padding:14px;font-family:'Oswald',sans-serif;font-size:20px;text-transform:uppercase;border:none;border-radius:12px;background:linear-gradient(135deg,#f2c14e,#c9941f);color:#1a1300;cursor:pointer;transition:all .15s;}
        .btn-main:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 8px 24px rgba(242,193,78,.25);}
        .btn-main:disabled{opacity:.35;cursor:not-allowed;}
        .btn-confirm{font-family:'Oswald',sans-serif;font-size:18px;text-transform:uppercase;padding:14px 24px;border-radius:10px;border:none;background:linear-gradient(135deg,#f2c14e,#c9941f);color:#1a1300;cursor:pointer;transition:all .15s;}
        .btn-confirm:hover:not(:disabled){transform:scale(1.04);}
        .btn-confirm:disabled{opacity:.3;cursor:not-allowed;}
        .btn-stop{font-family:'Oswald',sans-serif;font-size:15px;text-transform:uppercase;padding:10px 18px;border-radius:9px;border:1px solid rgba(244,241,234,.2);background:rgba(255,255,255,.04);color:rgba(244,241,234,.65);cursor:pointer;transition:all .15s;}
        .btn-stop:hover{background:rgba(255,255,255,.08);}

        /* Modals */
        .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px);}
        .modal-box{background:#0a1628;border:1px solid rgba(242,193,78,.25);border-radius:16px;padding:24px;width:100%;max-width:480px;animation:varEntry .25s ease;}

        @media(max-width:700px){.sm-layout{flex-direction:column!important;} .sm-ladder{display:none!important;}}
      `}</style>

      {/* ════════════════════════════════ INTRO ═════════════════════════════════ */}
      {gamePhase === 'intro' && (
        <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'20px', textAlign:'center', background:'radial-gradient(ellipse at 50% 0%, rgba(242,193,78,.12) 0%, transparent 60%)' }}>
          <div style={{ fontSize:'clamp(72px,18vw,120px)', animation:'trophyFloat 2.8s ease-in-out infinite', marginBottom:8 }}>🏆</div>
          <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, letterSpacing:'.3em', textTransform:'uppercase', color:'#f2c14e', marginBottom:6 }}>Copa do Mundo</p>
          <h1 style={{ fontFamily:"'Oswald',sans-serif", fontWeight:700, fontSize:'clamp(36px,10vw,72px)', textTransform:'uppercase', margin:'0 0 4px', background:'linear-gradient(135deg,#fff 30%,#f2c14e)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text', animation:'introGlow 2.5s ease-in-out infinite' }}>
            SHOW DA COPA
          </h1>
          <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:'rgba(244,241,234,.4)', marginBottom:36 }}>da Copa</p>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10, maxWidth:460, width:'100%', marginBottom:32 }}>
            {[['15 Perguntas','5 fáceis · 5 médias · 5 difíceis'],['4 Ajudas','Pulo · Cartas · Alunos · VAR'],['2 Seguros','R$10k e R$100k protegidos'],['30 Sec','Suspense em cada resposta!']].map(([t,d]) => (
              <div key={t} style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(244,241,234,.1)', borderRadius:12, padding:14 }}>
                <div style={{ fontFamily:"'Oswald',sans-serif", fontSize:15, textTransform:'uppercase', color:'#f2c14e', marginBottom:4 }}>{t}</div>
                <div style={{ fontSize:11, color:'rgba(244,241,234,.5)', lineHeight:1.5 }}>{d}</div>
              </div>
            ))}
          </div>
          <button className="btn-main" style={{ maxWidth:340 }} onClick={startGame}>⚽ Começar o Jogo!</button>
        </div>
      )}

      {/* ════════════════════════════════ GAME ══════════════════════════════════ */}
      {gamePhase === 'game' && currentQ && (
        <div className="sm-main">
          {/* Layout split */}
          <div className="sm-layout" style={{ display:'flex', gap:16, alignItems:'flex-start' }}>

            {/* ── Coluna principal ── */}
            <div style={{ flex:1, minWidth:0 }}>
              {/* Header */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <div>
                  <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, letterSpacing:'.2em', textTransform:'uppercase', color:'#f2c14e', margin:0 }}>Show da Copa</p>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:nivelCor, marginTop:3 }}>
                    Pergunta {qIdx+1}/15 · Nível {nivelAtual}
                  </div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontFamily:"'Oswald',sans-serif", fontSize:20, color:'#f2c14e' }}>{premioAtual?.val}</div>
                  {safePrize && <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:'rgba(244,241,234,.3)', marginTop:2 }}>Seguro: {safePrizeVal}</div>}
                </div>
              </div>

              {/* Pergunta */}
              <div key={qIdx} style={{
                background:'linear-gradient(145deg,#091425,#0d1f3c)', border:'1px solid rgba(242,193,78,.25)',
                borderRadius:16, padding:'22px 20px', marginBottom:14, textAlign:'center',
                animation:'qSlideIn .4s ease', position:'relative', overflow:'hidden',
              }}>
                <div style={{ position:'absolute', inset:0, background:'radial-gradient(circle at 50% 0%, rgba(242,193,78,.06) 0%, transparent 55%)', pointerEvents:'none' }} />
                <div style={{ fontFamily:"'Oswald',sans-serif", fontSize:'clamp(16px,3.2vw,22px)', lineHeight:1.35, fontWeight:600, textTransform:'uppercase', position:'relative', zIndex:1 }}>
                  {currentQ.pergunta}
                </div>
              </div>

              {/* Opções */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }} key={`opts-${qIdx}`}>
                {LETRAS.map((letter, li) => (
                  <button
                    key={letter}
                    className={`opt-base ${getOptClass(letter)}`}
                    style={{ animation: `optSlideIn .35s ease ${li * 0.07}s both` }}
                    disabled={!!answerPhase && answerPhase !== 'selected'}
                    onClick={() => handleSelect(letter)}
                  >
                    <span style={{
                      fontFamily:"'Oswald',sans-serif", fontSize:17, fontWeight:700,
                      width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center',
                      background: getOptClass(letter) === 'opt-correct' || getOptClass(letter) === 'opt-correct-reveal' ? 'rgba(34,197,94,.25)' : getOptClass(letter) === 'opt-wrong' ? 'rgba(239,68,68,.25)' : 'rgba(242,193,78,.12)',
                      border: '1px solid',
                      borderColor: getOptClass(letter) === 'opt-correct' || getOptClass(letter) === 'opt-correct-reveal' ? '#22c55e' : getOptClass(letter) === 'opt-wrong' ? '#ef4444' : 'rgba(242,193,78,.3)',
                      borderRadius:6, flexShrink:0,
                      color: getOptClass(letter) === 'opt-correct' || getOptClass(letter) === 'opt-correct-reveal' ? '#86efac' : getOptClass(letter) === 'opt-wrong' ? '#fca5a5' : '#f2c14e',
                    }}>{letter}</span>
                    <span style={{ flex:1 }}>{currentQ.opcoes[letter]}</span>
                    {getOptClass(letter) === 'opt-correct' && <span style={{ fontSize:18 }}>✅</span>}
                    {getOptClass(letter) === 'opt-correct-reveal' && <span style={{ fontSize:18 }}>✅</span>}
                    {getOptClass(letter) === 'opt-wrong' && <span style={{ fontSize:18 }}>❌</span>}
                  </button>
                ))}
              </div>

              {/* Suspense indicator */}
              {answerPhase === 'suspense' && (
                <div style={{ textAlign:'center', marginBottom:12, fontFamily:"'Oswald',sans-serif", fontSize:18, color:'#f2c14e', letterSpacing:'.1em' }}>
                  🎵 A resposta é...
                  <span style={{ display:'inline-flex', gap:4, marginLeft:8, verticalAlign:'middle' }}>
                    {[0,1,2].map(i => <span key={i} style={{ width:7, height:7, borderRadius:'50%', background:'#f2c14e', display:'inline-block', animation:`dotBlink 1s ${i*0.3}s infinite` }} />)}
                  </span>
                </div>
              )}

              {/* VAR dica inline (se ativada sem modal) */}
              {varDica && !activeModal && (
                <div style={{ background:'rgba(59,130,246,.1)', border:'1px solid rgba(59,130,246,.3)', borderRadius:10, padding:12, marginBottom:12 }}>
                  <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:'#93c5fd', textTransform:'uppercase' }}>📺 VAR: </span>
                  <span style={{ fontSize:13, color:'#dbeafe' }}>{varDica}</span>
                </div>
              )}

              {/* Ajudas */}
              <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap', marginBottom:14 }}>
                {[
                  { key:'pulo', icon:'⏭️', label:'Pulo', count:`${lifelines.pulo}×`, fn:usarPulo, disabled:lifelines.pulo<=0||answerPhase==='suspense' },
                  { key:'cartas', icon:'🃏', label:'Cartas', count:'', fn:usarCartas, disabled:!lifelines.cartas||answerPhase==='suspense' },
                  { key:'uni', icon:'🎓', label:'Alunos', count:'', fn:usarUni, disabled:!lifelines.uni||answerPhase==='suspense' },
                  { key:'var', icon:'📺', label:'VAR', count:'', fn:usarVAR, disabled:!lifelines.var||answerPhase==='suspense' },
                ].map(h => (
                  <button key={h.key} className={`lifeline${(!lifelines[h.key] && h.key!=='pulo') || (h.key==='pulo' && lifelines.pulo<=0) ? ' used' : ''}`}
                    disabled={h.disabled} onClick={h.fn}>
                    <span className="lifeline-icon">{h.icon}</span>
                    <span className="lifeline-label">{h.label}</span>
                    {h.count && <span className="lifeline-count">{h.count}</span>}
                  </button>
                ))}
              </div>

              {/* Botões confirmar/desistir */}
              <div style={{ display:'flex', gap:10 }}>
                <button className="btn-confirm" style={{ flex:2 }}
                  disabled={answerPhase !== 'selected' || !selectedLetter}
                  onClick={handleConfirm}>
                  {answerPhase === 'suspense' ? '🎵 Revelando...' : selectedLetter ? `Confirmar "${selectedLetter}" →` : 'Escolha uma resposta'}
                </button>
                <button className="btn-stop" onClick={desistir} disabled={answerPhase === 'suspense'}>
                  🏳️ Parar<br/>
                  <span style={{ fontSize:12, color:'#f2c14e' }}>{earnedPrize ? fmtNum(earnedPrize) : '—'}</span>
                </button>
              </div>
            </div>

            {/* ── Escada de prêmios (sidebar) ── */}
            <div className="sm-ladder" style={{ width:200, flexShrink:0, position:'sticky', top:20 }}>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, textTransform:'uppercase', letterSpacing:'.15em', color:'rgba(244,241,234,.3)', marginBottom:8, textAlign:'center' }}>Prêmios</div>
              <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                {[...PREMIOS].reverse().map((p, ri) => {
                  const idx = 14 - ri;
                  const isCur = idx === qIdx;
                  const isEarned = idx < qIdx;
                  const isSeguro = p.seguro;
                  return (
                    <div key={p.q} className={`prize-row${isCur?' current':''}${isEarned?' earned':''}${isSeguro?' safe':''}`}>
                      <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:'rgba(244,241,234,.3)', width:18 }}>{p.q}</span>
                      <span style={{
                        fontFamily:"'Oswald',sans-serif", fontSize: isCur ? 14 : 12,
                        color: isCur ? '#f2c14e' : isEarned ? '#86efac' : isSeguro ? '#93c5fd' : 'rgba(244,241,234,.45)',
                        fontWeight: isCur ? 700 : 400,
                      }}>
                        {isSeguro && '🔒 '}{p.num >= 1000 ? p.num >= 1000000 ? '1.000.000' : `${p.num/1000}k` : p.num}
                      </span>
                      {isCur && <span style={{ fontSize:10, color:'#f2c14e' }}>◀</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════ GAME OVER ══════════════════════════════ */}
      {gamePhase === 'gameover' && (
        <div style={{
          minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          padding:20, textAlign:'center',
          background:'radial-gradient(ellipse at 50% 0%, rgba(239,68,68,.22) 0%, #060c16 55%)',
        }}>
          <div style={{ fontSize:'clamp(60px,16vw,100px)', marginBottom:8, animation:'trophyFloat 2s ease-in-out infinite' }}>😢</div>

          <h1 style={{
            fontFamily:"'Oswald',sans-serif", fontSize:'clamp(38px,11vw,72px)', textTransform:'uppercase',
            color:'#ff4444', margin:'0 0 4px', animation:'gameOverSlam .8s cubic-bezier(.34,1.56,.64,1) forwards',
            textShadow:'0 0 40px rgba(239,68,68,.6)',
          }}>GAME OVER</h1>
          <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:'rgba(244,241,234,.4)', animation:'gameOverText .5s ease .3s both', marginBottom:20 }}>
            Você errou e foi eliminado!
          </p>

          {/* Resposta certa */}
          {wrongAnswer && questions[qIdx] && (
            <div style={{ background:'rgba(34,197,94,.08)', border:'1px solid rgba(34,197,94,.25)', borderRadius:14, padding:16, maxWidth:480, width:'100%', marginBottom:20, animation:'gameOverText .5s ease .5s both' }}>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:'#86efac', textTransform:'uppercase', marginBottom:8 }}>
                A resposta correta era:
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontFamily:"'Oswald',sans-serif", fontSize:28, color:'#22c55e', width:38, height:38, background:'rgba(34,197,94,.15)', border:'1px solid #22c55e', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  {questions[qIdx].resposta}
                </span>
                <span style={{ fontSize:14, color:'#dcfce7', textAlign:'left' }}>
                  {questions[qIdx].opcoes[questions[qIdx].resposta]}
                </span>
              </div>
            </div>
          )}

          {/* Prêmio */}
          <div style={{ animation:'gameOverText .5s ease .7s both', marginBottom:24 }}>
            <p style={{ fontSize:14, color:'rgba(244,241,234,.5)', marginBottom:4 }}>Você leva para casa:</p>
            <div style={{ fontFamily:"'Oswald',sans-serif", fontSize:'clamp(30px,9vw,52px)', color: earnedPrize > 0 ? '#f2c14e' : 'rgba(244,241,234,.4)', fontWeight:700 }}>
              {earnedPrize > 0 ? `R$ ${fmtNum(earnedPrize)}` : 'R$ 0'}
            </div>
            {earnedPrize === 0 && <p style={{ fontSize:12, color:'rgba(244,241,234,.35)', marginTop:4 }}>Você não atingiu nenhum seguro 😞</p>}
          </div>

          <div style={{ display:'flex', gap:10, flexWrap:'wrap', justifyContent:'center', animation:'gameOverText .5s ease .9s both' }}>
            <button className="btn-main" style={{ maxWidth:260 }} onClick={startGame}>🔄 Jogar de Novo</button>
            <button onClick={() => setGamePhase('intro')} style={{ padding:'14px 20px', fontFamily:"'Oswald',sans-serif", fontSize:16, textTransform:'uppercase', border:'1px solid rgba(244,241,234,.2)', borderRadius:10, background:'transparent', color:'rgba(244,241,234,.55)', cursor:'pointer' }}>
              ← Início
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════ MILHÃO ════════════════════════════════ */}
      {gamePhase === 'million' && (
        <div style={{
          minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          padding:20, textAlign:'center',
          background:'radial-gradient(ellipse at 50% 30%, rgba(242,193,78,.3) 0%, rgba(242,193,78,.05) 40%, #060c16 70%)',
        }}>
          <div style={{ fontSize:'clamp(80px,20vw,140px)', animation:'trophyFloat 1.5s ease-in-out infinite', marginBottom:12 }}>🏆</div>

          <h1 style={{
            fontFamily:"'Oswald',sans-serif", fontSize:'clamp(32px,9vw,68px)', textTransform:'uppercase',
            margin:'0 0 8px', animation:'millionText .6s cubic-bezier(.34,1.56,.64,1) forwards',
            background:'linear-gradient(135deg,#ffd700,#fff 40%,#f2c14e 70%,#ffd700)',
            WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text',
            textShadow:'none',
          }}>VOCÊ É MILIONÁRIO!</h1>

          <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:'rgba(244,241,234,.5)', marginBottom:24, animation:'gameOverText .5s ease .4s both' }}>
            Respondeu todas as 15 perguntas! Você é um gênio do futebol! 🌍⚽
          </p>

          <div style={{ animation:'millionExplode .7s .2s ease-out both', marginBottom:28 }}>
            <div style={{ fontFamily:"'Oswald',sans-serif", fontSize:'clamp(44px,12vw,80px)', fontWeight:700, color:'#f2c14e', textShadow:'0 0 60px rgba(242,193,78,.6)' }}>
              R$ 1.000.000
            </div>
          </div>

          <div style={{ display:'flex', gap:12, flexWrap:'wrap', justifyContent:'center', animation:'gameOverText .5s ease .9s both' }}>
            <button className="btn-main" style={{ maxWidth:280 }} onClick={startGame}>🔄 Jogar de Novo</button>
            <button onClick={() => setGamePhase('intro')} style={{ padding:'14px 20px', fontFamily:"'Oswald',sans-serif", fontSize:16, textTransform:'uppercase', border:'1px solid rgba(244,241,234,.2)', borderRadius:10, background:'transparent', color:'rgba(244,241,234,.55)', cursor:'pointer' }}>
              ← Início
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════ MODAIS ════════════════════════════════ */}

      {/* Modal: Universitários */}
      {activeModal === 'uni' && (
        <div className="modal-bg" onClick={() => setActiveModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily:"'Oswald',sans-serif", fontSize:22, textTransform:'uppercase', color:'#f2c14e', margin:'0 0 16px' }}>🎓 Painel dos Universitários</h3>
            {loadingUni ? (
              <div style={{ textAlign:'center', padding:28 }}>
                <div style={{ fontSize:28, marginBottom:8 }}>🤔</div>
                <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:'rgba(244,241,234,.4)' }}>Os alunos estão debatendo...</p>
              </div>
            ) : uniData && (
              <>
                {uniData.map((u, i) => (
                  <div key={i} style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(244,241,234,.1)', borderRadius:10, padding:12, marginBottom:10, animation:`uniSlide .3s ease ${i*.12}s both` }}>
                    <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:'#f2c14e', textTransform:'uppercase', marginBottom:6 }}>{u.nome}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <span style={{ fontFamily:"'Oswald',sans-serif", fontSize:26, fontWeight:700, width:36, height:36, background:'rgba(242,193,78,.15)', border:'1px solid rgba(242,193,78,.3)', borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', color:'#f2c14e', flexShrink:0 }}>{u.resposta}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ height:4, background:'rgba(244,241,234,.08)', borderRadius:2, overflow:'hidden' }}>
                          <div style={{ width:`${u.certeza}%`, height:'100%', background:'linear-gradient(90deg,#3b82f6,#22c55e)', borderRadius:2, transition:'width 1s ease' }} />
                        </div>
                        <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:'rgba(244,241,234,.4)', marginTop:3 }}>{u.certeza}% de certeza</div>
                      </div>
                    </div>
                    <div style={{ fontSize:11, color:'rgba(244,241,234,.45)', marginTop:5, fontStyle:'italic' }}>"{u.comentario}"</div>
                  </div>
                ))}
                <button className="btn-main" style={{ marginTop:8, fontSize:16, padding:12 }} onClick={() => setActiveModal(null)}>Voltar ao jogo</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal: VAR */}
      {activeModal === 'var' && (
        <div className="modal-bg" onClick={() => setActiveModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily:"'Oswald',sans-serif", fontSize:22, textTransform:'uppercase', color:'#93c5fd', margin:'0 0 4px' }}>📺 Revisão do VAR</h3>
            <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:'rgba(244,241,234,.35)', textTransform:'uppercase', marginBottom:16 }}>Central de vídeo revisando a pergunta...</p>
            <div style={{ background:'rgba(59,130,246,.08)', border:'1px solid rgba(59,130,246,.25)', borderRadius:12, padding:18, marginBottom:16 }}>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:'#93c5fd', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:10 }}>💡 Dica do árbitro:</div>
              <div style={{ fontSize:16, lineHeight:1.6, color:'#dbeafe' }}>{varDica}</div>
            </div>
            <button className="btn-main" style={{ fontSize:16, padding:12 }} onClick={() => setActiveModal(null)}>Entendido, voltar!</button>
          </div>
        </div>
      )}
    </div>
  );
}
