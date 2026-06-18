'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const COMPETITION_ID_COPA = 7;

const FORMACOES = {
  '4-3-3':  { nome: '4-3-3',  GOL: 1, DEF: 4, MEI: 3, ATA: 3 },
  '4-4-2':  { nome: '4-4-2',  GOL: 1, DEF: 4, MEI: 4, ATA: 2 },
  '4-2-3-1':{ nome: '4-2-3-1',GOL: 1, DEF: 4, MEI: 5, ATA: 1 },
  '5-3-2':  { nome: '5-3-2',  GOL: 1, DEF: 5, MEI: 3, ATA: 2 },
};

const GRUPOS_COPA = {
  A: ['Mexico','South Africa','South Korea','Czech Republic'],
  B: ['Canada','Bosnia & Herzegovina','Qatar','Switzerland'],
  C: ['Brazil','Morocco','Haiti','Scotland'],
  D: ['USA','Paraguay','Australia','Türkiye'],
  E: ['Germany','Curaçao','Ivory Coast','Ecuador'],
  F: ['Netherlands','Japan','Tunisia','Sweden'],
  G: ['Belgium','Egypt','Iran','New Zealand'],
  H: ['Spain','Cape Verde Islands','Saudi Arabia','Uruguay'],
  I: ['France','Senegal','Norway','Iraq'],
  J: ['Argentina','Algeria','Austria','Jordan'],
  K: ['Portugal','Uzbekistan','Colombia','Congo DR'],
  L: ['England','Croatia','Ghana','Panama'],
};

const SELECOES_COPA = Object.values(GRUPOS_COPA).flat();
const POSICAO_LABEL = { GOL:'Goleiro', DEF:'Zagueiro/Lateral', MEI:'Meio-campo', ATA:'Atacante' };
const POSICAO_COR   = { GOL:'#F2C14E', DEF:'#5FA8D3', MEI:'#8AD68A', ATA:'#D7263D' };
const ORDEM_POSICAO = { GOL:0, DEF:1, MEI:2, ATA:3 };
const TIER_LABEL = { top:'🔥 Nível Top', medio:'⚖️ Nível Médio/Bom', baixo:'🌱 Nível Médio/Fraco' };

// Tiers curados manualmente — refletem o nível real das seleções na Copa 2026.
const TIERS_FIXOS = {
  top: ['Brazil','Argentina','France','Spain','Belgium','England','Netherlands','Germany','Portugal'],
  medio: ['Mexico','South Korea','Switzerland','Morocco','Scotland','Türkiye','USA','Ecuador',
          'Japan','Sweden','Uruguay','Norway','Colombia','Croatia'],
};
// Tudo que não está em top nem medio cai automaticamente em baixo.

// ─── fases do mata-mata: faixas de percentil de dificuldade ───────────────────
const FASES_MATA_MATA = [
  { fase:'16-avos de Final', tipo:'percentil', min:0.40, max:1.00 },
  { fase:'Oitavas de Final', tipo:'minOVR',    minOVR:80 },
  { fase:'Quartas de Final', tipo:'minOVR',    minOVR:80 },
  { fase:'Semifinal',        tipo:'top' },
  { fase:'GRANDE FINAL',     tipo:'top' },
];

// motor de simulacao (inspirado no Brasfoot)

const delay = ms => new Promise(res => setTimeout(res, ms));

function classificarPosicao(p) {
  return ({ Goalkeeper:'GOL', Defender:'DEF', Midfielder:'MEI', Attacker:'ATA' })[p] || 'OUTRO';
}
function embaralhar(a) { return [...a].sort(() => Math.random() - 0.5); }

// variacao de forma: "dia de jogo" - controla zebras
function forma(v, amplitude = 7) { return v + (Math.random() * amplitude * 2 - amplitude); }

function calcularForcaSelecao(jogadores) {
  if (!jogadores?.length) return 70;
  const top11 = [...jogadores].sort((a,b) => b.overall - a.overall).slice(0,11);
  return Math.round(top11.reduce((s,p) => s + p.overall, 0) / top11.length);
}

function definirTiers(times) {
  const top   = times.filter(t => TIERS_FIXOS.top.includes(t.name));
  const medio = times.filter(t => TIERS_FIXOS.medio.includes(t.name));
  const baixo = times.filter(t => !TIERS_FIXOS.top.includes(t.name) && !TIERS_FIXOS.medio.includes(t.name));
  if (!top.length || !medio.length || !baixo.length) {
    const ord = [...times].sort((a,b) => 0.5 - Math.random());
    const s = Math.ceil(ord.length / 3);
    return { top: ord.slice(0,s), medio: ord.slice(s,s*2), baixo: ord.slice(s*2) };
  }
  return { top, medio, baixo };
}

function gerarPlanoSorteio() {
  return embaralhar([...Array(5).fill('top'),...Array(3).fill('medio'),...Array(3).fill('baixo')]);
}

// Sorteia adversario com regra por fase:
// 16-avos: faixa percentil livre
// Oitavas/Quartas: apenas selecoes OVR 80+
// Semi/Final: apenas selecoes do tier Top
function sortearAdversario(restantes, forcas, etapa) {
  let pool;
  if (etapa.tipo === 'top') {
    pool = restantes.filter(t => TIERS_FIXOS.top.includes(t.name));
  } else if (etapa.tipo === 'minOVR') {
    pool = restantes.filter(t => (forcas[t.id] || 70) >= etapa.minOVR);
  } else {
    const ord = [...restantes].sort((a,b) => (forcas[b.id]||70) - (forcas[a.id]||70));
    const n = ord.length;
    const lo = Math.floor(etapa.min * n);
    const hi = Math.min(n, Math.max(lo+1, Math.ceil(etapa.max * n)));
    pool = ord.slice(lo, hi);
  }
  if (!pool.length) pool = restantes;
  return pool[Math.floor(Math.random() * pool.length)];
}


/**
 * MOTOR BRASFOOT-INSPIRADO — calibrado para Copa 2026
 *
 * Princípio: diferença de força tem que dominar sobre sorte.
 * Amplitude de forma ±3 para ambos os lados (era ±4/±6).
 * Coeficiente 0.012 por ponto de diferença (era 0.008).
 *
 * Exemplos com time usuário OVR 82:
 *   vs time 82 (igual)  → ~1.65 gols × ~1.00 gols esperado
 *   vs time 68 (fraco)  → ~2.20 gols × ~0.45 gols esperado
 *   vs time 88 (forte)  → ~1.20 gols × ~1.40 gols esperado
 */
