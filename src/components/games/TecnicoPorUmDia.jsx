'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';

// ─── Constantes ───────────────────────────────────────────────────────────────
const COMPETITION_ID = 7;

const FORMACOES = {
  '4-3-3':   { DEF: 4, MEI: 3, ATA: 3, bonus: { ataque: 0.04,  defesa: -0.02 } },
  '4-4-2':   { DEF: 4, MEI: 4, ATA: 2, bonus: { ataque: 0,     defesa: 0 } },
  '4-2-3-1': { DEF: 4, MEI: 5, ATA: 1, bonus: { ataque: -0.02, defesa: 0.02 } },
  '5-3-2':   { DEF: 5, MEI: 3, ATA: 2, bonus: { ataque: -0.04, defesa: 0.06 } },
};

const POS_CAT = { GOL:'GOL', LD:'DEF', LE:'DEF', ZAG:'DEF', VOL:'MEI', MC:'MEI', MEI:'MEI', MD:'MEI', ME:'MEI', PD:'ATA', PE:'ATA', SA:'ATA', CA:'ATA' };

const delay = ms => new Promise(r => setTimeout(r, ms));

function forma(v, amp = 3) { return v + (Math.random() * amp * 2 - amp); }

function calcularSetores(jogadores, formKey) {
  const form = FORMACOES[formKey];
  const avg = (arr) => arr.length ? Math.round(arr.reduce((s, p) => s + (p.overall || 75), 0) / arr.length) : 75;
  const gols = jogadores.filter(p => (p.pos1 || '').startsWith('GOL') || p.position === 'Goalkeeper');
  const defs = jogadores.filter(p => ['DEF'].includes(POS_CAT[p.pos1] || '') || p.position === 'Defender');
  const meis = jogadores.filter(p => ['MEI'].includes(POS_CAT[p.pos1] || '') || p.position === 'Midfielder');
  const atas = jogadores.filter(p => ['ATA'].includes(POS_CAT[p.pos1] || '') || p.position === 'Attacker');
  const defesa  = Math.round((avg(gols) * 0.35) + (avg(defs) * 0.65));
  const meio    = avg(meis);
  const ataque  = avg(atas);
  const fBonus  = form?.bonus || { ataque: 0, defesa: 0 };
  return { defesa, meio, ataque, fBonus };
}

function simularMotor({ meuAtq, meuMei, minDef, advForca, mentBonus = { eu: 0, adv: 0 }, decBonus = { ataque: 0, defesa: 0 } }) {
  const mA = forma(meuAtq + decBonus.ataque * 10);
  const mM = forma(meuMei);
  const mD = forma(minDef + decBonus.defesa * 10);
  const aA = forma(advForca * 0.97);
  const aM = forma(advForca);
  const aD = forma(advForca * 0.97);
  const posse = Math.max(0.33, Math.min(0.67, mM / (mM + aM)));
  const cEu  = 3 + Math.round(posse * 4);
  const cAdv = 2 + Math.round((1 - posse) * 4);
  const pEu  = Math.max(0.17, Math.min(0.50, 0.27 + (mA - aD) * 0.012 + mentBonus.eu));
  const pAdv = Math.max(0.10, Math.min(0.40, 0.25 + (aA - mD) * 0.012 + mentBonus.adv));
  const duelo = p => Math.random() < Math.max(0, Math.min(1, p + (Math.random() * 0.04 - 0.02)));
  let gEu = 0, gAdv = 0;
  for (let i = 0; i < cEu; i++)  if (duelo(pEu))  gEu++;
  for (let i = 0; i < cAdv; i++) if (duelo(pAdv)) gAdv++;
  return { gEu, gAdv, posse };
}

function distribuirMinutos(qtd, inicio, fim) {
  return Array.from({ length: qtd }, () => Math.floor(Math.random() * (fim - inicio)) + inicio).sort((a, b) => a - b);
}

