'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const FORMACÕES = {
  '4-3-3': { name: '4-3-3', GOL: 1, DEF: 4, MEI: 3, ATA: 3 },
  '4-4-2': { name: '4-4-2', GOL: 1, DEF: 4, MEI: 4, ATA: 2 },
  '4-2-3-1': { name: '4-2-3-1', GOL: 1, DEF: 4, MEI: 5, ATA: 1 },
  '5-3-2': { name: '5-3-2', GOL: 1, DEF: 5, MEI: 3, ATA: 2 }
};

// Filtro absoluto: Apenas estas seleções serão puxadas do banco, eliminando os clubes.
const SELECOES_COPA = [
  'Brazil', 'Argentina', 'France', 'Germany', 'Spain', 'Portugal', 'Uruguay', 'Colombia',
  'Netherlands', 'Belgium', 'Croatia', 'USA', 'Mexico', 'Japan', 'Senegal', 'Morocco',
  'Switzerland', 'South Korea', 'Canada', 'Ecuador', 'Saudi Arabia', 'Australia', 'Tunisia',
  'Qatar', 'Iran', 'England', 'Scotland', 'Paraguay', 'South Africa', 'Haiti', 'Curacao',
  'Ivory Coast', 'Egypt', 'New Zealand', 'Cape Verde Islands', 'Algeria', 'Austria', 'Jordan',
  'Ghana', 'Panama', 'Uzbekistan', 'Norway', 'Czech Republic', 'Bosnia & Herzegovina',
  'Turkiye', 'Sweden', 'Iraq', 'Congo DR'
];

