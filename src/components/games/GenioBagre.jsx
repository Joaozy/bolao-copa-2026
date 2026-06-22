'use client';
import { useState, useEffect } from 'react';
import { loadCopaTimes } from '@/components/games/gameConstants';
import JOGADORES_COPA from '@/components/games/dados/jogadoresCopa.json';

const DIRS = ['L','C','R'];
const DIR_LABEL = { L:'Esquerda', C:'Centro', R:'Direita' };

const GK_TELLS = {
  L: ["🧤← Goleiro inclina para a esquerda", "🤸 Goleiro pesando para a esquerda!"],
  C: ["🧤↓ Goleiro centralizado e firme", "😤 Goleiro plantado no meio..."],
  R: ["🧤→ Goleiro inclina para a direita", "🤸 Goleiro pesando para a direita!"],
};

const COBRADOR_TELLS = {
  L: ["🦵 Perna de apoio aponta pra esquerda", "👁️ Cobrador olha para a sua esquerda..."],
  C: ["🚶 Corrida reta, corpo fechado", "👁️ Olhar fixo na bola..."],
  R: ["🦵 Perna de apoio aponta pra direita", "👁️ Cobrador olha para a sua direita..."]
};

export default function GenioBagre() {
  const [step, setStep] = useState('setup');
  const [gkRivais, setGkRivais] = useState([]);
  const [batRivais, setBatRivais] = useState([]);
  
  const [rodada, setRodada] = useState(1);
  const [placar, setPlacar] = useState({ eu: 0, cpu: 0 });
  const [turno, setTurno] = useState('chute'); // 'chute' ou 'defesa'
  const [msgAcao, setMsgAcao] = useState('');
  const [historico, setHistorico] = useState([]);

  useEffect(() => {
    async function load() {
      const times = await loadCopaTimes();
      const goleiros = JOGADORES_COPA.filter(p => p.pos1 === 'GOL' && p.overall > 75);
      const batedores = JOGADORES_COPA.filter(p => p.pos1 === 'CA' || p.pos1 === 'SA');
      setGkRivais(goleiros.sort(() => Math.random() - 0.5).slice(0, 5));
      setBatRivais(batedores.sort(() => Math.random() - 0.5).slice(0, 5));
    }
    load();
  }, []);

  const iniciar = () => {
    setRodada(1); setPlacar({ eu: 0, cpu: 0 }); setTurno('chute'); setHistorico([]); setMsgAcao("Escolha onde bater!"); setStep('playing');
  };

  const processarLance = (minhaEscolha) => {
    const dirOponente = DIRS[Math.floor(Math.random() * DIRS.length)];
    let golMarcado = false;
    let textoRes = "";

    if (turno === 'chute') {
      golMarcado = minhaEscolha !== dirOponente;
      if (golMarcado) { setPlacar(p => ({ ...p, eu: p.eu + 1 })); textoRes = "⚽ GOL!"; }
      else textoRes = `🧤 DEFESA DO GOLEIRO! Ele foi para o(a) ${DIR_LABEL[dirOponente]}`;
    } else {
      golMarcado = minhaEscolha !== dirOponente;
      if (golMarcado) { setPlacar(p => ({ ...p, cpu: p.cpu + 1 })); textoRes = `⚽ GOL DELES! Ele chutou no(a) ${DIR_LABEL[dirOponente]}`; }
      else textoRes = "🧤 ESPALMOU!! VOCÊ PEGOU!";
    }

    setHistorico(prev => [{ rodada, turno, minhaEscolha, dirOponente, gol: turno === 'chute' ? golMarcado : !golMarcado, textoRes }, ...prev]);

    if (turno === 'chute') {
      setTurno('defesa');
      setMsgAcao("Agora você é o goleiro. Escolha onde pular!");
    } else {
      if (rodada === 5) setStep('gameover');
      else { setTurno('chute'); setRodada(r => r + 1); setMsgAcao("Sua vez de bater!"); }
    }
  };

  return (
    <div style={{ minHeight:'100vh', background:'#08111f', color:'#f4f1ea', fontFamily:"'Inter', sans-serif", padding: '40px 16px' }}>
      <h1 style={{ fontFamily: "'Oswald',sans-serif", fontSize: 40, textAlign: 'center', color: '#f2c14e', margin:0, textTransform: 'uppercase' }}>Gênio ou Bagre</h1>
      <p style={{ textAlign: 'center', color: 'rgba(255,255,255,.6)', marginBottom: 30 }}>A clássica disputa de pênaltis!</p>

      {step === 'setup' && (
        <div style={{ textAlign: 'center', marginTop: 40 }}>
          <button onClick={iniciar} style={{ padding: '16px 32px', fontSize: 20, background: '#f2c14e', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: "'Oswald',sans-serif" }}>Ir para a Marca da Cal</button>
        </div>
      )}

      {step === 'playing' && (
        <div style={{ maxWidth: 500, margin: '0 auto' }}>
          
          <div style={{ background: '#1c180e', padding: 20, borderRadius: 12, border: '1px solid #f2c14e', marginBottom: 24, textAlign: 'center' }}>
            <h2 style={{ fontFamily: "'Oswald',sans-serif", fontSize: 48, margin: 0 }}>{placar.eu} <span style={{ opacity: .3 }}>x</span> {placar.cpu}</h2>
            <p style={{ color: '#f2c14e', textTransform: 'uppercase', letterSpacing: 2, margin: '10px 0 0' }}>Rodada {rodada} de 5</p>
          </div>

          <div style={{ background: '#0d1a2e', padding: 24, borderRadius: 12, marginBottom: 24, textAlign: 'center' }}>
             <h3 style={{ margin: '0 0 16px', color: turno === 'chute' ? '#6fd17a' : '#5fa8d3' }}>
               {turno === 'chute' ? '🦵 VOCÊ VAI CHUTAR' : '🧤 VOCÊ É O GOLEIRO'}
             </h3>
             <p style={{ fontSize: 14, color: 'rgba(255,255,255,.7)', marginBottom: 20 }}>{msgAcao}</p>
             
             <div style={{ display: 'flex', gap: 10 }}>
               <button onClick={() => processarLance('L')} style={{ flex: 1, padding: 20, background: '#111', border: '1px solid #333', color: '#fff', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}>⬅️ Esquerda</button>
               <button onClick={() => processarLance('C')} style={{ flex: 1, padding: 20, background: '#111', border: '1px solid #333', color: '#fff', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}>Centro</button>
               <button onClick={() => processarLance('R')} style={{ flex: 1, padding: 20, background: '#111', border: '1px solid #333', color: '#fff', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}>Direita ➡️</button>
             </div>
          </div>

          <div style={{ background: '#070a12', borderRadius: 12, padding: 20 }}>
            <p style={{ fontFamily: "'JetBrains Mono',monospace", color: 'rgba(255,255,255,.3)', margin: '0 0 10px', fontSize: 12, textTransform: 'uppercase' }}>Histórico</p>
            {historico.map((h, i) => (
              <div key={i} style={{ borderBottom: '1px solid #222', paddingBottom: 8, marginBottom: 8, fontSize: 13, color: h.gol ? '#6fd17a' : '#ff8a93' }}>
                <strong>{h.turno === 'chute' ? 'Seu Chute: ' : 'Sua Defesa: '}</strong> {h.textoRes}
              </div>
            ))}
          </div>

        </div>
      )}

      {step === 'gameover' && (
        <div style={{ textAlign: 'center', marginTop: 40, background: '#1c180e', padding: 40, borderRadius: 16, border: '2px solid #f2c14e' }}>
           <h2 style={{ fontFamily: "'Oswald',sans-serif", fontSize: 40, color: placar.eu > placar.cpu ? '#6fd17a' : placar.eu === placar.cpu ? '#eab308' : '#ff8a93', margin: '0 0 10px' }}>
             {placar.eu > placar.cpu ? '🏆 VOCÊ VENCEU!' : placar.eu === placar.cpu ? '⚖️ EMPATE TÉCNICO' : '😔 DERROTA...'}
           </h2>
           <p style={{ fontSize: 24, fontWeight: 'bold' }}>Placar Final: {placar.eu} x {placar.cpu}</p>
           <button onClick={iniciar} style={{ padding: '16px 32px', background: '#f2c14e', color: '#000', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', marginTop: 20 }}>Cobrar Novamente</button>
        </div>
      )}
    </div>
  );
}