'use client';
import { useState } from 'react';
import Game7x0  from './Game7x0';
import Futbol11 from './Futbol11';

const GAMES = [
  {
    id: 'draft',
    icon: '🎲',
    title: 'Desafio 7×0',
    subtitle: 'Monte um time dos sonhos e dispute a Copa do Mundo',
    badge: 'Draft',
  },
  {
    id: 'f11',
    icon: '🧩',
    title: 'Futbol 11',
    subtitle: 'Desafio diário: 11 seleções, 1 jogador cada',
    badge: 'Diário',
  },
];

export default function GameHub() {
  const [activeGame, setActiveGame] = useState(null);

  if (activeGame === 'draft') return (
    <GameWithBack onBack={() => setActiveGame(null)}>
      <Game7x0 />
    </GameWithBack>
  );

  if (activeGame === 'f11') return (
    <GameWithBack onBack={() => setActiveGame(null)}>
      <Futbol11 />
    </GameWithBack>
  );

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0f1a',
      color: '#f4f1ea',
      fontFamily: "'Inter', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');
        *{box-sizing:border-box;} body{margin:0;}
        .hub{max-width:700px;margin:0 auto;padding:60px 20px 80px;}
        .hub-eyebrow{font-family:'JetBrains Mono',monospace;letter-spacing:.25em;text-transform:uppercase;
          font-size:11px;color:#f2c14e;text-align:center;margin-bottom:6px;}
        .hub-h1{font-family:'Oswald',sans-serif;font-weight:700;text-transform:uppercase;
          font-size:clamp(36px,7vw,64px);background:linear-gradient(180deg,#fff,#f2c14e);
          -webkit-background-clip:text;background-clip:text;color:transparent;
          text-align:center;margin:0 0 6px;}
        .hub-sub{text-align:center;color:rgba(244,241,234,.55);font-size:15px;margin:0 0 48px;}

        .hub-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;}
        @media(max-width:520px){.hub-grid{grid-template-columns:1fr;}}

        .hub-card{background:linear-gradient(160deg,rgba(255,255,255,.05),rgba(255,255,255,.01));
          border:1px solid rgba(244,241,234,.1);border-radius:18px;padding:28px 22px;
          cursor:pointer;transition:transform .2s,box-shadow .2s,border-color .2s;text-align:left;}
        .hub-card:hover{transform:translateY(-4px);box-shadow:0 16px 40px rgba(242,193,78,.12);
          border-color:rgba(242,193,78,.35);}
        .hub-card-icon{font-size:40px;margin-bottom:14px;display:block;}
        .hub-card-badge{display:inline-block;font-family:'JetBrains Mono',monospace;font-size:10px;
          letter-spacing:.12em;text-transform:uppercase;padding:3px 9px;border-radius:999px;
          background:rgba(242,193,78,.15);border:1px solid rgba(242,193,78,.3);color:#f2c14e;
          margin-bottom:10px;}
        .hub-card-title{font-family:'Oswald',sans-serif;font-size:22px;font-weight:700;
          text-transform:uppercase;letter-spacing:.03em;color:#f4f1ea;margin:0 0 6px;}
        .hub-card-sub{font-size:13px;color:rgba(244,241,234,.55);line-height:1.45;margin:0;}
        .hub-card-cta{margin-top:18px;font-family:'JetBrains Mono',monospace;font-size:12px;
          color:#f2c14e;display:flex;align-items:center;gap:6px;}

        .hub-footer{text-align:center;margin-top:48px;font-family:'JetBrains Mono',monospace;
          font-size:11px;color:rgba(244,241,234,.25);letter-spacing:.08em;}
      `}</style>

      <div className="hub">
        <p className="hub-eyebrow">Copa do Mundo 2026</p>
        <h1 className="hub-h1">Futebol Games</h1>
        <p className="hub-sub">Dois desafios. Mesmos jogadores. Qual você vai jogar hoje?</p>

        <div className="hub-grid">
          {GAMES.map(g => (
            <div key={g.id} className="hub-card" onClick={() => setActiveGame(g.id)}>
              <span className="hub-card-icon">{g.icon}</span>
              <span className="hub-card-badge">{g.badge}</span>
              <h2 className="hub-card-title">{g.title}</h2>
              <p className="hub-card-sub">{g.subtitle}</p>
              <div className="hub-card-cta">
                Jogar agora →
              </div>
            </div>
          ))}
        </div>

        <p className="hub-footer">
          Copa do Mundo 2026 · 48 seleções · 1000+ jogadores
        </p>
      </div>
    </div>
  );
}

function GameWithBack({ children, onBack }) {
  return (
    <div>
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'rgba(10,15,26,0.92)', backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(244,241,234,.08)',
        padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button onClick={onBack} style={{
          fontFamily: "'JetBrains Mono',monospace", fontSize: 12, background: 'transparent',
          border: '1px solid rgba(244,241,234,.2)', color: 'rgba(244,241,234,.8)',
          padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
        }}>
          ← Voltar
        </button>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11,
          color: 'rgba(244,241,234,.35)', letterSpacing: '.1em', textTransform: 'uppercase' }}>
          Copa 2026 Games
        </span>
      </div>
      <div style={{ paddingTop: 48 }}>
        {children}
      </div>
    </div>
  );
}
