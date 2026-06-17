'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Ajuste aqui se o competition_id da Copa do Mundo 2026 no seu banco for outro.
const COMPETITION_ID_COPA = 7;

const FORMACOES = {
  '4-3-3': { nome: '4-3-3', GOL: 1, DEF: 4, MEI: 3, ATA: 3 },
  '4-4-2': { nome: '4-4-2', GOL: 1, DEF: 4, MEI: 4, ATA: 2 },
  '4-2-3-1': { nome: '4-2-3-1', GOL: 1, DEF: 4, MEI: 5, ATA: 1 },
  '5-3-2': { nome: '5-3-2', GOL: 1, DEF: 5, MEI: 3, ATA: 2 },
};

// Os 12 grupos reais do sorteio da Copa de 2026 — usados pra te jogar
// num grupo de verdade quando a simulação começa.
const GRUPOS_COPA = {
  A: ['Mexico', 'South Africa', 'South Korea', 'Czech Republic'],
  B: ['Canada', 'Bosnia & Herzegovina', 'Qatar', 'Switzerland'],
  C: ['Brazil', 'Morocco', 'Haiti', 'Scotland'],
  D: ['USA', 'Paraguay', 'Australia', 'Türkiye'],
  E: ['Germany', 'Curaçao', 'Ivory Coast', 'Ecuador'],
  F: ['Netherlands', 'Japan', 'Tunisia', 'Sweden'],
  G: ['Belgium', 'Egypt', 'Iran', 'New Zealand'],
  H: ['Spain', 'Cape Verde Islands', 'Saudi Arabia', 'Uruguay'],
  I: ['France', 'Senegal', 'Norway', 'Iraq'],
  J: ['Argentina', 'Algeria', 'Austria', 'Jordan'],
  K: ['Portugal', 'Uzbekistan', 'Colombia', 'Congo DR'],
  L: ['England', 'Croatia', 'Ghana', 'Panama'],
};

const SELECOES_COPA = Object.values(GRUPOS_COPA).flat();

const POSICAO_LABEL = { GOL: 'Goleiro', DEF: 'Zagueiro/Lateral', MEI: 'Meio-campo', ATA: 'Atacante' };
const POSICAO_COR = { GOL: '#F2C14E', DEF: '#5FA8D3', MEI: '#8AD68A', ATA: '#D7263D' };
const ORDEM_POSICAO = { GOL: 0, DEF: 1, MEI: 2, ATA: 3 };

const TIER_LABEL = {
  top: '🔥 Seleção de nível Top',
  medio: '⚖️ Seleção de nível Médio/Bom',
  baixo: '🌱 Seleção de nível Médio/Fraco',
};

const FASES_MATA_MATA = [
  { fase: '16-avos de Final', fator: 0.9 },
  { fase: 'Oitavas de Final', fator: 0.65 },
  { fase: 'Quartas de Final', fator: 0.45 },
  { fase: 'Semifinal', fator: 0.3 },
  { fase: 'GRANDE FINAL', fator: 0.12 },
];

// ---------- helpers de simulação ----------

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

function classificarPosicao(posBanco) {
  const mapa = { Goalkeeper: 'GOL', Defender: 'DEF', Midfielder: 'MEI', Attacker: 'ATA' };
  return mapa[posBanco] || 'OUTRO';
}

function embaralhar(lista) {
  return [...lista].sort(() => Math.random() - 0.5);
}

