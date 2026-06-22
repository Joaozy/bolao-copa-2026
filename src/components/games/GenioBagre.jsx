'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import JOGADORES_COPA from '@/components/games/dados/jogadoresCopa.json';

const MAX_RODADAS = 5;
const VELOCIDADE_BARRA = 2.2;

const GOL_MSGS_EU = [
  "⚡ GOLAÇO! Indefensável!",
  "🔥 OOOHHH QUE CANTOOOOO!",
  "💥 NA GAVETA! Goleiro nem se mexeu!",
  "🚀 GOOOOL! Que chutaço!",
];
const DEF_MSGS_CPU = [
  "🧤 DEFESAÇA! Espalmado!",
  "👊 DEFENDEU! Que reflexo!",
  "🛡️ VOOU! Salvou o time!",
];
const GOL_MSGS_CPU = [
  "😭 GOL DELES! Pulou pro lado errado...",
  "💀 SOFRIDO! Você foi enganado!",
  "🎭 ELE TE OLHOU E CHUTOU NO OUTRO LADO!",
];
const DEF_MSGS_EU = [
  "🧤 DEFESAÇA! Reflexo incrível!",
  "✋ ESPALMOU! Incrível!",
  "🦸 SUPER GOLEIRO! Que salto!",
];

function getRating(eu, cpu) {
  const saldo = eu - cpu;
  if (eu === MAX_RODADAS && cpu === 0) return { label:'GÊNIO ABSOLUTO', emoji:'🏆', cor:'#f2c14e', desc:'Perfeito! Uma lenda da marca da cal.' };
  if (saldo >= 3) return { label:'GÊNIO', emoji:'🏆', cor:'#f2c14e', desc:'Dominou de ponta a ponta. Artilheiro e goleiro!' };
  if (saldo >= 1) return { label:'BOA EXIBIÇÃO', emoji:'⚽', cor:'#86efac', desc:'Bom jogo! Saiu na frente no saldo.' };
  if (saldo === 0) return { label:'ZERO A ZERO DE BRIOS', emoji:'🤝', cor:'#a5b4fc', desc:'Nenhum levou a melhor. Repetição?' };
  if (saldo === -1) return { label:'BAGRE', emoji:'🐟', cor:'#fca5a5', desc:'Perdeu mais do que ganhou. Precisa treinar.' };
  return { label:'BAGRE LENDÁRIO', emoji:'🐡', cor:'#fb923c', desc:'Histórico de incompetência. Nenhuma seleção te quer.' };
}