export default function Game7x0() {
  const [step, setStep] = useState('formacao');
  const [formacao, setFormacao] = useState(null);
  const [myTeam, setMyTeam] = useState([]); 
  
  const [allTeams, setAllTeams] = useState([]);
  const [currentRolledTeam, setCurrentRolledTeam] = useState(null);
  const [availablePlayers, setAvailablePlayers] = useState([]);
  const [isRolling, setIsRolling] = useState(false);
  const [logsSimulacao, setLogsSimulacao] = useState([]);

  // Puxa estritamente as seleções mundiais
  useEffect(() => {
    async function loadInitialData() {
      const { data: selecoes } = await supabase
        .from('teams')
        .select('id, name, badge_url, flag_code')
        .in('name', SELECOES_COPA); // Corta os clubes na raiz

      setAllTeams(selecoes || []);
    }
    loadInitialData();
  }, []);

  const iniciarDraft = (tatic) => {
    setFormacao(FORMACÕES[tatic]);
    setStep('draft');
  };

  // Conversor: Pega a posição em inglês do banco e transforma na categoria tática
  const classificarPosicao = (posEnglish) => {
    if (!posEnglish) return 'OUTRO';
    const p = posEnglish.toLowerCase();
    if (p.includes('goalkeeper') || p === 'g') return 'GOL';
    if (p.includes('defender') || p === 'd') return 'DEF';
    if (p.includes('midfielder') || p === 'm') return 'MEI';
    if (p.includes('attacker') || p.includes('forward') || p === 'a') return 'ATA';
    return 'OUTRO';
  };

  // Verificador: Checa se a posição do jogador ainda cabe na formação escolhida
  const verificarVagaDisponivel = (playerPos) => {
    if (!formacao) return false;
    const cat = classificarPosicao(playerPos);
    if (cat === 'OUTRO') return false;

    const selecionadosNessaCategoria = myTeam.filter(p => classificarPosicao(p.position) === cat).length;
    const limiteDaCategoria = formacao[cat];

    return selecionadosNessaCategoria < limiteDaCategoria;
  };

  const rolarDado = async () => {
    if (isRolling || currentRolledTeam) return; // Trava contra re-rolagem sem escolher
    setIsRolling(true);
    setAvailablePlayers([]);

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
    if (!verificarVagaDisponivel(player.position)) return; // Trava de segurança no clique

    setMyTeam([...myTeam, { ...player, selectionName: currentRolledTeam.name }]);
    setCurrentRolledTeam(null); // Libera o dado para rolar novamente
    setAvailablePlayers([]);
  };

  const calcularForcaTime = () => {
    if (myTeam.length === 0) return 0;
    const soma = myTeam.reduce((acc, p) => acc + p.overall, 0);
    return Math.round(soma / myTeam.length);
  };

  // MOTOR DE SIMULAÇÃO DA COPA DO MUNDO
  const rodarSimulacaoCompleta = () => {
    setStep('simulacao');
    const logs = [];
    const minhaForca = calcularForcaTime();

    const simularJogo = (nomeTimeA, forcaA, nomeTimeB, forcaB) => {
      const margem = (forcaA - forcaB) * 0.1;
      const golsA = Math.max(0, Math.floor(Math.random() * 4 + margem));
      const golsB = Math.max(0, Math.floor(Math.random() * 4 - margem));
      
      if (golsA === golsB) {
        const viraA = Math.random() > 0.5;
        return { golsA, golsB, vencedor: viraA ? nomeTimeA : nomeTimeB, penaltis: true };
      }
      return { golsA, golsB, vencedor: golsA > golsB ? nomeTimeA : nomeTimeB, penaltis: false };
    };

    logs.push("🔮 *INICIANDO A FASE DE GRUPOS* 🔮");
    const rivaisGrupos = [
      { name: "Suécia", forca: 80 }, { name: "Marrocos", forca: 84 }, { name: "Japão", forca: 81 }
    ];

    let pontosGrupo = 0;
    rivaisGrupos.forEach(rival => {
      const res = simularJogo("Seu Time", minhaForca, rival.name, rival.forca);
      if (res.golsA > res.golsB) pontosGrupo += 3;
      else if (res.golsA === res.golsB) pontosGrupo += 1;
      logs.push(`🏟️ Seu Time ${res.golsA} x ${res.golsB} ${rival.name} (${res.golsA > res.golsB ? 'Vitória! ✅' : res.golsA === res.golsB ? 'Empate 🤝' : 'Derrota ❌'})`);
    });

    if (pontosGrupo < 4) {
      logs.push("❌ *ELIMINADO NA FASE DE GRUPOS!* O sonho terminou cedo demais.");
      setLogsSimulacao(logs);
      return;
    }
    logs.push(`\n🎉 *CLASSIFICADO!* Você fez ${pontosGrupo} pontos e avançou para o Mata-Mata!`);

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
      
      if (res.penaltis) logs.push(`🚨 Jogo tenso! Decidido nos pênaltis. Vencedor: *${res.vencedor}*`);

      if (res.vencedor !== "Seu Time") {
        logs.push(`💀 O time de ${etapa.rival} eliminou você na ${etapa.fase}. Fim de jogo.`);
        vivo = false;
      } else {
        logs.push(`🔥 VITÓRIA ESPETACULAR! Rumo à próxima fase!`);
      }
    }

    if (vivo) logs.push("\n🏆 ⭐ *PARABÉNS! VOCÊ É O CAMPEÃO DO MUNDO!* ⭐ 🏆\nSua escalação entrou para a história do futebol mundial.");
    setLogsSimulacao(logs);
  };

  return (
    <div style={{ padding: '24px', background: '#111', color: '#fff', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <h1 style={{ textAlign: 'center', color: '#00e676' }}>⚽ Desafio 7x0: Draft Copa 2026 ⚽</h1>
      
      {step === 'formacao' && (
        <div style={{ textAlign: 'center', marginTop: '40px' }}>
          <h3>Escolha a Formação Tática:</h3>
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

      {step === 'draft' && (
        <div style={{ display: 'flex', gap: '20px', marginTop: '30px' }}>
          
          <div style={{ flex: 1, background: '#1b5e20', padding: '20px', borderRadius: '12px', border: '3px solid #fff' }}>
            <h4 style={{ textAlign: 'center' }}>Sua Seleção ({myTeam.length}/11) - OVR: {calcularForcaTime()}</h4>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '20px' }}>
              {myTeam.map((p, i) => (
                <div key={i} style={{ background: 'rgba(0,0,0,0.6)', padding: '10px', borderRadius: '6px', textAlign: 'center', border: '1px solid #00e676' }}>
                  <p style={{ margin: 0, fontSize: '12px', color: '#aaa' }}>{classificarPosicao(p.position)}</p>
                  <strong style={{ fontSize: '14px' }}>{p.name}</strong>
                  <p style={{ margin: '4px 0 0 0', fontWeight: 'bold', color: '#00e676' }}>⭐ {p.overall}</p>
                </div>
              ))}
            </div>

            {myTeam.length === 11 && (
              <button 
                onClick={rodarSimulacaoCompleta}
                style={{ width: '100%', marginTop: '20px', padding: '15px', background: '#ffeb3b', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
              >
                🚀 Iniciar Simulação da Copa!
              </button>
            )}
          </div>

          <div style={{ width: '350px', background: '#222', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
            {/* O BOTÃO AGORA TRAVA SE JÁ TIVER TIME SORTEADO */}
            <button 
              onClick={rolarDado} 
              disabled={isRolling || myTeam.length >= 11 || currentRolledTeam !== null}
              style={{ 
                width: '100%', padding: '20px', fontSize: '18px', 
                background: (isRolling || currentRolledTeam) ? '#555' : '#0288d1', 
                color: '#fff', border: 'none', borderRadius: '8px', 
                cursor: (isRolling || currentRolledTeam) ? 'not-allowed' : 'pointer', 
                fontWeight: 'bold' 
              }}
            >
              {isRolling ? '🎰 Sorteando...' : currentRolledTeam ? '👇 Escolha 1 Atleta' : '🎲 ROLAR DADO'}
            </button>

            {currentRolledTeam && (
              <div style={{ marginTop: '20px', padding: '15px', background: '#333', borderRadius: '8px' }}>
                <h2 style={{ color: '#ffeb3b', margin: 0 }}>{currentRolledTeam.name}</h2>
                
                <div style={{ maxHeight: '300px', overflowY: 'auto', textAlign: 'left', marginTop: '10px' }}>
                  {availablePlayers.map(p => {
                    // LÓGICA DE ESCURECIMENTO E BLOQUEIO DE CLIQUE AQUI
                    const vagaLivre = verificarVagaDisponivel(p.position);
                    
                    return (
                      <div 
                        key={p.id} 
                        onClick={() => vagaLivre && selecionarJogador(p)}
                        style={{ 
                          padding: '8px', 
                          borderBottom: '1px solid #444', 
                          cursor: vagaLivre ? 'pointer' : 'not-allowed', 
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          opacity: vagaLivre ? 1 : 0.3, // Deixa o jogador escuro se não tiver vaga
                          background: vagaLivre ? 'transparent' : 'rgba(255,0,0,0.1)' 
                        }}
                      >
                        <div>
                          <span style={{ fontWeight: 'bold' }}>{p.name}</span>
                          <span style={{ fontSize: '11px', color: '#999', display: 'block' }}>{p.position} ({classificarPosicao(p.position)})</span>
                        </div>
                        <span style={{ background: '#00e676', color: '#000', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>{p.overall}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {step === 'simulacao' && (
        <div style={{ maxWidth: '600px', margin: '40px auto', background: '#222', padding: '25px', borderRadius: '12px' }}>
          <h3>📻 Transmissão ao Vivo</h3>
          <div style={{ background: '#000', padding: '15px', borderRadius: '8px', maxHeight: '450px', overflowY: 'auto', lineHeight: '1.6' }}>
            {logsSimulacao.map((log, index) => (
              <p key={index} style={{ margin: '8px 0', color: log.includes('❌') || log.includes('💀') ? '#ff5252' : log.includes('✅') || log.includes('🏆') ? '#00e676' : '#fff' }}>
                {log}
              </p>
            ))}
          </div>
          <button 
            onClick={() => { setStep('formacao'); setMyTeam([]); setLogsSimulacao([]); setCurrentRolledTeam(null); }}
            style={{ width: '100%', marginTop: '20px', padding: '12px', background: '#fff', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            🔄 Novo Draft
          </button>
        </div>
      )}
    </div>
  );
}