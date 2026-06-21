'use client';
import { useState, useEffect, useRef } from 'react';
import { SELECOES_COPA, TIERS_FIXOS, loadCopaTimes } from '@/components/games/gameConstants';
import DECISOES from '@/components/games/dados/decisoesTecnico.json';
import JOGADORES_COPA from '@/components/games/dados/jogadoresCopa.json';

const delay = ms => new Promise(r => setTimeout(r, ms));

export default function TecnicoPorUmDia() {
  const [step, setStep] = useState('selecao'); // selecao | pre_jogo | jogo | gameover | campeao
  const [allTeams, setAllTeams] = useState([]);
  const [myTeam, setMyTeam] = useState(null);
  
  // Torneio Progressivo
  const [rodada, setRodada] = useState(1); 
  const nomeRodadas = { 1: 'Oitavas de Final', 2: 'Quartas de Final', 3: 'Semifinal', 4: 'Grande Final' };
  const [advForca, setAdvForca] = useState(80);
  const [advTeam, setAdvTeam] = useState(null);

  // Tática
  const [minhaForca, setMinhaForca] = useState({ atk: 80, def: 80 });
  const [bonusTat, setBonusTat] = useState({ atk: 0, def: 0 });

  // In-Game
  const [logs, setLogs] = useState([]);
  const [placar, setPlacar] = useState({ eu: 0, adv: 0 });
  const [minuto, setMinuto] = useState(0);
  const [decisaoAtual, setDecisaoAtual] = useState(null);
  
  const logRef = useRef(null);
  const resolverDecisao = useRef(null);
  const playState = useRef({ sEu: 0, sAdv: 0 }); // Usado para evitar problemas de state assíncrono

  useEffect(() => {
    loadCopaTimes().then(t => setAllTeams(t.filter(x => SELECOES_COPA.includes(x.name))));
  }, []);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [logs, decisaoAtual]);

  const addLog = async (txt, cor = '#fff') => {
    setLogs(prev => [...prev, { txt, cor, key: Date.now() + Math.random() }]);
    await delay(300); // Ticker speed
  };

  const selecionarTime = (team) => {
    setMyTeam(team);
    const jogadores = JOGADORES_COPA.filter(p => String(p.team_id) === String(team.id));
    const forcaGeral = jogadores.length ? Math.round(jogadores.reduce((s, p) => s + p.overall, 0) / jogadores.length) : 78;
    setMinhaForca({ atk: forcaGeral + 2, def: forcaGeral }); // Leve boost pra compensar jogar em casa
    prepararRodada(1);
  };

  const prepararRodada = (r) => {
    let possiveisRivais = [];
    if (r === 1) possiveisRivais = allTeams.filter(t => TIERS_FIXOS.medio.includes(t.name) && t.id !== myTeam?.id);
    else if (r === 2) possiveisRivais = allTeams.filter(t => t.id !== myTeam?.id);
    else possiveisRivais = allTeams.filter(t => TIERS_FIXOS.top.includes(t.name) && t.id !== myTeam?.id);

    if (!possiveisRivais.length) possiveisRivais = allTeams; // Fallback
    
    const rival = possiveisRivais[Math.floor(Math.random() * possiveisRivais.length)];
    setAdvTeam(rival);
    
    const jogRival = JOGADORES_COPA.filter(p => String(p.team_id) === String(rival.id));
    const fRival = jogRival.length ? Math.round(jogRival.reduce((s, p) => s + p.overall, 0) / jogRival.length) : 78;
    
    // Na final a IA tem um boost natural
    setAdvForca(r === 4 ? fRival + 3 : fRival); 
    setRodada(r);
    setStep('pre_jogo');
  };

  const rolarMinuto = async (m, pEu, pAdv) => {
    setMinuto(m);
    // Probabilidade ajustada por minuto (para ter placares realistas de futebol 1 a 3 gols)
    const chanceGeral = 0.025; 
    
    // Minha chance: Base (chanceGeral) + Diff Força + Decisões
    let chanceEu = chanceGeral + ((minhaForca.atk + (bonusTat.atk*100)) - advForca) * 0.0015;
    // Chance Adv: Base (chanceGeral) + Diff Força - Minha Defesa + Decisões
    let chanceAdv = chanceGeral + (advForca - (minhaForca.def + (bonusTat.def*100))) * 0.0015;

    // Normalizar para nunca ser menor que 0.5%
    chanceEu = Math.max(0.005, chanceEu);
    chanceAdv = Math.max(0.005, chanceAdv);

    if (Math.random() < chanceEu) { 
      playState.current.sEu++; 
      setPlacar({ ...playState.current }); 
      await addLog(`⚽ ${m}' GOL DO ${myTeam.name.toUpperCase()}!`, '#6fd17a'); 
      await delay(800);
    }
    else if (Math.random() < chanceAdv) { 
      playState.current.sAdv++; 
      setPlacar({ ...playState.current }); 
      await addLog(`⚽ ${m}' GOL DO ${advTeam.name.toUpperCase()}...`, '#ff8a93'); 
      await delay(800);
    }
  };

  const iniciarPartida = async () => {
    setStep('jogo'); setLogs([]); setPlacar({ eu: 0, adv: 0 }); setMinuto(0); setBonusTat({ atk: 0, def: 0 });
    playState.current = { sEu: 0, sAdv: 0 };

    await addLog(`🏆 APITO INICIAL: ${nomeRodadas[rodada]}!`, '#f2c14e');
    await delay(1000);
    
    // Paradas programadas para Decisões
    const paradas = [30, 45, 75];

    for (let m = 1; m <= 90; m++) {
      await rolarMinuto(m);
      
      if (paradas.includes(m)) {
        await addLog(`⏱️ Jogo paralisado aos ${m}' para instrução tática!`, '#5fa8d3');
        
        let faseDecisao = 'pressao';
        if (m === 30) faseDecisao = 'intervalo'; // aproveitando as mesmas tags
        if (m === 45) faseDecisao = 'intervalo';

        const evts = DECISOES.filter(d => d.fase === faseDecisao);
        const evt = evts[Math.floor(Math.random() * evts.length)];
        
        setDecisaoAtual(evt);
        // Trava o loop até o jogador clicar no botão
        const escolha = await new Promise(r => { resolverDecisao.current = r; });
        setDecisaoAtual(null);
        
        // Aplica o bonus no state
        setBonusTat(prev => ({ atk: prev.atk + escolha.atk, def: prev.def + escolha.def }));
        await addLog(`🗣️ Técnico: "${escolha.label}"`, '#fff');
        await delay(1000);
      }
    }

    await addLog(`🏁 FIM DE JOGO!`, '#f2c14e');
    await delay(1500);

    let finalVenceu = playState.current.sEu > playState.current.sAdv;

    // Pênaltis
    if (playState.current.sEu === playState.current.sAdv) {
      await addLog('⚖️ EMPATE! VAMOS PARA OS PÊNALTIS!', '#f2c14e');
      await delay(2000);
      finalVenceu = Math.random() > 0.4; // 60% chance de vencer nos penaltis por ser o player
      if (finalVenceu) { await addLog('⚽ VITÓRIA NOS PÊNALTIS!', '#6fd17a'); }
      else { await addLog('❌ Derrota amarga nos pênaltis...', '#ff8a93'); }
      await delay(2000);
    }

    if (finalVenceu) {
      if (rodada === 4) setStep('campeao');
      else prepararRodada(rodada + 1);
    } else {
      setStep('gameover');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0f1a', color: '#fff', fontFamily: "Inter, sans-serif" }}>
       <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');
        .t-btn{font-family:'Oswald',sans-serif;font-size:16px;text-transform:uppercase;padding:12px 24px;background:#f2c14e;color:#000;border:none;border-radius:8px;cursor:pointer;}
        .t-btn:hover{transform:scale(1.05);}
        .t-logbox::-webkit-scrollbar { width: 6px; }
        .t-logbox::-webkit-scrollbar-thumb { background: rgba(244,241,234,.2); border-radius: 4px; }
      `}</style>
      
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 16px' }}>
        <h1 style={{ textAlign: 'center', fontFamily: "Oswald, sans-serif", color: '#f2c14e', fontSize: 40, margin:0 }}>Técnico por um Dia</h1>
        
        {step === 'selecao' && (
          <div style={{ marginTop: 40 }}>
            <p style={{ textAlign: 'center', color: 'rgba(255,255,255,.6)', marginBottom: 30 }}>Escolha sua seleção e tente vencer a Copa do Mundo em 4 rodadas.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
              {allTeams.map(t => (
                <button key={t.id} onClick={() => selecionarTime(t)} style={{ padding: '12px', background: '#1c180e', border: '1px solid rgba(242,193,78,.4)', color: '#fff', borderRadius: 8, cursor: 'pointer', fontFamily: "'Oswald',sans-serif", textTransform: 'uppercase' }}>
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'pre_jogo' && advTeam && (
          <div style={{ textAlign: 'center', marginTop: 60, background: '#1c180e', border: '2px solid #f2c14e', borderRadius: 16, padding: 40 }}>
            <p style={{ color: '#f2c14e', letterSpacing: 2, fontFamily: "'JetBrains Mono',monospace", textTransform: 'uppercase' }}>{nomeRodadas[rodada]}</p>
            
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 20, margin: '30px 0' }}>
               <div>
                  <h2 style={{ fontSize: 32, fontFamily: 'Oswald', margin: 0 }}>{myTeam.name}</h2>
                  <p style={{ color: 'rgba(255,255,255,.5)', margin: 0 }}>Força OVR ~ {minhaForca.atk}</p>
               </div>
               <span style={{ fontSize: 30, opacity: .3, fontFamily: 'Oswald' }}>VS</span>
               <div>
                  <h2 style={{ fontSize: 32, fontFamily: 'Oswald', margin: 0 }}>{advTeam.name}</h2>
                  <p style={{ color: 'rgba(255,255,255,.5)', margin: 0 }}>Força OVR ~ {advForca}</p>
               </div>
            </div>

            <button className="t-btn" onClick={iniciarPartida}>Ir para o Campo</button>
          </div>
        )}

        {step === 'jogo' && (
          <div style={{ maxWidth: 500, margin: '20px auto' }}>
            
            {/* Placar estilo TV */}
            <div style={{ background: '#111', padding: '16px 24px', borderRadius: 12, textAlign: 'center', marginBottom: 20, border: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 24, fontFamily: 'Oswald', textTransform: 'uppercase' }}>{myTeam?.name.slice(0,3)}</div>
              <div style={{ background: '#000', padding: '8px 24px', borderRadius: 8 }}>
                <span style={{ fontSize: 36, fontFamily: 'Oswald', fontWeight: 'bold' }}>{placar.eu} - {placar.adv}</span>
                <div style={{ fontSize: 12, color: '#f2c14e', fontFamily: "'JetBrains Mono',monospace" }}>{minuto}' MIN</div>
              </div>
              <div style={{ fontSize: 24, fontFamily: 'Oswald', textTransform: 'uppercase' }}>{advTeam?.name.slice(0,3)}</div>
            </div>

            {/* Painel de Decisão (Aparece pausando o jogo) */}
            {decisaoAtual && (
              <div style={{ background: '#0d1a2e', padding: 24, borderRadius: 12, marginBottom: 20, border: '2px solid #5fa8d3', animation: 'fadeIn 0.3s ease' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 24 }}>🚨</span>
                  <h3 style={{ margin: 0, color: '#5fa8d3', fontFamily: 'Oswald', textTransform: 'uppercase', fontSize: 22 }}>{decisaoAtual.titulo}</h3>
                </div>
                <p style={{ fontSize: 15, color: 'rgba(255,255,255,.8)', marginBottom: 20 }}>{decisaoAtual.texto}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {decisaoAtual.opcoes.map((op, i) => (
                    <button key={i} onClick={() => resolverDecisao.current(op)} style={{ padding: 14, background: 'rgba(95,168,211,.1)', color: '#fff', border: '1px solid rgba(95,168,211,.4)', borderRadius: 8, cursor: 'pointer', fontFamily: "'JetBrains Mono',monospace", fontSize: 13, textAlign: 'left', transition: 'all 0.2s' }}>
                      👉 {op.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Log / Ticker do Jogo */}
            <div className="t-logbox" style={{ background: '#070a12', padding: 20, borderRadius: 12, height: 350, overflowY: 'auto', border: '1px solid rgba(255,255,255,.1)' }} ref={logRef}>
              {logs.map(l => (
                <div key={l.key} style={{ color: l.cor, marginBottom: 12, fontFamily: "'JetBrains Mono',monospace", fontSize: 13, borderBottom: '1px dashed rgba(255,255,255,.05)', paddingBottom: 8 }}>
                  {l.txt}
                </div>
              ))}
              {minuto < 90 && !decisaoAtual && (
                <div style={{ color: 'rgba(255,255,255,.3)', fontStyle: 'italic', fontSize: 12, marginTop: 10 }}>Aguardando próximo lance...</div>
              )}
            </div>
          </div>
        )}

        {step === 'gameover' && (
          <div style={{ textAlign: 'center', marginTop: 80 }}>
             <h2 style={{ fontSize: 60, color: '#ff5252', fontFamily: 'Oswald', margin: 0 }}>ELIMINADO!</h2>
             <p style={{ fontSize: 20 }}>A diretoria não gostou da sua derrota na fase: <strong style={{color:'#f2c14e'}}>{nomeRodadas[rodada]}</strong></p>
             <button className="t-btn" onClick={() => setStep('selecao')} style={{ marginTop: 30 }}>Assinar com Novo Clube</button>
          </div>
        )}

        {step === 'campeao' && (
          <div style={{ textAlign: 'center', marginTop: 80 }}>
             <h2 style={{ fontSize: 60, color: '#f2c14e', fontFamily: 'Oswald', margin: 0 }}>🏆 CAMPEÃO!</h2>
             <p style={{ fontSize: 20 }}>A taça do mundo é nossa! Histórico com a seleção de <strong>{myTeam.name}</strong>!</p>
             <button className="t-btn" onClick={() => setStep('selecao')} style={{ marginTop: 30 }}>Buscar Novo Desafio</button>
          </div>
        )}
      </div>
    </div>
  );
}