function randomMsg(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export default function GenioBagre() {
  const [step, setStep]   = useState('setup');
  const [rodada, setRodada] = useState(1);
  const [placar, setPlacar] = useState({ eu: 0, cpu: 0 });
  const [turno, setTurno]   = useState('chute');

  // Rivais (do banco)
  const [gkRival, setGkRival]   = useState(null);
  const [batRival, setBatRival] = useState(null);

  // Visual
  const [mensagem, setMensagem] = useState('');
  const [mensagemTipo, setMensagemTipo] = useState('normal'); // gol_eu | gol_cpu | defesa | miss
  const [mostrarMsg, setMostrarMsg] = useState(false);
  const [bolaEstado, setBolaEstado] = useState('idle'); // idle | voando_gol | voando_fora | parado_gk
  const [bolaLado, setBolaLado]   = useState('C');   // L | C | R (para animacao)
  const [gkLado, setGkLado]       = useState('C');   // posicao do goleiro
  const [fieldFlash, setFieldFlash] = useState(null); // 'green' | 'red' | null

  // Barra de precisão
  const [barPos, setBarPos]         = useState(50);
  const [chuteTravado, setChuteTravado] = useState(false);
  const barDir    = useRef(1);
  const reqRef    = useRef(null);

  // Defesa QTE
  const [alvoDefesa, setAlvoDefesa]     = useState(null);
  const [tempoDefesa, setTempoDefesa]   = useState(100);
  const [defesaTravada, setDefesaTravada] = useState(true);
  const [preparandoAtaque, setPreparandoAtaque] = useState(false);
  const defTimerRef   = useRef(null);
  const reacaoRef     = useRef(null);
  const chuteCpuRef   = useRef(null);

  // ── Barra de Precisão ─────────────────────────────────────────────────────
  const animarBarra = useCallback(() => {
    setBarPos(prev => {
      let next = prev + barDir.current * VELOCIDADE_BARRA;
      if (next >= 100) { next = 100; barDir.current = -1; }
      if (next <= 0)   { next = 0;   barDir.current = 1; }
      return next;
    });
    reqRef.current = requestAnimationFrame(animarBarra);
  }, []);

  useEffect(() => {
    if (step === 'playing' && turno === 'chute' && !chuteTravado) {
      reqRef.current = requestAnimationFrame(animarBarra);
    }
    return () => cancelAnimationFrame(reqRef.current);
  }, [step, turno, chuteTravado, animarBarra]);

  const flash = (tipo) => {
    setFieldFlash(tipo);
    setTimeout(() => setFieldFlash(null), 600);
  };

  const mostrarMensagem = (txt, tipo, ms = 2400) => {
    setMensagem(txt); setMensagemTipo(tipo); setMostrarMsg(true);
    return new Promise(r => setTimeout(() => { setMostrarMsg(false); r(); }, ms));
  };

  // ── Chutar ─────────────────────────────────────────────────────────────────
  const dispararChute = async () => {
    if (chuteTravado) return;
    setChuteTravado(true);
    cancelAnimationFrame(reqRef.current);

    const precisao = Math.abs(50 - barPos);
    const puloGk  = ['L','C','R'][Math.floor(Math.random() * 3)];
    const ladoChute = barPos < 38 ? 'L' : barPos > 62 ? 'R' : 'C';

    setGkLado(puloGk);
    setBolaLado(ladoChute);

    let gol = false;
    let msgTxt = '';
    let msgTipo = '';

    if (precisao <= 10) {
      // GAVETA — indefensável
      gol = true; setBolaEstado('voando_gol');
      msgTxt = randomMsg(GOL_MSGS_EU); msgTipo = 'gol_eu';
      flash('green');
    } else if (precisao > 37) {
      // ISOLOU
      setBolaEstado('voando_fora');
      msgTxt = '😱 ISOLOU! Mandou pra arquibancada!'; msgTipo = 'miss';
      flash('red');
    } else {
      if (ladoChute === puloGk) {
        setBolaEstado('parado_gk'); msgTxt = randomMsg(DEF_MSGS_CPU); msgTipo = 'defesa';
      } else {
        gol = true; setBolaEstado('voando_gol'); msgTxt = randomMsg(GOL_MSGS_EU); msgTipo = 'gol_eu';
        flash('green');
      }
    }

    if (gol) setPlacar(p => ({ ...p, eu: p.eu + 1 }));
    await mostrarMensagem(msgTxt, msgTipo);

    setBolaEstado('idle'); setGkLado('C');
    setTurno('defesa');
    await new Promise(r => setTimeout(r, 400));
  };

  // ── Defesa QTE ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (step !== 'playing' || turno !== 'defesa') return;
    setAlvoDefesa(null); setTempoDefesa(100); setDefesaTravada(true);
    setPreparandoAtaque(true);

    const delay = 1000 + Math.random() * 1800;
    defTimerRef.current = setTimeout(() => {
      setPreparandoAtaque(false);
      const lado = ['L','C','R'][Math.floor(Math.random() * 3)];
      chuteCpuRef.current = lado;
      setAlvoDefesa(lado); setDefesaTravada(false);

      let t = 100;
      reacaoRef.current = setInterval(() => {
        t -= 5;
        setTempoDefesa(t);
        if (t <= 0) {
          clearInterval(reacaoRef.current);
          processarDefesa(null);
        }
      }, 35); // 35ms * 20 = 700ms total
    }, delay);

    return () => { clearTimeout(defTimerRef.current); clearInterval(reacaoRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, turno]);

  const processarDefesa = async (minhaEscolha) => {
    if (defesaTravada && minhaEscolha !== null) return;
    setDefesaTravada(true);
    clearInterval(reacaoRef.current);
    const chuteCpu = chuteCpuRef.current || 'C';

    setBolaLado(chuteCpu);
    setBolaEstado('voando_gol');
    if (minhaEscolha) setGkLado(minhaEscolha);

    let gol = false;
    let msgTxt = '';
    let msgTipo = '';

    if (!minhaEscolha) {
      gol = true; msgTxt = '⏳ CONGELOU! Nem tentou defender!'; msgTipo = 'gol_cpu';
      flash('red');
    } else if (minhaEscolha === chuteCpu) {
      setBolaEstado('parado_gk'); msgTxt = randomMsg(DEF_MSGS_EU); msgTipo = 'gol_eu';
      flash('green');
    } else {
      gol = true; msgTxt = randomMsg(GOL_MSGS_CPU); msgTipo = 'gol_cpu';
      flash('red');
    }

    if (gol) setPlacar(p => ({ ...p, cpu: p.cpu + 1 }));
    setAlvoDefesa(null);
    await mostrarMensagem(msgTxt, msgTipo);

    setBolaEstado('idle'); setGkLado('C');

    if (rodada === MAX_RODADAS) {
      setStep('gameover');
    } else {
      setRodada(r => r + 1);
      setTurno('chute');
      setChuteTravado(false);
    }
  };

  // ── Iniciar ────────────────────────────────────────────────────────────────
  const iniciar = () => {
    const gols = JOGADORES_COPA.filter(p => p.pos1 === 'GOL' && p.overall >= 80);
    const atas = JOGADORES_COPA.filter(p => ['CA','SA','PE','PD'].includes(p.pos1) && p.overall >= 82);
    setGkRival(gols[Math.floor(Math.random() * gols.length)]);
    setBatRival(atas[Math.floor(Math.random() * atas.length)]);
    setRodada(1); setPlacar({ eu: 0, cpu: 0 });
    setTurno('chute'); setChuteTravado(false);
    setBolaEstado('idle'); setGkLado('C'); setMostrarMsg(false);
    setStep('playing');
  };

  // ── Helpers visuais ────────────────────────────────────────────────────────
  const gkX = gkLado === 'L' ? 20 : gkLado === 'R' ? 80 : 50;
  const bolaX = bolaLado === 'L' ? 22 : bolaLado === 'R' ? 78 : 50;
  const bolaY = bolaEstado === 'idle' ? 86 : bolaEstado === 'voando_fora' ? -10 : bolaEstado === 'parado_gk' ? 28 : 22;
  const bolaScale = bolaEstado === 'idle' ? 1 : bolaEstado === 'voando_fora' ? 0.3 : 0.55;
  const rating = step === 'gameover' ? getRating(placar.eu, placar.cpu) : null;

  const barZone = barPos < 25 ? 'red' : barPos < 40 ? 'yellow' : barPos <= 60 ? 'green' : barPos < 75 ? 'yellow' : 'red';
  const barCor  = barZone === 'green' ? '#22c55e' : barZone === 'yellow' ? '#eab308' : '#ef4444';

  return (
    <div style={{ minHeight:'100vh', background:'#08111f', color:'#f4f1ea', fontFamily:"'Inter',sans-serif", overflowX:'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');
        *{box-sizing:border-box;}
        .gb{max-width:500px;margin:0 auto;padding:20px 14px 60px;}
        .gb-h1{font-family:'Oswald',sans-serif;font-size:clamp(28px,8vw,52px);text-transform:uppercase;
          text-align:center;margin:0;background:linear-gradient(160deg,#fff 30%,#f2c14e);
          -webkit-background-clip:text;background-clip:text;color:transparent;}

        /* Campo */
        .gb-campo{position:relative;width:100%;height:300px;
          background:radial-gradient(ellipse at 50% 110%,#1a6b3a 0%,#0f4424 40%,#0a3318 100%);
          border-radius:16px;overflow:hidden;border:2px solid rgba(255,255,255,.12);
          box-shadow:inset 0 -30px 60px rgba(0,0,0,.4), 0 0 0 1px rgba(255,255,255,.05);}
        
        /* Campo flash overlay */
        .gb-flash{position:absolute;inset:0;z-index:25;pointer-events:none;border-radius:14px;
          transition:opacity .15s;opacity:0;}
        .gb-flash.green{background:rgba(34,197,94,.3);opacity:1;}
        .gb-flash.red{background:rgba(239,68,68,.25);opacity:1;}

        /* Grama listrada */
        .gb-grama{position:absolute;inset:0;
          background:repeating-linear-gradient(180deg,rgba(0,0,0,0) 0 30px,rgba(0,0,0,.12) 30px 60px);}

        /* Trave + rede */
        .gb-gol-wrap{position:absolute;top:18px;left:12%;right:12%;}
        .gb-rede{width:100%;height:90px;
          background:repeating-linear-gradient(90deg,rgba(255,255,255,.15) 0 2px,transparent 2px 24px),
                      repeating-linear-gradient(0deg,rgba(255,255,255,.15) 0 2px,transparent 2px 18px);
          border-radius:4px 4px 0 0;background-color:rgba(0,0,0,.3);}
        .gb-trave-h{position:absolute;top:0;left:0;right:0;height:9px;
          background:linear-gradient(180deg,#fff 0%,#ddd 100%);border-radius:4px;
          box-shadow:0 2px 8px rgba(0,0,0,.5);}
        .gb-trave-l{position:absolute;left:-9px;top:0;bottom:-6px;width:9px;
          background:linear-gradient(90deg,#ddd,#fff);border-radius:4px;
          box-shadow:-2px 0 6px rgba(0,0,0,.3);}
        .gb-trave-r{position:absolute;right:-9px;top:0;bottom:-6px;width:9px;
          background:linear-gradient(-90deg,#ddd,#fff);border-radius:4px;
          box-shadow:2px 0 6px rgba(0,0,0,.3);}

        /* Linhas do campo */
        .gb-area{position:absolute;bottom:-4px;left:6%;right:6%;height:100px;
          border:2px solid rgba(255,255,255,.3);border-bottom:none;border-radius:0;}
        .gb-ponto{position:absolute;bottom:18px;left:50%;transform:translateX(-50%);
          width:8px;height:8px;background:rgba(255,255,255,.5);border-radius:50%;}

        /* Goleiro */
        .gb-gk{position:absolute;font-size:40px;line-height:1;
          transform:translate(-50%,-50%);z-index:10;
          transition:left .25s cubic-bezier(.17,.67,.5,1.2);
          filter:drop-shadow(0 4px 8px rgba(0,0,0,.6));}

        /* Bola */
        .gb-bola{position:absolute;font-size:30px;line-height:1;
          transform:translate(-50%,-50%);z-index:12;
          transition:left .35s ease-in, top .35s cubic-bezier(.22,.61,.36,1), transform .35s ease;
          filter:drop-shadow(0 4px 8px rgba(0,0,0,.7));}

        /* Alvo */
        .gb-alvo{position:absolute;font-size:36px;line-height:1;
          transform:translate(-50%,-50%);z-index:8;
          animation:gb-alvo .18s ease-in-out infinite alternate;}
        @keyframes gb-alvo{from{transform:translate(-50%,-50%) scale(.85);opacity:.6;}to{transform:translate(-50%,-50%) scale(1.15);opacity:1;}}

        /* Mensagem overlay */
        .gb-msg{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
          z-index:30;background:rgba(0,0,0,.55);border-radius:14px;animation:gb-msg-in .2s ease;}
        @keyframes gb-msg-in{from{opacity:0;}to{opacity:1;}}
        .gb-msg-text{font-family:'Oswald',sans-serif;font-size:clamp(20px,5vw,32px);text-transform:uppercase;
          text-align:center;padding:14px 20px;border-radius:12px;letter-spacing:.03em;
          max-width:90%;border:2px solid transparent;}
        .gb-msg-text.gol_eu{color:#86efac;border-color:rgba(34,197,94,.4);background:rgba(0,20,8,.7);}
        .gb-msg-text.gol_cpu{color:#fca5a5;border-color:rgba(239,68,68,.4);background:rgba(20,0,0,.7);}
        .gb-msg-text.defesa{color:#86efac;border-color:rgba(34,197,94,.4);background:rgba(0,20,8,.7);}
        .gb-msg-text.miss{color:#fca5a5;border-color:rgba(239,68,68,.4);background:rgba(20,0,0,.7);}

        /* Placar */
        .gb-placar{display:flex;justify-content:space-between;align-items:center;
          background:#0d1a2e;border:1px solid rgba(244,241,234,.12);border-radius:12px;
          padding:14px 20px;margin-bottom:14px;}
        .gb-placar-lado{text-align:center;flex:1;}
        .gb-placar-nome{font-family:'JetBrains Mono',monospace;font-size:10px;text-transform:uppercase;
          letter-spacing:.1em;color:rgba(244,241,234,.45);margin-bottom:4px;}
        .gb-placar-gols{font-family:'Oswald',sans-serif;font-size:36px;font-weight:700;line-height:1;}
        .gb-placar-centro{text-align:center;padding:0 12px;}
        .gb-rodada{font-family:'JetBrains Mono',monospace;font-size:11px;color:#f2c14e;
          text-transform:uppercase;letter-spacing:.1em;}
        .gb-turno{font-family:'Oswald',sans-serif;font-size:15px;text-transform:uppercase;margin-top:4px;}

        /* Barra de precisão */
        .gb-bar-wrap{position:relative;height:40px;background:#111;border-radius:999px;
          overflow:hidden;border:2px solid rgba(244,241,234,.15);margin-bottom:4px;}
        .gb-bar-zones{position:absolute;inset:0;display:flex;}
        .gb-bz{flex:1;}
        .gb-cursor{position:absolute;top:0;bottom:0;width:7px;background:#fff;
          transform:translateX(-50%);border-radius:999px;box-shadow:0 0 12px #fff,0 0 4px rgba(255,255,255,.8);}
        .gb-bar-label{font-family:'JetBrains Mono',monospace;font-size:10px;text-align:center;
          letter-spacing:.12em;text-transform:uppercase;margin-bottom:10px;color:rgba(244,241,234,.5);}

        /* Botões */
        .gb-btn{font-family:'Oswald',sans-serif;font-size:18px;text-transform:uppercase;padding:16px;
          border-radius:10px;border:none;cursor:pointer;transition:all .12s;width:100%;display:block;margin-top:10px;}
        .gb-btn.chutar{background:linear-gradient(135deg,#f2c14e,#c9941f);color:#1a1300;}
        .gb-btn.chutar:hover:not(:disabled){transform:scale(1.02);}
        .gb-btn.chutar:disabled{opacity:.4;cursor:not-allowed;transform:none;}
        .gb-btn.reiniciar{background:linear-gradient(135deg,#f2c14e,#c9941f);color:#1a1300;margin-top:20px;}
        .gb-btn.reiniciar:hover{transform:translateY(-2px);}

        /* Defesa */
        .gb-def-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;}
        .gb-def-btn{padding:22px 0;background:#0d1a2e;border:2px solid rgba(244,241,234,.2);
          border-radius:12px;color:#f4f1ea;font-size:28px;cursor:pointer;transition:all .1s;}
        .gb-def-btn:not(:disabled):hover{background:rgba(244,241,234,.08);border-color:#f2c14e;transform:scale(1.06);}
        .gb-def-btn:disabled{opacity:.35;cursor:not-allowed;}
        .gb-def-timer{height:6px;background:rgba(244,241,234,.08);border-radius:999px;overflow:hidden;margin:10px 0;}
        .gb-def-timer-fill{height:100%;border-radius:999px;transition:width .04s linear,background .3s;}

        /* Rival info */
        .gb-rival{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.04);
          border:1px solid rgba(244,241,234,.08);border-radius:8px;padding:8px 12px;margin-bottom:10px;}
        .gb-rival-flag{width:22px;height:14px;object-fit:cover;border-radius:2px;}
        .gb-rival-name{font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;}
        .gb-rival-ovr{font-family:'JetBrains Mono',monospace;font-size:10px;
          color:rgba(244,241,234,.45);margin-left:auto;}

        /* Gameover */
        .gb-final{text-align:center;padding:28px 20px;border-radius:14px;animation:gb-pop .4s ease;}
        @keyframes gb-pop{from{opacity:0;transform:scale(.95);}to{opacity:1;transform:scale(1);}}
        .gb-final-label{font-family:'Oswald',sans-serif;font-size:clamp(28px,8vw,52px);
          text-transform:uppercase;font-weight:700;margin:6px 0;}
        .gb-final-placar{font-family:'Oswald',sans-serif;font-size:48px;font-weight:700;
          line-height:1;margin:6px 0;}

        @media(max-width:400px){.gb-def-btn{padding:16px 0;font-size:22px;}}
      `}</style>

      <div className="gb">
        <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, letterSpacing:'.22em', textTransform:'uppercase', color:'#f2c14e', textAlign:'center', marginBottom:4 }}>Copa do Mundo 2026</p>
        <h1 className="gb-h1">Gênio ou Bagre?</h1>
        <p style={{ textAlign:'center', color:'rgba(244,241,234,.45)', fontSize:12, fontFamily:"'JetBrains Mono',monospace", margin:'6px 0 20px' }}>
          {MAX_RODADAS} rodadas · Pare a barra · Defenda com reflexo
        </p>

        {/* ── Setup ── */}
        {step === 'setup' && (
          <div style={{ background:'rgba(255,255,255,.035)', border:'1px solid rgba(244,241,234,.1)', borderRadius:14, padding:22 }}>
            <div style={{ display:'flex', flexDirection:'column', gap:14, marginBottom:20 }}>
              {[
                ['⚽', 'Você bate', 'Uma barra corre. Clique em CHUTAR quando estiver na zona verde — é gaveta! Vermelho = isolou.'],
                ['🧤', 'Você defende', 'Aguarde o ataque da CPU. Quando o alvo piscar no gol, clique na direção correta em < 700ms.'],
              ].map(([e,t,d]) => (
                <div key={t} style={{ display:'flex', gap:12, padding:'12px 14px', background:'rgba(255,255,255,.04)', borderRadius:10 }}>
                  <span style={{ fontSize:24, flexShrink:0 }}>{e}</span>
                  <div>
                    <div style={{ fontFamily:"'Oswald',sans-serif", fontSize:16, textTransform:'uppercase', marginBottom:3 }}>{t}</div>
                    <div style={{ fontSize:12, color:'rgba(244,241,234,.55)', lineHeight:1.5 }}>{d}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', justifyContent:'center', marginBottom:18 }}>
              {[['🏆 Gênio','saldo ≥ +3'],['⚽ Boa Exibição','saldo +1/+2'],['🤝 Zero de Brios','empatou'],['🐟 Bagre','saldo -1'],['🐡 Bagre Lendário','saldo ≤ -2']].map(([e,r]) => (
                <div key={e} style={{ textAlign:'center', background:'rgba(255,255,255,.04)', borderRadius:8, padding:'7px 10px', fontSize:11 }}>
                  <div style={{ fontWeight:700 }}>{e}</div>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:'rgba(244,241,234,.4)', marginTop:2 }}>{r}</div>
                </div>
              ))}
            </div>
            <button className="gb-btn chutar" onClick={iniciar}>⚽ Bora pro Jogo!</button>
          </div>
        )}

        {/* ── Playing ── */}
        {step === 'playing' && (
          <div>
            {/* Placar */}
            <div className="gb-placar">
              <div className="gb-placar-lado">
                <div className="gb-placar-nome">Você</div>
                <div className="gb-placar-gols" style={{ color:'#86efac' }}>{placar.eu}</div>
              </div>
              <div className="gb-placar-centro">
                <div className="gb-rodada">Rodada {rodada}/{MAX_RODADAS}</div>
                <div className="gb-turno" style={{ color: turno==='chute' ? '#f2c14e' : '#5fa8d3' }}>
                  {turno === 'chute' ? '⚽ Você bate' : '🧤 Você defende'}
                </div>
              </div>
              <div className="gb-placar-lado">
                <div className="gb-placar-nome">CPU</div>
                <div className="gb-placar-gols" style={{ color:'#fca5a5' }}>{placar.cpu}</div>
              </div>
            </div>

            {/* Rival info */}
            {turno === 'chute' && gkRival && (
              <div className="gb-rival">
                <span style={{ fontSize:16 }}>🧤</span>
                <div>
                  <div className="gb-rival-name">{gkRival.name}</div>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:'rgba(244,241,234,.4)' }}>Goleiro rival</div>
                </div>
                <span className="gb-rival-ovr">OVR {gkRival.overall}</span>
              </div>
            )}
            {turno === 'defesa' && batRival && (
              <div className="gb-rival">
                <span style={{ fontSize:16 }}>⚽</span>
                <div>
                  <div className="gb-rival-name">{batRival.name}</div>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:'rgba(244,241,234,.4)' }}>Cobrador rival</div>
                </div>
                <span className="gb-rival-ovr">OVR {batRival.overall}</span>
              </div>
            )}

            {/* Campo */}
            <div className="gb-campo">
              <div className="gb-grama" />
              <div className={`gb-flash ${fieldFlash || ''}`} />

              {/* Gol estrutura */}
              <div className="gb-gol-wrap">
                <div className="gb-rede" />
                <div className="gb-trave-h" />
                <div className="gb-trave-l" />
                <div className="gb-trave-r" />
              </div>

              {/* Linhas */}
              <div className="gb-area" />
              <div className="gb-ponto" />

              {/* Goleiro */}
              <div className="gb-gk" style={{ left:`${gkX}%`, top:'44%' }}>
                {turno === 'chute'
                  ? (gkLado !== 'C' ? '🤸' : '🧍')
                  : '🧤'}
              </div>

              {/* Alvo QTE */}
              {alvoDefesa && (
                <div className="gb-alvo" style={{
                  top:'32%',
                  left: alvoDefesa === 'L' ? '28%' : alvoDefesa === 'R' ? '72%' : '50%',
                }}>🎯</div>
              )}

              {/* Bola */}
              <div className="gb-bola" style={{
                left: bolaEstado === 'idle' ? '50%' : `${bolaX}%`,
                top: `${bolaY}%`,
                transform: `translate(-50%,-50%) scale(${bolaScale})`,
              }}>⚽</div>

              {/* Mensagem overlay */}
              {mostrarMsg && (
                <div className="gb-msg">
                  <div className={`gb-msg-text ${mensagemTipo}`}>{mensagem}</div>
                </div>
              )}
            </div>

            {/* Controles */}
            <div style={{ marginTop:14 }}>
              {turno === 'chute' ? (
                <div>
                  <div className="gb-bar-label">
                    <span style={{ color:barCor }}>
                      {barZone === 'green' ? '🔥 Zona perfeita — SOLTE AGORA!' : barZone === 'yellow' ? '⚡ Zona boa' : '💀 Zona ruim'}
                    </span>
                  </div>
                  <div className="gb-bar-wrap">
                    <div className="gb-bar-zones">
                      <div className="gb-bz" style={{ background:'#ef4444' }} />
                      <div className="gb-bz" style={{ background:'#f97316' }} />
                      <div className="gb-bz" style={{ background:'#eab308' }} />
                      <div className="gb-bz" style={{ background:'#22c55e' }} />
                      <div className="gb-bz" style={{ background:'#22c55e' }} />
                      <div className="gb-bz" style={{ background:'#eab308' }} />
                      <div className="gb-bz" style={{ background:'#f97316' }} />
                      <div className="gb-bz" style={{ background:'#ef4444' }} />
                    </div>
                    <div className="gb-cursor" style={{ left:`${barPos}%` }} />
                  </div>
                  <button className="gb-btn chutar" onClick={dispararChute} disabled={chuteTravado || mostrarMsg}>
                    {chuteTravado ? '...' : '⚽ CHUTAR!'}
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ textAlign:'center', fontFamily:"'JetBrains Mono',monospace", fontSize:12,
                    color: alvoDefesa ? '#f97316' : 'rgba(244,241,234,.5)',
                    fontWeight: alvoDefesa ? 700 : 400, marginBottom:8, minHeight:20 }}>
                    {mostrarMsg ? '' : preparandoAtaque ? `${batRival?.name || 'Cobrador'} está se preparando...` : alvoDefesa ? '🚨 RÁPIDO! ESCOLHA O LADO!' : ''}
                  </div>
                  {alvoDefesa && (
                    <div className="gb-def-timer">
                      <div className="gb-def-timer-fill" style={{
                        width:`${tempoDefesa}%`,
                        background: tempoDefesa > 50 ? '#22c55e' : tempoDefesa > 25 ? '#eab308' : '#ef4444',
                      }} />
                    </div>
                  )}
                  <div className="gb-def-grid">
                    {[['L','⬅️'],['C','⬆️'],['R','➡️']].map(([dir, icon]) => (
                      <button key={dir} className="gb-def-btn"
                        disabled={defesaTravada || mostrarMsg}
                        onClick={() => processarDefesa(dir)}>
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Gameover ── */}
        {step === 'gameover' && rating && (
          <div>
            <div className="gb-final" style={{ background: rating.cor + '12', border:`1px solid ${rating.cor}40`, marginBottom:14 }}>
              <div style={{ fontSize:56 }}>{rating.emoji}</div>
              <h2 className="gb-final-label" style={{ color:rating.cor }}>{rating.label}</h2>
              <div className="gb-final-placar">{placar.eu} × {placar.cpu}</div>
              <p style={{ fontSize:13, color:'rgba(244,241,234,.55)', margin:'4px 0 18px' }}>{rating.desc}</p>
            </div>
            {/* Mini histórico por rounds */}
            <div style={{ display:'flex', gap:6, justifyContent:'center', marginBottom:16 }}>
              {Array.from({length:MAX_RODADAS}).map((_,i) => (
                <div key={i} style={{ textAlign:'center' }}>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:'rgba(244,241,234,.3)', marginBottom:3 }}>R{i+1}</div>
                  <div style={{ width:28, height:28, borderRadius:6, background:'rgba(255,255,255,.08)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>⚽</div>
                </div>
              ))}
            </div>
            <button className="gb-btn reiniciar" onClick={iniciar}>🔄 Cobrar de novo</button>
          </div>
        )}
      </div>
    </div>
  );
}