function simularMotor({ meuAtq, meuMei, minDef, advForca }) {
  // amplitude pequena → força real domina, zebras existem mas são raras
  const mA = forma(meuAtq, 3);
  const mM = forma(meuMei, 3);
  const mD = forma(minDef, 3);
  const aA = forma(advForca * 0.97, 3);
  const aM = forma(advForca,        3);
  const aD = forma(advForca * 0.97, 3);

  // posse pelo meio-campo (33–67%)
  const posse = Math.max(0.33, Math.min(0.67, mM / (mM + aM)));

  // chances por lado — base enxuta para placar realista
  const cEu  = 3 + Math.round(posse       * 4); // 3–5
  const cAdv = 2 + Math.round((1 - posse) * 4); // 2–4

  // prob por chance: protagonista +0.33 de base, coeficiente alto para diferenciar bem
  // leve dificuldade extra: base de pEu baixou, pAdv subiu
  const pEu  = Math.max(0.17, Math.min(0.48, 0.29 + (mA - aD) * 0.012));
  const pAdv = Math.max(0.12, Math.min(0.37, 0.25 + (aA - mD) * 0.012));

  // duelo: luck minúsculo ±2% — só um toque de imprevisibilidade
  let gEu = 0, gAdv = 0;
  const duelo = prob => Math.random() < Math.max(0, Math.min(1, prob + (Math.random() * 0.04 - 0.02)));
  for (let i = 0; i < cEu;  i++) if (duelo(pEu))  gEu++;
  for (let i = 0; i < cAdv; i++) if (duelo(pAdv)) gAdv++;

  return { gEu, gAdv, cEu, cAdv, posse, mA, mM, mD, aA, aM, aD };
}

// distribui os gols em minutos realistas
function gerarMinutosGols(qtdEu, qtdAdv) {
  const ev = [];
  for (let i = 0; i < qtdEu;  i++) ev.push({ min: Math.floor(Math.random()*90)+1, lado:'eu' });
  for (let i = 0; i < qtdAdv; i++) ev.push({ min: Math.floor(Math.random()*90)+1, lado:'adv' });
  return ev.sort((a,b) => a.min - b.min);
}

/**
 * Sorteia o marcador de um gol do MEU time.
 * Pesos: ATA 5.5× · MEI 2× · DEF 0.8× (sem GOL).
 * Dentro de cada grupo, jogadores com overall maior têm mais chance.
 */
function sortearGoleador(team) {
  const candidatos = team.filter(p => classificarPosicao(p.position) !== 'GOL');
  if (!candidatos.length) return null;
  const pw = { ATA: 5.5, MEI: 2.0, DEF: 0.8 };
  const pesos = candidatos.map(p => (pw[classificarPosicao(p.position)] || 1) * (p.overall / 75));
  const total = pesos.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < candidatos.length; i++) {
    r -= pesos[i];
    if (r <= 0) return candidatos[i];
  }
  return candidatos[candidatos.length - 1];
}

/**
 * Monta a fila de cobradores de pênalti do meu time.
 * Ordenados por peso posicional × overall, do mais apto ao menos apto.
 * No sudden death continua ciclando a partir do início da lista.
 */
function filaDePenaltis(team) {
  const pw = { ATA: 4, MEI: 2.5, DEF: 1 };
  return [...team]
    .filter(p => classificarPosicao(p.position) !== 'GOL')
    .sort((a, b) => {
      const wa = (pw[classificarPosicao(a.position)] || 1) * a.overall;
      const wb = (pw[classificarPosicao(b.position)] || 1) * b.overall;
      return wb - wa;
    });
}

function gerarSlotsCampo(f) {
  const slots = [{ cat:'GOL', x:50, y:91 }];
  for (let i=0;i<f.DEF;i++) slots.push({ cat:'DEF', x:(i+1)/(f.DEF+1)*100, y:71 });
  if (f.MEI<=3) {
    for (let i=0;i<f.MEI;i++) slots.push({ cat:'MEI', x:(i+1)/(f.MEI+1)*100, y:47 });
  } else {
    const a=Math.ceil(f.MEI/2), b=f.MEI-a;
    for (let i=0;i<a;i++) slots.push({ cat:'MEI', x:(i+1)/(a+1)*100, y:55 });
    for (let i=0;i<b;i++) slots.push({ cat:'MEI', x:(i+1)/(b+1)*100, y:36 });
  }
  for (let i=0;i<f.ATA;i++) slots.push({ cat:'ATA', x:(i+1)/(f.ATA+1)*100, y:14 });
  return slots;
}

// ─── componente principal ────────────────────────────────────────────────────

