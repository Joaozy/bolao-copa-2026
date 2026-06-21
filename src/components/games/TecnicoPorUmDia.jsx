'use client';
import { useState, useEffect, useRef } from 'react';
import { SELECOES_COPA, loadCopaTimes } from '@/components/games/gameConstants';
import DECISOES from '@/components/games/dados/decisoesTecnico.json';
import JOGADORES_COPA from '@/components/games/dados/jogadoresCopa.json';

const delay = ms => new Promise(r => setTimeout(r, ms));
const forma = (v, amp = 3) => v + (Math.random() * amp * 2 - amp);

export default function TecnicoPorUmDia() {
  const [step, setStep] = useState('selecao'); // selecao | pre_jogo | jogo | gameover | campeao
  const [allTeams, setAllTeams] = useState([]);
  const [myTeam, setMyTeam] = useState(null);
  
  // Torneio
  const [rodada, setRodada] = useState(1); // 1=Oitavas, 2=Quartas, 3=Semi, 4=Final
  const nomeRodadas = { 1: 'Oitavas de Final', 2: 'Quartas de Final', 3: 'Semifinal', 4: 'Grande Final' };
  const [advForca, setAdvForca] = useState(80);
  const [advNome, setAdvNome] = useState('');

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

  useEffect(() => {
    loadCopaTimes().then(t => setAllTeams(t.filter(x => SELECOES_COPA.includes(x.name))));
  }, []);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [logs]);

  const addLog = async (txt, cor = '#fff') => {
    setLogs(prev => [...prev, { txt, cor, key: Date.now() + Math.random() }]);
    await delay(700);
  };

  const selecionarTime = (team) => {
    setMyTeam(team);
    const jogadores = JOGADORES_COPA.filter(p => String(p.team_id) === String(team.id));
    const forcaGeral = jogadores.length ? Math.round(jogadores.reduce((s, p) => s + p.overall, 0) / jogadores.length) : 78;
    setMinhaForca({ atk: forcaGeral + 2, def: forcaGeral });
    prepararRodada(1);
  };

  const prepararRodada = (r) => {
    const rivais = allTeams.filter(t => t.id !== myTeam.id);
    const rival = rivais[Math.floor(Math.random() * rivais.length)];
    setAdvNome(rival.name);
    // A cada rodada fica mais difícil!
    setAdvForca(78 + (r * 2) + Math.floor(Math.random() * 4)); 
    setRodada(r);
    setStep('pre_jogo');
  };

  const iniciarPartida = async () => {
    setStep('jogo'); setLogs([]); setPlacar({ eu: 0, adv: 0 }); setMinuto(0); setBonusTat({ atk: 0, def: 0 });
    let sEu = 0; let sAdv = 0;

    await addLog(`⚽ APITO INICIAL: ${nomeRodadas[rodada]}!`, '#f2c14e');
    
    // 1T
    for(let m = 15; m <= 45; m+=15) {
      setMinuto(m);
      if (Math.random() < (minhaForca.atk + (bonusTat.atk*100) - advForca) * 0.02 + 0.2) { sEu++; await addLog(`GOL DO ${myTeam.name.toUpperCase()}!`, '#6fd17a'); }
      else if (Math.random() < (advForca - (minhaForca.def + (bonusTat.def*100))) * 0.02 + 0.15) { sAdv++; await addLog(`Gol do ${advNome}...`, '#ff8a93'); }
      setPlacar({ eu: sEu, adv: sAdv });
      await delay(500);
    }

    await addLog(`⏱️ INTERVALO. Placar: ${sEu} x ${sAdv}`, '#f2c14e');
    
    // Evento Tático
    const evts = DECISOES.filter(d => d.fase === 'intervalo');
    const evt = evts[Math.floor(Math.random() * evts.length)];
    setDecisaoAtual(evt);
    const escolha = await new Promise(r => { resolverDecisao.current = r; });
    setDecisaoAtual(null);
    setBonusTat({ atk: escolha.atk, def: escolha.def });
    await addLog(`Tática alterada! O time volta para o 2º tempo.`, '#5fa8d3');

    // 2T
    for(let m = 60; m <= 90; m+=15) {
      setMinuto(m);
      if (Math.random() < (minhaForca.atk + (bonusTat.atk*100) - advForca) * 0.02 + 0.2) { sEu++; await addLog(`GOL DO ${myTeam.name.toUpperCase()}!`, '#6fd17a'); }
      else if (Math.random() < (advForca - (minhaForca.def + (bonusTat.def*100))) * 0.02 + 0.15) { sAdv++; await addLog(`Gol do ${advNome}...`, '#ff8a93'); }
      setPlacar({ eu: sEu, adv: sAdv });
      await delay(500);
    }

    await addLog(`🏁 FIM DE JOGO!`, '#f2c14e');
    await delay(1000);

    // Desempate (Pênaltis fake)
    if (sEu === sAdv) {
      await addLog('PÊNALTIS!', '#f2c14e');
      const venceuPenaltis = Math.random() > 0.5;
      if (venceuPenaltis) { sEu++; await addLog('VITÓRIA NOS PÊNALTIS!', '#6fd17a'); }
      else { sAdv++; await addLog('Derrota nos pênaltis...', '#ff8a93'); }
    }

    if (sEu > sAdv) {
      if (rodada === 4) setStep('campeao');
      else prepararRodada(rodada + 1);
    } else {
      setStep('gameover');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0f1a', color: '#fff', fontFamily: "Inter, sans-serif", padding: 20 }}>
      <h1 style={{ textAlign: 'center', fontFamily: "Oswald, sans-serif", color: '#f2c14e', fontSize: 36, margin:0 }}>Modo Carreira</h1>
      
      {step === 'selecao' && (
        <div style={{ maxWidth: 600, margin: '40px auto', display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
          {allTeams.map(t => (
            <button key={t.id} onClick={() => selecionarTime(t)} style={{ padding: '10px 20px', background: '#1c180e', border: '1px solid #f2c14e', color: '#fff', borderRadius: 8, cursor: 'pointer' }}>{t.name}</button>
          ))}
        </div>
      )}

      {step === 'pre_jogo' && (
        <div style={{ textAlign: 'center', marginTop: 60 }}>
          <p style={{ color: '#f2c14e', letterSpacing: 2 }}>{nomeRodadas[rodada]}</p>
          <h2 style={{ fontSize: 40, fontFamily: 'Oswald' }}>{myTeam.name} <span style={{ opacity: .3 }}>vs</span> {advNome}</h2>
          <button onClick={iniciarPartida} style={{ marginTop: 30, padding: '16px 32px', background: '#f2c14e', color: '#000', fontSize: 20, fontWeight: 'bold', border: 'none', borderRadius: 8, cursor: 'pointer' }}>IR PARA O JOGO</button>
        </div>
      )}

      {step === 'jogo' && (
        <div style={{ maxWidth: 500, margin: '20px auto' }}>
          <div style={{ background: '#1c180e', padding: 20, borderRadius: 12, textAlign: 'center', marginBottom: 20, border: '2px solid #f2c14e' }}>
            <p style={{ margin: 0, opacity: .6 }}>{minuto}' Minutos</p>
            <h2 style={{ fontSize: 48, margin: 0, fontFamily: 'Oswald' }}>{placar.eu} x {placar.adv}</h2>
          </div>

          {decisaoAtual && (
            <div style={{ background: '#222', padding: 20, borderRadius: 12, marginBottom: 20, border: '1px solid #5fa8d3' }}>
              <h3 style={{ margin: '0 0 10px', color: '#5fa8d3' }}>{decisaoAtual.titulo}</h3>
              <p style={{ fontSize: 14 }}>{decisaoAtual.texto}</p>
              {decisaoAtual.opcoes.map((op, i) => (
                <button key={i} onClick={() => resolverDecisao.current(op)} style={{ display: 'block', width: '100%', padding: 12, margin: '10px 0 0', background: '#111', color: '#fff', border: '1px solid #444', borderRadius: 8, cursor: 'pointer' }}>{op.label}</button>
              ))}
            </div>
          )}

          <div style={{ background: '#070a12', padding: 20, borderRadius: 12, height: 300, overflowY: 'auto' }} ref={logRef}>
            {logs.map(l => <div key={l.key} style={{ color: l.cor, marginBottom: 10, fontFamily: "JetBrains Mono" }}>{l.txt}</div>)}
          </div>
        </div>
      )}

      {step === 'gameover' && (
        <div style={{ textAlign: 'center', marginTop: 80 }}>
           <h2 style={{ fontSize: 48, color: '#ff5252', fontFamily: 'Oswald' }}>ELIMINADO!</h2>
           <p>O sonho acabou na fase: {nomeRodadas[rodada]}</p>
           <button onClick={() => setStep('selecao')} style={{ padding: 12, background: '#fff', color: '#000', border: 'none', borderRadius: 8, marginTop: 20, cursor: 'pointer' }}>Tentar Novamente</button>
        </div>
      )}

      {step === 'campeao' && (
        <div style={{ textAlign: 'center', marginTop: 80 }}>
           <h2 style={{ fontSize: 60, color: '#f2c14e', fontFamily: 'Oswald' }}>🏆 CAMPEÃO DO MUNDO!</h2>
           <p>Você fez história com a seleção de {myTeam.name}!</p>
           <button onClick={() => setStep('selecao')} style={{ padding: 12, background: '#f2c14e', color: '#000', border: 'none', borderRadius: 8, marginTop: 20, cursor: 'pointer', fontWeight: 'bold' }}>Novo Desafio</button>
        </div>
      )}
    </div>
  );
}