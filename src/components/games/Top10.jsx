'use client';
import { useState, useEffect, useRef } from 'react';

// 🗄️ ESTRUTURA DO BANCO DE DADOS (Pode virar um .json externo depois)
const DESAFIOS_DB = [
  {
    id: 1,
    tema: "Artilheiros da Copa do Mundo (Todos os Tempos)",
    jogadores: [
      { id: 1,  nome: "Miroslav Klose",     aceitos: ["miroslav klose", "klose"],                 nacionalidade: "Alemanha", flag_url: "https://flagcdn.com/w40/de.png" },
      { id: 2,  nome: "Ronaldo",            aceitos: ["ronaldo", "ronaldo fenomeno", "fenomeno"], nacionalidade: "Brasil",   flag_url: "https://flagcdn.com/w40/br.png" },
      { id: 3,  nome: "Gerd Müller",        aceitos: ["gerd muller", "muller", "gerd mueller"],   nacionalidade: "Alemanha", flag_url: "https://flagcdn.com/w40/de.png" },
      { id: 4,  nome: "Just Fontaine",      aceitos: ["just fontaine", "fontaine"],               nacionalidade: "França",   flag_url: "https://flagcdn.com/w40/fr.png" },
      { id: 5,  nome: "Lionel Messi",       aceitos: ["lionel messi", "messi"],                   nacionalidade: "Argentina",flag_url: "https://flagcdn.com/w40/ar.png" },
      { id: 6,  nome: "Pelé",               aceitos: ["pele"],                                    nacionalidade: "Brasil",   flag_url: "https://flagcdn.com/w40/br.png" },
      { id: 7,  nome: "Kylian Mbappé",      aceitos: ["kylian mbappe", "mbappe"],                 nacionalidade: "França",   flag_url: "https://flagcdn.com/w40/fr.png" },
      { id: 8,  nome: "Sándor Kocsis",      aceitos: ["sandor kocsis", "kocsis"],                 nacionalidade: "Hungria",  flag_url: "https://flagcdn.com/w40/hu.png" },
      { id: 9,  nome: "Jürgen Klinsmann",   aceitos: ["jurgen klinsmann", "klinsmann"],           nacionalidade: "Alemanha", flag_url: "https://flagcdn.com/w40/de.png" },
      { id: 10, nome: "Grzegorz Kohl",      aceitos: ["helmut rahn", "rahn"],                     nacionalidade: "Alemanha", flag_url: "https://flagcdn.com/w40/de.png" } // Usando Helmut Rahn como placeholder real
    ]
  }
];

// 🧹 Função para limpar acentos e espaços extras da digitação
const normalizarTexto = (texto) => {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
};