export default function Game7x0() {
  const [step, setStep] = useState('formacao');
  const [modo, setModo] = useState('classico');
  const [velocidade, setVelocidade] = useState('normal');
  const [nomeTime, setNomeTime] = useState('');
  const [formacaoKey, setFormacaoKey] = useState(null);
  const [myTeam, setMyTeam] = useState([]);

  const [allTeams, setAllTeams] = useState([]);
  const [forcaPorTime, setForcaPorTime] = useState({});
  const [tiers, setTiers] = useState({ top:[], medio:[], baixo:[] });
  const [carregando, setCarregando] = useState(true);

  const [planoSorteio, setPlanoSorteio] = useState([]);
  const [rodadaAtual, setRodadaAtual] = useState(0);
  const [ajudaUsada, setAjudaUsada] = useState(false);
  const [teamsUsados, setTeamsUsados] = useState([]); // IDs das seleções já sorteadas nesse draft
  const [currentRolledTeam, setCurrentRolledTeam] = useState(null);
  const [availablePlayers, setAvailablePlayers] = useState([]);
  const [isRolling, setIsRolling] = useState(false);

  const [logsSimulacao, setLogsSimulacao] = useState([]);
  const [grupoAtual, setGrupoAtual] = useState(null);
  const [tabelaGrupo, setTabelaGrupo] = useState(null);
  const [scoreboard, setScoreboard] = useState(null);
  const [eventosPartida, setEventosPartida] = useState([]);
  const [minutoAtual, setMinutoAtual] = useState(0);
  const [golFlash, setGolFlash] = useState(null);
  const [resultadoFinal, setResultadoFinal] = useState(null);
  const [esperandoAcao, setEsperandoAcao] = useState(null);
  const [viewMobile, setViewMobile] = useState('campo'); // 'campo' | 'lista'

  const logRef = useRef(null);
  const cliqueRef = useRef(null);
  const velRef = useRef('normal');
  const golFlashRef = useRef(null);

  useEffect(() => { velRef.current = velocidade; }, [velocidade]);
  // Normal = lento e dramático (2.4×). Rápida = velocidade antiga do "normal" (1×).
  const t = ms => velRef.current === 'rapida' ? ms : Math.round(ms * 2.4);

  const formacao = formacaoKey ? FORMACOES[formacaoKey] : null;

  useEffect(() => {
    async function load() {
      const { data: sel } = await supabase.from('teams').select('id,name,badge_url,flag_code').in('name', SELECOES_COPA);
      const times = sel || [];
      setAllTeams(times);
      if (times.length) {
        const { data: jog } = await supabase.from('players').select('team_id,overall')
          .eq('competition_id', COMPETITION_ID_COPA).in('team_id', times.map(t=>t.id));
        const f = {};
        times.forEach(time => {
          f[time.id] = calcularForcaSelecao((jog||[]).filter(j=>j.team_id===time.id));
        });
        setForcaPorTime(f);
        setTiers(definirTiers(times));
      }
      setCarregando(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logsSimulacao]);

  const iniciarDraft = key => {
    setFormacaoKey(key); setMyTeam([]); setPlanoSorteio(gerarPlanoSorteio());
    setRodadaAtual(0); setAjudaUsada(false); setTeamsUsados([]); setStep('draft');
  };

  const verificarVaga = pos => {
    if (!formacao) return false;
    const cat = classificarPosicao(pos);
    if (cat === 'OUTRO') return false;
    return myTeam.filter(p=>classificarPosicao(p.position)===cat).length < formacao[cat];
  };

  const finalizarRolagem = async team => {
    const { data } = await supabase.from('players').select('id,name,position,overall,photo_url')
      .eq('team_id', team.id).eq('competition_id', COMPETITION_ID_COPA);
    const ord = (data||[]).sort((a,b) => {
      const pa = ORDEM_POSICAO[classificarPosicao(a.position)]??9;
      const pb = ORDEM_POSICAO[classificarPosicao(b.position)]??9;
      return pa!==pb ? pa-pb : b.overall-a.overall;
    });
    setAvailablePlayers(ord); setIsRolling(false);
  };

  // Filtra o pool removendo seleções já sorteadas neste draft
  const poolDaRodada = (excluirId = null) => {
    const tier = planoSorteio[rodadaAtual];
    const base = tiers[tier]?.length ? tiers[tier] : allTeams;
    const filtrado = base.filter(t => !teamsUsados.includes(t.id) && t.id !== excluirId);
    // fallback: se o tier esgotou (todos já usados), abre para qualquer seleção ainda disponível
    if (filtrado.length === 0) return allTeams.filter(t => !teamsUsados.includes(t.id) && t.id !== excluirId);
    return filtrado;
  };

  const rolarDado = () => {
    if (isRolling || currentRolledTeam || !allTeams.length || rodadaAtual>=11) return;
    const pool = poolDaRodada(); setIsRolling(true); setAvailablePlayers([]);
    let v=0;
    const iv = setInterval(() => {
      const s = pool[Math.floor(Math.random()*pool.length)];
      setCurrentRolledTeam(s); v++;
      if (v>14) { clearInterval(iv); finalizarRolagem(s); }
    }, 90);
  };

  const usarAjuda = () => {
    if (ajudaUsada||isRolling||!currentRolledTeam) return;
    setAjudaUsada(true);
    // exclui também a seleção atual ao buscar substituta
    const pool = poolDaRodada(currentRolledTeam.id);
    const p = pool.length ? pool : allTeams.filter(t=>t.id!==currentRolledTeam.id);
    setIsRolling(true); setAvailablePlayers([]); setCurrentRolledTeam(null);
    let v=0;
    const iv = setInterval(() => {
      const s = p[Math.floor(Math.random()*p.length)];
      setCurrentRolledTeam(s); v++;
      if (v>14) { clearInterval(iv); finalizarRolagem(s); }
    }, 90);
  };

  const selecionarJogador = p => {
    if (myTeam.length>=11||myTeam.some(x=>x.id===p.id)||!verificarVaga(p.position)) return;
    // marca a seleção como usada para não sair de novo
    setTeamsUsados(prev => [...prev, currentRolledTeam.id]);
    setMyTeam([...myTeam, {...p, selectionName: currentRolledTeam.name}]);
    setRodadaAtual(prev=>prev+1); setCurrentRolledTeam(null); setAvailablePlayers([]);
  };

  const calcularForcaTime = (time=myTeam) => {
    if (!time.length) return 0;
    return Math.round(time.reduce((s,p)=>s+p.overall,0)/time.length);
  };

  const calcularSetores = () => {
    const atas = myTeam.filter(p=>classificarPosicao(p.position)==='ATA');
    const meis = myTeam.filter(p=>classificarPosicao(p.position)==='MEI');
    const defs = myTeam.filter(p=>['GOL','DEF'].includes(classificarPosicao(p.position)));
    const avg  = arr => arr.length ? Math.round(arr.reduce((s,p)=>s+p.overall,0)/arr.length) : calcularForcaTime();
    return { ataque: avg(atas), meio: avg(meis), defesa: avg(defs) };
  };

  const addLog = async (texto, tipo='normal') => {
    setLogsSimulacao(prev=>[...prev,{texto,tipo,key:prev.length}]);
    await delay(t(520));
  };

  const flashGol = (lado, nome) => {
    if (golFlashRef.current) clearTimeout(golFlashRef.current);
    setGolFlash({lado, nome, key:Date.now()});
    golFlashRef.current = setTimeout(()=>setGolFlash(null), t(1200));
  };

  const aguardar = label => new Promise(resolve=>{
    cliqueRef.current = resolve;
    setEsperandoAcao(label);
  });

  const clicarAcao = () => {
    const r = cliqueRef.current;
    cliqueRef.current = null; setEsperandoAcao(null);
    if (r) r();
  };

  // ── partida com motor Brasfoot ──────────────────────────────────────────────
  const jogarPartida = async ({ faseLabel, rival, ataque, meio, defesa, nomeExibido }) => {
    const advForca = forcaPorTime[rival.id] || 78;
    const { gEu, gAdv, cEu, cAdv, posse } = simularMotor({
      meuAtq: ataque, meuMei: meio, minDef: defesa, advForca
    });
    const eventos = gerarMinutosGols(gEu, gAdv);

    setScoreboard({ fase:faseLabel, nosso:0, deles:0, rival:rival.name, badge:rival.badge_url, forcaAdv: advForca });
    setEventosPartida(eventos); setMinutoAtual(0);

    const posseStr = `${Math.round(posse*100)}% vs ${Math.round((1-posse)*100)}%`;
    await addLog(`🏁 ${nomeExibido} vs ${rival.name} — Posse: ${posseStr} | Chances: ${cEu}x${cAdv}`, 'titulo');

    let pEu=0, pAdv=0;
    if (!eventos.length) await delay(t(600));
    for (const ev of eventos) {
      await delay(t(700));
      if (ev.lado==='eu') pEu++; else pAdv++;
      setMinutoAtual(ev.min);
      setScoreboard(prev=>({...prev, nosso:pEu, deles:pAdv}));
      flashGol(ev.lado, ev.lado==='eu' ? nomeExibido : rival.name);
      if (ev.lado==='eu') {
        const scorer = sortearGoleador(myTeam);
        const scorerStr = scorer ? ` — ${scorer.name}` : '';
        await addLog(`⚽ ${ev.min}' GOL! ${nomeExibido}${scorerStr} (${pEu}-${pAdv})`, 'bom');
      } else {
        await addLog(`⚽ ${ev.min}' GOL! ${rival.name} (${pEu}-${pAdv})`, 'mau');
      }
    }
    setMinutoAtual(90);
    await addLog(
      `📣 Apito final: ${nomeExibido} ${gEu}×${gAdv} ${rival.name}`,
      gEu>gAdv ? 'bom' : gEu===gAdv ? 'meio' : 'mau'
    );
    return { golsEu:gEu, golsAdv:gAdv };
  };

  // ── pênaltis cobrança a cobrança ────────────────────────────────────────────
  const simularPenaltis = async ({ nomeEu, nomeAdv, forcaEuChute, forcaAdvChute }) => {
    let gEu=0, gAdv=0, rodada=0;
    const euPrimeiro = Math.random()<0.5;
    const cobradores = filaDePenaltis(myTeam); // fila de cobradores do meu time
    await addLog('🥅 Foi para os pênaltis! O estádio prende a respiração.','titulo');
    await delay(t(500));
    while (true) {
      rodada++;
      const ordem = euPrimeiro ? ['eu','adv'] : ['adv','eu'];
      for (const lado of ordem) {
        const fc = lado==='eu' ? forcaEuChute : forcaAdvChute;
        const prob = Math.min(0.92, Math.max(0.52, 0.72 + (fc-80)*0.003));
        const conv = Math.random() < prob;
        if (lado==='eu') gEu+=conv?1:0; else gAdv+=conv?1:0;

        if (lado==='eu') {
          // pega o cobrador da fila (cicla se for sudden death)
          const cobrador = cobradores[(rodada-1) % cobradores.length];
          const nCob = cobrador ? cobrador.name : nomeEu;
          await addLog(
            `${conv?'⚽':'❌'} ${rodada}ª cobrança — ${nCob}: ${conv?'CONVERTEU! 🙌':'PERDEU! 😩'}  (${gEu}-${gAdv})`,
            conv?'bom':'mau'
          );
        } else {
          await addLog(
            `${conv?'⚽':'❌'} ${rodada}ª cobrança — ${nomeAdv}: ${conv?'converte.':'desperdiça!'}  (${gEu}-${gAdv})`,
            conv?'mau':'bom'
          );
        }
      }
      if (rodada>=5) { if (gEu!==gAdv) break; }
      else if (Math.abs(gEu-gAdv) > 5-rodada) break;
    }
    const venceu = gEu>gAdv;
    await addLog(
      `🚨 ${venceu?nomeEu:nomeAdv} vence nos pênaltis por ${Math.max(gEu,gAdv)}-${Math.min(gEu,gAdv)}!`,
      venceu?'bom':'mau'
    );
    return venceu;
  };

  // ── entre rivais (bastidores, sem animação) ─────────────────────────────────
  const simBastidores = (fA, fB) => {
    const r = simularMotor({ meuAtq:fA, meuMei:fA, minDef:fA, advForca:fB });
    return { golsA:r.gEu, golsB:r.gAdv };
  };

  // ── simulação da Copa ───────────────────────────────────────────────────────
  const rodarSimulacao = async () => {
    setStep('simulacao');
    setLogsSimulacao([]); setTabelaGrupo(null); setResultadoFinal(null);
    setScoreboard(null); setEsperandoAcao(null); setGolFlash(null);
    setEventosPartida([]); setMinutoAtual(0);

    const { ataque, meio, defesa } = calcularSetores();
    const nome = nomeTime.trim() || 'Sua Seleção';

    // sorteio do grupo
    const letras = Object.keys(GRUPOS_COPA);
    const letra = letras[Math.floor(Math.random()*letras.length)];
    const nomesRivais = GRUPOS_COPA[letra];
    const rivais = nomesRivais.map(n=>allTeams.find(t=>t.name===n)).filter(Boolean);
    setGrupoAtual({ letra, rivais });
    await addLog(`🎟️ Sorteio: GRUPO ${letra} — ${nomesRivais.join(', ')}.`, 'titulo');

    const tabela = [
      { id:'EU', nome, pontos:0, j:0, v:0, e:0, d:0, gp:0, gc:0, souEu:true },
      ...rivais.map(r=>({ id:r.id, nome:r.name, pontos:0, j:0, v:0, e:0, d:0, gp:0, gc:0, souEu:false })),
    ];

    const aplic = (eA, gA, eB, gB) => {
      eA.j++;eB.j++;eA.gp+=gA;eA.gc+=gB;eB.gp+=gB;eB.gc+=gA;
      if(gA>gB){eA.pontos+=3;eA.v++;eB.d++;}
      else if(gA<gB){eB.pontos+=3;eB.v++;eA.d++;}
      else{eA.pontos++;eB.pontos++;eA.e++;eB.e++;}
    };

    await addLog('🔮 FASE DE GRUPOS 🔮','titulo');

    for (const rival of rivais) {
      await aguardar(`🏟️ Apitar: ${nome} vs ${rival.name}`);
      const { golsEu, golsAdv } = await jogarPartida({ faseLabel:`Grupo ${letra}`, rival, ataque, meio, defesa, nomeExibido:nome });
      aplic(tabela.find(x=>x.id==='EU'), golsEu, tabela.find(x=>x.id===rival.id), golsAdv);
    }

    for (let i=0;i<rivais.length;i++) for (let j=i+1;j<rivais.length;j++) {
      const {golsA,golsB} = simBastidores(forcaPorTime[rivais[i].id]||75, forcaPorTime[rivais[j].id]||75);
      aplic(tabela.find(x=>x.id===rivais[i].id), golsA, tabela.find(x=>x.id===rivais[j].id), golsB);
    }

    tabela.sort((a,b)=>(b.pontos-a.pontos)||((b.gp-b.gc)-(a.gp-a.gc))||b.gp-a.gp);
    setTabelaGrupo(tabela);
    const pos = tabela.findIndex(x=>x.souEu)+1;
    const pts = tabela.find(x=>x.souEu).pontos;
    await addLog(`📊 Grupo ${letra}: ${pos}º lugar · ${pts} pontos.`, 'titulo');

    let clf = false;
    if (pos<=2) { clf=true; await addLog('🎉 CLASSIFICADO entre os 2 primeiros!','bom'); }
    else if (pos===3) {
      const ch = 0.12 + (pts/9)*0.6;
      await addLog('🍀 Na loteria dos melhores terceiros...','meio');
      clf = Math.random()<ch;
      await addLog(clf?'🎉 Classificado como melhor terceiro!':'💀 Fora pelos critérios dos terceiros.', clf?'bom':'mau');
    } else { await addLog('💀 ELIMINADO na fase de grupos.','mau'); }

    if (!clf) { setResultadoFinal({status:'eliminado',fase:'Fase de Grupos'}); return; }

    let restantes = allTeams.filter(t=>!rivais.some(r=>r.id===t.id));
    let vivo=true, faseAlc='';

    for (const etapa of FASES_MATA_MATA) {
      if (!vivo) break;
      const adv = sortearAdversario(restantes, forcaPorTime, etapa);
      if (!adv) break;
      restantes = restantes.filter(t=>t.id!==adv.id);

      await aguardar(`⚔️ Apitar ${etapa.fase}: ${nome} vs ${adv.name}`);
      await addLog(`⚔️ ${etapa.fase.toUpperCase()} ⚔️`, 'titulo');
      const { golsEu, golsAdv } = await jogarPartida({ faseLabel:etapa.fase, rival:adv, ataque, meio, defesa, nomeExibido:nome });

      let venceu = golsEu>golsAdv;
      if (golsEu===golsAdv) {
        await aguardar('🥅 Cobranças de pênalti — clique para começar');
        venceu = await simularPenaltis({ nomeEu:nome, nomeAdv:adv.name, forcaEuChute:ataque, forcaAdvChute:forcaPorTime[adv.id]||78 });
      }

      faseAlc = etapa.fase;
      if (!venceu) { await addLog(`💀 ${adv.name} te eliminou na ${etapa.fase}.`,'mau'); vivo=false; }
      else await addLog('🔥 VITÓRIA! Próxima fase!','bom');
    }

    if (vivo) {
      await addLog('🏆 PARABÉNS! VOCÊ É O CAMPEÃO DO MUNDO! 🏆','bom');
      setResultadoFinal({status:'campeao'});
    } else setResultadoFinal({status:'eliminado',fase:faseAlc});
  };

  const reiniciar = () => {
    setStep('formacao'); setFormacaoKey(null); setMyTeam([]); setLogsSimulacao([]);
    setCurrentRolledTeam(null); setAvailablePlayers([]); setGrupoAtual(null);
    setTabelaGrupo(null); setScoreboard(null); setResultadoFinal(null);
    setEsperandoAcao(null); setGolFlash(null); setEventosPartida([]); setMinutoAtual(0);
    setTeamsUsados([]); setRodadaAtual(0); setAjudaUsada(false);
  };

  // ── render helpers ─────────────────────────────────────────────────────────
  const forcaAtual = calcularForcaTime();
  const setores    = formacao ? calcularSetores() : { ataque:0, meio:0, defesa:0 };
  const slotsCampo = formacao ? gerarSlotsCampo(formacao) : [];
  const slots = slotsCampo.map(slot=>{
    const ocup = myTeam.filter(p=>classificarPosicao(p.position)===slot.cat);
    const idx  = slotsCampo.filter(s=>s.cat===slot.cat).indexOf(slot);
    return {...slot, jogador: ocup[idx]||null};
  });
  const mostrarOVR = modo==='classico' || myTeam.length>=11;
  const tierLabel  = planoSorteio[rodadaAtual] ? TIER_LABEL[planoSorteio[rodadaAtual]] : '';

  // lineup mobile agrupado por posição
  const gruposMobile = ['GOL','DEF','MEI','ATA'].map(cat=>({
    cat, label: POSICAO_LABEL[cat], cor: POSICAO_COR[cat],
    jogadores: myTeam.filter(p=>classificarPosicao(p.position)===cat),
    vagas: formacao ? formacao[cat] : 0,
  }));

  return (
    <div style={{
      minHeight:'100vh', background:'var(--bg)', color:'var(--chalk)', fontFamily:'var(--font-body)',
      '--bg':'#0a0f1a','--turf-1':'#123524','--turf-2':'#1d5c3c','--gold':'#f2c14e',
      '--chalk':'#f4f1ea','--crimson':'#d7263d','--ink':'#070a12','--linha':'rgba(244,241,234,0.35)',
      '--font-display':"'Oswald', sans-serif",'--font-body':"'Inter', sans-serif",
      '--font-mono':"'JetBrains Mono', monospace",
    }}>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');
      *{box-sizing:border-box;} body{margin:0;}
      .g7{max-width:1100px;margin:0 auto;padding:28px 18px 60px;}
      @media(max-width:480px){.g7{padding:16px 10px 50px;}}

      .g7-eyebrow{font-family:var(--font-mono);letter-spacing:.22em;text-transform:uppercase;font-size:12px;color:var(--gold);text-align:center;}
      .g7-h1{font-family:var(--font-display);font-weight:700;text-transform:uppercase;text-align:center;
        font-size:clamp(28px,6vw,56px);margin:4px 0 0;
        background:linear-gradient(180deg,#fff,var(--gold));-webkit-background-clip:text;background-clip:text;color:transparent;}
      .g7-sub{text-align:center;color:rgba(244,241,234,.6);margin-top:8px;font-size:15px;}

      .g7-card{background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.01));border:1px solid rgba(244,241,234,.1);border-radius:14px;}

      .g7-pills{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;}
      .g7-pill{font-family:var(--font-mono);font-size:13px;padding:9px 18px;border-radius:999px;
        border:1px solid rgba(244,241,234,.25);background:transparent;color:var(--chalk);cursor:pointer;transition:all .15s;}
      .g7-pill.on{background:var(--gold);color:#1a1300;border-color:var(--gold);font-weight:700;}

      .g7-formbtn{font-family:var(--font-display);font-size:22px;font-weight:600;padding:22px 30px;border-radius:12px;
        border:1px solid rgba(242,193,78,.4);background:var(--ink);color:var(--gold);cursor:pointer;
        transition:transform .15s,box-shadow .15s;}
      .g7-formbtn:hover{transform:translateY(-3px);box-shadow:0 10px 24px rgba(242,193,78,.18);}

      .g7-input{font-family:var(--font-body);background:var(--ink);border:1px solid rgba(244,241,234,.2);
        color:var(--chalk);padding:10px 14px;border-radius:8px;font-size:14px;width:260px;text-align:center;}

      /* ── campo tático ── */
      .g7-pitch{position:relative;width:100%;aspect-ratio:2/3;border-radius:16px;overflow:hidden;
        background:repeating-linear-gradient(0deg,var(--turf-1) 0 40px,var(--turf-2) 40px 80px);
        border:3px solid rgba(244,241,234,.5);}
      .g7-pitch::before{content:'';position:absolute;left:50%;top:50%;width:30%;aspect-ratio:1;
        border:2px solid var(--linha);border-radius:50%;transform:translate(-50%,-50%);}
      .g7-pitch::after{content:'';position:absolute;left:50%;top:0;width:0;height:100%;
        border-left:2px solid var(--linha);transform:translateX(-50%);}

      .g7-slot{position:absolute;transform:translate(-50%,-50%);width:clamp(50px,15vw,78px);text-align:center;animation:gpop .3s ease;}
      .g7-slot-empty{width:26px;height:26px;margin:0 auto;border:2px dashed rgba(244,241,234,.4);border-radius:50%;}
      .g7-chip{background:rgba(7,10,18,.9);border-radius:6px;padding:3px 4px;line-height:1.2;
        border:1px solid rgba(244,241,234,.25);overflow:hidden;}
      .g7-chip strong{font-family:var(--font-display);font-size:clamp(7px,1.8vw,10px);display:block;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .g7-chip .ovr{font-family:var(--font-mono);font-weight:700;font-size:clamp(7px,1.7vw,10px);}

      /* ── lineup mobile ── */
      .g7-lineup{display:flex;flex-direction:column;gap:12px;}
      .g7-lineup-cat{border-radius:10px;overflow:hidden;border:1px solid rgba(244,241,234,.1);}
      .g7-lineup-head{padding:6px 12px;font-family:var(--font-mono);font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;}
      .g7-lineup-row{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;
        border-top:1px solid rgba(244,241,234,.06);}
      .g7-lineup-vazio{padding:8px 12px;color:rgba(244,241,234,.35);font-size:12px;border-top:1px solid rgba(244,241,234,.06);}

      /* ── toggle campo/lista ── */
      .g7-viewtoggle{display:none;gap:6px;justify-content:center;margin-bottom:12px;}
      @media(max-width:640px){.g7-viewtoggle{display:flex;}}
      .g7-vtbtn{font-family:var(--font-mono);font-size:11px;padding:5px 14px;border-radius:999px;
        border:1px solid rgba(244,241,234,.2);background:transparent;color:rgba(244,241,234,.7);cursor:pointer;}
      .g7-vtbtn.on{background:rgba(242,193,78,.15);border-color:var(--gold);color:var(--gold);font-weight:700;}

      /* ── setores bar ── */
      .g7-setores{display:flex;gap:6px;margin-top:12px;}
      .g7-setor{flex:1;background:rgba(244,241,234,.05);border-radius:6px;padding:6px 8px;text-align:center;}
      .g7-setor label{font-family:var(--font-mono);font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:rgba(244,241,234,.5);display:block;}
      .g7-setor span{font-family:var(--font-mono);font-weight:700;font-size:15px;}

      /* ── dado e ajuda ── */
      .g7-dice{width:100%;padding:20px;font-size:16px;font-family:var(--font-display);letter-spacing:.04em;
        text-transform:uppercase;border:none;border-radius:12px;color:#fff;cursor:pointer;
        background:linear-gradient(135deg,#0288d1,#01579b);transition:filter .15s;}
      .g7-dice:disabled{filter:grayscale(.6) brightness(.6);cursor:not-allowed;}
      .g7-ajuda{width:100%;margin-top:8px;padding:9px;font-family:var(--font-mono);font-size:12px;
        border:1px dashed rgba(242,193,78,.6);border-radius:8px;background:transparent;color:var(--gold);cursor:pointer;}
      .g7-ajuda:disabled{opacity:.3;cursor:not-allowed;}

      /* ── lista de jogadores ── */
      .g7-prow{padding:9px 12px;border-bottom:1px solid rgba(244,241,234,.07);display:flex;
        justify-content:space-between;align-items:center;transition:background .12s;}
      .g7-prow.livre:hover{background:rgba(242,193,78,.08);}
      .g7-ptag{font-family:var(--font-mono);font-size:10px;padding:1px 5px;border-radius:4px;color:#06090f;font-weight:700;}

      /* ── scoreboard ── */
      .g7-sb{font-family:var(--font-mono);background:var(--ink);border:1px solid rgba(244,241,234,.15);border-radius:12px;padding:18px;text-align:center;margin-bottom:16px;}
      .g7-sb .fase{color:var(--gold);letter-spacing:.15em;font-size:11px;text-transform:uppercase;}
      .g7-sb .placar{font-size:clamp(34px,8vw,52px);font-weight:700;margin:4px 0;}
      .g7-sb .rival{color:rgba(244,241,234,.7);font-size:13px;}

      /* ── linha do tempo ── */
      .g7-tl{position:relative;height:24px;margin-top:10px;background:rgba(244,241,234,.07);border-radius:999px;overflow:hidden;}
      .g7-tl-prog{position:absolute;left:0;top:0;height:100%;background:linear-gradient(90deg,rgba(242,193,78,.3),rgba(242,193,78,.1));border-radius:999px;transition:width .4s ease;}
      .g7-tl-bola{position:absolute;top:50%;width:13px;height:13px;border-radius:50%;background:var(--gold);transform:translate(-50%,-50%);transition:left .4s ease;box-shadow:0 0 8px rgba(242,193,78,.7);}
      .g7-tl-dot{position:absolute;top:50%;width:8px;height:8px;border-radius:50%;transform:translate(-50%,-50%);border:2px solid var(--ink);}
      .g7-tl-dot.eu{background:var(--gold);} .g7-tl-dot.adv{background:var(--crimson);}

      /* ── gol flash ── */
      .g7-gf{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:9999;}
      .g7-gf span{font-family:var(--font-display);text-transform:uppercase;letter-spacing:.04em;animation:gfpop 1.2s ease forwards;text-shadow:0 0 30px rgba(0,0,0,.6);}
      .g7-gf.eu span{color:var(--gold);font-size:clamp(42px,13vw,96px);}
      .g7-gf.adv span{color:var(--crimson);font-size:clamp(28px,8vw,54px);}
      @keyframes gfpop{0%{opacity:0;transform:scale(.4) rotate(-4deg);}15%{opacity:1;transform:scale(1.08) rotate(1deg);}30%{transform:scale(1);}75%{opacity:1;}100%{opacity:0;transform:scale(1.04);}}

      /* ── ação (botão pulsante) ── */
      .g7-acwrap{text-align:center;margin:16px 0;}
      .g7-ac{font-family:var(--font-display);text-transform:uppercase;letter-spacing:.03em;font-size:16px;
        padding:15px 28px;border-radius:10px;border:none;cursor:pointer;color:#1a1300;
        background:linear-gradient(135deg,var(--gold),#ffe17a);animation:gpulse 1.5s ease-in-out infinite;}
      @keyframes gpulse{0%,100%{box-shadow:0 0 0 0 rgba(242,193,78,.5);}50%{box-shadow:0 0 0 10px rgba(242,193,78,0);}}

      /* ── log ── */
      .g7-log{background:var(--ink);border-radius:10px;padding:16px;max-height:360px;overflow-y:auto;}
      .g7-logline{margin:0 0 10px;padding-left:14px;border-left:2px solid rgba(244,241,234,.2);font-size:14px;animation:gfade .3s ease;}
      .g7-logline.bom{border-left-color:#6fd17a;color:#b9f3bf;} .g7-logline.mau{border-left-color:var(--crimson);color:#ffb3bb;}
      .g7-logline.meio{border-left-color:var(--gold);color:#ffe6ad;}
      .g7-logline.titulo{border-left-color:var(--gold);font-family:var(--font-display);text-transform:uppercase;letter-spacing:.04em;color:var(--gold);}
      @keyframes gfade{from{opacity:0;transform:translateY(5px);}to{opacity:1;transform:translateY(0);}}

      /* ── tabela ── */
      .g7-tab{width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:12px;}
      .g7-tab th,.g7-tab td{padding:5px 7px;text-align:center;border-bottom:1px solid rgba(244,241,234,.07);}
      .g7-tab th{color:var(--gold);text-transform:uppercase;font-size:10px;}
      .g7-tab td:first-child,.g7-tab th:first-child{text-align:left;}
      .g7-tab tr.eu{background:rgba(242,193,78,.08);font-weight:700;}
      .g7-tab tr.corte td{border-bottom:2px dashed rgba(244,241,234,.25);}

      /* ── resultado final ── */
      .g7-fin{text-align:center;padding:36px 20px;border-radius:16px;font-family:var(--font-display);text-transform:uppercase;}
      .g7-fin.campeao{background:radial-gradient(circle at top,rgba(242,193,78,.22),transparent);border:1px solid var(--gold);}
      .g7-fin.eliminado{background:rgba(215,38,61,.07);border:1px solid rgba(215,38,61,.4);}

      .g7-reset{font-family:var(--font-mono);font-size:13px;background:transparent;border:1px solid rgba(244,241,234,.3);
        color:var(--chalk);padding:9px 17px;border-radius:8px;cursor:pointer;margin-top:16px;}
      .g7-reset:hover{border-color:var(--gold);color:var(--gold);}

      .g7-velrow{display:flex;gap:6px;justify-content:center;margin-bottom:12px;}
      .g7-vbtn{font-family:var(--font-mono);font-size:11px;padding:5px 12px;border-radius:999px;
        border:1px solid rgba(244,241,234,.2);background:transparent;color:rgba(244,241,234,.6);cursor:pointer;}
      .g7-vbtn.on{background:rgba(242,193,78,.15);border-color:var(--gold);color:var(--gold);font-weight:700;}

      @keyframes gpop{from{opacity:0;transform:translate(-50%,-30%) scale(.6);}to{opacity:1;transform:translate(-50%,-50%) scale(1);}}
      .g7-flip{animation:gflip .09s linear infinite;}
      @keyframes gflip{from{opacity:.4;}to{opacity:1;}}

      @media(max-width:880px){.g7-draftgrid{flex-direction:column!important;} .g7-dicecol{width:100%!important;}}
      @media(prefers-reduced-motion:reduce){.g7-slot,.g7-logline,.g7-ac{animation:none!important;}}
    `}</style>

    {/* gol flash global */}
    {golFlash && (
      <div className={`g7-gf ${golFlash.lado}`} key={golFlash.key}>
        <span>{golFlash.lado==='eu' ? '⚽ GOOOOL!' : `⚠️ GOL ${golFlash.nome}`}</span>
      </div>
    )}

    <div className="g7">
      <p className="g7-eyebrow">Draft &amp; Simulação</p>
      <h1 className="g7-h1">Desafio 7×0 — Copa 2026</h1>
      <p className="g7-sub">Monte sua seleção dos sonhos com craques das 48 seleções e tente vencer a Copa do Mundo.</p>

      {carregando && <p style={{textAlign:'center',marginTop:40,color:'rgba(244,241,234,.6)'}}>Carregando seleções...</p>}

      {/* ── tela de formação ── */}
      {!carregando && step==='formacao' && (
        <div style={{marginTop:36}}>
          <div style={{textAlign:'center',marginBottom:26}}>
            <input className="g7-input" placeholder="Nome da sua seleção (opcional)" value={nomeTime}
              onChange={e=>setNomeTime(e.target.value)} maxLength={24}/>
          </div>

          <p style={{textAlign:'center',fontFamily:'var(--font-mono)',fontSize:12,letterSpacing:'.1em',
            color:'rgba(244,241,234,.5)',textTransform:'uppercase',marginBottom:10}}>Modo de jogo</p>
          <div className="g7-pills" style={{marginBottom:28}}>
            <button className={`g7-pill ${modo==='classico'?'on':''}`} onClick={()=>setModo('classico')}>Clássico · notas visíveis</button>
            <button className={`g7-pill ${modo==='almanaque'?'on':''}`} onClick={()=>setModo('almanaque')}>Almanaque · na memória</button>
          </div>

          <p style={{textAlign:'center',fontFamily:'var(--font-mono)',fontSize:12,letterSpacing:'.1em',
            color:'rgba(244,241,234,.5)',textTransform:'uppercase',marginBottom:10}}>Velocidade da simulação</p>
          <div className="g7-pills" style={{marginBottom:32}}>
            <button className={`g7-pill ${velocidade==='normal'?'on':''}`} onClick={()=>setVelocidade('normal')}>🐢 Normal</button>
            <button className={`g7-pill ${velocidade==='rapida'?'on':''}`} onClick={()=>setVelocidade('rapida')}>⚡ Rápida</button>
          </div>

          <p style={{textAlign:'center',fontFamily:'var(--font-mono)',fontSize:12,letterSpacing:'.1em',
            color:'rgba(244,241,234,.5)',textTransform:'uppercase',marginBottom:16}}>Escolha a formação tática</p>
          <div className="g7-pills">
            {Object.keys(FORMACOES).map(k=>(
              <button key={k} className="g7-formbtn" onClick={()=>iniciarDraft(k)}>{k}</button>
            ))}
          </div>
        </div>
      )}

      {/* ── tela de draft ── */}
      {!carregando && step==='draft' && (
        <div className="g7-draftgrid" style={{display:'flex',gap:22,marginTop:28,alignItems:'flex-start'}}>

          {/* campo / lineup */}
          <div style={{flex:1,minWidth:0}}>
            <div className="g7-card" style={{padding:16}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:10}}>
                <h3 style={{fontFamily:'var(--font-display)',textTransform:'uppercase',margin:0,fontSize:'clamp(14px,3vw,18px)'}}>
                  {nomeTime.trim()||'Sua Seleção'} ({myTeam.length}/11)
                </h3>
                <span style={{fontFamily:'var(--font-mono)',color:'var(--gold)',fontSize:20,fontWeight:700}}>
                  {mostrarOVR ? forcaAtual : '❔'}
                </span>
              </div>

              {myTeam.length===11 && modo==='almanaque' && (
                <p style={{textAlign:'center',color:'var(--gold)',fontFamily:'var(--font-mono)',fontSize:12,marginBottom:8}}>
                  ✨ Elenco fechado — os overalls estão revelados!
                </p>
              )}

              {/* toggle campo/lista (só aparece no mobile via CSS) */}
              <div className="g7-viewtoggle">
                <button className={`g7-vtbtn ${viewMobile==='campo'?'on':''}`} onClick={()=>setViewMobile('campo')}>🏟️ Campo</button>
                <button className={`g7-vtbtn ${viewMobile==='lista'?'on':''}`} onClick={()=>setViewMobile('lista')}>📋 Lista</button>
              </div>

              {/* campo tático — esconde no mobile quando modo lista */}
              <div style={{display: viewMobile==='lista' ? 'none' : 'block'}}
                className="g7-pitch-wrapper">
                <style>{`@media(max-width:640px){.g7-pitch-wrapper.lista-hide{display:none!important;}}`}</style>
                <div className="g7-pitch">
                  {slots.map((slot,i)=>(
                    <div key={i} className="g7-slot" style={{left:`${slot.x}%`,top:`${slot.y}%`}}>
                      {slot.jogador ? (
                        <div className="g7-chip" style={{borderColor:POSICAO_COR[slot.cat]}}>
                          <strong>{slot.jogador.name}</strong>
                          <span className="ovr" style={{color:POSICAO_COR[slot.cat]}}>
                            {mostrarOVR ? `⭐${slot.jogador.overall}` : '🔒'}
                          </span>
                        </div>
                      ) : (
                        <div className="g7-slot-empty" title={POSICAO_LABEL[slot.cat]}/>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* lineup lista — visível no mobile quando modo lista */}
              {viewMobile==='lista' && (
                <div className="g7-lineup" style={{}}>
                  {gruposMobile.map(g=>(
                    <div key={g.cat} className="g7-lineup-cat" style={{background:'rgba(255,255,255,.03)'}}>
                      <div className="g7-lineup-head" style={{background:g.cor+'22',color:g.cor}}>
                        {g.label} ({g.jogadores.length}/{g.vagas})
                      </div>
                      {g.jogadores.map((p,i)=>(
                        <div key={i} className="g7-lineup-row">
                          <span style={{fontSize:13,fontWeight:600}}>{p.name}</span>
                          <span style={{fontFamily:'var(--font-mono)',color:g.cor,fontWeight:700}}>
                            {mostrarOVR ? `⭐${p.overall}` : '🔒'}
                          </span>
                        </div>
                      ))}
                      {Array.from({length: g.vagas - g.jogadores.length}).map((_,i)=>(
                        <div key={`v${i}`} className="g7-lineup-vazio">— vaga aberta</div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* setores */}
              {myTeam.length>0 && (
                <div className="g7-setores">
                  {[{l:'🛡️ DEF',v:setores.defesa,c:'#5FA8D3'},{l:'⚙️ MEI',v:setores.meio,c:'#8AD68A'},{l:'⚔️ ATQ',v:setores.ataque,c:'#D7263D'}].map(s=>(
                    <div key={s.l} className="g7-setor">
                      <label>{s.l}</label>
                      <span style={{color: mostrarOVR ? s.c : 'rgba(244,241,234,.3)'}}>
                        {mostrarOVR ? s.v : '?'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {myTeam.length===11 && (
                <button className="g7-dice" style={{marginTop:16,background:'linear-gradient(135deg,var(--gold),#c9941f)',color:'#1a1300'}}
                  onClick={rodarSimulacao}>🚀 Iniciar a Copa do Mundo</button>
              )}
            </div>
          </div>

          {/* painel de sorteio */}
          <div className="g7-dicecol" style={{width:350,flexShrink:0}}>
            <div className="g7-card" style={{padding:16,textAlign:'center'}}>
              {myTeam.length<11 && (
                <p style={{fontFamily:'var(--font-mono)',fontSize:11,color:'rgba(244,241,234,.55)',marginBottom:8}}>
                  Sorteio {Math.min(rodadaAtual+1,11)}/11 · {tierLabel}
                </p>
              )}
              <button className="g7-dice" onClick={rolarDado}
                disabled={isRolling||myTeam.length>=11||currentRolledTeam!==null}>
                {isRolling?'🎰 Sorteando...':currentRolledTeam?'👇 Escolha 1 atleta':'🎲 Rolar o dado'}
              </button>

              {currentRolledTeam && (
                <div style={{marginTop:14,padding:12,background:'var(--ink)',borderRadius:10,textAlign:'left'}}>
                  <div style={{textAlign:'center',marginBottom:8}}>
                    {currentRolledTeam.badge_url && (
                      <img src={currentRolledTeam.badge_url} alt="" width={38} height={38} className={isRolling?'g7-flip':''}/>
                    )}
                    <h2 style={{color:'var(--gold)',fontFamily:'var(--font-display)',margin:'5px 0 0',fontSize:'clamp(16px,4vw,22px)'}}>
                      {currentRolledTeam.name}
                    </h2>
                    {!isRolling && <p style={{color:'rgba(244,241,234,.5)',fontSize:11,fontFamily:'var(--font-mono)',margin:'2px 0 0'}}>
                      Força {forcaPorTime[currentRolledTeam.id]||'?'}
                    </p>}
                  </div>

                  {!isRolling && !ajudaUsada && (
                    <button className="g7-ajuda" onClick={usarAjuda}>
                      🔁 Não gostei — sortear outra (vale 1× no jogo)
                    </button>
                  )}
                  {ajudaUsada && !isRolling && (
                    <p style={{textAlign:'center',fontSize:11,color:'rgba(244,241,234,.4)',fontFamily:'var(--font-mono)',marginTop:4}}>
                      ajuda já utilizada
                    </p>
                  )}

                  <div style={{maxHeight:300,overflowY:'auto',marginTop:10}}>
                    {availablePlayers.map(p=>{
                      const cat = classificarPosicao(p.position);
                      const livre = verificarVaga(p.position);
                      return (
                        <div key={p.id} className={`g7-prow ${livre?'livre':''}`}
                          onClick={()=>livre&&selecionarJogador(p)}
                          style={{cursor:livre?'pointer':'not-allowed',opacity:livre?1:.3}}>
                          <div>
                            <strong style={{display:'block',fontSize:13}}>{p.name}</strong>
                            <span className="g7-ptag" style={{background:POSICAO_COR[cat]}}>{cat}</span>
                          </div>
                          <span style={{fontFamily:'var(--font-mono)',fontWeight:700,color:'var(--gold)'}}>
                            {modo==='almanaque' ? '🔒' : p.overall}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <button className="g7-reset" onClick={reiniciar}>← trocar formação</button>
          </div>

        </div>
      )}

      {/* ── tela de simulação ── */}
      {step==='simulacao' && (
        <div style={{maxWidth:640,margin:'28px auto 0'}}>
          <div className="g7-velrow">
            <button className={`g7-vbtn ${velocidade==='normal'?'on':''}`} onClick={()=>setVelocidade('normal')}>🐢 Normal</button>
            <button className={`g7-vbtn ${velocidade==='rapida'?'on':''}`} onClick={()=>setVelocidade('rapida')}>⚡ Rápida</button>
          </div>

          {grupoAtual && (
            <p style={{textAlign:'center',fontFamily:'var(--font-mono)',letterSpacing:'.15em',
              textTransform:'uppercase',color:'var(--gold)',fontSize:12,marginBottom:12}}>
              Grupo {grupoAtual.letra}
            </p>
          )}

          {scoreboard && (
            <div className="g7-sb">
              <p className="fase">{scoreboard.fase} · rival forca {scoreboard.forcaAdv}</p>
              <p className="placar">{scoreboard.nosso} × {scoreboard.deles}</p>
              <p className="rival">vs {scoreboard.rival}</p>
              <div className="g7-tl">
                <div className="g7-tl-prog" style={{width:`${(minutoAtual/90)*100}%`}}/>
                {eventosPartida.filter(ev=>ev.min<=minutoAtual).map((ev,i)=>(
                  <div key={i} className={`g7-tl-dot ${ev.lado}`} style={{left:`${(ev.min/90)*100}%`}} title={`${ev.min}'`}/>
                ))}
                <div className="g7-tl-bola" style={{left:`${(minutoAtual/90)*100}%`}}/>
              </div>
            </div>
          )}

          {esperandoAcao && (
            <div className="g7-acwrap">
              <button className="g7-ac" onClick={clicarAcao}>{esperandoAcao}</button>
            </div>
          )}

          {tabelaGrupo && (
            <div className="g7-card" style={{padding:14,marginBottom:16}}>
              <table className="g7-tab">
                <thead><tr>
                  <th>Seleção</th><th>P</th><th>J</th><th>V</th><th>E</th><th>D</th><th>GP</th><th>GC</th><th>SG</th>
                </tr></thead>
                <tbody>
                  {tabelaGrupo.map((t,i)=>(
                    <tr key={t.id} className={`${t.souEu?'eu':''} ${i===1?'corte':''}`}>
                      <td>{t.souEu?`👉 ${t.nome}`:t.nome}</td>
                      <td>{t.pontos}</td><td>{t.j}</td><td>{t.v}</td><td>{t.e}</td><td>{t.d}</td>
                      <td>{t.gp}</td><td>{t.gc}</td><td>{t.gp-t.gc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="g7-card" style={{padding:4}}>
            <div className="g7-log" ref={logRef}>
              {logsSimulacao.map(l=>(
                <p key={l.key} className={`g7-logline ${l.tipo}`}>{l.texto}</p>
              ))}
            </div>
          </div>

          {resultadoFinal && (
            <div className={`g7-fin ${resultadoFinal.status}`} style={{marginTop:16}}>
              <h2 style={{fontSize:26,margin:0,color:resultadoFinal.status==='campeao'?'var(--gold)':'#ff8a93'}}>
                {resultadoFinal.status==='campeao'?'🏆 Campeão do Mundo!':`Eliminado · ${resultadoFinal.fase}`}
              </h2>
              <p style={{fontFamily:'var(--font-body)',textTransform:'none',color:'rgba(244,241,234,.65)',marginTop:6}}>
                OVR {forcaAtual} · DEF {setores.defesa} · MEI {setores.meio} · ATQ {setores.ataque}
              </p>
            </div>
          )}

          {resultadoFinal && (
            <div style={{textAlign:'center'}}>
              <button className="g7-reset" onClick={reiniciar}>🔄 Novo Draft</button>
            </div>
          )}
        </div>
      )}
    </div>
    </div>
  );
}
