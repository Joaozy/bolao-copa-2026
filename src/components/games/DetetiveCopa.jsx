'use client';
import { useState, useEffect, useRef } from 'react';
import { loadCopaTimes } from '@/components/games/gameConstants';
import JOGADORES_COPA from '@/components/games/dados/jogadoresCopa.json';
import DETETIVE_DB from '@/components/games/dados/detetive.json';

const normalizarTexto = (t) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

// Embaralhador
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function DetetiveCopa() {
  const [step, setStep] = useState('setup'); // setup, playing, round_result, gameover
  const [misteriosDaPartida, setMisteriosDaPartida] = useState([]);
  
  // 🧠 NOVO: Pool de Autocomplete (Jogadores 2026 + Lendas do Detetive)
  const [poolBusca, setPoolBusca] = useState([]);

  // Estados Globais da Partida
  const [rodadaAtual, setRodadaAtual] = useState(1);
  const [pontuacaoTotal, setPontuacaoTotal] = useState(0);

  // Estados da Rodada Atual
  const [misterioAtual, setMisterioAtual] = useState(null);
  const [tentativa, setTentativa] = useState(1); // 1 a 10 (10 dicas)
  const [palpitesErrados, setPalpitesErrados] = useState([]);
  const [pontosGanhosNaRodada, setPontosGanhosNaRodada] = useState(0);

  // Autocomplete
  const [input, setInput] = useState("");
  const [sugestoes, setSugestoes] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    async function prepararBancoDeBusca() {
      const times = await loadCopaTimes();
      
      // Mapeia os times para tentar puxar a bandeira das lendas, se o nome bater
      const timesMapByName = {};
      times.forEach(t => { timesMapByName[t.name.toLowerCase()] = t; });

      // 1. Pega os jogadores da Copa atual
      const atuais = JOGADORES_COPA.map(j => ({
        ...j,
        team_name: times.find(t => String(t.id) === String(j.team_id))?.name || 'Nação',
        badge_url: times.find(t => String(t.id) === String(j.team_id))?.badge_url || null
      }));

      // 2. Transforma o nosso banco de lendas em "Perfis" pesquisáveis
      const lendasInjetadas = DETETIVE_DB.map(lenda => ({
        id: `lenda-${lenda.id}`,
        name: lenda.nome,
        team_name: lenda.nacionalidade,
        badge_url: timesMapByName[lenda.nacionalidade.toLowerCase()]?.badge_url || null,
        pos1: 'ÍCONE', // Classe especial para eles!
        overall: 99    // Força máxima
      }));

      // 3. Mistura tudo no estado que a barra de pesquisa vai ler
      setPoolBusca([...atuais, ...lendasInjetadas]);
    }
    prepararBancoDeBusca();
  }, []);

  const iniciarJogo = () => {
    const sorteados = shuffleArray(DETETIVE_DB).slice(0, 10);
    setMisteriosDaPartida(sorteados);
    setPontuacaoTotal(0);
    prepararRodada(1, sorteados);
    setStep('playing');
  };

  const prepararRodada = (numeroRodada, misterios) => {
    setRodadaAtual(numeroRodada);
    setMisterioAtual(misterios[numeroRodada - 1]);
    setTentativa(1);
    setPalpitesErrados([]);
    setPontosGanhosNaRodada(0);
    setInput("");
    setSugestoes([]);
    if (inputRef.current) setTimeout(() => inputRef.current.focus(), 100);
  };

  const lidarComBusca = (texto) => {
    setInput(texto);
    if (texto.length >= 3) {
      const t = normalizarTexto(texto);
      // 🔥 Agora ele filtra pelo nosso Banco Misto (Atual + Lendas)
      const filtrados = poolBusca.filter(j => normalizarTexto(j.name).includes(t)).slice(0, 6);
      setSugestoes(filtrados);
    } else {
      setSugestoes([]);
    }
  };

  const avaliarPalpite = (nomeSugerido) => {
    setInput("");
    setSugestoes([]);
    const nomeLimpo = normalizarTexto(nomeSugerido);

    // Verifica se acertou baseado no array "aceitos" da lenda
    const acertou = misterioAtual.aceitos.map(a => normalizarTexto(a)).includes(nomeLimpo);

    if (acertou) {
      const pontos = (11 - tentativa) * 10; 
      setPontosGanhosNaRodada(pontos);
      setPontuacaoTotal(prev => prev + pontos);
      setStep('round_result');
    } else {
      setPalpitesErrados(prev => [...prev, nomeSugerido]);
      if (tentativa < 10) {
        setTentativa(prev => prev + 1);
        if (inputRef.current) inputRef.current.focus();
      } else {
        setPontosGanhosNaRodada(0);
        setStep('round_result');
      }
    }
  };

  const pularDica = () => {
    setInput("");
    setSugestoes([]);
    if (tentativa < 10) {
      setTentativa(prev => prev + 1);
      if (inputRef.current) inputRef.current.focus();
    } else {
      setPontosGanhosNaRodada(0);
      setStep('round_result');
    }
  };

  const proximaRodada = () => {
    if (rodadaAtual < 10) {
      prepararRodada(rodadaAtual + 1, misteriosDaPartida);
      setStep('playing');
    } else {
      setStep('gameover');
    }
  };

  return (
    <div style={{ minHeight:'100vh', background:'#08111f', color:'#f4f1ea', fontFamily:"'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');
        *{box-sizing:border-box;} body{margin:0;}
        .det-wrap{max-width:760px;margin:0 auto;padding:28px 16px 64px;}
        .det-h1{font-family:'Oswald',sans-serif;font-weight:700;text-transform:uppercase; font-size:clamp(32px,7vw,58px);text-align:center;margin:0; background:linear-gradient(160deg,#fff 30%,#f2c14e); -webkit-background-clip:text;background-clip:text;color:transparent;}
        .det-btn{font-family:'Oswald',sans-serif;font-size:18px;text-transform:uppercase;padding:16px 32px;border-radius:10px;border:none;background:#f2c14e;color:#1a1300;cursor:pointer;font-weight:bold;transition:transform 0.1s;}
        .det-btn:hover{transform:scale(1.03);}
        .det-card{background:#0d1a2e; border:1px solid rgba(242,193,78,.3); border-radius:12px; padding:20px; margin-bottom:20px;}
        .det-pista-box{background:rgba(255,255,255,.05); border-left:4px solid #f2c14e; padding:12px 16px; border-radius:4px; margin-bottom:12px;}
        .det-input{width:100%;background:#111;border:2px solid rgba(242,193,78,.4); border-radius:8px;padding:16px;font-size:16px;color:#fff;outline:none;}
        .det-input:focus{border-color:#f2c14e;}
        .det-sug{display:flex;align-items:center;gap:10px;padding:12px;cursor:pointer;border-bottom:1px solid #222; background:#111;}
        .det-sug:hover{background:#1a1a1a;}
      `}</style>

      <div className="det-wrap">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
           <div style={{ fontFamily: "'JetBrains Mono',monospace", color: '#f2c14e', fontSize: 13, textTransform: 'uppercase' }}>Detetive: Quem Sou Eu?</div>
           {step !== 'setup' && (
             <div style={{ background: 'rgba(242,193,78,.15)', border: '1px solid #f2c14e', padding: '6px 12px', borderRadius: 8, fontFamily: "'JetBrains Mono',monospace", fontWeight: 'bold', color: '#f2c14e' }}>
               Score: {pontuacaoTotal}
             </div>
           )}
        </div>
        
        {step === 'setup' && (
          <div style={{ textAlign: 'center', marginTop: 60 }}>
            <h1 className="det-h1">Quem Sou Eu?</h1>
            <p style={{ color: 'rgba(255,255,255,.6)', fontSize: 16, margin: '16px 0 40px', lineHeight: 1.5 }}>
              O clássico jogo de adivinhação. Serão 10 rodadas.<br/>
              A cada rodada, você receberá dicas sobre um jogador lendário.<br/>
              A 1ª dica é muito difícil, a 10ª é quase óbvia.<br/>
              Quanto mais cedo você adivinhar, mais pontos você ganha!
            </p>
            <button className="det-btn" onClick={iniciarJogo}>🕵️‍♂️ Iniciar Investigação</button>
          </div>
        )}

        {step === 'playing' && misterioAtual && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontFamily: "'JetBrains Mono',monospace", fontSize: 14 }}>
              <span>Rodada {rodadaAtual}/10</span>
              <span style={{ color: '#6fd17a' }}>Valendo: {(11 - tentativa) * 10} pts</span>
            </div>

            <div className="det-card">
              <h3 style={{ fontFamily: "'Oswald',sans-serif", fontSize: 24, margin: '0 0 16px', color: '#fff' }}>Dossiê Confidencial:</h3>
              
              {misterioAtual.dicas.slice(0, tentativa).map((dica, index) => (
                <div key={index} className="det-pista-box" style={{ opacity: index === tentativa - 1 ? 1 : 0.5 }}>
                  <div style={{ fontSize: 12, color: '#f2c14e', fontFamily: "'JetBrains Mono',monospace", marginBottom: 4 }}>Dica {index + 1}</div>
                  <div style={{ fontSize: 16, lineHeight: 1.4 }}>"{dica}"</div>
                </div>
              ))}
            </div>

            <div style={{ position: 'relative', marginBottom: 16 }}>
              <input 
                ref={inputRef} 
                type="text" 
                placeholder="Quem é o jogador?" 
                value={input} 
                onChange={e => lidarComBusca(e.target.value)} 
                autoComplete="off"
                className="det-input"
              />
              {sugestoes.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, borderRadius: 8, marginTop: 4, overflow: 'hidden', border: '1px solid #333' }}>
                  {sugestoes.map(j => (
                    <div key={j.id} className="det-sug" onClick={() => avaliarPalpite(j.name)}>
                      {j.badge_url && <img src={j.badge_url} alt="" style={{ width: 24, borderRadius: 2 }} />}
                      <span style={{ fontSize: 16, flex: 1 }}>{j.name}</span>
                      {j.pos1 === 'ÍCONE' && (
                        <span style={{ fontSize: 10, background: '#f2c14e', color: '#000', padding: '2px 6px', borderRadius: 4, fontWeight: 'bold' }}>⭐ Lenda</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {palpitesErrados.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase' }}>Chutes incorretos: </span>
                <span style={{ color: '#ff8a93', fontSize: 14 }}>{palpitesErrados.join(', ')}</span>
              </div>
            )}

            <button onClick={pularDica} style={{ width: '100%', padding: 16, background: 'transparent', border: '1px dashed rgba(255,255,255,.3)', color: '#fff', borderRadius: 8, cursor: 'pointer', fontFamily: "'JetBrains Mono',monospace" }}>
              {tentativa < 10 ? '👀 Pular e revelar próxima dica' : '🏳️ Desisto, revelar jogador'}
            </button>
          </div>
        )}

        {step === 'round_result' && misterioAtual && (
          <div style={{ textAlign: 'center', marginTop: 40 }}>
            <div style={{ background: pontosGanhosNaRodada > 0 ? 'rgba(34,197,94,.15)' : 'rgba(239,68,68,.15)', border: `2px solid ${pontosGanhosNaRodada > 0 ? '#22c55e' : '#ef4444'}`, borderRadius: 16, padding: 32 }}>
              <h2 style={{ fontFamily: "'Oswald',sans-serif", fontSize: 36, color: pontosGanhosNaRodada > 0 ? '#22c55e' : '#ef4444', margin: '0 0 8px' }}>
                {pontosGanhosNaRodada > 0 ? 'VOCÊ ACERTOU!' : 'NÃO FOI DESSA VEZ!'}
              </h2>
              
              <div style={{ margin: '24px 0' }}>
                <p style={{ color: 'rgba(255,255,255,.6)', fontSize: 14, textTransform: 'uppercase', marginBottom: 4 }}>O Jogador Misterioso era:</p>
                <div style={{ fontSize: 40, fontFamily: "'Oswald',sans-serif", color: '#fff' }}>{misterioAtual.nome}</div>
                <div style={{ fontSize: 16, color: '#f2c14e', marginTop: 4 }}>{misterioAtual.nacionalidade}</div>
              </div>

              <div style={{ display: 'inline-block', background: 'rgba(0,0,0,.3)', padding: '12px 24px', borderRadius: 8, fontSize: 24, fontWeight: 'bold' }}>
                +{pontosGanhosNaRodada} pts
              </div>
            </div>

            <button className="det-btn" onClick={proximaRodada} style={{ marginTop: 32, width: '100%' }}>
              {rodadaAtual < 10 ? 'Ir para a Próxima Rodada →' : 'Ver Resultado Final 🏆'}
            </button>
          </div>
        )}

        {step === 'gameover' && (
          <div style={{ textAlign: 'center', marginTop: 60 }}>
            <h1 className="det-h1">Fim de Jogo!</h1>
            <p style={{ fontSize: 20, color: 'rgba(255,255,255,.7)', marginTop: 20 }}>Sua pontuação final como Detetive:</p>
            
            <div style={{ fontSize: 80, fontFamily: "'Oswald',sans-serif", color: '#f2c14e', margin: '20px 0', textShadow: '0 4px 20px rgba(242,193,78,.4)' }}>
              {pontuacaoTotal}
            </div>

            <p style={{ fontSize: 18, color: '#fff', marginBottom: 40 }}>
              {pontuacaoTotal === 1000 ? 'Lenda Absoluta do Futebol! 👑' : 
               pontuacaoTotal >= 700 ? 'Excelente! Conhece muito da história! 🧠' : 
               pontuacaoTotal >= 400 ? 'Bom desempenho, mas dá para melhorar! 📊' : 
               'Pelo visto você assiste Copa desde 2022... 😅'}
            </p>

            <button className="det-btn" onClick={iniciarJogo}>Jogar Novamente</button>
          </div>
        )}
      </div>
    </div>
  );
}