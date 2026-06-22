'use client';
import { useState, useEffect } from 'react';
import FATOS_DB from '@/components/games/dados/fatoOuFake.json';

// Embaralhador
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function FatoOuFake() {
  const [step, setStep] = useState('setup');
  const [pool, setPool] = useState([]);
  const [idx, setIdx] = useState(0);
  const [historico, setHistorico] = useState([]);

  const iniciarJogo = () => {
    // Sorteia 7 perguntas aleatórias do banco para o jogador não enjoar rápido
    setPool(shuffleArray(FATOS_DB).slice(0, 7));
    setIdx(0);
    setHistorico([]);
    setStep('playing');
  };

  const responder = (chuteReal) => {
    const item = pool[idx];
    const acertou = (chuteReal === item.real);
    
    setHistorico(prev => [...prev, { 
      manchete: item.manchete, 
      real: item.real, 
      acertou, 
      curiosidade: item.curiosidade 
    }]);

    if (idx + 1 < pool.length) {
      setIdx(idx + 1);
    } else {
      setStep('resultado');
    }
  };

  const acertos = historico.filter(h => h.acertou).length;
  const curr = pool[idx];

  return (
    <div style={{ minHeight:'100vh', background:'#08111f', color:'#f4f1ea', fontFamily:"'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');
        *{box-sizing:border-box;} body{margin:0;}
        .ff-wrap{max-width:700px;margin:0 auto;padding:32px 16px 64px;}
        .ff-h1{font-family:'Oswald',sans-serif;font-weight:700;text-transform:uppercase; font-size:clamp(32px,8vw,56px);text-align:center;margin:0; background:linear-gradient(160deg,#fff 30%,#f2c14e); -webkit-background-clip:text;background-clip:text;color:transparent;}
        .ff-sub{text-align:center;color:rgba(244,241,234,.6);font-size:15px;margin:8px 0 32px;}
        .ff-card{background:rgba(255,255,255,.03);border:1px solid rgba(244,241,234,.1);border-radius:16px;padding:24px;text-align:center;}
        .ff-btn{font-family:'Oswald',sans-serif;font-size:18px;text-transform:uppercase;padding:16px 32px;border-radius:10px;border:none;cursor:pointer;font-weight:bold;transition:transform 0.1s;}
        .ff-btn:hover{transform:scale(1.03);}
        .ff-btn-fato{background:#22c55e; color:#fff; border: 2px solid #166534; box-shadow: 0 4px 15px rgba(34, 197, 94, 0.2);}
        .ff-btn-fake{background:#ef4444; color:#fff; border: 2px solid #991b1b; box-shadow: 0 4px 15px rgba(239, 68, 68, 0.2);}
        .ff-hist-row{background:rgba(0,0,0,.3);border:1px solid rgba(244,241,234,.05);border-radius:12px;padding:16px;margin-bottom:12px;display:flex;gap:12px;align-items:flex-start;text-align:left;}
        .ff-hist-dot{width:16px;height:16px;border-radius:50%;flex-shrink:0;margin-top:2px;}
      `}</style>

      <div className="ff-wrap">
        <h1 className="ff-h1">Fato ou Fake?</h1>
        <p className="ff-sub">Mitos, lendas e bizarrices da história das Copas.</p>

        {step === 'setup' && (
          <div className="ff-card" style={{ marginTop: 40 }}>
            <p style={{ fontSize: 18, color: '#f2c14e', marginBottom: 20 }}>O detetive da história é você.</p>
            <p style={{ color: 'rgba(255,255,255,.7)', marginBottom: 30, lineHeight: 1.5 }}>
              Você receberá 7 manchetes inacreditáveis sobre Copas do Mundo. Sua missão é descobrir o que realmente aconteceu e o que é pura invenção!
            </p>
            <button className="ff-btn" style={{ background: '#f2c14e', color: '#000', width: '100%' }} onClick={iniciarJogo}>Iniciar Desafio</button>
          </div>
        )}

        {step === 'playing' && curr && (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: 'rgba(244,241,234,.5)' }}>
              <span>Pergunta {idx + 1}/{pool.length}</span>
              <span>Dificuldade: <strong style={{ color: curr.dif === 'facil' ? '#22c55e' : curr.dif === 'media' ? '#eab308' : '#ef4444' }}>{curr.dif.toUpperCase()}</strong></span>
            </div>
            
            <div className="ff-card" style={{ padding: '40px 24px', border: '2px solid rgba(242,193,78,.3)', background: '#0d1a2e' }}>
              <p style={{ fontFamily: "'JetBrains Mono',monospace", color: '#f2c14e', fontSize: 12, textTransform: 'uppercase', marginBottom: 16 }}>Tema: {curr.copa}</p>
              <h2 style={{ fontFamily: "'Oswald',sans-serif", fontSize: 26, lineHeight: 1.4, margin: 0 }}>"{curr.manchete}"</h2>
            </div>

            <div style={{ display: 'flex', gap: 16, marginTop: 24 }}>
              <button className="ff-btn ff-btn-fato" style={{ flex: 1 }} onClick={() => responder(true)}>✅ É FATO</button>
              <button className="ff-btn ff-btn-fake" style={{ flex: 1 }} onClick={() => responder(false)}>❌ É FAKE</button>
            </div>
          </div>
        )}

        {step === 'resultado' && (
          <div style={{ marginTop: 20 }}>
            <div className="ff-card" style={{ marginBottom: 24, border: `2px solid ${acertos > 4 ? '#22c55e' : '#ef4444'}` }}>
              <h2 style={{ fontFamily: "'Oswald',sans-serif", fontSize: 32, margin: '0 0 10px', color: acertos > 4 ? '#22c55e' : '#ef4444' }}>
                {acertos === pool.length ? 'PERFEITO!' : acertos >= 5 ? 'ÓTIMO CONHECIMENTO!' : 'PRECISA ESTUDAR MAIS...'}
              </h2>
              <p style={{ fontSize: 18 }}>Você acertou <strong>{acertos}</strong> de {pool.length}</p>
              <button className="ff-btn" style={{ background: '#f2c14e', color: '#000', marginTop: 20 }} onClick={iniciarJogo}>Jogar Novamente</button>
            </div>

            <h3 style={{ fontFamily: "'Oswald',sans-serif", fontSize: 20, color: '#f2c14e', borderBottom: '1px solid rgba(255,255,255,.1)', paddingBottom: 10, marginBottom: 20 }}>Gabarito Oficial</h3>
            
            {historico.map((h, i) => (
              <div key={i} className="ff-hist-row">
                <div className="ff-hist-dot" style={{ background: h.acertou ? '#22c55e' : '#ef4444', boxShadow: `0 0 10px ${h.acertou ? '#22c55e' : '#ef4444'}` }} />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{h.manchete}</div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, marginBottom: 8 }}>
                    Status: <strong style={{ color: h.real ? '#22c55e' : '#ef4444' }}>{h.real ? 'FATO VERÍDICO' : 'MENTIRA DESLAVADA'}</strong>
                  </div>
                  <div style={{ fontSize: 13, color: 'rgba(244,241,234,.7)', lineHeight: 1.4 }}>
                    <strong>Explicação:</strong> {h.curiosidade}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}