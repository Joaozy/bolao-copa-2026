'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Inicializa usando o pacote padrão que você já tem instalado
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const FORMACÕES = {
  '4-3-3': { name: '4-3-3', GOL: 1, DEF: 4, MEI: 3, ATA: 3 },
  '4-4-2': { name: '4-4-2', GOL: 1, DEF: 4, MEI: 4, ATA: 2 },
  '4-2-3-1': { name: '4-2-3-1', GOL: 1, DEF: 4, MEI: 5, ATA: 1 },
  '5-3-2': { name: '5-3-2', GOL: 1, DEF: 5, MEI: 3, ATA: 2 }
};

export default function Game7x0() {
  const [step, setStep] = useState('formacao'); // formacao -> draft -> simulacao -> fim
  const [formacao, setFormacao] = useState(null);
  const [myTeam, setMyTeam] = useState([]); // Array de jogadores selecionados
  
  const [allTeams, setAllTeams] = useState([]);
  const [currentRolledTeam, setCurrentRolledTeam] = useState(null);
  const [availablePlayers, setAvailablePlayers] = useState([]);
  const [isRolling, setIsRolling] = useState(false);
  
  const [logsSimulacao, setLogsSimulacao] = useState([]);

  // Puxa os times (seleções) para o sorteio do dado
  useEffect(() => {
    async function loadInitialData() {
      // 1. Puxa qual é a competição ativa no momento
      const { data: comp } = await supabase
        .from('competitions')
        .select('id')
        .eq('is_active', true)
        .single();

      if (!comp) return;

      // 2. Puxa todos os jogos dessa competição para saber quem está jogando
      const { data: games } = await supabase
        .from('games')
        .select('team_a_id, team_b_id')
        .eq('competition_id', comp.id);

      if (!games) return;

      // 3. Extrai apenas os IDs únicos das seleções que estão nesses jogos
      const teamIds = new Set();
      games.forEach(g => {
        if (g.team_a_id) teamIds.add(g.team_a_id);
        if (g.team_b_id) teamIds.add(g.team_b_id);
      });

      // 4. Agora sim, puxa os dados apenas dessas seleções isoladas
      const { data: selecoes } = await supabase
        .from('teams')
        .select('id, name, badge_url, flag_code')
        .in('id', Array.from(teamIds));

      setAllTeams(selecoes || []);
    }
    
    loadInitialData();
  }, []);

  const iniciarDraft = (tatic) => {
    setFormacao(FORMACÕES[tatic]);
    setStep('draft');
  };

  // Rolar o Dado (Sorteia uma Seleção Mundial)
  const rolarDado = async () => {
    if (isRolling) return;
    setIsRolling(true);
    setAvailablePlayers([]);

    // Efeito visual de giro do dado
    let voltas = 0;
    const interval = setInterval(() => {
      const randomTeam = allTeams[Math.floor(Math.random() * allTeams.length)];
      setCurrentRolledTeam(randomTeam);
      voltas++;
      if (voltas > 10) {
        clearInterval(interval);
        finalizarRolagem(randomTeam);
      }
    }, 100);
  };

  const finalizarRolagem = async (teamSelected) => {
    // Puxa os jogadores reais daquela seleção específica que sorteamos
    const { data: players } = await supabase
      .from('players')
      .select('id, name, position, overall, photo_url')
      .eq('team_id', teamSelected.id)
      .order('overall', { ascending: false });

    setAvailablePlayers(players || []);
    setIsRolling(false);
  };

  const selecionarJogador = (player) => {
    if (myTeam.length >= 11) return;
    if (myTeam.some(p => p.id === player.id)) return;

    setMyTeam([...myTeam, { ...player, selectionName: currentRolledTeam.name }]);
    setCurrentRolledTeam(null);
    setAvailablePlayers([]);
  };

  // CALCULA FORÇA TOTAL DO TIME DO USUÁRIO
  const calcularForcaTime = () => {
    if (myTeam.length === 0) return 0;
    const soma = myTeam.reduce((acc, p) => acc + p.overall, 0);
    return Math.round(soma / myTeam.length);
  };

  // MOTOR DE SIMULAÇÃO DA COPA DO MUNDO (Fase de Grupos até a Final)
  const rodarSimulacaoCompleta = () => {
    setStep('simulacao');
    const logs = [];
    const minhaForca = calcularForcaTime();

    // Função interna para simular o placar de uma partida baseado nos Overalls
    const simularJogo = (nomeTimeA, forcaA, nomeTimeB, forcaB) => {
      const margem = (forcaA - forcaB) * 0.1;
      const golsA = Math.max(0, Math.floor(Math.random() * 4 + margem));
      const golsB = Math.max(0, Math.floor(Math.random() * 4 - margem));
      
      // Se for mata-mata e empatar, força decisão nos pênaltis
      if (golsA === golsB) {
        const viraA = Math.random() > 0.5;
        return { golsA, golsB, vencedor: viraA ? nomeTimeA : nomeTimeB, penaltis: true };
      }
      return { golsA, golsB, vencedor: golsA > golsB ? nomeTimeA : nomeTimeB, penaltis: false };
    };

    // 1. FASE DE GRUPOS (3 Jogos)
    logs.push("🔮 *INICIANDO A FASE DE GRUPOS* 🔮");
    const rivaisGrupos = [
      { name: "Suécia", forca: 80 },
      { name: "Marrocos", forca: 84 },
      { name: "Japão", forca: 81 }
    ];

    let pontosGrupo = 0;
    rivaisGrupos.forEach(rival => {
      const res = simularJogo("Seu Time", minhaForca, rival.name, rival.forca);
      if (res.golsA > res.golsB) pontosGrupo += 3;
      else if (res.golsA === res.golsB) pontosGrupo += 1;
      logs.push(`🏟️ Seu Time ${res.golsA} x ${res.golsB} ${rival.name} (${res.golsA > res.golsB ? 'Vitória! ✅' : res.golsA === res.golsB ? 'Empate 🤝' : 'Derrota ❌'})`);
    });

    if (pontosGrupo < 4) {
      logs.push("❌ *ELIMINADO NA FASE DE GRUPOS!* O sonho terminou cedo demais. Seu time não aguentou a pressão.");
      setLogsSimulacao(logs);
      return;
    }
    logs.push(`\n🎉 *CLASSIFICADO!* Você fez ${pontosGrupo} pontos e avançou para o Mata-Mata!`);

    // 2. MATA-MATA (A dificuldade vai escalando)
    const fasesMataMata = [
      { fase: "16 avos de Final", rival: "Equador", forca: 82 },
      { fase: "Oitavas de Final", rival: "Portugal", forca: 86 },
      { fase: "Quartas de Final", rival: "Alemanha", forca: 88 },
      { fase: "Semifinal", rival: "França", forca: 91 },
      { fase: "GRANDE FINAL", rival: "Argentina", forca: 93 }
    ];

    let vivo = true;
    for (const etapa of fasesMataMata) {
      if (!vivo) break;
      logs.push(`\n⚔️ *${etapa.fase.toUpperCase()}* ⚔️`);
      
      const res = simularJogo("Seu Time", minhaForca, etapa.rival, etapa.forca);
      logs.push(`👉 *Seu Time ${res.golsA} x ${res.golsB} ${etapa.rival}*`);
      
      if (res.penaltis) {
        logs.push(`🚨 Jogo tenso! Decidido nos pênaltis. Vencedor: *${res.vencedor}*`);
      }

      if (res.vencedor !== "Seu Time") {
        logs.push(`💀 O time de ${etapa.rival} eliminou você na ${etapa.fase}. Fim de jogo.`);
        vivo = false;
      } else {
        logs.push(`🔥 VITÓRIA ESPETACULAR! Rumo à próxima fase!`);
      }
    }

    if (vivo) {
      logs.push("\n🏆 ⭐ *PARABÉNS! VOCÊ É O CAMPEÃO DO MUNDO!* ⭐ 🏆\nSua escalação entrou para a história do futebol mundial.");
    }

    setLogsSimulacao(logs);
  };

  return (
    <div style={{ padding: '24px', background: '#111', color: '#fff', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <h1 style={{ textAlign: 'center', color: '#00e676' }}>⚽ Desafio 7x0: Draft Copa 2026 ⚽</h1>
      
      {/* PASSO 1: ESCOLHA DA TÁTICA */}
      {step === 'formacao' && (
        <div style={{ textAlign: 'center', marginTop: '40px' }}>
          <h3>Escolha a Formação Tática do seu Time:</h3>
          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '20px' }}>
            {Object.keys(FORMACÕES).map(key => (
              <button 
                key={key}
                onClick={() => iniciarDraft(key)}
                style={{ padding: '15px 25px', background: '#00e676', border: 'none', borderRadius: '8px', color: '#000', fontWeight: 'bold', cursor: 'pointer' }}
              >
                {key}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* PASSO 2: O DRAFT */}
      {step === 'draft' && (
        <div style={{ display: 'flex', gap: '20px', marginTop: '30px' }}>
          
          {/* LADO ESQUERDO: CAMPO VISUAL */}
          <div style={{ flex: 1, background: '#1b5e20', padding: '20px', borderRadius: '12px', border: '3px solid #fff' }}>
            <h4 style={{ textAlign: 'center' }}>Sua Seleção ({myTeam.length}/11) - Média: {calcularForcaTime()} OVR</h4>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '20px' }}>
              {myTeam.map((p, i) => (
                <div key={i} style={{ background: 'rgba(0,0,0,0.6)', padding: '10px', borderRadius: '6px', textAlign: 'center', border: '1px solid #00e676' }}>
                  <p style={{ margin: 0, fontSize: '12px', color: '#aaa' }}>{p.position}</p>
                  <strong style={{ fontSize: '14px' }}>{p.name}</strong>
                  <p style={{ margin: '4px 0 0 0', fontWeight: 'bold', color: '#00e676' }}>⭐ {p.overall}</p>
                  <span style={{ fontSize: '10px', display: 'block', color: '#00e676' }}>({p.selectionName})</span>
                </div>
              ))}
            </div>

            {myTeam.length === 11 && (
              <button 
                onClick={rodarSimulacaoCompleta}
                style={{ width: '100%', marginTop: '20px', padding: '15px', background: '#ffeb3b', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
              >
                🚀 Iniciar Simulação da Copa do Mundo!
              </button>
            )}
          </div>

          {/* LADO DIREITO: O DADO DA ROLAGEM */}
          <div style={{ width: '350px', background: '#222', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
            <button 
              onClick={rolarDado} 
              disabled={isRolling || myTeam.length >= 11}
              style={{ width: '100%', padding: '20px', fontSize: '18px', background: '#0288d1', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              {isRolling ? '🎰 Sorteando Seleção...' : '🎲 ROLAR DADO (Sorteie País)'}
            </button>

            {currentRolledTeam && (
              <div style={{ marginTop: '20px', padding: '15px', background: '#333', borderRadius: '8px' }}>
                <h2 style={{ color: '#ffeb3b', margin: 0 }}>{currentRolledTeam.name}</h2>
                <p style={{ fontSize: '13px', color: '#ccc' }}>Escolha 1 atleta para entrar no seu elenco:</p>
                
                <div style={{ maxHeight: '300px', overflowY: 'auto', textAlign: 'left', marginTop: '10px' }}>
                  {availablePlayers.map(p => (
                    <div 
                      key={p.id} 
                      onClick={() => selecionarJogador(p)}
                      style={{ padding: '8px', borderBottom: '1px solid #444', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      className="player-row"
                    >
                      <div>
                        <span style={{ fontWeight: 'bold' }}>{p.name}</span>
                        <span style={{ fontSize: '11px', color: '#999', display: 'block' }}>{p.position}</span>
                      </div>
                      <span style={{ background: '#00e676', color: '#000', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>{p.overall}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* PASSO 3: TELA DE SIMULAÇÃO */}
      {step === 'simulacao' && (
        <div style={{ maxWidth: '600px', margin: '40px auto', background: '#222', padding: '25px', borderRadius: '12px' }}>
          <h3>📻 Transmissão ao Vivo: Copa do Mundo 2026</h3>
          <div style={{ background: '#000', padding: '15px', borderRadius: '8px', maxHeight: '450px', overflowY: 'auto', lineHeight: '1.6' }}>
            {logsSimulacao.map((log, index) => (
              <p key={index} style={{ margin: '8px 0', color: log.includes('❌') || log.includes('💀') ? '#ff5252' : log.includes('✅') || log.includes('🏆') ? '#00e676' : '#fff' }}>
                {log}
              </p>
            ))}
          </div>
          <button 
            onClick={() => { setStep('formacao'); setMyTeam([]); setLogsSimulacao([]); }}
            style={{ width: '100%', marginTop: '20px', padding: '12px', background: '#fff', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            🔄 Jogar Novamente (Novo Draft)
          </button>
        </div>
      )}
    </div>
  );
}