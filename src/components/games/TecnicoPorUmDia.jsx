'use client';
import { useState, useEffect, useRef } from 'react';
import { SELECOES_COPA, TIERS_FIXOS, loadCopaTimes } from '@/components/games/gameConstants';
import JOGADORES_COPA from '@/components/games/dados/jogadoresCopa.json';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const delay = ms => new Promise(r => setTimeout(r, ms));
const calcForca = jogs => jogs.length ? Math.round(jogs.reduce((s, p) => s + p.overall, 0) / jogs.length) : 78;

const RODADAS = {
  1: { short: 'Oitavas', full: 'Oitavas de Final',  emoji: '⚔️' },
  2: { short: 'Quartas', full: 'Quartas de Final',  emoji: '🏅' },
  3: { short: 'Semi',    full: 'Semifinal',          emoji: '🔥' },
  4: { short: 'Final',   full: 'Grande Final',       emoji: '🏆' },
};

const ATMOS = [
  { tipo:'chute',   txt: (m) => `💨 ${m}' Chute colocado, mas para fora!` },
  { tipo:'defesa',  txt: (m) => `🧤 ${m}' Defesa incrível do goleiro!` },
  { tipo:'falta',   txt: (m) => `🟨 ${m}' Falta dura no meio-campo.` },
  { tipo:'escanteio', txt: (m) => `🚩 ${m}' Escanteio — bola na área!` },
  { tipo:'trave',   txt: (m) => `💥 ${m}' NA TRAVE! Quase!` },
];