// Amostra um número de gols seguindo distribuição de Poisson — a mesma
// matemática usada pra modelar gols no futebol de verdade.
function poisson(lambda) {
  const media = Math.max(0, lambda);
  const L = Math.exp(-media);
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

// "Dia de jogo": variação aleatória de forma que dá chance de zebra —
// uma seleção 81 pode jogar acima da média e superar uma 83.
function variarForma(forca) {
  return forca + (Math.random() * 14 - 7);
}

// Força de uma seleção real = média de overall dos 11 melhores jogadores dela.
function calcularForcaSelecao(jogadoresDoTime) {
  if (!jogadoresDoTime || jogadoresDoTime.length === 0) return 70;
  const top11 = [...jogadoresDoTime].sort((a, b) => b.overall - a.overall).slice(0, 11);
  return Math.round(top11.reduce((acc, p) => acc + p.overall, 0) / top11.length);
}

// Divide as 48 seleções em 3 níveis de força pra alimentar o sorteio do draft.
function definirTiers(times, forcaPorTime) {
  const ordenados = [...times].sort((a, b) => (forcaPorTime[b.id] || 70) - (forcaPorTime[a.id] || 70));
  const tercio = Math.ceil(ordenados.length / 3);
  return {
    top: ordenados.slice(0, tercio),
    medio: ordenados.slice(tercio, tercio * 2),
    baixo: ordenados.slice(tercio * 2),
  };
}

// Plano dos 11 sorteios do draft: 5 seleções top, 3 médio/boas, 3 médio/ruins.
function gerarPlanoSorteio() {
  return embaralhar([...Array(5).fill('top'), ...Array(3).fill('medio'), ...Array(3).fill('baixo')]);
}

// Sorteia um adversário real entre os times restantes, dando peso aos mais
// fortes conforme a fase avança — sem repetir quem você já enfrentou.
function sortearAdversario(restantes, forcaPorTime, fator) {
  const ordenados = [...restantes].sort((a, b) => (forcaPorTime[b.id] || 70) - (forcaPorTime[a.id] || 70));
  const tamanhoPool = Math.max(1, Math.round(ordenados.length * fator));
  const pool = ordenados.slice(0, tamanhoPool);
  return pool[Math.floor(Math.random() * pool.length)];
}

// Sorteia os minutos dos gols de cada lado e devolve a lista em ordem cronológica.
function gerarEventosGols(qtdEu, qtdAdv) {
  const eventos = [];
  for (let i = 0; i < qtdEu; i += 1) eventos.push({ minuto: Math.floor(Math.random() * 90) + 1, lado: 'eu' });
  for (let i = 0; i < qtdAdv; i += 1) eventos.push({ minuto: Math.floor(Math.random() * 90) + 1, lado: 'adv' });
  return eventos.sort((a, b) => a.minuto - b.minuto);
}

// Gera as coordenadas (x%, y%) de cada posição dentro do campo, de acordo
// com a formação escolhida — é o que monta o desenho da escalação.
function gerarSlotsCampo(formacao) {
  const slots = [{ cat: 'GOL', x: 50, y: 91 }];
  for (let i = 0; i < formacao.DEF; i += 1) {
    slots.push({ cat: 'DEF', x: ((i + 1) / (formacao.DEF + 1)) * 100, y: 71 });
  }
  if (formacao.MEI <= 3) {
    for (let i = 0; i < formacao.MEI; i += 1) {
      slots.push({ cat: 'MEI', x: ((i + 1) / (formacao.MEI + 1)) * 100, y: 47 });
    }
  } else {
    const linhaFundo = Math.ceil(formacao.MEI / 2);
    const linhaFrente = formacao.MEI - linhaFundo;
    for (let i = 0; i < linhaFundo; i += 1) {
      slots.push({ cat: 'MEI', x: ((i + 1) / (linhaFundo + 1)) * 100, y: 55 });
    }
    for (let i = 0; i < linhaFrente; i += 1) {
      slots.push({ cat: 'MEI', x: ((i + 1) / (linhaFrente + 1)) * 100, y: 35 });
    }
  }
  for (let i = 0; i < formacao.ATA; i += 1) {
    slots.push({ cat: 'ATA', x: ((i + 1) / (formacao.ATA + 1)) * 100, y: 13 });
  }
  return slots;
}

export default function Game7x0() {
  const [step, setStep] = useState('formacao');
  const [modo, setModo] = useState('classico'); // 'classico' | 'almanaque'
  const [nomeTime, setNomeTime] = useState('');
  const [formacaoKey, setFormacaoKey] = useState(null);
  const [myTeam, setMyTeam] = useState([]);

  const [allTeams, setAllTeams] = useState([]);
  const [forcaPorTime, setForcaPorTime] = useState({});
  const [tiers, setTiers] = useState({ top: [], medio: [], baixo: [] });
  const [carregando, setCarregando] = useState(true);

  const [planoSorteio, setPlanoSorteio] = useState([]);
  const [rodadaAtual, setRodadaAtual] = useState(0);
  const [ajudaUsada, setAjudaUsada] = useState(false);

  const [currentRolledTeam, setCurrentRolledTeam] = useState(null);
  const [availablePlayers, setAvailablePlayers] = useState([]);
  const [isRolling, setIsRolling] = useState(false);

  const [logsSimulacao, setLogsSimulacao] = useState([]);
  const [grupoAtual, setGrupoAtual] = useState(null);
  const [tabelaGrupo, setTabelaGrupo] = useState(null);
  const [scoreboard, setScoreboard] = useState(null);
  const [resultadoFinal, setResultadoFinal] = useState(null);
  const [esperandoAcao, setEsperandoAcao] = useState(null);
  const logRef = useRef(null);
  const cliqueResolverRef = useRef(null);

  const formacao = formacaoKey ? FORMACOES[formacaoKey] : null;

  useEffect(() => {
    async function loadInitialData() {
      const { data: selecoes } = await supabase
        .from('teams')
        .select('id, name, badge_url, flag_code')
        .in('name', SELECOES_COPA);

      const times = selecoes || [];
      setAllTeams(times);

      if (times.length > 0) {
        const { data: jogadores } = await supabase
          .from('players')
          .select('team_id, overall')
          .eq('competition_id', COMPETITION_ID_COPA)
          .in('team_id', times.map((t) => t.id));

        const forcas = {};
        times.forEach((t) => {
          const doTime = (jogadores || []).filter((j) => j.team_id === t.id);
          forcas[t.id] = calcularForcaSelecao(doTime);
        });
        setForcaPorTime(forcas);
        setTiers(definirTiers(times, forcas));
      }
      setCarregando(false);
    }
    loadInitialData();
  }, []);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logsSimulacao]);

  const iniciarDraft = (key) => {
    setFormacaoKey(key);
    setMyTeam([]);
    setPlanoSorteio(gerarPlanoSorteio());
    setRodadaAtual(0);
    setAjudaUsada(false);
    setStep('draft');
  };

  const verificarVagaDisponivel = (playerPos) => {
    if (!formacao) return false;
    const cat = classificarPosicao(playerPos);
    if (cat === 'OUTRO') return false;
    const ocupadas = myTeam.filter((p) => classificarPosicao(p.position) === cat).length;
    return ocupadas < formacao[cat];
  };

  const finalizarRolagem = async (teamSelected) => {
    const { data: players } = await supabase
      .from('players')
      .select('id, name, position, overall, photo_url')
      .eq('team_id', teamSelected.id)
      .eq('competition_id', COMPETITION_ID_COPA);

    const ordenados = (players || []).slice().sort((a, b) => {
      const pa = ORDEM_POSICAO[classificarPosicao(a.position)] ?? 9;
      const pb = ORDEM_POSICAO[classificarPosicao(b.position)] ?? 9;
      if (pa !== pb) return pa - pb;
      return b.overall - a.overall;
    });

    setAvailablePlayers(ordenados);
    setIsRolling(false);
  };

  const poolDaRodada = () => {
    const tierAtual = planoSorteio[rodadaAtual];
    const pool = tiers[tierAtual];
    return pool && pool.length > 0 ? pool : allTeams;
  };

  const rolarDado = () => {
    if (isRolling || currentRolledTeam || allTeams.length === 0 || rodadaAtual >= 11) return;
    const pool = poolDaRodada();
    setIsRolling(true);
    setAvailablePlayers([]);

    let voltas = 0;
    const interval = setInterval(() => {
      const sorteado = pool[Math.floor(Math.random() * pool.length)];
      setCurrentRolledTeam(sorteado);
      voltas += 1;
      if (voltas > 14) {
        clearInterval(interval);
        finalizarRolagem(sorteado);
      }
    }, 90);
  };

  // Ajuda de uma vez só: não gostou da seleção sorteada, troca por outra do mesmo nível.
  const usarAjudaSorteio = () => {
    if (ajudaUsada || isRolling || !currentRolledTeam) return;
    setAjudaUsada(true);
    const poolBase = poolDaRodada();
    const pool = poolBase.filter((t) => t.id !== currentRolledTeam.id);
    const poolFinal = pool.length > 0 ? pool : poolBase;

    setIsRolling(true);
    setAvailablePlayers([]);
    setCurrentRolledTeam(null);

    let voltas = 0;
    const interval = setInterval(() => {
      const sorteado = poolFinal[Math.floor(Math.random() * poolFinal.length)];
      setCurrentRolledTeam(sorteado);
      voltas += 1;
      if (voltas > 14) {
        clearInterval(interval);
        finalizarRolagem(sorteado);
      }
    }, 90);
  };

  const selecionarJogador = (player) => {
    if (myTeam.length >= 11) return;
    if (myTeam.some((p) => p.id === player.id)) return;
    if (!verificarVagaDisponivel(player.position)) return;

    setMyTeam([...myTeam, { ...player, selectionName: currentRolledTeam.name }]);
    setRodadaAtual((prev) => prev + 1);
    setCurrentRolledTeam(null);
    setAvailablePlayers([]);
  };

  const calcularForcaTime = (time = myTeam) => {
    if (time.length === 0) return 0;
    return Math.round(time.reduce((acc, p) => acc + p.overall, 0) / time.length);
  };

  const calcularAtaqueDefesa = () => {
    const atas = myTeam.filter((p) => classificarPosicao(p.position) === 'ATA');
    const defs = myTeam.filter((p) => ['GOL', 'DEF'].includes(classificarPosicao(p.position)));
    const media = (arr) =>
      arr.length ? Math.round(arr.reduce((a, p) => a + p.overall, 0) / arr.length) : calcularForcaTime();
    return { ataque: media(atas), defesa: media(defs) };
  };

  const addLog = async (texto, tipo = 'normal') => {
    setLogsSimulacao((prev) => [...prev, { texto, tipo, key: prev.length }]);
    await delay(550);
  };

  // Pausa a simulação até o usuário clicar no botão de ação exibido na tela.
  const aguardarClique = (label) =>
    new Promise((resolve) => {
      cliqueResolverRef.current = resolve;
      setEsperandoAcao(label);
    });

  const clicarAcao = () => {
    const resolver = cliqueResolverRef.current;
    cliqueResolverRef.current = null;
    setEsperandoAcao(null);
    if (resolver) resolver();
  };

  // Joga uma partida sua, minuto a minuto, com placar atualizando em tempo real.
  const jogarPartidaUsuario = async ({ faseLabel, rival, ataque, defesa, nomeExibido }) => {
    const forcaAdv = forcaPorTime[rival.id] || 78;
    const ataqueHoje = variarForma(ataque);
    const defesaHoje = variarForma(defesa);
    const advHoje = variarForma(forcaAdv);
    const mediaEu = Math.max(0.15, 1.4 + (ataqueHoje - advHoje) * 0.08);
    const mediaAdv = Math.max(0.15, 1.4 + (advHoje - defesaHoje) * 0.08);
    const golsEu = poisson(mediaEu);
    const golsAdv = poisson(mediaAdv);
    const eventos = gerarEventosGols(golsEu, golsAdv);

    setScoreboard({ fase: faseLabel, nosso: 0, deles: 0, rival: rival.name, badge: rival.badge_url });
    await addLog(`🏁 Bola rolando: ${nomeExibido} x ${rival.name} (força ${forcaAdv})`, 'titulo');

    let placarEu = 0;
    let placarAdv = 0;
    if (eventos.length === 0) await delay(700);
    for (const ev of eventos) {
      await delay(650);
      if (ev.lado === 'eu') placarEu += 1;
      else placarAdv += 1;
      setScoreboard((prev) => ({ ...prev, nosso: placarEu, deles: placarAdv }));
      await addLog(
        `⚽ ${ev.minuto}' GOL! ${ev.lado === 'eu' ? nomeExibido : rival.name} (${placarEu}-${placarAdv})`,
        ev.lado === 'eu' ? 'bom' : 'mau'
      );
    }
    await addLog(
      `📣 Apito final: ${nomeExibido} ${golsEu} x ${golsAdv} ${rival.name}`,
      golsEu > golsAdv ? 'bom' : golsEu === golsAdv ? 'meio' : 'mau'
    );
    return { golsEu, golsAdv };
  };

  // Disputa de pênaltis, cobrança por cobrança, com early-stop e prorrogação (sudden death).
  const simularPenaltis = async ({ nomeEu, nomeAdv, forcaEuChute, forcaAdvChute }) => {
    let golsEu = 0;
    let golsAdv = 0;
    let rodada = 0;
    const euPrimeiro = Math.random() < 0.5;
    await addLog('🥅 Foi para os pênaltis! Apito longo do juiz.', 'titulo');

    // eslint-disable-next-line no-constant-condition
    while (true) {
      rodada += 1;
      const ordem = euPrimeiro ? ['eu', 'adv'] : ['adv', 'eu'];
      for (const lado of ordem) {
        const forcaChutador = lado === 'eu' ? forcaEuChute : forcaAdvChute;
        const prob = Math.min(0.92, Math.max(0.55, 0.74 + (forcaChutador - 80) * 0.003));
        const converteu = Math.random() < prob;
        if (lado === 'eu') golsEu += converteu ? 1 : 0;
        else golsAdv += converteu ? 1 : 0;
        const nome = lado === 'eu' ? nomeEu : nomeAdv;
        await addLog(
          `${converteu ? '⚽' : '❌'} Cobrança ${rodada}: ${nome} ${converteu ? 'converte!' : 'desperdiça!'} (${golsEu}-${golsAdv})`,
          converteu ? (lado === 'eu' ? 'bom' : 'mau') : lado === 'eu' ? 'mau' : 'bom'
        );
      }
      if (rodada >= 5) {
        if (golsEu !== golsAdv) break;
      } else if (Math.abs(golsEu - golsAdv) > 5 - rodada) {
        break;
      }
    }

    const venceuEu = golsEu > golsAdv;
    await addLog(`🚨 ${venceuEu ? nomeEu : nomeAdv} vence a disputa de pênaltis por ${Math.max(golsEu, golsAdv)} a ${Math.min(golsEu, golsAdv)}!`, venceuEu ? 'bom' : 'mau');
    return venceuEu;
  };

  // Jogo entre dois rivais reais (calculado por baixo dos panos, só pra fechar a tabela do grupo).
  const simularEntreRivais = (forcaA, forcaB) => {
    const fAHoje = variarForma(forcaA);
    const fBHoje = variarForma(forcaB);
    const mediaA = Math.max(0.15, 1.4 + (fAHoje - fBHoje) * 0.08);
    const mediaB = Math.max(0.15, 1.4 + (fBHoje - fAHoje) * 0.08);
    return { golsA: poisson(mediaA), golsB: poisson(mediaB) };
  };

  const rodarSimulacaoCompleta = async () => {
    setStep('simulacao');
    setLogsSimulacao([]);
    setTabelaGrupo(null);
    setResultadoFinal(null);
    setScoreboard(null);
    setEsperandoAcao(null);

    const { ataque, defesa } = calcularAtaqueDefesa();
    const nomeExibido = nomeTime.trim() || 'Sua Seleção';

    // ---- Sorteio do grupo real ----
    const letrasGrupos = Object.keys(GRUPOS_COPA);
    const letraSorteada = letrasGrupos[Math.floor(Math.random() * letrasGrupos.length)];
    const nomesRivaisGrupo = GRUPOS_COPA[letraSorteada];
    const rivaisGrupo = nomesRivaisGrupo
      .map((nome) => allTeams.find((t) => t.name === nome))
      .filter(Boolean);

    setGrupoAtual({ letra: letraSorteada, rivais: rivaisGrupo });
    await addLog(`🎟️ O sorteio te colocou no GRUPO ${letraSorteada}, ao lado de ${nomesRivaisGrupo.join(', ')}.`, 'titulo');

    const tabela = [
      { id: 'EU', nome: nomeExibido, pontos: 0, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, souEu: true },
      ...rivaisGrupo.map((t) => ({
        id: t.id, nome: t.name, pontos: 0, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, souEu: false,
      })),
    ];

    const aplicarResultado = (entradaA, golsA, entradaB, golsB) => {
      entradaA.j += 1; entradaB.j += 1;
      entradaA.gp += golsA; entradaA.gc += golsB;
      entradaB.gp += golsB; entradaB.gc += golsA;
      if (golsA > golsB) { entradaA.pontos += 3; entradaA.v += 1; entradaB.d += 1; }
      else if (golsA < golsB) { entradaB.pontos += 3; entradaB.v += 1; entradaA.d += 1; }
      else { entradaA.pontos += 1; entradaB.pontos += 1; entradaA.e += 1; entradaB.e += 1; }
    };

    await addLog('🔮 INICIANDO A FASE DE GRUPOS 🔮', 'titulo');

    for (const rival of rivaisGrupo) {
      await aguardarClique(`🏟️ Apitar o jogo: ${nomeExibido} vs ${rival.name}`);
      const { golsEu, golsAdv } = await jogarPartidaUsuario({ faseLabel: `Grupo ${letraSorteada}`, rival, ataque, defesa, nomeExibido });
      aplicarResultado(tabela.find((t) => t.id === 'EU'), golsEu, tabela.find((t) => t.id === rival.id), golsAdv);
    }

    // jogos entre os outros 3 do grupo (calculados na hora, só pra fechar a tabela real)
    for (let i = 0; i < rivaisGrupo.length; i += 1) {
      for (let j = i + 1; j < rivaisGrupo.length; j += 1) {
        const a = rivaisGrupo[i];
        const b = rivaisGrupo[j];
        const { golsA, golsB } = simularEntreRivais(forcaPorTime[a.id] || 75, forcaPorTime[b.id] || 75);
        aplicarResultado(tabela.find((t) => t.id === a.id), golsA, tabela.find((t) => t.id === b.id), golsB);
      }
    }

    tabela.sort((x, y) => (y.pontos - x.pontos) || (y.gp - y.gc) - (x.gp - x.gc) || y.gp - x.gp);
    setTabelaGrupo(tabela);

    const minhaPosicao = tabela.findIndex((t) => t.souEu) + 1;
    const meusPontos = tabela.find((t) => t.souEu).pontos;
    await addLog(`📊 Você fechou o Grupo ${letraSorteada} em ${minhaPosicao}º lugar, com ${meusPontos} pontos.`, 'titulo');

    let classificado = false;
    if (minhaPosicao <= 2) {
      classificado = true;
      await addLog('🎉 CLASSIFICADO direto entre os 2 primeiros do grupo!', 'bom');
    } else if (minhaPosicao === 3) {
      const chance = 0.15 + (meusPontos / 9) * 0.6;
      await addLog('🍀 Você caiu na loteria dos melhores terceiros colocados...', 'meio');
      classificado = Math.random() < chance;
      await addLog(
        classificado ? '🎉 E você foi sorteado como um dos 8 melhores terceiros! Classificado!' : '💀 Não foi dessa vez — você não entrou entre os melhores terceiros.',
        classificado ? 'bom' : 'mau'
      );
    } else {
      await addLog('💀 ELIMINADO NA FASE DE GRUPOS! O sonho terminou cedo demais.', 'mau');
    }

    if (!classificado) {
      setResultadoFinal({ status: 'eliminado', fase: 'Fase de Grupos' });
      return;
    }

    // ---- Mata-mata contra times reais, cada vez mais fortes ----
    let restantes = allTeams.filter((t) => !rivaisGrupo.some((r) => r.id === t.id));
    let vivo = true;
    let faseAlcancada = '';

    for (const etapa of FASES_MATA_MATA) {
      if (!vivo) break;
      const adversario = sortearAdversario(restantes, forcaPorTime, etapa.fator);
      if (!adversario) break;
      restantes = restantes.filter((t) => t.id !== adversario.id);

      await aguardarClique(`⚔️ Apitar ${etapa.fase}: ${nomeExibido} vs ${adversario.name}`);
      await addLog(`⚔️ ${etapa.fase.toUpperCase()} ⚔️`, 'titulo');
      const { golsEu, golsAdv } = await jogarPartidaUsuario({ faseLabel: etapa.fase, rival: adversario, ataque, defesa, nomeExibido });

      let venceu = golsEu > golsAdv;
      if (golsEu === golsAdv) {
        await aguardarClique('🥅 Começar as cobranças de pênalti');
        venceu = await simularPenaltis({
          nomeEu: nomeExibido,
          nomeAdv: adversario.name,
          forcaEuChute: ataque,
          forcaAdvChute: forcaPorTime[adversario.id] || 78,
        });
      }

      faseAlcancada = etapa.fase;
      if (!venceu) {
        await addLog(`💀 ${adversario.name} te eliminou na ${etapa.fase}. Fim de jogo.`, 'mau');
        vivo = false;
      } else {
        await addLog('🔥 VITÓRIA! Rumo à próxima fase!', 'bom');
      }
    }

    if (vivo) {
      await addLog('🏆 PARABÉNS! VOCÊ É O CAMPEÃO DO MUNDO! 🏆', 'bom');
      setResultadoFinal({ status: 'campeao' });
    } else {
      setResultadoFinal({ status: 'eliminado', fase: faseAlcancada });
    }
  };

  const reiniciar = () => {
    setStep('formacao');
    setFormacaoKey(null);
    setMyTeam([]);
    setLogsSimulacao([]);
    setCurrentRolledTeam(null);
    setAvailablePlayers([]);
    setGrupoAtual(null);
    setTabelaGrupo(null);
    setScoreboard(null);
    setResultadoFinal(null);
    setEsperandoAcao(null);
  };

  const forcaAtual = calcularForcaTime();
  const { ataque, defesa } = formacao ? calcularAtaqueDefesa() : { ataque: 0, defesa: 0 };
  const slotsCampo = formacao ? gerarSlotsCampo(formacao) : [];

  const slotsPreenchidos = slotsCampo.map((slot) => {
    const ocupantesDaCategoria = myTeam.filter((p) => classificarPosicao(p.position) === slot.cat);
    const slotsDaCategoria = slotsCampo.filter((s) => s.cat === slot.cat);
    const indexNaCategoria = slotsDaCategoria.indexOf(slot);
    return { ...slot, jogador: ocupantesDaCategoria[indexNaCategoria] || null };
  });

  const tierAtualLabel = planoSorteio[rodadaAtual] ? TIER_LABEL[planoSorteio[rodadaAtual]] : '';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        color: 'var(--chalk)',
        fontFamily: 'var(--font-body)',
        '--bg': '#0a0f1a',
        '--turf-1': '#123524',
        '--turf-2': '#1d5c3c',
        '--gold': '#f2c14e',
        '--chalk': '#f4f1ea',
        '--crimson': '#d7263d',
        '--ink': '#070a12',
        '--linha': 'rgba(244,241,234,0.35)',
        '--font-display': "'Oswald', sans-serif",
        '--font-body': "'Inter', sans-serif",
        '--font-mono': "'JetBrains Mono', monospace",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');

        * { box-sizing: border-box; }
        body { margin: 0; }

        .g7-wrap { max-width: 1100px; margin: 0 auto; padding: 28px 18px 60px; }

        .g7-eyebrow {
          font-family: var(--font-mono); letter-spacing: 0.22em; text-transform: uppercase;
          font-size: 12px; color: var(--gold); text-align: center;
        }
        .g7-h1 {
          font-family: var(--font-display); font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.02em; text-align: center; font-size: clamp(32px, 6vw, 56px);
          margin: 4px 0 0; background: linear-gradient(180deg, #fff, var(--gold));
          -webkit-background-clip: text; background-clip: text; color: transparent;
        }
        .g7-sub { text-align: center; color: rgba(244,241,234,0.6); margin-top: 8px; font-size: 15px; }

        .g7-card {
          background: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01));
          border: 1px solid rgba(244,241,234,0.1); border-radius: 14px;
        }

        .g7-pill-row { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
        .g7-pill {
          font-family: var(--font-mono); font-size: 13px; padding: 9px 18px; border-radius: 999px;
          border: 1px solid rgba(244,241,234,0.25); background: transparent; color: var(--chalk);
          cursor: pointer; transition: all 0.15s ease;
        }
        .g7-pill.ativo { background: var(--gold); color: #1a1300; border-color: var(--gold); font-weight: 700; }
        .g7-pill:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }

        .g7-form-btn {
          font-family: var(--font-display); font-size: 22px; font-weight: 600; padding: 22px 30px;
          border-radius: 12px; border: 1px solid rgba(242,193,78,0.4); background: var(--ink);
          color: var(--gold); cursor: pointer; transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .g7-form-btn:hover { transform: translateY(-3px); box-shadow: 0 10px 24px rgba(242,193,78,0.18); }
        .g7-form-btn:focus-visible { outline: 2px solid var(--gold); outline-offset: 3px; }

        .g7-input {
          font-family: var(--font-body); background: var(--ink); border: 1px solid rgba(244,241,234,0.2);
          color: var(--chalk); padding: 10px 14px; border-radius: 8px; font-size: 14px; width: 260px; text-align: center;
        }

        .g7-pitch {
          position: relative; width: 100%; aspect-ratio: 2 / 3; border-radius: 16px;
          background: repeating-linear-gradient(0deg, var(--turf-1) 0 40px, var(--turf-2) 40px 80px);
          border: 3px solid rgba(244,241,234,0.5); overflow: hidden;
        }
        .g7-pitch::before {
          content: ''; position: absolute; left: 50%; top: 50%; width: 30%; aspect-ratio: 1;
          border: 2px solid var(--linha); border-radius: 50%; transform: translate(-50%, -50%);
        }
        .g7-pitch::after {
          content: ''; position: absolute; left: 50%; top: 0; width: 0; height: 100%;
          border-left: 2px solid var(--linha); transform: translateX(-50%);
        }
        .g7-slot { position: absolute; transform: translate(-50%, -50%); width: 78px; text-align: center; animation: g7-pop 0.35s ease; }
        .g7-slot-vazio { width: 30px; height: 30px; margin: 0 auto; border: 2px dashed rgba(244,241,234,0.4); border-radius: 50%; }
        .g7-chip {
          background: rgba(7,10,18,0.88); border-radius: 8px; padding: 4px 6px; font-size: 11px;
          line-height: 1.25; border: 1px solid rgba(244,241,234,0.25);
        }
        .g7-chip strong { font-family: var(--font-display); font-size: 11px; display: block; }
        .g7-chip .ovr { font-family: var(--font-mono); font-weight: 700; display: block; }

        .g7-dice {
          width: 100%; padding: 22px; font-size: 17px; font-family: var(--font-display);
          letter-spacing: 0.04em; text-transform: uppercase; border: none; border-radius: 12px;
          color: #fff; cursor: pointer; background: linear-gradient(135deg, #0288d1, #01579b);
          transition: filter 0.15s ease;
        }
        .g7-dice:disabled { filter: grayscale(0.6) brightness(0.6); cursor: not-allowed; }
        .g7-dice:focus-visible { outline: 2px solid var(--gold); outline-offset: 3px; }

        .g7-ajuda {
          width: 100%; margin-top: 10px; padding: 10px; font-family: var(--font-mono); font-size: 12px;
          border: 1px dashed rgba(242,193,78,0.6); border-radius: 8px; background: transparent;
          color: var(--gold); cursor: pointer;
        }
        .g7-ajuda:disabled { opacity: 0.3; cursor: not-allowed; }

        .g7-flip { animation: g7-flip 0.09s linear infinite; }
        @keyframes g7-flip { from { opacity: 0.4; } to { opacity: 1; } }
        @keyframes g7-pop { from { opacity: 0; transform: translate(-50%, -30%) scale(0.7); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }

        .g7-player-row {
          padding: 10px 12px; border-bottom: 1px solid rgba(244,241,234,0.08);
          display: flex; justify-content: space-between; align-items: center; transition: background 0.12s ease;
        }
        .g7-player-row.livre:hover { background: rgba(242,193,78,0.08); }
        .g7-pos-tag { font-family: var(--font-mono); font-size: 10px; padding: 1px 6px; border-radius: 4px; color: #06090f; font-weight: 700; }

        .g7-scoreboard { font-family: var(--font-mono); background: var(--ink); border: 1px solid rgba(244,241,234,0.15); border-radius: 12px; padding: 18px; text-align: center; }
        .g7-scoreboard .fase { color: var(--gold); letter-spacing: 0.15em; font-size: 12px; text-transform: uppercase; }
        .g7-scoreboard .placar { font-size: 40px; font-weight: 700; margin: 6px 0; }
        .g7-scoreboard .rival { color: rgba(244,241,234,0.7); font-size: 13px; }

        .g7-acao-wrap { text-align: center; margin: 18px 0; }
        .g7-acao {
          font-family: var(--font-display); text-transform: uppercase; letter-spacing: 0.03em; font-size: 16px;
          padding: 16px 28px; border-radius: 10px; border: none; cursor: pointer; color: #1a1300;
          background: linear-gradient(135deg, var(--gold), #ffe17a); animation: g7-pulso 1.6s ease-in-out infinite;
        }
        @keyframes g7-pulso { 0%, 100% { box-shadow: 0 0 0 0 rgba(242,193,78,0.5); } 50% { box-shadow: 0 0 0 10px rgba(242,193,78,0); } }

        .g7-log-feed { background: var(--ink); border-radius: 10px; padding: 16px; max-height: 380px; overflow-y: auto; }
        .g7-log-line { margin: 0 0 10px; padding-left: 14px; border-left: 2px solid rgba(244,241,234,0.2); font-size: 14px; animation: g7-fade 0.3s ease; }
        .g7-log-line.bom { border-left-color: #6fd17a; color: #b9f3bf; }
        .g7-log-line.mau { border-left-color: var(--crimson); color: #ffb3bb; }
        .g7-log-line.meio { border-left-color: var(--gold); color: #ffe6ad; }
        .g7-log-line.titulo { border-left-color: var(--gold); font-family: var(--font-display); text-transform: uppercase; letter-spacing: 0.04em; color: var(--gold); }
        @keyframes g7-fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

        .g7-table { width: 100%; border-collapse: collapse; font-family: var(--font-mono); font-size: 13px; }
        .g7-table th, .g7-table td { padding: 6px 8px; text-align: center; border-bottom: 1px solid rgba(244,241,234,0.08); }
        .g7-table th { color: var(--gold); text-transform: uppercase; font-size: 11px; }
        .g7-table td:first-child, .g7-table th:first-child { text-align: left; }
        .g7-table tr.eu { background: rgba(242,193,78,0.1); font-weight: 700; }
        .g7-table tr.linha-corte td { border-bottom: 2px dashed rgba(244,241,234,0.3); }

        .g7-final-banner { text-align: center; padding: 40px 20px; border-radius: 16px; font-family: var(--font-display); text-transform: uppercase; }
        .g7-final-banner.campeao { background: radial-gradient(circle at top, rgba(242,193,78,0.25), transparent); border: 1px solid var(--gold); }
        .g7-final-banner.eliminado { background: rgba(215,38,61,0.08); border: 1px solid rgba(215,38,61,0.4); }

        .g7-reset {
          font-family: var(--font-mono); font-size: 13px; background: transparent; border: 1px solid rgba(244,241,234,0.3);
          color: var(--chalk); padding: 10px 18px; border-radius: 8px; cursor: pointer; margin-top: 18px;
        }
        .g7-reset:hover { border-color: var(--gold); color: var(--gold); }

        @media (max-width: 880px) {
          .g7-draft-grid { flex-direction: column !important; }
          .g7-dice-col { width: 100% !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .g7-slot, .g7-log-line, .g7-acao { animation: none !important; }
        }
      `}</style>

      <div className="g7-wrap">
        <p className="g7-eyebrow">Draft &amp; Simulação</p>
        <h1 className="g7-h1">Desafio 7×0 — Copa 2026</h1>
        <p className="g7-sub">Monte sua seleção dos sonhos com craques das 48 seleções e tente vencer a Copa do Mundo de verdade.</p>

        {carregando && (
          <p style={{ textAlign: 'center', marginTop: 40, color: 'rgba(244,241,234,0.6)' }}>Carregando seleções da Copa...</p>
        )}

        {!carregando && step === 'formacao' && (
          <div style={{ marginTop: 36 }}>
            <div style={{ textAlign: 'center', marginBottom: 26 }}>
              <input
                className="g7-input"
                placeholder="Nome da sua seleção (opcional)"
                value={nomeTime}
                onChange={(e) => setNomeTime(e.target.value)}
                maxLength={24}
              />
            </div>

            <p style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.1em', color: 'rgba(244,241,234,0.6)', textTransform: 'uppercase', marginBottom: 10 }}>
              Modo de jogo
            </p>
            <div className="g7-pill-row" style={{ marginBottom: 34 }}>
              <button className={`g7-pill ${modo === 'classico' ? 'ativo' : ''}`} onClick={() => setModo('classico')}>
                Clássico · notas visíveis
              </button>
              <button className={`g7-pill ${modo === 'almanaque' ? 'ativo' : ''}`} onClick={() => setModo('almanaque')}>
                De Almanaque · na memória
              </button>
            </div>

            <p style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.1em', color: 'rgba(244,241,234,0.6)', textTransform: 'uppercase', marginBottom: 16 }}>
              Escolha a formação tática
            </p>
            <div className="g7-pill-row">
              {Object.keys(FORMACOES).map((key) => (
                <button key={key} className="g7-form-btn" onClick={() => iniciarDraft(key)}>
                  {key}
                </button>
              ))}
            </div>
          </div>
        )}

        {!carregando && step === 'draft' && (
          <div className="g7-draft-grid" style={{ display: 'flex', gap: 24, marginTop: 30, alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div className="g7-card" style={{ padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', textTransform: 'uppercase', margin: 0 }}>
                    {nomeTime.trim() || 'Sua Seleção'} ({myTeam.length}/11)
                  </h3>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--gold)', fontSize: 22, fontWeight: 700 }}>
                    {modo === 'almanaque' ? '❔' : forcaAtual}
                  </span>
                </div>

                <div className="g7-pitch">
                  {slotsPreenchidos.map((slot, i) => (
                    <div key={i} className="g7-slot" style={{ left: `${slot.x}%`, top: `${slot.y}%` }}>
                      {slot.jogador ? (
                        <div className="g7-chip" style={{ borderColor: POSICAO_COR[slot.cat] }}>
                          <strong>{slot.jogador.name}</strong>
                          <span className="ovr" style={{ color: POSICAO_COR[slot.cat] }}>
                            {modo === 'almanaque' ? '🔒' : `⭐ ${slot.jogador.overall}`}
                          </span>
                        </div>
                      ) : (
                        <div className="g7-slot-vazio" title={POSICAO_LABEL[slot.cat]} />
                      )}
                    </div>
                  ))}
                </div>

                {myTeam.length === 11 && (
                  <button className="g7-dice" style={{ marginTop: 18, background: 'linear-gradient(135deg, var(--gold), #c9941f)', color: '#1a1300' }} onClick={rodarSimulacaoCompleta}>
                    🚀 Iniciar a Copa do Mundo
                  </button>
                )}
              </div>
            </div>

            <div className="g7-dice-col" style={{ width: 360 }}>
              <div className="g7-card" style={{ padding: 18, textAlign: 'center' }}>
                {myTeam.length < 11 && (
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'rgba(244,241,234,0.6)', marginBottom: 10 }}>
                    Sorteio {Math.min(rodadaAtual + 1, 11)}/11 · {tierAtualLabel}
                  </p>
                )}
                <button
                  className="g7-dice"
                  onClick={rolarDado}
                  disabled={isRolling || myTeam.length >= 11 || currentRolledTeam !== null}
                >
                  {isRolling ? '🎰 Sorteando...' : currentRolledTeam ? '👇 Escolha 1 atleta' : '🎲 Rolar o dado'}
                </button>

                {currentRolledTeam && (
                  <div style={{ marginTop: 18, padding: 14, background: 'var(--ink)', borderRadius: 10, textAlign: 'left' }}>
                    <div style={{ textAlign: 'center', marginBottom: 10 }}>
                      {currentRolledTeam.badge_url && (
                        <img src={currentRolledTeam.badge_url} alt="" width={40} height={40} className={isRolling ? 'g7-flip' : ''} />
                      )}
                      <h2 style={{ color: 'var(--gold)', fontFamily: 'var(--font-display)', margin: '6px 0 0' }}>
                        {currentRolledTeam.name}
                      </h2>
                    </div>

                    {!isRolling && !ajudaUsada && (
                      <button className="g7-ajuda" onClick={usarAjudaSorteio}>
                        🔁 Não gostei, sortear outra seleção (vale 1x no jogo)
                      </button>
                    )}

                    <div style={{ maxHeight: 320, overflowY: 'auto', marginTop: 10 }}>
                      {availablePlayers.map((p) => {
                        const cat = classificarPosicao(p.position);
                        const livre = verificarVagaDisponivel(p.position);
                        return (
                          <div
                            key={p.id}
                            className={`g7-player-row ${livre ? 'livre' : ''}`}
                            onClick={() => livre && selecionarJogador(p)}
                            style={{ cursor: livre ? 'pointer' : 'not-allowed', opacity: livre ? 1 : 0.35 }}
                          >
                            <div>
                              <strong style={{ display: 'block', fontSize: 13 }}>{p.name}</strong>
                              <span className="g7-pos-tag" style={{ background: POSICAO_COR[cat] }}>{cat}</span>
                            </div>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--gold)' }}>
                              {modo === 'almanaque' ? '🔒' : p.overall}
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

        {step === 'simulacao' && (
          <div style={{ maxWidth: 640, margin: '32px auto 0' }}>
            {grupoAtual && (
              <p style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--gold)', fontSize: 13, marginBottom: 14 }}>
                Grupo {grupoAtual.letra}
              </p>
            )}

            {scoreboard && (
              <div className="g7-scoreboard" style={{ marginBottom: 18 }}>
                <p className="fase">{scoreboard.fase}</p>
                <p className="placar">{scoreboard.nosso} × {scoreboard.deles}</p>
                <p className="rival">vs {scoreboard.rival}</p>
              </div>
            )}

            {esperandoAcao && (
              <div className="g7-acao-wrap">
                <button className="g7-acao" onClick={clicarAcao}>{esperandoAcao}</button>
              </div>
            )}

            {tabelaGrupo && (
              <div className="g7-card" style={{ padding: 16, marginBottom: 18 }}>
                <table className="g7-table">
                  <thead>
                    <tr>
                      <th>Seleção</th><th>P</th><th>J</th><th>V</th><th>E</th><th>D</th><th>GP</th><th>GC</th><th>SG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tabelaGrupo.map((t, i) => (
                      <tr key={t.id} className={`${t.souEu ? 'eu' : ''} ${i === 1 ? 'linha-corte' : ''}`}>
                        <td>{t.souEu ? `👉 ${t.nome}` : t.nome}</td>
                        <td>{t.pontos}</td><td>{t.j}</td><td>{t.v}</td><td>{t.e}</td><td>{t.d}</td>
                        <td>{t.gp}</td><td>{t.gc}</td><td>{t.gp - t.gc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="g7-card" style={{ padding: 4 }}>
              <div className="g7-log-feed" ref={logRef}>
                {logsSimulacao.map((log) => (
                  <p key={log.key} className={`g7-log-line ${log.tipo}`}>{log.texto}</p>
                ))}
              </div>
            </div>

            {resultadoFinal && (
              <div className={`g7-final-banner ${resultadoFinal.status === 'campeao' ? 'campeao' : 'eliminado'}`} style={{ marginTop: 18 }}>
                <h2 style={{ fontSize: 28, margin: 0, color: resultadoFinal.status === 'campeao' ? 'var(--gold)' : '#ff8a93' }}>
                  {resultadoFinal.status === 'campeao' ? '🏆 Campeão do Mundo!' : `Eliminado · ${resultadoFinal.fase}`}
                </h2>
                <p style={{ fontFamily: 'var(--font-body)', textTransform: 'none', color: 'rgba(244,241,234,0.7)', marginTop: 8 }}>
                  Força final: {forcaAtual} OVR · Ataque {ataque} · Defesa {defesa}
                </p>
              </div>
            )}

            {resultadoFinal && (
              <div style={{ textAlign: 'center' }}>
                <button className="g7-reset" onClick={reiniciar}>🔄 Novo Draft</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