function getMentBonus(ment) {
  return { ofensivo: { eu: 0.04, adv: 0.02 }, equilibrado: { eu: 0, adv: 0 }, defensivo: { eu: -0.03, adv: -0.04 } }[ment] || { eu: 0, adv: 0 };
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function TecnicoPorUmDia() {
  const [step, setStep] = useState('selecao');
  const [allTeams, setAllTeams] = useState([]);
  const [myTeam, setMyTeam] = useState(null);
  const [myPlayers, setMyPlayers] = useState([]);
  const [opponent, setOpponent] = useState(null);
  const [formKey, setFormKey] = useState('4-3-3');
  const [mentalidade, setMentalidade] = useState('equilibrado');
  const [carregando, setCarregando] = useState(false);
  const [advForca, setAdvForca] = useState(80);

  // Jogo
  const [logs, setLogs] = useState([]);
  const [placar, setPlacar] = useState({ eu: 0, adv: 0 });
  const [minuto, setMinuto] = useState(0);
  const [fase, setFase] = useState(''); // '1T' | 'intervalo' | '2T' | 'fim'
  const [decisaoAtual, setDecisaoAtual] = useState(null);
  const [decBonus, setDecBonus] = useState({ ataque: 0, defesa: 0 });
  const [bench, setBench] = useState([]);
  const [resultado, setResultado] = useState(null);
  const [simulando, setSimulando] = useState(false);

  const logRef = useRef(null);
  const resolverDecisao = useRef(null);

  useEffect(() => {
    supabase.from('teams').select('id,name,badge_url').then(({ data }) => setAllTeams(data || []));
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const selecionarTime = async (team) => {
    setMyTeam(team); setCarregando(true);
    const { data } = await supabase.from('players').select('id,name,pos1,position,overall')
      .eq('team_id', team.id).eq('competition_id', COMPETITION_ID)
      .order('overall', { ascending: false }).limit(18);
    const jogadores = data || [];
    setMyPlayers(jogadores.slice(0, 11));
    setBench(jogadores.slice(11, 18));

    // adversário aleatório
    const rivais = allTeams.filter(t => t.id !== team.id);
    const rival = rivais[Math.floor(Math.random() * rivais.length)];
    setOpponent(rival);

    const { data: rp } = await supabase.from('players').select('overall')
      .eq('team_id', rival.id).eq('competition_id', COMPETITION_ID)
      .order('overall', { ascending: false }).limit(11);
    const f = rp?.length ? Math.round(rp.reduce((s, p) => s + p.overall, 0) / rp.length) : 78;
    setAdvForca(f);
    setCarregando(false); setStep('pre_jogo');
  };

  const addLog = async (txt, tipo = 'normal', pauseMs = 600) => {
    setLogs(prev => [...prev, { txt, tipo, key: Date.now() + Math.random() }]);
    await delay(pauseMs);
  };

  const pedirDecisao = (decisao) => new Promise(resolve => {
    resolverDecisao.current = resolve;
    setDecisaoAtual(decisao);
  });

  const responderDecisao = (resposta) => {
    const fn = resolverDecisao.current;
    resolverDecisao.current = null;
    setDecisaoAtual(null);
    if (fn) fn(resposta);
  };

  const iniciarPartida = async () => {
    setStep('jogo'); setSimulando(true);
    setLogs([]); setPlacar({ eu: 0, adv: 0 }); setDecBonus({ ataque: 0, defesa: 0 });

    const nomeEu = myTeam.name;
    const nomeAdv = opponent.name;
    const setores = calcularSetores(myPlayers, formKey);
    const fBonus = setores.fBonus;
    const mBonus = getMentBonus(mentalidade);
    let scoreEu = 0, scoreAdv = 0;
    let bonusAtual = { ataque: fBonus.ataque, defesa: fBonus.defesa };

    await addLog(`⚽ APITOU! ${nomeEu} × ${nomeAdv}`, 'titulo', 800);
    await addLog(`📋 ${formKey} · ${mentalidade} · DEF ${setores.defesa} | MEI ${setores.meio} | ATQ ${setores.ataque}`, 'info', 600);

    // ── 1º Tempo (1-45') ─────────────────────────────────────────────────────
    setFase('1T');
    const r1 = simularMotor({ meuAtq: setores.ataque, meuMei: setores.meio, minDef: setores.defesa, advForca, mentBonus: mBonus, decBonus: bonusAtual });
    const mins1eu  = distribuirMinutos(r1.gEu, 1, 45);
    const mins1adv = distribuirMinutos(r1.gAdv, 1, 45);
    const ev1 = [...mins1eu.map(m => ({ m, lado: 'eu' })), ...mins1adv.map(m => ({ m, lado: 'adv' }))].sort((a, b) => a.m - b.m);

    for (const ev of ev1) {
      setMinuto(ev.m);
      if (ev.lado === 'eu') { scoreEu++; setPlacar({ eu: scoreEu, adv: scoreAdv }); await addLog(`⚽ ${ev.m}' GOL! ${nomeEu} (${scoreEu}-${scoreAdv})`, 'bom'); }
      else { scoreAdv++; setPlacar({ eu: scoreEu, adv: scoreAdv }); await addLog(`⚽ ${ev.m}' GOL! ${nomeAdv} (${scoreEu}-${scoreAdv})`, 'mau'); }
    }
    setMinuto(45);
    await addLog(`🔔 Intervalo: ${nomeEu} ${scoreEu}×${scoreAdv} ${nomeAdv}`, 'titulo', 1000);

    // ── DECISÃO 1: Substituição ───────────────────────────────────────────────
    setFase('intervalo');
    const sub = await pedirDecisao({ tipo: 'substituicao', placar: { eu: scoreEu, adv: scoreAdv } });
    if (sub === 'ataque') { bonusAtual = { ...bonusAtual, ataque: bonusAtual.ataque + 0.05 }; await addLog('📣 Substituição ofensiva! Reforço no ataque.', 'bom', 500); }
    else if (sub === 'defesa') { bonusAtual = { ...bonusAtual, defesa: bonusAtual.defesa + 0.05 }; await addLog('📣 Substituição defensiva! Mais solidez atrás.', 'bom', 500); }
    else await addLog('📣 Sem alterações. Equipe se mantém.', 'info', 500);
    setDecBonus(bonusAtual);

    // ── 2º Tempo (46-90') ────────────────────────────────────────────────────
    setFase('2T');
    const r2 = simularMotor({ meuAtq: setores.ataque, meuMei: setores.meio, minDef: setores.defesa, advForca, mentBonus: mBonus, decBonus: bonusAtual });

    // DECISÃO 2 aos 75': só aparece se empatando ou perdendo
    let decidiu75 = false;
    const mins2eu  = distribuirMinutos(r2.gEu, 46, 90);
    const mins2adv = distribuirMinutos(r2.gAdv, 46, 90);
    const ev2 = [...mins2eu.map(m => ({ m, lado: 'eu' })), ...mins2adv.map(m => ({ m, lado: 'adv' }))].sort((a, b) => a.m - b.m);

    for (const ev of ev2) {
      // Pausa aos 75' se necessário
      if (!decidiu75 && ev.m >= 75 && scoreEu <= scoreAdv) {
        decidiu75 = true; setMinuto(75);
        await addLog('⏱ 75\' — momento crítico!', 'titulo', 400);
        const press = await pedirDecisao({ tipo: 'pressao', placar: { eu: scoreEu, adv: scoreAdv } });
        if (press === 'pressionar') {
          bonusAtual = { ataque: bonusAtual.ataque + 0.06, defesa: bonusAtual.defesa - 0.04 };
          await addLog('🔥 Pressão total! Time vai ao ataque.', 'bom', 400);
        } else {
          bonusAtual = { ataque: bonusAtual.ataque - 0.02, defesa: bonusAtual.defesa + 0.05 };
          await addLog('🛡️ Bloco baixo. Aguardando contra-ataque.', 'info', 400);
        }
        setDecBonus(bonusAtual);
        // Re-simula os gols restantes (75-90)
        const mins75eu  = distribuirMinutos(Math.round(r2.gEu * 0.3), 75, 90);
        const mins75adv = distribuirMinutos(Math.round(r2.gAdv * (bonusAtual.defesa > 0 ? 0.1 : 0.3)), 75, 90);
        const ev75 = [...mins75eu.map(m => ({ m, lado: 'eu' })), ...mins75adv.map(m => ({ m, lado: 'adv' }))].sort((a, b) => a.m - b.m);
        for (const ev75i of ev75) {
          setMinuto(ev75i.m);
          if (ev75i.lado === 'eu') { scoreEu++; setPlacar({ eu: scoreEu, adv: scoreAdv }); await addLog(`⚽ ${ev75i.m}' GOL! ${nomeEu} (${scoreEu}-${scoreAdv})`, 'bom'); }
          else { scoreAdv++; setPlacar({ eu: scoreEu, adv: scoreAdv }); await addLog(`⚽ ${ev75i.m}' GOL! ${nomeAdv} (${scoreEu}-${scoreAdv})`, 'mau'); }
        }
        break;
      }
      setMinuto(ev.m);
      if (ev.lado === 'eu') { scoreEu++; setPlacar({ eu: scoreEu, adv: scoreAdv }); await addLog(`⚽ ${ev.m}' GOL! ${nomeEu} (${scoreEu}-${scoreAdv})`, 'bom'); }
      else { scoreAdv++; setPlacar({ eu: scoreEu, adv: scoreAdv }); await addLog(`⚽ ${ev.m}' GOL! ${nomeAdv} (${scoreEu}-${scoreAdv})`, 'mau'); }
    }

    setMinuto(90); setFase('fim');
    const venceu = scoreEu > scoreAdv;
    await addLog(`📣 APITO FINAL: ${nomeEu} ${scoreEu}×${scoreAdv} ${nomeAdv}`, 'titulo', 1000);
    setResultado({ scoreEu, scoreAdv, venceu: venceu, empate: scoreEu === scoreAdv });
    setSimulando(false);
  };

  const reiniciar = () => { setStep('selecao'); setMyTeam(null); setMyPlayers([]); setOpponent(null); setLogs([]); setPlacar({ eu: 0, adv: 0 }); setResultado(null); setDecisaoAtual(null); setFase(''); setMinuto(0); };

  const pctMin = Math.min(100, (minuto / 90) * 100);

  return (
    <div style={{ minHeight: '100vh', background: '#08111f', color: '#f4f1ea', fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');
        *{box-sizing:border-box;}
        .tec{max-width:820px;margin:0 auto;padding:26px 16px 60px;}
        .tec-eye{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#f2c14e;text-align:center;margin-bottom:4px;}
        .tec-h1{font-family:'Oswald',sans-serif;font-weight:700;font-size:clamp(30px,6vw,52px);text-transform:uppercase;text-align:center;margin:0;background:linear-gradient(160deg,#fff 30%,#f2c14e);-webkit-background-clip:text;background-clip:text;color:transparent;}
        .tec-sub{text-align:center;color:rgba(244,241,234,.5);font-size:13px;margin:6px 0 0;font-family:'JetBrains Mono',monospace;}
        .tec-card{background:rgba(255,255,255,.03);border:1px solid rgba(244,241,234,.1);border-radius:14px;}
        .tec-pill{font-family:'JetBrains Mono',monospace;font-size:12px;padding:8px 16px;border-radius:999px;border:1px solid rgba(244,241,234,.22);background:transparent;color:#f4f1ea;cursor:pointer;transition:all .15s;}
        .tec-pill.on{background:#f2c14e;color:#1a1300;border-color:#f2c14e;font-weight:700;}
        .tec-pills{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
        .tec-team-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-top:18px;max-height:360px;overflow-y:auto;}
        .tec-team-btn{display:flex;align-items:center;gap:8px;padding:10px 12px;background:rgba(255,255,255,.03);border:1px solid rgba(244,241,234,.1);border-radius:10px;cursor:pointer;transition:all .15s;font-size:13px;font-weight:600;color:#f4f1ea;text-align:left;}
        .tec-team-btn:hover{border-color:rgba(242,193,78,.4);background:rgba(242,193,78,.06);}
        .tec-team-flag{width:28px;height:18px;object-fit:cover;border-radius:3px;flex-shrink:0;}
        .tec-sb{background:#070a12;border:1px solid rgba(244,241,234,.12);border-radius:12px;padding:16px;text-align:center;margin-bottom:14px;}
        .tec-sb-fase{font-family:'JetBrains Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.15em;color:#f2c14e;margin-bottom:4px;}
        .tec-sb-placar{font-family:'Oswald',sans-serif;font-size:clamp(36px,9vw,56px);font-weight:700;margin:0;}
        .tec-sb-teams{font-family:'JetBrains Mono',monospace;font-size:11px;color:rgba(244,241,234,.5);}
        .tec-timeline{height:6px;background:rgba(244,241,234,.08);border-radius:999px;margin-top:10px;overflow:hidden;}
        .tec-tl-fill{height:100%;background:linear-gradient(90deg,#f2c14e,#ffe17a);border-radius:999px;transition:width .8s ease;}
        .tec-log{background:#070a12;border-radius:10px;padding:14px;max-height:280px;overflow-y:auto;}
        .tec-logline{margin:0 0 8px;padding-left:12px;border-left:2px solid rgba(244,241,234,.2);font-size:13px;animation:tec-fade .3s ease;}
        .tec-logline.bom{border-left-color:#6fd17a;color:#b9f3bf;}
        .tec-logline.mau{border-left-color:#d7263d;color:#ffb3bb;}
        .tec-logline.titulo{border-left-color:#f2c14e;font-family:'Oswald',sans-serif;text-transform:uppercase;letter-spacing:.04em;color:#f2c14e;}
        .tec-logline.info{border-left-color:rgba(244,241,234,.3);color:rgba(244,241,234,.6);}
        @keyframes tec-fade{from{opacity:0;transform:translateY(4px);}to{opacity:1;}}
        .tec-decisao{background:#0d1a2e;border:2px solid #f2c14e;border-radius:14px;padding:22px;text-align:center;margin-bottom:14px;animation:tec-pop .3s ease;}
        @keyframes tec-pop{from{opacity:0;transform:scale(.97);}to{opacity:1;transform:scale(1);}}
        .tec-dec-title{font-family:'Oswald',sans-serif;font-size:20px;text-transform:uppercase;color:#f2c14e;margin:0 0 6px;}
        .tec-dec-sub{font-size:13px;color:rgba(244,241,234,.6);margin:0 0 16px;}
        .tec-dec-opts{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;}
        .tec-dec-btn{font-family:'Oswald',sans-serif;font-size:15px;padding:12px 22px;border-radius:10px;border:1px solid rgba(244,241,234,.25);background:rgba(244,241,234,.05);color:#f4f1ea;cursor:pointer;transition:all .15s;text-transform:uppercase;}
        .tec-dec-btn:hover{border-color:#f2c14e;background:rgba(242,193,78,.12);color:#f2c14e;}
        .tec-btn{font-family:'Oswald',sans-serif;font-size:17px;text-transform:uppercase;padding:13px 32px;border-radius:10px;border:none;background:linear-gradient(135deg,#f2c14e,#c9941f);color:#1a1300;cursor:pointer;transition:transform .15s;display:block;margin:16px auto 0;}
        .tec-btn:hover{transform:translateY(-2px);}
        .tec-result{text-align:center;padding:28px 20px;border-radius:14px;margin-top:14px;animation:tec-pop .4s ease;}
        .tec-result.v{background:rgba(34,197,94,.07);border:1px solid rgba(34,197,94,.3);}
        .tec-result.d{background:rgba(215,38,61,.07);border:1px solid rgba(215,38,61,.3);}
        .tec-result.e{background:rgba(244,241,234,.04);border:1px solid rgba(244,241,234,.15);}
        .tec-squad{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:7px;margin-top:12px;}
        .tec-player{background:rgba(244,241,234,.04);border:1px solid rgba(244,241,234,.1);border-radius:8px;padding:8px 10px;font-size:12px;}
        .tec-player strong{display:block;font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .tec-player span{font-family:'JetBrains Mono',monospace;font-size:10px;color:rgba(244,241,234,.5);}
        @media(max-width:500px){.tec-team-grid{grid-template-columns:1fr 1fr;} .tec-dec-opts{flex-direction:column;} .tec-dec-btn{width:100%;}}
      `}</style>

      <div className="tec">
        <p className="tec-eye">Copa do Mundo 2026</p>
        <h1 className="tec-h1">Técnico por um Dia</h1>
        <p className="tec-sub">Tome as decisões certas e leve sua seleção à vitória</p>

        {/* ── Seleção do time ── */}
        {step === 'selecao' && (
          <div style={{ marginTop: 28 }}>
            <div className="tec-card" style={{ padding: 20 }}>
              <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, textTransform: 'uppercase', letterSpacing: '.12em', color: 'rgba(244,241,234,.4)', marginBottom: 4 }}>
                Escolha sua seleção
              </p>
              <p style={{ fontSize: 13, color: 'rgba(244,241,234,.5)', marginBottom: 0 }}>
                {allTeams.length} seleções disponíveis · O adversário será sorteado automaticamente
              </p>
              <div className="tec-team-grid">
                {allTeams.sort((a, b) => a.name.localeCompare(b.name)).map(t => (
                  <button key={t.id} className="tec-team-btn" onClick={() => selecionarTime(t)}>
                    {t.badge_url ? <img src={t.badge_url} alt={t.name} className="tec-team-flag" /> : <div className="tec-team-flag" style={{ background: 'rgba(244,241,234,.1)' }} />}
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
            {carregando && <p style={{ textAlign: 'center', color: 'rgba(244,241,234,.4)', fontFamily: "'JetBrains Mono',monospace", fontSize: 12, marginTop: 12 }}>Carregando elenco...</p>}
          </div>
        )}

        {/* ── Pré-jogo ── */}
        {step === 'pre_jogo' && myTeam && opponent && (
          <div style={{ marginTop: 24 }}>
            <div className="tec-card" style={{ padding: 20, marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  {myTeam.badge_url && <img src={myTeam.badge_url} alt={myTeam.name} style={{ width: 52, height: 52, objectFit: 'contain', display: 'block', margin: '0 auto 6px' }} />}
                  <strong style={{ fontFamily: "'Oswald',sans-serif", fontSize: 16 }}>{myTeam.name}</strong>
                </div>
                <span style={{ fontFamily: "'Oswald',sans-serif", fontSize: 28, color: 'rgba(244,241,234,.3)', padding: '0 12px' }}>VS</span>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  {opponent.badge_url && <img src={opponent.badge_url} alt={opponent.name} style={{ width: 52, height: 52, objectFit: 'contain', display: 'block', margin: '0 auto 6px' }} />}
                  <strong style={{ fontFamily: "'Oswald',sans-serif", fontSize: 16 }}>{opponent.name}</strong>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: 'rgba(244,241,234,.4)', marginTop: 2 }}>Força {advForca}</div>
                </div>
              </div>

              <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(244,241,234,.4)', textAlign: 'center', marginBottom: 10 }}>Formação</p>
              <div className="tec-pills" style={{ marginBottom: 16 }}>
                {Object.keys(FORMACOES).map(k => (
                  <button key={k} className={`tec-pill ${formKey === k ? 'on' : ''}`} onClick={() => setFormKey(k)}>{k}</button>
                ))}
              </div>

              <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(244,241,234,.4)', textAlign: 'center', marginBottom: 10 }}>Mentalidade</p>
              <div className="tec-pills" style={{ marginBottom: 18 }}>
                {[['ofensivo','⚔️ Ofensivo'], ['equilibrado','⚖️ Equilibrado'], ['defensivo','🛡️ Defensivo']].map(([v, l]) => (
                  <button key={v} className={`tec-pill ${mentalidade === v ? 'on' : ''}`} onClick={() => setMentalidade(v)}>{l}</button>
                ))}
              </div>

              <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(244,241,234,.4)', marginBottom: 10 }}>Seu Elenco</p>
              <div className="tec-squad">
                {myPlayers.map(p => (
                  <div key={p.id} className="tec-player">
                    <strong>{p.name}</strong>
                    <span>{p.pos1 || p.position?.slice(0,3)} · {p.overall}</span>
                  </div>
                ))}
              </div>

              <button className="tec-btn" onClick={iniciarPartida}>⚽ Apitar a Partida</button>
            </div>
          </div>
        )}

        {/* ── Jogo em andamento ── */}
        {step === 'jogo' && (
          <div style={{ marginTop: 20, maxWidth: 640, margin: '20px auto 0' }}>
            <div className="tec-sb">
              <p className="tec-sb-fase">{fase === '1T' ? '1º Tempo' : fase === 'intervalo' ? 'Intervalo' : fase === '2T' ? '2º Tempo' : 'Fim de Jogo'} · {minuto}'</p>
              <p className="tec-sb-placar">{placar.eu} × {placar.adv}</p>
              <p className="tec-sb-teams">{myTeam?.name} · vs · {opponent?.name}</p>
              <div className="tec-timeline"><div className="tec-tl-fill" style={{ width: `${pctMin}%` }} /></div>
            </div>

            {/* Decisão tática */}
            {decisaoAtual && (
              <div className="tec-decisao">
                {decisaoAtual.tipo === 'substituicao' && (
                  <>
                    <p className="tec-dec-title">🔄 Intervalo — Hora da Substituição</p>
                    <p className="tec-dec-sub">Placar: {decisaoAtual.placar.eu}×{decisaoAtual.placar.adv} · Você precisa ajustar alguma coisa?</p>
                    <div className="tec-dec-opts">
                      <button className="tec-dec-btn" onClick={() => responderDecisao('ataque')}>⚔️ Substituição Ofensiva<br/><small style={{fontSize:10,opacity:.6}}>+ataque · entrada de ponta/atacante</small></button>
                      <button className="tec-dec-btn" onClick={() => responderDecisao('defesa')}>🛡️ Substituição Defensiva<br/><small style={{fontSize:10,opacity:.6}}>+defesa · entrada de volante</small></button>
                      <button className="tec-dec-btn" onClick={() => responderDecisao('nada')}>✋ Sem Alterações<br/><small style={{fontSize:10,opacity:.6}}>manter o que está dando certo</small></button>
                    </div>
                  </>
                )}
                {decisaoAtual.tipo === 'pressao' && (
                  <>
                    <p className="tec-dec-title">⚡ 75' — Decisão Crítica</p>
                    <p className="tec-dec-sub">Placar: {decisaoAtual.placar.eu}×{decisaoAtual.placar.adv} · Como o time vai jogar os minutos finais?</p>
                    <div className="tec-dec-opts">
                      <button className="tec-dec-btn" onClick={() => responderDecisao('pressionar')}>🔥 Pressão Total<br/><small style={{fontSize:10,opacity:.6}}>+ataque · −defesa · tudo ou nada</small></button>
                      <button className="tec-dec-btn" onClick={() => responderDecisao('segurar')}>🧱 Bloco Baixo<br/><small style={{fontSize:10,opacity:.6}}>+defesa · −ataque · aguarda contra</small></button>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="tec-card" style={{ padding: 4 }}>
              <div className="tec-log" ref={logRef}>
                {logs.map(l => <p key={l.key} className={`tec-logline ${l.tipo}`}>{l.txt}</p>)}
              </div>
            </div>

            {/* Resultado final */}
            {resultado && (
              <div className={`tec-result ${resultado.venceu ? 'v' : resultado.empate ? 'e' : 'd'}`}>
                <p style={{ fontFamily: "'Oswald',sans-serif", fontSize: 28, textTransform: 'uppercase', margin: '0 0 4px', color: resultado.venceu ? '#86efac' : resultado.empate ? '#f4f1ea' : '#ff8a93' }}>
                  {resultado.venceu ? '🏆 Vitória!' : resultado.empate ? '🤝 Empate' : '😔 Derrota'}
                </p>
                <p style={{ color: 'rgba(244,241,234,.6)', fontSize: 14, margin: '0 0 18px' }}>
                  {myTeam.name} {resultado.scoreEu}×{resultado.scoreAdv} {opponent.name}
                </p>
                <button className="tec-btn" onClick={reiniciar}>🔄 Nova Partida</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