// ─── Componente ───────────────────────────────────────────────────────────────
export default function TecnicoPorUmDia() {
  const [step, setStep]     = useState('selecao');
  const [allTeams, setAllTeams] = useState([]);
  const [myTeam, setMyTeam] = useState(null);
  const [rodada, setRodada] = useState(1);
  const [advTeam, setAdvTeam] = useState(null);
  const [advForca, setAdvForca] = useState(80);
  const [minhaForca, setMinhaForca] = useState({ atk: 80, def: 80 });
  const [logs, setLogs]     = useState([]);
  const [placar, setPlacar] = useState({ eu: 0, adv: 0 });
  const [minuto, setMinuto] = useState(0);
  const [faseJogo, setFaseJogo] = useState('');
  const [decisaoAtual, setDecisaoAtual] = useState(null);
  const [golFlash, setGolFlash] = useState(null); // 'eu' | 'adv' | null

  // Refs para evitar stale closures em funções assíncronas
  const logRef      = useRef(null);
  const resolverRef = useRef(null);
  const scoreRef    = useRef({ eu: 0, adv: 0 });   // FIX: chaves corretas eu/adv
  const bonusRef    = useRef({ atk: 0, def: 0 });   // FIX: não usa state dentro de async
  const forcaRef    = useRef({ atk: 80, def: 80 }); // FIX: idem
  const advFRef     = useRef(80);
  const golFlashRef = useRef(null);
  const myTeamRef   = useRef(null);
  const advTeamRef  = useRef(null);

  useEffect(() => {
    loadCopaTimes().then(t => setAllTeams(t.filter(x => SELECOES_COPA.includes(x.name))));
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs, decisaoAtual]);

  // ── Log ────────────────────────────────────────────────────────────────────
  const addLog = async (txt, tipo = 'normal', ms = 350) => {
    setLogs(prev => [...prev, { txt, tipo, key: Date.now() + Math.random() }]);
    await delay(ms);
  };

  // ── Goal flash overlay ────────────────────────────────────────────────────
  const triggerGolFlash = (side) => {
    if (golFlashRef.current) clearTimeout(golFlashRef.current);
    setGolFlash(side);
    golFlashRef.current = setTimeout(() => setGolFlash(null), 1400);
  };

  // ── Selecionar time ───────────────────────────────────────────────────────
  const selecionarTime = (team) => {
    const jogs = JOGADORES_COPA.filter(p => String(p.team_id) === String(team.id));
    const f = calcForca(jogs);
    const forca = { atk: f + 2, def: f };
    setMyTeam(team);
    myTeamRef.current = team;
    setMinhaForca(forca);
    forcaRef.current = forca;
    prepararRodada(1, team);
  };

  const prepararRodada = (r, team = myTeam) => {
    let pool = [];
    if (r === 1)      pool = allTeams.filter(t => TIERS_FIXOS.medio.includes(t.name) && t.id !== team?.id);
    else if (r <= 2)  pool = allTeams.filter(t => t.id !== team?.id);
    else              pool = allTeams.filter(t => TIERS_FIXOS.top.includes(t.name) && t.id !== team?.id);
    if (!pool.length) pool = allTeams.filter(t => t.id !== team?.id);

    const rival = pool[Math.floor(Math.random() * pool.length)];
    const jRival = JOGADORES_COPA.filter(p => String(p.team_id) === String(rival.id));
    const fR = calcForca(jRival);
    // Dificuldade crescente
    const boost = r === 4 ? 4 : r === 3 ? 2 : 0;
    const forcaRival = fR + boost;

    setAdvTeam(rival);    advTeamRef.current  = rival;
    setAdvForca(forcaRival); advFRef.current  = forcaRival;
    setRodada(r);
    bonusRef.current = { atk: 0, def: 0 };
    setStep('pre_jogo');
  };

  // ── Decisão tática 100% contextual — placar + minuto definem as opções ─────
  const gerarDecisaoContextual = (minuto, score, nomeEu, nomeAdv) => {
    const diff = score.eu - score.adv;
    const ganhandoPor = diff;
    const G = diff > 0, P = diff < 0;
    const pl = `${score.eu}×${score.adv}`;

    if (minuto <= 32) {
      // ── 30' — ajuste do 1T ──────────────────────────────────────────────────
      if (G) return {
        titulo: `30' — Na frente do placar (${pl})`,
        texto: `${nomeEu} vence por ${diff} gol(s). Como quer administrar o restante do 1T?`,
        opcoes: [
          { label: 'Manter o esquema — estamos bem assim', atk: 0.02, def: 0.02 },
          { label: 'Recuar a linha e preservar o resultado', atk: -0.02, def: 0.07 },
          { label: ganhandoPor >= 2 ? 'Ampliar antes do intervalo!' : 'Pressionar e fechar o 1T melhor', atk: 0.07, def: -0.03 },
        ],
      };
      if (P) return {
        titulo: `30' — Estamos perdendo (${pl})`,
        texto: `${nomeAdv} está na frente. É cedo, mas precisa reagir já no 1T!`,
        opcoes: [
          { label: 'Mudar para esquema mais ofensivo agora', atk: 0.08, def: -0.03 },
          { label: 'Manter a calma — ainda temos 60 minutos', atk: 0.01, def: 0.01 },
          { label: 'Fechar mais e sair nos contra-ataques', atk: 0.01, def: 0.06 },
        ],
      };
      return {
        titulo: `30' — Jogo equilibrado (${pl})`,
        texto: 'Empate até agora. Como quer dominar a segunda parte do 1T?',
        opcoes: [
          { label: 'Pressing alto — roubar bola e atacar rápido', atk: 0.05, def: 0.01 },
          { label: 'Bolas longas direto para os atacantes', atk: 0.04, def: -0.01 },
          { label: 'Paciência — organizar o meio-campo primeiro', atk: 0.01, def: 0.04 },
        ],
      };
    }

    if (minuto <= 47) {
      // ── Intervalo ────────────────────────────────────────────────────────────
      if (G) return {
        titulo: `Intervalo — Vencendo! (${pl})`,
        texto: `${nomeEu} chega ao vestiário na frente. O que mudar (ou não) para o 2T?`,
        opcoes: [
          { label: 'Recuar o bloco e segurar o resultado', atk: -0.03, def: 0.09 },
          { label: 'Manter a intensidade do 1T', atk: 0.03, def: 0.03 },
          { label: 'Atacar desde o início do 2T e matar o jogo', atk: 0.09, def: -0.04 },
        ],
      };
      if (P) return {
        titulo: `Intervalo — Precisamos reagir! (${pl})`,
        texto: `${nomeAdv} vence o 1T. Quais são as ordens para o 2T?`,
        opcoes: [
          { label: 'Entrada de atacante — tirar um volante', atk: 0.10, def: -0.04 },
          { label: 'Pressão máxima logo na saída do intervalo', atk: 0.07, def: -0.01 },
          { label: 'Ajustar a marcação e explorar os flancos', atk: 0.04, def: 0.05 },
        ],
      };
      return {
        titulo: `Intervalo — Jogo empatado (${pl})`,
        texto: 'Nenhum gol até aqui. O 2T precisa ser diferente.',
        opcoes: [
          { label: 'Bola mais direta — colocar pressão no adversário', atk: 0.06, def: 0.01 },
          { label: 'Mudar o meia — mais criatividade no ataque', atk: 0.07, def: -0.01 },
          { label: 'Solidez defensiva e esperar o erro deles', atk: -0.01, def: 0.07 },
        ],
      };
    }

    // ── 75' — reta final ─────────────────────────────────────────────────────
    if (G) return {
      titulo: `75' — Segurando a vantagem (${pl})`,
      texto: `Faltam 15 minutos. ${nomeEu} vence por ${diff} gol(s). Como fechar?`,
      opcoes: [
        { label: ganhandoPor >= 2 ? 'Bloco baixo — jogo fechado até o apito' : 'Recuar — defender o resultado', atk: -0.05, def: 0.12 },
        { label: 'Segurar a posse e não arriscar', atk: 0.01, def: 0.05 },
        { label: 'Ampliar o placar agora para matar o jogo', atk: 0.08, def: -0.05 },
      ],
    };
    if (P) return {
      titulo: `75' — Precisamos do gol! (${pl})`,
      texto: `Faltam 15 minutos e estamos perdendo por ${Math.abs(diff)}. Tudo ou nada!`,
      opcoes: [
        { label: '🔥 Pressão TOTAL — todo mundo no ataque!', atk: 0.13, def: -0.09 },
        { label: diff === -1 ? 'Forçar o empate e ir para os pênaltis' : 'Bolas na área — goleiro vai nos escanteios', atk: 0.08, def: -0.05 },
        { label: 'Contra-ataques rápidos — inteligência ao invés de desespero', atk: 0.05, def: -0.01 },
      ],
    };
    return {
      titulo: `75' — Quem vai querer mais? (${pl})`,
      texto: `Empate ${pl} faltando 15 minutos. A decisão pode custar a Copa.`,
      opcoes: [
        { label: 'Arriscar tudo pelo gol da vitória', atk: 0.11, def: -0.07 },
        { label: 'Segurar o empate e ir para os pênaltis', atk: -0.04, def: 0.09 },
        { label: 'Jogo inteligente — criar espaços aos poucos', atk: 0.04, def: 0.03 },
      ],
    };
  };

  const pedirDecisao = (minuto, score) => {
    const nome = myTeamRef.current?.name || 'Seu Time';
    const adv  = advTeamRef.current?.name || 'Adversário';
    const evt  = gerarDecisaoContextual(minuto, score, nome, adv);
    return new Promise(resolve => {
      resolverRef.current = resolve;
      setDecisaoAtual(evt);
    });
  };

  const confirmarDecisao = (opcao) => {
    const fn = resolverRef.current;
    resolverRef.current = null;
    setDecisaoAtual(null);
    if (fn) fn(opcao);
  };

  // ── Simula um segmento de minutos ──────────────────────────────────────────
  // Gera eventos (gols + atmosféricos) e os anima um a um com delays.
  const rodarSegmento = async (minInicio, minFim) => {
    const atk = forcaRef.current.atk + bonusRef.current.atk;
    const def = forcaRef.current.def + bonusRef.current.def;
    const adv = advFRef.current;

    // Gera eventos do segmento
    const eventos = [];
    for (let m = minInicio; m < minFim; m++) {
      const chEu   = Math.max(0.004, 0.017 + (atk - adv) * 0.0016);
      const chAdv  = Math.max(0.004, 0.017 + (adv - def) * 0.0016);
      const chAtmos = 0.035;
      const r = Math.random();

      if (r < chEu) {
        eventos.push({ m, tipo: 'gol_eu' });
      } else if (r < chEu + chAdv) {
        eventos.push({ m, tipo: 'gol_adv' });
      } else if (r < chEu + chAdv + chAtmos) {
        const a = ATMOS[Math.floor(Math.random() * ATMOS.length)];
        eventos.push({ m, tipo: 'atmos', txt: a.txt(m) });
      }
    }

    if (eventos.length === 0) {
      setMinuto(minFim);
      await addLog(`🕐 Jogo truncado de ${minInicio}' a ${minFim}'. Poucas chances criadas.`, 'dim', 450);
      return;
    }

    for (const ev of eventos) {
      setMinuto(ev.m);

      if (ev.tipo === 'gol_eu') {
        scoreRef.current = { eu: scoreRef.current.eu + 1, adv: scoreRef.current.adv };
        setPlacar({ eu: scoreRef.current.eu, adv: scoreRef.current.adv }); // FIX: chaves corretas
        triggerGolFlash('eu');
        await addLog(
          `⚽ ${ev.m}' GOOOOL DE ${(myTeamRef.current?.name || '').toUpperCase()}!`,
          'gol_eu', 1400
        );
      } else if (ev.tipo === 'gol_adv') {
        scoreRef.current = { eu: scoreRef.current.eu, adv: scoreRef.current.adv + 1 };
        setPlacar({ eu: scoreRef.current.eu, adv: scoreRef.current.adv }); // FIX
        triggerGolFlash('adv');
        await addLog(
          `⚽ ${ev.m}' Gol sofrido! ${advTeamRef.current?.name} marca...`,
          'gol_adv', 1400
        );
      } else {
        await addLog(ev.txt, 'atmos', 300);
      }
    }

    setMinuto(minFim);
  };

  // ── Partida completa ───────────────────────────────────────────────────────
  const iniciarPartida = async () => {
    setStep('jogo');
    setLogs([]); setPlacar({ eu: 0, adv: 0 }); setMinuto(0);
    scoreRef.current = { eu: 0, adv: 0 };
    bonusRef.current = { atk: 0, def: 0 };

    const nr = RODADAS[rodada];
    await addLog(`${nr.emoji} APITO INICIAL — ${nr.full}!`, 'titulo', 900);
    await addLog(
      `${myTeam.name.toUpperCase()} (ATK ${forcaRef.current.atk}) vs ${advTeam.name.toUpperCase()} (${advFRef.current})`,
      'subtitulo', 600
    );

    // ── 1T: 1–30' ────────────────────────────────────────────────────────────
    setFaseJogo('1T');
    await rodarSegmento(1, 30);

    // Decisão aos 30'
    await addLog('⏱ Pausa tática — técnico entra em campo!', 'aviso', 400);
    const d30 = await pedirDecisao(30, scoreRef.current);
    bonusRef.current = { atk: bonusRef.current.atk + (d30.atk || 0) * 100, def: bonusRef.current.def + (d30.def || 0) * 100 };
    await addLog(`🗣 Técnico: "${d30.label}"`, 'instrucao', 700);

    // 1T cont: 30–45'
    await rodarSegmento(30, 45);
    setFaseJogo('HT');
    await addLog(
      `🔔 INTERVALO — ${scoreRef.current.eu}×${scoreRef.current.adv}`,
      'titulo', 1000
    );

    // Decisão do intervalo
    const d45 = await pedirDecisao(45, scoreRef.current);
    bonusRef.current = { atk: bonusRef.current.atk + (d45.atk || 0) * 100, def: bonusRef.current.def + (d45.def || 0) * 100 };
    await addLog(`🗣 Técnico: "${d45.label}"`, 'instrucao', 700);

    // ── 2T: 45–75' ────────────────────────────────────────────────────────────
    setFaseJogo('2T');
    await rodarSegmento(45, 75);

    // Decisão aos 75'
    await addLog('⏱ Minuto 75 — instrução final!', 'aviso', 400);
    const d75 = await pedirDecisao(75, scoreRef.current);
    bonusRef.current = { atk: bonusRef.current.atk + (d75.atk || 0) * 100, def: bonusRef.current.def + (d75.def || 0) * 100 };
    await addLog(`🗣 Técnico: "${d75.label}"`, 'instrucao', 700);

    // 2T final: 75–90'
    await rodarSegmento(75, 90);
    setMinuto(90);
    await addLog('🏁 APITO FINAL!', 'titulo', 1200);

    // Resultado
    let venceu = scoreRef.current.eu > scoreRef.current.adv;

    if (scoreRef.current.eu === scoreRef.current.adv) {
      await addLog('⚖️ EMPATE! PÊNALTIS!', 'aviso', 1500);
      venceu = Math.random() > 0.40;
      await addLog(
        venceu ? '⚽⚽ VITÓRIA NOS PÊNALTIS!' : '❌ Derrota nos pênaltis...',
        venceu ? 'gol_eu' : 'gol_adv', 1600
      );
    }

    await delay(1800);
    if (venceu) { if (rodada === 4) setStep('campeao'); else prepararRodada(rodada + 1); }
    else setStep('gameover');
  };

  // ── Progresso do torneio ───────────────────────────────────────────────────
  const TournamentBar = () => (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:0, marginBottom:16 }}>
      {[1,2,3,4].map((r, i) => {
        const done  = r < rodada;
        const atual = r === rodada;
        const rd    = RODADAS[r];
        return (
          <div key={r} style={{ display:'flex', alignItems:'center' }}>
            <div style={{ textAlign:'center', padding:'0 4px' }}>
              <div style={{
                width:34, height:34, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:14, fontWeight:700, transition:'all .3s',
                background: done ? '#f2c14e' : atual ? 'rgba(242,193,78,.18)' : 'rgba(244,241,234,.06)',
                border: done ? '2px solid #f2c14e' : atual ? '2px solid #f2c14e' : '2px solid rgba(244,241,234,.15)',
                color: done ? '#1a1300' : atual ? '#f2c14e' : 'rgba(244,241,234,.3)',
              }}>
                {done ? '✓' : rd.emoji}
              </div>
              <div style={{ fontSize:9, fontFamily:"'JetBrains Mono',monospace", textTransform:'uppercase', letterSpacing:'.06em', marginTop:3,
                color: atual ? '#f2c14e' : done ? 'rgba(244,241,234,.6)' : 'rgba(244,241,234,.25)' }}>
                {rd.short}
              </div>
            </div>
            {i < 3 && (
              <div style={{ width:28, height:2, background: r < rodada ? '#f2c14e' : 'rgba(244,241,234,.1)', transition:'background .4s', marginBottom:18 }} />
            )}
          </div>
        );
      })}
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:'100vh', background:'#08111f', color:'#f4f1ea', fontFamily:"'Inter',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');
        *{box-sizing:border-box;}
        .tec{max-width:760px;margin:0 auto;padding:24px 14px 60px;}

        /* Goal flash */
        .tec-gf{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:9999;}
        .tec-gf span{font-family:'Oswald',sans-serif;text-transform:uppercase;letter-spacing:.06em;animation:gfpop 1.4s ease forwards;text-shadow:0 0 40px rgba(0,0,0,.7);}
        .tec-gf.eu span{color:#6fd17a;font-size:clamp(50px,14vw,100px);}
        .tec-gf.adv span{color:#ff5252;font-size:clamp(32px,9vw,60px);}
        @keyframes gfpop{0%{opacity:0;transform:scale(.3);}15%{opacity:1;transform:scale(1.1);}30%{transform:scale(1);}75%{opacity:1;}100%{opacity:0;transform:scale(1.05);}}

        /* Scoreboard */
        .tec-sb{background:#070a12;border:1px solid rgba(244,241,234,.1);border-radius:14px;padding:16px 20px;margin-bottom:14px;}
        .tec-sb-fase{font-family:'JetBrains Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.2em;color:#f2c14e;text-align:center;margin-bottom:10px;}
        .tec-sb-row{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;}
        .tec-sb-team{font-family:'Oswald',sans-serif;font-size:clamp(14px,3.5vw,20px);text-transform:uppercase;font-weight:700;}
        .tec-sb-team.eu{text-align:right;color:#f2c14e;}
        .tec-sb-team.adv{text-align:left;color:rgba(244,241,234,.7);}
        .tec-sb-score{font-family:'Oswald',sans-serif;font-size:clamp(38px,9vw,60px);font-weight:700;text-align:center;line-height:1;padding:0 16px;background:rgba(0,0,0,.4);border-radius:10px;}
        .tec-sb-min{font-family:'JetBrains Mono',monospace;font-size:11px;color:#f2c14e;text-align:center;margin-top:8px;}
        .tec-tl{height:4px;background:rgba(244,241,234,.07);border-radius:999px;margin-top:8px;}
        .tec-tl-fill{height:100%;background:linear-gradient(90deg,#f2c14e,#ffe17a);border-radius:999px;transition:width .8s ease;}

        /* Log */
        .tec-log{background:#070a12;border:1px solid rgba(244,241,234,.08);border-radius:12px;padding:14px;max-height:300px;overflow-y:auto;}
        .tec-log::-webkit-scrollbar{width:5px;}
        .tec-log::-webkit-scrollbar-thumb{background:rgba(244,241,234,.15);border-radius:4px;}
        .tec-logline{padding:6px 0 6px 12px;border-left:2px solid rgba(244,241,234,.15);margin-bottom:8px;font-size:13px;animation:lfade .3s ease;}
        @keyframes lfade{from{opacity:0;transform:translateY(5px);}to{opacity:1;}}
        .tec-logline.gol_eu{border-left-color:#6fd17a;color:#b9f3bf;font-family:'Oswald',sans-serif;font-size:15px;text-transform:uppercase;letter-spacing:.04em;}
        .tec-logline.gol_adv{border-left-color:#ff5252;color:#ffc5c5;font-family:'Oswald',sans-serif;font-size:15px;text-transform:uppercase;}
        .tec-logline.titulo{border-left-color:#f2c14e;color:#f2c14e;font-family:'Oswald',sans-serif;text-transform:uppercase;letter-spacing:.04em;font-size:14px;}
        .tec-logline.subtitulo{border-left-color:rgba(244,241,234,.3);color:rgba(244,241,234,.5);font-family:'JetBrains Mono',monospace;font-size:11px;}
        .tec-logline.aviso{border-left-color:#5fa8d3;color:#a8d8f0;}
        .tec-logline.instrucao{border-left-color:rgba(244,241,234,.5);color:rgba(244,241,234,.8);font-style:italic;}
        .tec-logline.atmos{border-left-color:rgba(244,241,234,.18);color:rgba(244,241,234,.42);font-size:12px;}
        .tec-logline.dim{border-left-color:rgba(244,241,234,.1);color:rgba(244,241,234,.3);font-size:11px;}

        /* Decisão */
        .tec-dec{background:#0d1a2e;border:2px solid #5fa8d3;border-radius:14px;padding:20px;margin-bottom:14px;animation:decpop .35s ease;}
        @keyframes decpop{from{opacity:0;transform:scale(.97);}to{opacity:1;transform:scale(1);}}
        .tec-dec h3{font-family:'Oswald',sans-serif;font-size:20px;text-transform:uppercase;color:#5fa8d3;margin:0 0 6px;}
        .tec-dec p{font-size:13px;color:rgba(244,241,234,.7);margin:0 0 14px;line-height:1.5;}
        .tec-dec-opts{display:flex;flex-direction:column;gap:8px;}
        .tec-dec-btn{padding:12px 14px;background:rgba(95,168,211,.08);color:#f4f1ea;border:1px solid rgba(95,168,211,.3);border-radius:9px;cursor:pointer;font-family:'JetBrains Mono',monospace;font-size:12px;text-align:left;transition:all .15s;line-height:1.4;}
        .tec-dec-btn:hover{background:rgba(95,168,211,.18);border-color:rgba(95,168,211,.6);}

        /* Teams grid */
        .tec-teams-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;max-height:460px;overflow-y:auto;margin-top:16px;padding-right:4px;}
        .tec-teams-grid::-webkit-scrollbar{width:5px;}
        .tec-teams-grid::-webkit-scrollbar-thumb{background:rgba(244,241,234,.15);border-radius:4px;}
        .tec-team-btn{display:flex;align-items:center;gap:8px;padding:10px 12px;background:rgba(255,255,255,.03);border:1px solid rgba(244,241,234,.1);border-radius:10px;cursor:pointer;color:#f4f1ea;font-family:'Oswald',sans-serif;font-size:13px;text-transform:uppercase;text-align:left;transition:all .15s;}
        .tec-team-btn:hover{border-color:rgba(242,193,78,.5);background:rgba(242,193,78,.07);}
        .tec-team-flag{width:26px;height:16px;object-fit:cover;border-radius:2px;flex-shrink:0;}

        /* Pre-jogo */
        .tec-vs{background:#0d1a2e;border:2px solid rgba(242,193,78,.3);border-radius:16px;padding:28px 24px;text-align:center;}
        .tec-vs-row{display:flex;justify-content:center;align-items:center;gap:16px;margin:20px 0;}
        .tec-vs-side{flex:1;text-align:center;}
        .tec-vs-name{font-family:'Oswald',sans-serif;font-size:clamp(18px,4vw,26px);text-transform:uppercase;font-weight:700;margin:0;}
        .tec-vs-ovr{font-family:'JetBrains Mono',monospace;font-size:11px;color:rgba(244,241,234,.4);margin-top:3px;}
        .tec-vs-sep{font-family:'Oswald',sans-serif;font-size:28px;color:rgba(244,241,234,.2);flex-shrink:0;}
        .tec-flag{width:52px;height:32px;object-fit:cover;border-radius:5px;margin:0 auto 8px;display:block;border:1px solid rgba(244,241,234,.2);}

        .tec-btn{font-family:'Oswald',sans-serif;font-size:17px;text-transform:uppercase;padding:13px 32px;border-radius:10px;border:none;background:linear-gradient(135deg,#f2c14e,#c9941f);color:#1a1300;cursor:pointer;transition:transform .15s;}
        .tec-btn:hover{transform:translateY(-2px);}

        /* End screens */
        .tec-end{text-align:center;margin-top:60px;padding:40px 20px;}
        .tec-end h2{font-family:'Oswald',sans-serif;font-weight:700;font-size:clamp(42px,10vw,72px);margin:0 0 10px;}

        @media(max-width:480px){.tec-vs-row{flex-direction:column;gap:10px;} .tec-sb-score{font-size:48px;padding:0 10px;}}
      `}</style>

      {/* Goal Flash Overlay */}
      {golFlash && (
        <div className={`tec-gf ${golFlash}`} key={golFlash + Date.now()}>
          <span>{golFlash === 'eu' ? '⚽ GOOOL!' : `GOL SOFRIDO`}</span>
        </div>
      )}

      <div className="tec">
        <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, letterSpacing:'.22em', textTransform:'uppercase', color:'#f2c14e', textAlign:'center', marginBottom:4 }}>
          Copa do Mundo 2026
        </p>
        <h1 style={{ fontFamily:"'Oswald',sans-serif", fontWeight:700, textTransform:'uppercase', textAlign:'center', fontSize:'clamp(28px,6vw,48px)', margin:'0 0 6px', background:'linear-gradient(160deg,#fff 30%,#f2c14e)', WebkitBackgroundClip:'text', backgroundClip:'text', color:'transparent' }}>
          Técnico por um Dia
        </h1>
        <p style={{ textAlign:'center', color:'rgba(244,241,234,.4)', fontSize:12, fontFamily:"'JetBrains Mono',monospace", margin:'0 0 24px' }}>
          4 partidas · Decisões táticas reais · Copa do Mundo em suas mãos
        </p>

        {/* ── Seleção ── */}
        {step === 'selecao' && (
          <div>
            <p style={{ textAlign:'center', color:'rgba(244,241,234,.55)', fontSize:14, marginBottom:4 }}>
              Escolha sua seleção e tente conquistar o título em 4 rodadas.
            </p>
            <div className="tec-teams-grid">
              {allTeams.sort((a, b) => a.name.localeCompare(b.name)).map(t => (
                <button key={t.id} className="tec-team-btn" onClick={() => selecionarTime(t)}>
                  {t.badge_url
                    ? <img src={t.badge_url} alt={t.name} className="tec-team-flag" />
                    : <div className="tec-team-flag" style={{ background:'rgba(244,241,234,.1)' }} />}
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Pré-jogo ── */}
        {step === 'pre_jogo' && myTeam && advTeam && (
          <div>
            <TournamentBar />
            <div className="tec-vs">
              <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, letterSpacing:'.15em', textTransform:'uppercase', color:'#f2c14e', margin:'0 0 4px' }}>
                {RODADAS[rodada].emoji} {RODADAS[rodada].full}
              </p>
              <div className="tec-vs-row">
                <div className="tec-vs-side">
                  {myTeam.badge_url && <img src={myTeam.badge_url} alt={myTeam.name} className="tec-flag" />}
                  <h2 className="tec-vs-name" style={{ color:'#f2c14e' }}>{myTeam.name}</h2>
                  <div className="tec-vs-ovr">ATK {minhaForca.atk} · DEF {minhaForca.def}</div>
                </div>
                <span className="tec-vs-sep">VS</span>
                <div className="tec-vs-side">
                  {advTeam.badge_url && <img src={advTeam.badge_url} alt={advTeam.name} className="tec-flag" />}
                  <h2 className="tec-vs-name">{advTeam.name}</h2>
                  <div className="tec-vs-ovr">OVR ≈ {advForca}</div>
                </div>
              </div>
              <p style={{ fontSize:13, color:'rgba(244,241,234,.5)', marginBottom:20 }}>
                Você tomará 3 decisões táticas durante a partida. Escolha certo.
              </p>
              <button className="tec-btn" onClick={iniciarPartida}>⚽ Ir para o Campo</button>
            </div>
          </div>
        )}

        {/* ── Jogo ── */}
        {step === 'jogo' && myTeam && advTeam && (
          <div style={{ maxWidth:560, margin:'0 auto' }}>
            <TournamentBar />

            {/* Scoreboard */}
            <div className="tec-sb">
              <div className="tec-sb-fase">
                {faseJogo === '1T' ? '1º Tempo' : faseJogo === 'HT' ? 'Intervalo' : '2º Tempo'}
              </div>
              <div className="tec-sb-row">
                <div className="tec-sb-team eu">{myTeam.name}</div>
                <div className="tec-sb-score">{placar.eu} – {placar.adv}</div>
                <div className="tec-sb-team adv">{advTeam.name}</div>
              </div>
              <div className="tec-sb-min">⏱ {minuto}'</div>
              <div className="tec-tl">
                <div className="tec-tl-fill" style={{ width:`${Math.min(100, (minuto / 90) * 100)}%` }} />
              </div>
            </div>

            {/* Decisão tática */}
            {decisaoAtual && (
              <div className="tec-dec">
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                  <span style={{ fontSize:22 }}>🚨</span>
                  <h3>{decisaoAtual.titulo}</h3>
                </div>
                <p>{decisaoAtual.texto}</p>
                <div className="tec-dec-opts">
                  {decisaoAtual.opcoes.map((op, i) => (
                    <button key={i} className="tec-dec-btn" onClick={() => confirmarDecisao(op)}>
                      <span style={{ color:'#5fa8d3', marginRight:6 }}>▶</span> {op.label}
                      {(op.atk || op.def) && (
                        <span style={{ display:'block', fontSize:10, color:'rgba(244,241,234,.35)', marginTop:3 }}>
                          {op.atk > 0 ? `+${Math.round(op.atk * 100)} ATK` : op.atk < 0 ? `${Math.round(op.atk * 100)} ATK` : ''}
                          {op.atk && op.def ? '  ·  ' : ''}
                          {op.def > 0 ? `+${Math.round(op.def * 100)} DEF` : op.def < 0 ? `${Math.round(op.def * 100)} DEF` : ''}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Log */}
            <div className="tec-log" ref={logRef}>
              {logs.map(l => (
                <div key={l.key} className={`tec-logline ${l.tipo}`}>{l.txt}</div>
              ))}
              {!decisaoAtual && minuto < 90 && (
                <div style={{ color:'rgba(244,241,234,.2)', fontSize:11, fontFamily:"'JetBrains Mono',monospace", marginTop:4 }}>
                  ···
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Game Over ── */}
        {step === 'gameover' && (
          <div className="tec-end">
            <h2 style={{ color:'#ff5252' }}>ELIMINADO</h2>
            <p style={{ fontSize:16, color:'rgba(244,241,234,.6)', marginBottom:24 }}>
              A Copa termina nas <strong style={{ color:'#f2c14e' }}>{RODADAS[rodada].full}</strong>
              {advTeam && ` após a derrota para ${advTeam.name}.`}
            </p>
            <button className="tec-btn" onClick={() => { setStep('selecao'); setRodada(1); }}>
              Recomeçar
            </button>
          </div>
        )}

        {/* ── Campeão ── */}
        {step === 'campeao' && (
          <div className="tec-end">
            <TournamentBar />
            <div style={{ fontSize:64, margin:'16px 0 8px' }}>🏆</div>
            <h2 style={{ color:'#f2c14e' }}>CAMPEÃO!</h2>
            <p style={{ fontSize:16, color:'rgba(244,241,234,.6)', marginBottom:24 }}>
              {myTeam?.name} conquista a Copa do Mundo 2026! Você foi o melhor técnico do mundo.
            </p>
            <button className="tec-btn" onClick={() => { setStep('selecao'); setRodada(1); }}>
              Novo Desafio
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
