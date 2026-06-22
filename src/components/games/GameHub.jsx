'use client';
import { useState } from 'react';
import Game7x0  from './Game7x0';
import Futbol11 from './Futbol11';
import GameImpostor from './GameImpostor';
import QuemEOCraque from './QuemEOCraque';
import TecnicoPorUmDia from './TecnicoPorUmDia';
import Top10 from './Top10';
import CopaLeilao from './CopaLeilao';
import FatoOuFake from './FatoOuFake';
import DetetiveCopa from './DetetiveCopa';
import GenioBagre from './GenioBagre';

const GAMES = [
  {
    id: 'draft',
    icon: '🎲',
    title: 'Desafio 7×0',
    subtitle: 'Monte um time dos sonhos e dispute a Copa do Mundo',
    badge: 'Estratégia',
  },
  {
    id: 'f11',
    icon: '🧩',
    title: 'Futbol 11',
    subtitle: 'Desafio tático: 11 seleções, 1 jogador puxado da memória',
    badge: 'Diário',
  },
  {
    id: 'impostor',
    icon: '🕵️‍♂️',
    title: 'O Impostor',
    subtitle: 'Ache os jogadores corretos da categoria e fuja das pegadinhas',
    badge: 'Quiz',
  },
  {
    id: 'craque',
    icon: '👤',
    title: 'Quem é o Craque?',
    subtitle: 'Descubra o jogador misterioso com dicas a cada palpite',
    badge: 'Diário',
  },
  {
    id: 'top10',
    icon: '🔟',
    title: 'Top 10',
    subtitle: 'Complete a lista temática. Jogue normal ou corra contra o tempo',
    badge: 'Desafio',
  },
  {
    id: 'leilao',
    icon: '🔨',
    title: 'Copa Leilão',
    subtitle: 'Dispute lances contra a IA e monte o melhor time possível',
    badge: 'Estratégia',
  },
  {
    id: 'tecnico',
    icon: '📋',
    title: 'Técnico por 1 Dia',
    subtitle: 'Tome as decisões à beira do campo e leve o time à glória',
    badge: 'Simulador',
  },
  {
    id: 'ff',
    icon: '🧐',
    title: 'Fato ou Fake?',
    subtitle: 'Descubra a verdade sobre lendas absurdas das Copas',
    badge: 'Quiz',
  },
  {
    id: 'detetive',
    icon: '🕵️‍♂️',
    title: 'Detetive Copa',
    subtitle: 'Qual jogador cometeu esse crime absurdo nos bastidores?',
    badge: 'Investigação',
  },
  {
    id: 'bagre',
    icon: '🧤',
    title: 'Gênio ou Bagre',
    subtitle: 'Aglomere coragem na disputa de pênaltis final',
    badge: 'Ação',
  }
];

export default function GameHub() {
  const [activeGame, setActiveGame] = useState(null);

  // Roteador de Jogos
  if (activeGame === 'draft') return (
    <GameWithBack onBack={() => setActiveGame(null)}><Game7x0 /></GameWithBack>
  );
  if (activeGame === 'f11') return (
    <GameWithBack onBack={() => setActiveGame(null)}><Futbol11 /></GameWithBack>
  );
  if (activeGame === 'impostor') return (
    <GameWithBack onBack={() => setActiveGame(null)}><GameImpostor onBack={() => setActiveGame(null)} /></GameWithBack>
  );
  if (activeGame === 'craque') return (
    <GameWithBack onBack={() => setActiveGame(null)}><QuemEOCraque /></GameWithBack>
  );
  if (activeGame === 'tecnico') return (
    <GameWithBack onBack={() => setActiveGame(null)}><TecnicoPorUmDia /></GameWithBack>
  );
  if (activeGame === 'top10') return (
    <GameWithBack onBack={() => setActiveGame(null)}><Top10 /></GameWithBack>
  );
  if (activeGame === 'leilao') return (
    <GameWithBack onBack={() => setActiveGame(null)}><CopaLeilao /></GameWithBack>
  );
  if (activeGame === 'ff') return (
    <GameWithBack onBack={() => setActiveGame(null)}><FatoOuFake /></GameWithBack>
  );
  if (activeGame === 'detetive') return (
    <GameWithBack onBack={() => setActiveGame(null)}><DetetiveCopa /></GameWithBack>
  );
  if (activeGame === 'bagre') return (
    <GameWithBack onBack={() => setActiveGame(null)}><GenioBagre /></GameWithBack>
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
        .hub{max-width:900px;margin:0 auto;padding:60px 20px 80px;}
        .hub-eyebrow{font-family:'JetBrains Mono',monospace;letter-spacing:.25em;text-transform:uppercase;
          font-size:11px;color:#f2c14e;text-align:center;margin-bottom:6px;}
        .hub-h1{font-family:'Oswald',sans-serif;font-weight:700;text-transform:uppercase;
          font-size:clamp(36px,7vw,64px);background:linear-gradient(180deg,#fff,#f2c14e);
          -webkit-background-clip:text;background-clip:text;color:transparent;
          text-align:center;margin:0 0 6px;}
        .hub-sub{text-align:center;color:rgba(244,241,234,.55);font-size:15px;margin:0 0 48px;}

        .hub-grid{display:grid;grid-template-columns:repeat(auto-fill, minmax(280px, 1fr));gap:18px;}

        .hub-card{background:linear-gradient(160deg,rgba(255,255,255,.05),rgba(255,255,255,.01));
          border:1px solid rgba(244,241,234,.1);border-radius:18px;padding:28px 22px;
          cursor:pointer;transition:transform .2s,box-shadow .2s,border-color .2s;text-align:left;
          display: flex; flex-direction: column;}
        .hub-card:hover{transform:translateY(-4px);box-shadow:0 16px 40px rgba(242,193,78,.12);
          border-color:rgba(242,193,78,.35);}
        .hub-card-icon{font-size:40px;margin-bottom:14px;display:block;}
        .hub-card-badge{display:inline-block;font-family:'JetBrains Mono',monospace;font-size:10px;
          letter-spacing:.12em;text-transform:uppercase;padding:3px 9px;border-radius:999px;
          background:rgba(242,193,78,.15);border:1px solid rgba(242,193,78,.3);color:#f2c14e;
          margin-bottom:10px; align-self: flex-start;}
        .hub-card-title{font-family:'Oswald',sans-serif;font-size:22px;font-weight:700;
          text-transform:uppercase;letter-spacing:.03em;color:#f4f1ea;margin:0 0 6px;}
        .hub-card-sub{font-size:13px;color:rgba(244,241,234,.55);line-height:1.45;margin:0; flex-grow: 1;}
        .hub-card-cta{margin-top:18px;font-family:'JetBrains Mono',monospace;font-size:12px;
          color:#f2c14e;display:flex;align-items:center;gap:6px;}

        .hub-footer{text-align:center;margin-top:48px;font-family:'JetBrains Mono',monospace;
          font-size:11px;color:rgba(244,241,234,.25);letter-spacing:.08em;}
      `}</style>

      <div className="hub">
        <p className="hub-eyebrow">Copa do Mundo 2026</p>
        <h1 className="hub-h1">Futebol Games</h1>
        <p className="hub-sub">Acesse o hub completo de jogos e mostre que você conhece o esporte.</p>

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
          Bolão Copa do Mundo 2026 · {GAMES.length} Desafios Disponíveis
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
          ← Voltar ao Hub
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