export default function Top10() {
  const [step, setStep] = useState('setup');
  const [timerMode, setTimerMode] = useState(0); // 0 = Normal, 120 = 2 Minutos
  
  const [desafioAtual, setDesafioAtual] = useState(null);
  const [acertos, setAcertos] = useState([]);
  const [busca, setBusca] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  
  const timerRef = useRef(null);
  const inputRef = useRef(null);

  // ⏱️ Motor do Cronômetro
  useEffect(() => {
    if (step === 'playing' && timerMode > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setStep('finished'); // Morte súbita!
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [step, timerMode]);

  // Foco automático no campo de texto
  useEffect(() => {
    if (step === 'playing' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [step]);

  const iniciarJogo = () => {
    // No futuro, isso pode ser um sorteio ou o "Desafio do Dia"
    setDesafioAtual(DESAFIOS_DB[0]); 
    setAcertos([]);
    setBusca('');
    if (timerMode > 0) setTimeLeft(timerMode);
    setStep('playing');
  };

  const tentarAdivinhar = (e) => {
    e.preventDefault();
    if (!busca) return;

    const palpiteLimpo = normalizarTexto(busca);
    
    // Procura no array de jogadores do desafio se o palpite bate com algum dos "aceitos"
    const jogadorEncontrado = desafioAtual.jogadores.find(jog => {
      // Se ele já acertou esse, ignora
      if (acertos.includes(jog.id)) return false;
      
      const nomesAceitos = jog.aceitos.map(n => normalizarTexto(n));
      return nomesAceitos.includes(palpiteLimpo);
    });

    if (jogadorEncontrado) {
      const novosAcertos = [...acertos, jogadorEncontrado.id];
      setAcertos(novosAcertos);
      setBusca('');
      
      // Checa vitória total
      if (novosAcertos.length === 10) {
        clearInterval(timerRef.current);
        setStep('finished');
      }
    } else {
      // Se errou ou já colocou, apenas limpa ou faz um efeito visual de tremor (opcional)
      setBusca('');
    }
  };

  const desistir = () => {
    clearInterval(timerRef.current);
    setStep('finished');
  };

  const reiniciar = () => {
    setStep('setup');
  };

  const compartilharStats = () => {
    const modo = timerMode === 120 ? '⏱️ Modo 2-Min' : '🧠 Modo Normal';
    const texto = `🏆 *Futbol11 Top 10*\n\n📝 Tema: ${desafioAtual.tema}\n✅ Acertos: ${acertos.length}/10\n${modo}\n\nConsegue bater meu score? Jogue aqui: https://bolao-aju.vercel.app/`;
    
    // Copia para a área de transferência
    navigator.clipboard.writeText(texto);
    alert('Resultado copiado para a área de transferência! Cole no WhatsApp.');
  };

  const miniTime = (t) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;

  return (
    <div style={{ minHeight:'100vh', background:'#0a0f1a', color:'#f4f1ea', fontFamily:"'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');
        *{box-sizing:border-box;} body{margin:0;}
        .t10-container{max-width:800px;margin:0 auto;padding:24px 16px 60px;}
        
        .t10-h1{font-family:'Oswald',sans-serif;font-weight:700;text-transform:uppercase; letter-spacing:.04em;text-align:center;font-size:clamp(26px,5vw,48px); background:linear-gradient(180deg,#fff,#f2c14e);-webkit-background-clip:text; background-clip:text;color:transparent;margin:4px 0 0;}
        .t10-sub{text-align:center;color:rgba(244,241,234,.6);font-size:14px;margin:6px 0 0;}

        .t10-card{background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.01)); border:1px solid rgba(244,241,234,.1);border-radius:14px; padding:24px;}
        .t10-pills{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;}
        .t10-pill{font-family:'JetBrains Mono',monospace;font-size:14px;padding:12px 24px; border-radius:999px;border:1px solid rgba(244,241,234,.22);background:transparent; color:#f4f1ea;cursor:pointer;transition:all .15s;}
        .t10-pill.on{background:#f2c14e;color:#1a1300;border-color:#f2c14e;font-weight:700;}

        .t10-btn{font-family:'Oswald',sans-serif;font-size:20px;font-weight:700; text-transform:uppercase;padding:18px 48px;border-radius:10px;border:none; background:linear-gradient(135deg,#f2c14e,#c9941f);color:#1a1300;cursor:pointer; transition:transform .15s;display:block;margin:24px auto 0; width:100%; max-width: 300px;}
        .t10-btn:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(242,193,78,.3);}

        .t10-input-group{display:flex; gap:10px; margin-bottom: 24px;}
        .t10-input{flex:1; padding:16px; border-radius:8px; border:2px solid rgba(244,241,234,.2); background:#070a12; color:#f4f1ea; font-family:'Inter',sans-serif; font-size:16px; outline:none; transition:border .2s;}
        .t10-input:focus{border-color:#f2c14e;}
        .t10-input::placeholder{color:rgba(244,241,234,.3);}
        .t10-submit{background:#f2c14e; color:#1a1300; font-family:'Oswald',sans-serif; font-weight:700; text-transform:uppercase; padding:0 24px; border-radius:8px; border:none; cursor:pointer;}

        .t10-grid{display:grid; grid-template-columns: repeat(2, 1fr); gap: 12px;}
        @media(max-width:600px){ .t10-grid{grid-template-columns: 1fr;} }

        .t10-slot{display:flex; align-items:center; background:rgba(255,255,255,.03); border:1px solid rgba(244,241,234,.1); border-radius:8px; padding:12px; min-height: 64px;}
        .t10-slot.acerto{background:rgba(111,209,122,.15); border-color:#6fd17a;}
        .t10-slot.missed{background:rgba(215,38,61,.15); border-color:#ff5252;}
        
        .t10-number{font-family:'JetBrains Mono',monospace; font-size:14px; font-weight:bold; color:rgba(244,241,234,.4); width: 30px;}
        .t10-flag{width:28px; height:18px; object-fit:cover; border-radius:3px; margin-right: 12px; border: 1px solid rgba(255,255,255,0.2);}
        .t10-name{font-family:'Oswald',sans-serif; font-size:16px; text-transform:uppercase; letter-spacing:.05em;}
        .t10-name.hidden{color:rgba(244,241,234,.2); letter-spacing: 4px;}
      `}</style>

      <div className="t10-container">
        <h1 className="t10-h1">Football Top 10</h1>
        <p className="t10-sub">Complete a lista baseado no tema. Quantos você consegue lembrar?</p>

        {/* ── TELA DE SETUP ── */}
        {step === 'setup' && (
          <div style={{ maxWidth: 520, margin: '36px auto 0' }}>
            <div className="t10-card">
              <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(244,241,234,.5)', textAlign: 'center', marginBottom: 16 }}>Modo de Jogo</p>
              
              <div className="t10-pills">
                <button className={`t10-pill ${timerMode === 0 ? 'on' : ''}`} onClick={() => setTimerMode(0)}>
                  🧠 Normal (Sem Tempo)
                </button>
                <button className={`t10-pill ${timerMode === 120 ? 'on' : ''}`} onClick={() => setTimerMode(120)}>
                  ⏱️ 2-Min Timer
                </button>
              </div>

              <div style={{ background: 'rgba(244,241,234,.05)', padding: 16, borderRadius: 8, marginTop: 24, fontSize: 13, color: 'rgba(244,241,234,.7)', lineHeight: 1.6 }}>
                <strong>Como jogar:</strong> O jogo revelará o tema e as nacionalidades (bandeiras) dos 10 jogadores do ranking. Digite o nome do jogador na caixa de texto. Se estiver certo, a posição dele é revelada.
              </div>
            </div>

            <button className="t10-btn" onClick={iniciarJogo}>
              Jogar Agora
            </button>
          </div>
        )}

        {/* ── TELA IN-GAME ── */}
        {step === 'playing' && desafioAtual && (
          <div style={{ marginTop: 32 }}>
            
            {/* CABEÇALHO DA PARTIDA */}
            <div style={{ background: '#1c180e', border: '2px solid #f2c14e', borderRadius: 12, padding: '20px', textAlign: 'center', marginBottom: 24 }}>
              <p style={{ fontFamily: "'JetBrains Mono',monospace", color: '#f2c14e', fontSize: 12, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>Tema do Desafio</p>
              <h2 style={{ fontFamily: "'Oswald',sans-serif", fontSize: 24, textTransform: 'uppercase', margin: 0 }}>{desafioAtual.tema}</h2>
            </div>

            {/* STATUS (PLACAR E CRONÔMETRO) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, padding: '0 8px' }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 18, fontWeight: 'bold' }}>
                Acertos: <span style={{ color: '#6fd17a' }}>{acertos.length}</span><span style={{ color: 'rgba(244,241,234,.4)' }}>/10</span>
              </div>
              
              {timerMode > 0 && (
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 22, fontWeight: 'bold', color: timeLeft <= 15 ? '#ff5252' : '#f2c14e' }}>
                  ⏱️ {miniTime(timeLeft)}
                </div>
              )}
            </div>

            {/* INPUT DE PALPITES */}
            <form onSubmit={tentarAdivinhar} className="t10-input-group">
              <input 
                ref={inputRef}
                type="text" 
                className="t10-input"
                placeholder="Adivinhe um jogador..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                autoComplete="off"
              />
              <button type="submit" className="t10-submit">Chutar</button>
            </form>

            {/* LISTA DOS TOP 10 */}
            <div className="t10-grid">
              {desafioAtual.jogadores.map((jog, index) => {
                const acertou = acertos.includes(jog.id);
                return (
                  <div key={jog.id} className={`t10-slot ${acertou ? 'acerto' : ''}`}>
                    <div className="t10-number">{index + 1}.</div>
                    <img src={jog.flag_url} alt={jog.nacionalidade} className="t10-flag" title={jog.nacionalidade} />
                    <div className={`t10-name ${!acertou ? 'hidden' : ''}`}>
                      {acertou ? jog.nome : '??????????'}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ textAlign: 'center', marginTop: 32 }}>
              <button onClick={desistir} style={{ background: 'transparent', border: 'none', color: '#ff5252', fontFamily: "'JetBrains Mono',monospace", textDecoration: 'underline', cursor: 'pointer' }}>
                🏳️ Desistir e revelar respostas
              </button>
            </div>
          </div>
        )}

        {/* ── TELA DE FINALIZAÇÃO ── */}
        {step === 'finished' && desafioAtual && (
          <div style={{ marginTop: 32 }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <h2 style={{ fontFamily: "'Oswald',sans-serif", fontSize: 40, textTransform: 'uppercase', color: acertos.length === 10 ? '#f2c14e' : '#f4f1ea', margin: 0 }}>
                {acertos.length === 10 ? '🏆 Perfeito!' : 'Fim de Jogo!'}
              </h2>
              <p style={{ color: 'rgba(244,241,234,.6)', fontSize: 18, marginTop: 8 }}>
                Você acertou <strong>{acertos.length}</strong> de 10 em "{desafioAtual.tema}"
              </p>
            </div>

            {/* LISTA REVELADA */}
            <div className="t10-grid" style={{ marginBottom: 32 }}>
              {desafioAtual.jogadores.map((jog, index) => {
                const acertou = acertos.includes(jog.id);
                return (
                  <div key={jog.id} className={`t10-slot ${acertou ? 'acerto' : 'missed'}`}>
                    <div className="t10-number" style={{ color: acertou ? 'rgba(255,255,255,.6)' : '#ff8a93' }}>{index + 1}.</div>
                    <img src={jog.flag_url} alt={jog.nacionalidade} className="t10-flag" />
                    <div className="t10-name" style={{ color: acertou ? '#fff' : '#ff8a93' }}>
                      {jog.nome}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* AÇÕES FINAIS */}
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={compartilharStats} style={{ padding: '16px 32px', borderRadius: 8, background: '#f2c14e', color: '#1a1300', fontFamily: "'Oswald',sans-serif", fontSize: 18, textTransform: 'uppercase', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>
                📲 Compartilhar Stats
              </button>
              <button onClick={reiniciar} style={{ padding: '16px 32px', borderRadius: 8, background: 'transparent', border: '2px solid rgba(244,241,234,.3)', color: '#f4f1ea', fontFamily: "'Oswald',sans-serif", fontSize: 18, textTransform: 'uppercase', fontWeight: 'bold', cursor: 'pointer' }}>
                🔄 Voltar ao Início
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}