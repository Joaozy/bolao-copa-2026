'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import JOGADORES_COPA from '@/components/games/dados/jogadoresCopa.json';

const DIRS = ['L', 'C', 'R'];
const MAX_RODADAS = 5;

export default function GenioBagre() {
  const [step, setStep] = useState('setup'); // setup, playing, gameover
  const [rodada, setRodada] = useState(1);
  const [placar, setPlacar] = useState({ eu: 0, cpu: 0 });
  const [turno, setTurno] = useState('chute'); // 'chute' ou 'defesa'
  
  // Adversários
  const [gkRival, setGkRival] = useState(null);
  const [batRival, setBatRival] = useState(null);

  // Estados Visuais (O Campo)
  const [posBola, setPosBola] = useState({ x: 50, y: 100, scale: 1 }); // x% e y%
  const [posGk, setPosGk] = useState(50); // 50% = centro
  const [mensagemCampo, setMensagemCampo] = useState('');

  // ----------------------------------------------------
  // MECÂNICA 1: O CHUTE (BARRA DE PRECISÃO)
  // ----------------------------------------------------
  const [barPos, setBarPos] = useState(50);
  const barDir = useRef(1); // 1 = indo pra direita, -1 = indo pra esquerda
  const reqRef = useRef(null);
  const [chuteTravado, setChuteTravado] = useState(false);

  const animarBarra = useCallback(() => {
    setBarPos((prev) => {
      let next = prev + (barDir.current * 2.5); // Velocidade da barra
      if (next >= 100) { next = 100; barDir.current = -1; }
      if (next <= 0) { next = 0; barDir.current = 1; }
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

  const dispararChute = async () => {
    setChuteTravado(true);
    cancelAnimationFrame(reqRef.current);
    
    // Calcula a precisão (o centro perfeito é 50)
    const precisao = Math.abs(50 - barPos);
    
    // Goleiro da CPU decide pular aleatoriamente
    const puloGk = DIRS[Math.floor(Math.random() * DIRS.length)];
    const gkX = puloGk === 'L' ? 20 : puloGk === 'R' ? 80 : 50;
    setPosGk(gkX);

    // Animando a bola baseada na barra
    setPosBola({ x: barPos, y: 30, scale: 0.5 }); // A bola voa pro gol (y:30)

    let gol = false;
    let msg = "";

    if (precisao <= 10) {
      // PERFEITO! Na gaveta, o goleiro não pega nem se pular certo
      gol = true;
      msg = "🔥 GOLAÇO! NA GAVETA! Indefensável!";
    } else if (precisao > 35) {
      // ISOLOU
      gol = false;
      setPosBola({ x: barPos, y: -20, scale: 0.3 }); // Bola vai pra arquibancada
      msg = "❌ ISOLOU! Mandou a bola na lua!";
    } else {
      // CHUTE MÉDIO - O goleiro pode pegar se pular pro lado certo
      // Lado esquerdo da barra = L, Lado Direito = R, Centro = C
      const ladoChute = barPos < 40 ? 'L' : barPos > 60 ? 'R' : 'C';
      if (ladoChute === puloGk) {
        gol = false;
        setPosBola({ x: barPos, y: 40, scale: 0.6 }); // Bola bate no goleiro
        msg = "🧤 DEFESAÇA DO GOLEIRO!";
      } else {
        gol = true;
        msg = "⚽ GOL! Goleiro foi para o lado errado!";
      }
    }

    setMensagemCampo(msg);
    if (gol) setPlacar(p => ({ ...p, eu: p.eu + 1 }));

    // Troca de turno
    setTimeout(() => {
      setTurno('defesa');
      setPosBola({ x: 50, y: 100, scale: 1 });
      setPosGk(50);
      setMensagemCampo("Sua vez de defender! Prepare-se!");
    }, 2500);
  };

  // ----------------------------------------------------
  // MECÂNICA 2: A DEFESA (REFLEXO RÁPIDO)
  // ----------------------------------------------------
  const [alvoDefesa, setAlvoDefesa] = useState(null); // 'L', 'C', 'R'
  const [tempoDefesa, setTempoDefesa] = useState(100); // 100% caindo para 0
  const [defesaTravada, setDefesaTravada] = useState(true);
  const defTimerRef = useRef(null);
  const reacaoTimerRef = useRef(null);

  useEffect(() => {
    if (step === 'playing' && turno === 'defesa') {
      setAlvoDefesa(null);
      setTempoDefesa(100);
      setDefesaTravada(true);

      // O adversário se prepara... Tensão...
      const delay = Math.floor(Math.random() * 1500) + 1000; // 1s a 2.5s
      
      defTimerRef.current = setTimeout(() => {
        // Revela onde a CPU vai bater
        const chuteCpu = DIRS[Math.floor(Math.random() * DIRS.length)];
        setAlvoDefesa(chuteCpu);
        setDefesaTravada(false);
        setMensagemCampo("👆 PULE AGORA!");

        // Cronômetro do reflexo do jogador (600ms para reagir)
        let t = 100;
        reacaoTimerRef.current = setInterval(() => {
          t -= 5;
          setTempoDefesa(t);
          if (t <= 0) {
            clearInterval(reacaoTimerRef.current);
            processarDefesa(null, chuteCpu); // Tempo esgotado
          }
        }, 30); // 30ms * 20 = 600ms total
      }, delay);
    }
    return () => { clearTimeout(defTimerRef.current); clearInterval(reacaoTimerRef.current); };
  }, [step, turno]);

  const processarDefesa = (minhaEscolha, chuteCpu) => {
    if (defesaTravada) return;
    setDefesaTravada(true);
    clearInterval(reacaoTimerRef.current);

    // Animando goleiro (você)
    const gkX = minhaEscolha === 'L' ? 20 : minhaEscolha === 'R' ? 80 : 50;
    if (minhaEscolha) setPosGk(gkX);

    // Animando bola (CPU)
    const bolaX = chuteCpu === 'L' ? 20 : chuteCpu === 'R' ? 80 : 50;
    setPosBola({ x: bolaX, y: 30, scale: 0.5 });

    let gol = false;
    let msg = "";

    if (!minhaEscolha) {
      gol = true;
      msg = "⏳ Muito lento! Você congelou! GOL DELES!";
    } else if (minhaEscolha === chuteCpu) {
      gol = false;
      msg = "🧤 ESPALMOU! QUE DEFESAÇA!";
      setPosBola({ x: bolaX, y: 40, scale: 0.6 }); // Bola para no goleiro
    } else {
      gol = true;
      msg = "⚽ GOL! Você pulou pro lado errado!";
    }

    setMensagemCampo(msg);
    setAlvoDefesa(null);
    if (gol) setPlacar(p => ({ ...p, cpu: p.cpu + 1 }));

    // Troca de turno ou fim
    setTimeout(() => {
      if (rodada === MAX_RODADAS) {
        setStep('gameover');
      } else {
        setRodada(r => r + 1);
        setTurno('chute');
        setPosBola({ x: 50, y: 100, scale: 1 });
        setPosGk(50);
        setMensagemCampo('');
        setChuteTravado(false);
      }
    }, 2500);
  };


  const iniciar = () => {
    // Sorteia os rivais da base para dar "rosto" ao jogo
    const goleiros = JOGADORES_COPA.filter(p => p.pos1 === 'GOL' && p.overall >= 80);
    const atacantes = JOGADORES_COPA.filter(p => p.pos1 === 'CA' || p.pos1 === 'SA');
    setGkRival(goleiros[Math.floor(Math.random() * goleiros.length)]);
    setBatRival(atacantes[Math.floor(Math.random() * atacantes.length)]);

    setRodada(1); 
    setPlacar({ eu: 0, cpu: 0 }); 
    setTurno('chute'); 
    setChuteTravado(false);
    setPosBola({ x: 50, y: 100, scale: 1 });
    setPosGk(50);
    setMensagemCampo('');
    setStep('playing');
  };

  return (
    <div style={{ minHeight:'100vh', background:'#08111f', color:'#f4f1ea', fontFamily:"'Inter', sans-serif", padding: '20px 16px 60px', overflow: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');
        .gb-btn { font-family: 'Oswald', sans-serif; font-size: 20px; font-weight: 700; text-transform: uppercase; padding: 18px 48px; border-radius: 10px; border: none; background: linear-gradient(135deg, #f2c14e, #c9941f); color: #1a1300; cursor: pointer; transition: transform 0.1s; }
        .gb-btn:hover { transform: scale(1.05); }
        .gb-btn:disabled { background: #555; color: #888; cursor: not-allowed; transform: none; }
        
        /* O Campo e Gol CSS Art */
        .gb-campo { position: relative; width: 100%; max-width: 500px; margin: 0 auto; height: 320px; background: repeating-linear-gradient(0deg, #123524 0 20px, #1d5c3c 20px 40px); border-radius: 12px; overflow: hidden; border: 2px solid rgba(255,255,255,0.1); box-shadow: inset 0 20px 50px rgba(0,0,0,0.5); }
        .gb-area { position: absolute; bottom: -20px; left: 10%; right: 10%; height: 120px; border: 3px solid rgba(255,255,255,0.4); border-bottom: none; }
        .gb-marca { position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%); width: 12px; height: 12px; background: rgba(255,255,255,0.7); border-radius: 50%; }
        
        .gb-gol-trave { position: absolute; top: 40px; left: 15%; right: 15%; height: 120px; border: 8px solid #fff; border-bottom: none; background: repeating-linear-gradient(45deg, rgba(255,255,255,0.1) 0 10px, transparent 10px 20px); border-radius: 4px 4px 0 0; }
        
        .gb-bola { position: absolute; width: 32px; height: 32px; font-size: 28px; line-height: 1; transform: translate(-50%, -50%); transition: all 0.4s cubic-bezier(0.25, 1, 0.5, 1); z-index: 10; filter: drop-shadow(0 5px 5px rgba(0,0,0,0.5)); }
        .gb-gk { position: absolute; top: 120px; width: 60px; height: 60px; font-size: 50px; line-height: 1; transform: translate(-50%, -50%); transition: left 0.3s ease-out; z-index: 5; filter: drop-shadow(0 5px 5px rgba(0,0,0,0.5)); }
        
        .gb-alvo { position: absolute; font-size: 40px; transform: translate(-50%, -50%); animation: piscar 0.2s infinite alternate; z-index: 8; opacity: 0.8; }
        @keyframes piscar { from { opacity: 0.4; transform: translate(-50%, -50%) scale(0.9); } to { opacity: 1; transform: translate(-50%, -50%) scale(1.1); } }

        /* Barra de Precisão */
        .gb-bar-container { width: 100%; height: 36px; background: #222; border-radius: 999px; margin-top: 20px; position: relative; border: 2px solid #444; overflow: hidden; }
        .gb-bar-zones { position: absolute; inset: 0; display: flex; }
        .gb-zone-red { flex: 2; background: #ef4444; }
        .gb-zone-yellow { flex: 2; background: #eab308; }
        .gb-zone-green { flex: 2; background: #22c55e; }
        .gb-cursor { position: absolute; top: 0; bottom: 0; width: 8px; background: #fff; transform: translateX(-50%); box-shadow: 0 0 10px #fff; }
        
        /* Controles de Defesa */
        .gb-def-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-top: 20px; }
        .gb-def-btn { padding: 24px 0; background: #111; border: 2px solid #444; border-radius: 12px; color: #fff; font-size: 24px; cursor: pointer; transition: background 0.1s; }
        .gb-def-btn:hover:not(:disabled) { background: #222; border-color: #f2c14e; }
        .gb-def-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>

      <h1 style={{ fontFamily: "'Oswald',sans-serif", fontSize: 40, textAlign: 'center', color: '#f2c14e', margin:0, textTransform: 'uppercase' }}>Gênio ou Bagre</h1>
      <p style={{ textAlign: 'center', color: 'rgba(255,255,255,.6)', margin: '4px 0 24px' }}>Reflexo e sangue frio na marca da cal.</p>

      {step === 'setup' && (
        <div style={{ textAlign: 'center', marginTop: 60 }}>
          <div style={{ background: 'rgba(255,255,255,.05)', padding: 24, borderRadius: 16, maxWidth: 500, margin: '0 auto 40px', textAlign: 'left', lineHeight: 1.6 }}>
             <h3 style={{ color: '#f2c14e', marginTop: 0 }}>Como Jogar:</h3>
             <p>🟢 <strong>Chutando:</strong> Uma barra se moverá rapidamente. Clique em "CHUTAR" para pará-la. Pare na zona verde para um golaço indefensável. No vermelho, a bola vai pra arquibancada!</p>
             <p>🧤 <strong>Defendendo:</strong> O alvo do adversário vai piscar na tela. Você tem uma fração de segundo para clicar no botão correspondente (Esquerda, Centro ou Direita) e fazer a defesa.</p>
          </div>
          <button className="gb-btn" onClick={iniciar}>Bora pro Jogo!</button>
        </div>
      )}

      {step === 'playing' && (
        <div style={{ maxWidth: 500, margin: '0 auto' }}>
          
          {/* PLACAR */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0d1a2e', padding: '16px 24px', borderRadius: 12, border: '2px solid rgba(242,193,78,.3)', marginBottom: 20 }}>
             <div style={{ textAlign: 'center' }}>
               <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)' }}>VOCÊ</div>
               <div style={{ fontSize: 32, fontFamily: "'Oswald',sans-serif", color: '#fff' }}>{placar.eu}</div>
             </div>
             <div style={{ textAlign: 'center' }}>
               <div style={{ fontSize: 12, color: '#f2c14e', fontFamily: "'JetBrains Mono',monospace" }}>RODADA {rodada}/5</div>
               <div style={{ fontSize: 14, fontWeight: 'bold', color: turno === 'chute' ? '#6fd17a' : '#5fa8d3', marginTop: 8 }}>
                 {turno === 'chute' ? 'VOCÊ BATE' : 'VOCÊ DEFENDE'}
               </div>
             </div>
             <div style={{ textAlign: 'center' }}>
               <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)' }}>CPU</div>
               <div style={{ fontSize: 32, fontFamily: "'Oswald',sans-serif", color: '#ff8a93' }}>{placar.cpu}</div>
             </div>
          </div>

          {/* O CAMPO 3D */}
          <div className="gb-campo">
            <div className="gb-area" />
            <div className="gb-marca" />
            <div className="gb-gol-trave" />
            
            {/* Goleiro Animado */}
            <div className="gb-gk" style={{ left: `${posGk}%` }}>
               {turno === 'chute' ? (posGk === 50 ? '🧍' : '🤸') : '🧤'}
            </div>

            {/* Alvo da Defesa (Pisca quando a CPU vai chutar) */}
            {alvoDefesa && (
               <div className="gb-alvo" style={{ 
                 top: '80px', 
                 left: alvoDefesa === 'L' ? '25%' : alvoDefesa === 'R' ? '75%' : '50%' 
               }}>
                 🎯
               </div>
            )}

            {/* Bola Animada */}
            <div className="gb-bola" style={{ left: `${posBola.x}%`, top: `${posBola.y}%`, transform: `translate(-50%, -50%) scale(${posBola.scale})` }}>
              ⚽
            </div>
            
            {/* Mensagem central */}
            {mensagemCampo && (
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.8)', padding: '12px 24px', borderRadius: 8, fontSize: 20, fontWeight: 'bold', fontFamily: "'Oswald',sans-serif", width: '90%', textAlign: 'center', zIndex: 20, border: '1px solid #f2c14e' }}>
                {mensagemCampo}
              </div>
            )}
          </div>

          {/* CONTROLES */}
          <div style={{ marginTop: 24, minHeight: 120 }}>
            {turno === 'chute' ? (
              // Controles do Chute
              <div>
                <p style={{ textAlign: 'center', fontSize: 14, color: 'rgba(255,255,255,.6)', margin: '0 0 8px' }}>Pressione na área verde para o chute perfeito!</p>
                <div className="gb-bar-container">
                   <div className="gb-bar-zones">
                     <div className="gb-zone-red" />
                     <div className="gb-zone-yellow" />
                     <div className="gb-zone-green" />
                     <div className="gb-zone-yellow" />
                     <div className="gb-zone-red" />
                   </div>
                   <div className="gb-cursor" style={{ left: `${barPos}%` }} />
                </div>
                <button className="gb-btn" style={{ width: '100%', marginTop: 16 }} onClick={dispararChute} disabled={chuteTravado}>
                  {chuteTravado ? 'AGUARDE...' : '⚽ CHUTAR!'}
                </button>
              </div>
            ) : (
              // Controles de Defesa
              <div>
                <p style={{ textAlign: 'center', fontSize: 14, color: alvoDefesa ? '#ff5252' : 'rgba(255,255,255,.6)', fontWeight: alvoDefesa ? 'bold' : 'normal', margin: '0 0 8px' }}>
                  {alvoDefesa ? `RÁPIDO! ${Math.ceil(tempoDefesa)}%` : `Aguarde o chute de ${batRival?.name}...`}
                </p>
                
                {/* Barra de Tempo do Reflexo */}
                {alvoDefesa && (
                  <div style={{ width: '100%', height: 8, background: '#333', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${tempoDefesa}%`, height: '100%', background: tempoDefesa > 50 ? '#22c55e' : tempoDefesa > 25 ? '#eab308' : '#ef4444' }} />
                  </div>
                )}

                <div className="gb-def-grid">
                  <button className="gb-def-btn" disabled={defesaTravada} onClick={() => processarDefesa('L')}>⬅️</button>
                  <button className="gb-def-btn" disabled={defesaTravada} onClick={() => processarDefesa('C')}>⬆️</button>
                  <button className="gb-def-btn" disabled={defesaTravada} onClick={() => processarDefesa('R')}>➡️</button>
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {step === 'gameover' && (
        <div style={{ textAlign: 'center', marginTop: 40, background: '#1c180e', padding: 40, borderRadius: 16, border: '2px solid #f2c14e', maxWidth: 500, margin: '40px auto 0' }}>
           <h2 style={{ fontFamily: "'Oswald',sans-serif", fontSize: 40, color: placar.eu > placar.cpu ? '#6fd17a' : placar.eu === placar.cpu ? '#eab308' : '#ff8a93', margin: '0 0 10px' }}>
             {placar.eu > placar.cpu ? '🏆 VOCÊ VENCEU!' : placar.eu === placar.cpu ? '⚖️ EMPATE!' : '😔 DERROTA...'}
           </h2>
           <p style={{ fontSize: 24, fontWeight: 'bold' }}>Placar Final: {placar.eu} x {placar.cpu}</p>
           <button className="gb-btn" onClick={iniciar} style={{ marginTop: 24, width: '100%' }}>Cobrar Novamente</button>
        </div>
      )}
    </div>
  );
}