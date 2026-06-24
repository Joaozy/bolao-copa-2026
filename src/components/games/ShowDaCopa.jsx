'use client'
import { useState, useEffect } from 'react'
import perguntasJson from './dados/perguntas.json' // Ajuste o caminho conforme necessário

// --- ESCADA DE PRÊMIOS EXATA ---
export const prizeLadder = [
  { step: 1, acertar: 1000, parar: 0, errar: 0 },
  { step: 2, acertar: 2000, parar: 1000, errar: 0 },
  { step: 3, acertar: 3000, parar: 2000, errar: 1000 },
  { step: 4, acertar: 4000, parar: 3000, errar: 2000 },
  { step: 5, acertar: 5000, parar: 4000, errar: 3000 },
  { step: 6, acertar: 10000, parar: 5000, errar: 4000 },
  { step: 7, acertar: 20000, parar: 10000, errar: 5000 },
  { step: 8, acertar: 30000, parar: 20000, errar: 10000 },
  { step: 9, acertar: 40000, parar: 30000, errar: 20000 },
  { step: 10, acertar: 50000, parar: 40000, errar: 30000 },
  { step: 11, acertar: 100000, parar: 50000, errar: 40000 },
  { step: 12, acertar: 200000, parar: 100000, errar: 50000 },
  { step: 13, acertar: 300000, parar: 200000, errar: 100000 },
  { step: 14, acertar: 400000, parar: 300000, errar: 200000 },
  { step: 15, acertar: 500000, parar: 400000, errar: 300000 },
  { step: 16, acertar: 1000000, parar: 500000, errar: 0 } // Pergunta do Milhão
]

// --- FUNÇÃO PARA EMBARALHAR ARRAYS ---
const shuffle = (array) => [...array].sort(() => Math.random() - 0.5)

export default function ShowDaCopa() {
  const [gameState, setGameState] = useState('start') // start, playing, gameover, victory
  const [activeQuestions, setActiveQuestions] = useState([])
  const [reservePool, setReservePool] = useState({ facil: [], medio: [], dificil: [] })
  const [currentIndex, setCurrentIndex] = useState(0)
  const [earnedPrize, setEarnedPrize] = useState(0)
  
  // --- ESTADOS DE AJUDA ---
  const [skipsLeft, setSkipsLeft] = useState(3)
  const [usedCards, setUsedCards] = useState(false)
  const [usedIA, setUsedIA] = useState(false)
  const [usedVAR, setUsedVAR] = useState(false)
  
  // --- ESTADOS VISUAIS (TELA) ---
  const [eliminatedOptions, setEliminatedOptions] = useState([])
  const [iaData, setIaData] = useState(null)
  const [varMessage, setVarMessage] = useState('')
  const [showCardsModal, setShowCardsModal] = useState(false)
  
  // --- INICIALIZAR O JOGO ---
  const startGame = () => {
    // 1. Separar perguntas por dificuldade
    const facil = shuffle(perguntasJson.filter(p => p.difficulty === 'facil'))
    const medio = shuffle(perguntasJson.filter(p => p.difficulty === 'medio'))
    const dificil = shuffle(perguntasJson.filter(p => p.difficulty === 'dificil'))

    // 2. Montar as 16 perguntas principais (5 fáceis, 5 médias, 6 difíceis incluindo o milhão)
    const mainQuestions = [
      ...facil.slice(0, 5),
      ...medio.slice(0, 5),
      ...dificil.slice(0, 6)
    ]

    // 3. Guardar o resto para os Pulos (Reservas)
    setReservePool({
      facil: facil.slice(5),
      medio: medio.slice(5),
      dificil: dificil.slice(6)
    })

    setActiveQuestions(mainQuestions)
    setCurrentIndex(0)
    setEarnedPrize(0)
    
    // Resetar Ajudas
    setSkipsLeft(3)
    setUsedCards(false)
    setUsedIA(false)
    setUsedVAR(false)
    setEliminatedOptions([])
    setIaData(null)
    setVarMessage('')
    
    setGameState('playing')
  }

  // --- LÓGICA DE RESPOSTA ---
  const handleAnswer = (selectedIndex) => {
    const currentQ = activeQuestions[currentIndex]
    const currentLadder = prizeLadder[currentIndex]
    const isMillion = currentIndex === 15

    if (selectedIndex === currentQ.answerIndex) {
      // ACERTOU
      if (isMillion) {
        setEarnedPrize(currentLadder.acertar)
        setGameState('victory')
      } else {
        // Avança de fase
        setEarnedPrize(currentLadder.acertar)
        setEliminatedOptions([])
        setIaData(null)
        setVarMessage('')
        setCurrentIndex(prev => prev + 1)
      }
    } else {
      // ERROU
      setEarnedPrize(currentLadder.errar)
      setGameState('gameover')
    }
  }

  // --- LÓGICA DE PARAR ---
  const handleStop = () => {
    const currentLadder = prizeLadder[currentIndex]
    setEarnedPrize(currentLadder.parar)
    setGameState('gameover')
  }

  // --- AJUDA: PULAR ---
  const handleSkip = () => {
    if (skipsLeft <= 0 || currentIndex === 15) return // Não pula no milhão
    
    const currentDifficulty = activeQuestions[currentIndex].difficulty
    const pool = reservePool[currentDifficulty]
    
    if (pool.length > 0) {
      const newQuestion = pool.pop()
      const newActive = [...activeQuestions]
      newActive[currentIndex] = newQuestion
      
      setActiveQuestions(newActive)
      setReservePool({ ...reservePool, [currentDifficulty]: pool })
      setSkipsLeft(prev => prev - 1)
      
      // Limpa as dicas visuais da pergunta anterior
      setEliminatedOptions([])
      setIaData(null)
      setVarMessage('')
    }
  }

  // --- AJUDA: CARTÕES ---
  const handleDrawCard = () => {
    setShowCardsModal(false)
    setUsedCards(true)
    
    // Sorteia de 0 a 3 alternativas incorretas para eliminar
    const numToEliminate = Math.floor(Math.random() * 4) 
    if (numToEliminate === 0) return // Deu azar, não tira nenhuma

    const currentQ = activeQuestions[currentIndex]
    const wrongIndexes = [0, 1, 2, 3].filter(i => i !== currentQ.answerIndex)
    const shuffledWrongs = shuffle(wrongIndexes)
    
    setEliminatedOptions(shuffledWrongs.slice(0, numToEliminate))
  }

  // --- AJUDA: IAs UNIVERSITÁRIAS ---
  const handleIA = () => {
    setUsedIA(true)
    const currentQ = activeQuestions[currentIndex]
    const correctIdx = currentQ.answerIndex
    
    // A IA sempre dá a maior % para a certa, mas com margem de dúvida
    let remaining = 100
    const percentages = [0, 0, 0, 0]
    
    // A correta ganha entre 50% e 80%
    const correctPercent = Math.floor(Math.random() * 31) + 50 
    percentages[correctIdx] = correctPercent
    remaining -= correctPercent

    // Distribui o resto pelas opções não eliminadas
    const availableWrongs = [0, 1, 2, 3].filter(i => i !== correctIdx && !eliminatedOptions.includes(i))
    
    availableWrongs.forEach((idx, i) => {
      if (i === availableWrongs.length - 1) {
        percentages[idx] = remaining
      } else {
        const p = Math.floor(Math.random() * (remaining + 1))
        percentages[idx] = p
        remaining -= p
      }
    })

    setIaData(percentages)
  }

  // --- AJUDA: VAR ---
  const handleVAR = () => {
    setUsedVAR(true)
    setVarMessage(activeQuestions[currentIndex].var_hint)
  }

  // =======================================================================
  // RENDERIZAÇÃO
  // =======================================================================

  if (gameState === 'start') {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
        <h1 className="text-5xl font-extrabold text-yellow-400 mb-6 text-center drop-shadow-lg">
          ⚽ Show Da Copa
        </h1>
        <p className="text-gray-300 mb-8 max-w-md text-center text-lg">
          Responda a 16 perguntas sobre a história das Copas e tente chegar ao prêmio máximo fictício de 1 Milhão!
        </p>
        <button 
          onClick={startGame} 
          className="bg-green-600 hover:bg-green-500 text-white font-bold py-4 px-12 rounded-full text-xl shadow-lg transition transform hover:scale-105"
        >
          COMEÇAR O JOGO
        </button>
      </div>
    )
  }

  if (gameState === 'gameover' || gameState === 'victory') {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
        <h1 className={`text-6xl font-extrabold mb-4 ${gameState === 'victory' ? 'text-yellow-400' : 'text-red-500'}`}>
          {gameState === 'victory' ? '🏆 VOCÊ VENCEU!' : 'FIM DE JOGO'}
        </h1>
        <p className="text-2xl text-gray-300 mb-2">Seu prêmio final foi de:</p>
        <div className="text-5xl font-black text-green-400 mb-8 bg-gray-800 px-8 py-4 rounded-xl border border-gray-700">
          R$ {earnedPrize.toLocaleString('pt-BR')}
        </div>
        <button 
          onClick={startGame} 
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded-full shadow-lg transition"
        >
          JOGAR NOVAMENTE
        </button>
      </div>
    )
  }

  // --- TELA DE JOGO ---
  const currentQ = activeQuestions[currentIndex]
  const currentLadder = prizeLadder[currentIndex]
  const isMillion = currentIndex === 15

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 pb-32 flex flex-col items-center">
      
      {/* HEADER: Prêmios e Pergunta */}
      <div className="w-full max-w-3xl flex justify-between items-center mb-6 bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-md">
        <div className="text-gray-400 font-bold">
          Pergunta <span className="text-yellow-400 text-xl">{currentIndex + 1}</span> / 16
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500 uppercase tracking-widest">Prêmio Atual</div>
          <div className="text-2xl font-black text-green-400">R$ {earnedPrize.toLocaleString('pt-BR')}</div>
        </div>
      </div>

      {/* ÁREA DA PERGUNTA */}
      <div className="w-full max-w-3xl bg-blue-900/40 border border-blue-500/30 p-6 rounded-2xl mb-8 shadow-xl">
        <h2 className="text-2xl md:text-3xl font-bold text-white text-center leading-relaxed">
          {currentQ.question}
        </h2>
      </div>

      {/* AJUDAS (Desabilitadas na pergunta do milhão) */}
      {!isMillion && (
        <div className="w-full max-w-3xl flex justify-center gap-3 md:gap-6 mb-8">
          <button onClick={handleSkip} disabled={skipsLeft === 0} className={`flex flex-col items-center p-3 rounded-lg border transition ${skipsLeft > 0 ? 'bg-gray-800 border-gray-600 hover:bg-gray-700' : 'bg-gray-900 border-gray-800 text-gray-600 opacity-50 cursor-not-allowed'}`}>
            <span className="text-2xl mb-1">⏭️</span>
            <span className="text-xs font-bold">Pular ({skipsLeft})</span>
          </button>
          
          <button onClick={() => setShowCardsModal(true)} disabled={usedCards} className={`flex flex-col items-center p-3 rounded-lg border transition ${!usedCards ? 'bg-gray-800 border-gray-600 hover:bg-gray-700' : 'bg-gray-900 border-gray-800 text-gray-600 opacity-50 cursor-not-allowed'}`}>
            <span className="text-2xl mb-1">🃏</span>
            <span className="text-xs font-bold">Cartões</span>
          </button>

          <button onClick={handleIA} disabled={usedIA} className={`flex flex-col items-center p-3 rounded-lg border transition ${!usedIA ? 'bg-gray-800 border-gray-600 hover:bg-gray-700' : 'bg-gray-900 border-gray-800 text-gray-600 opacity-50 cursor-not-allowed'}`}>
            <span className="text-2xl mb-1">🤖</span>
            <span className="text-xs font-bold">IAs</span>
          </button>

          <button onClick={handleVAR} disabled={usedVAR} className={`flex flex-col items-center p-3 rounded-lg border transition ${!usedVAR ? 'bg-gray-800 border-gray-600 hover:bg-gray-700' : 'bg-gray-900 border-gray-800 text-gray-600 opacity-50 cursor-not-allowed'}`}>
            <span className="text-2xl mb-1">📺</span>
            <span className="text-xs font-bold">VAR</span>
          </button>
        </div>
      )}

      {/* RENDERIZAÇÃO DAS DICAS (IA e VAR) */}
      {varMessage && (
        <div className="w-full max-w-3xl bg-yellow-900/30 border border-yellow-500/50 p-4 rounded-lg mb-6 text-yellow-300 font-semibold text-center animate-pulse">
          📺 ÁUDIO DO VAR: "{varMessage}"
        </div>
      )}

      {iaData && (
        <div className="w-full max-w-3xl flex justify-around bg-gray-800 p-4 rounded-lg mb-6 border border-gray-700">
          {['A', 'B', 'C', 'D'].map((letter, idx) => (
            <div key={idx} className="flex flex-col items-center">
              <div className="h-24 w-8 bg-gray-900 rounded-t flex items-end justify-center pb-1">
                <div className="w-full bg-blue-500 rounded-t" style={{ height: `${iaData[idx]}%` }}></div>
              </div>
              <span className="mt-2 font-bold text-xs">{letter}: {iaData[idx]}%</span>
            </div>
          ))}
        </div>
      )}

      {/* ALTERNATIVAS */}
      <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-4">
        {currentQ.options.map((opt, idx) => {
          const isEliminated = eliminatedOptions.includes(idx)
          const letter = ['A', 'B', 'C', 'D'][idx]
          
          if (isEliminated) {
             return <div key={idx} className="bg-gray-900/50 border border-gray-800 p-4 rounded-xl opacity-20"></div>
          }

          return (
            <button 
              key={idx} 
              onClick={() => handleAnswer(idx)}
              className="bg-gray-800 hover:bg-blue-800 border border-gray-600 hover:border-blue-400 p-4 rounded-xl text-left font-semibold text-lg transition flex items-center group shadow"
            >
              <span className="bg-gray-900 text-yellow-500 font-bold w-10 h-10 flex items-center justify-center rounded-full mr-4 group-hover:bg-blue-900">
                {letter}
              </span>
              {opt}
            </button>
          )
        })}
      </div>

      {/* BOTTOM BAR: Parar / Errar / Acertar */}
      <div className="fixed bottom-0 left-0 w-full bg-gray-950 border-t border-gray-800 p-4 flex justify-center gap-2 md:gap-8 z-40">
        <button onClick={handleStop} className="flex flex-col items-center bg-yellow-600 hover:bg-yellow-500 text-black px-6 py-2 rounded-lg font-bold transition">
          <span className="text-xs uppercase">Parar</span>
          <span className="text-lg">R$ {currentLadder.parar.toLocaleString('pt-BR')}</span>
        </button>
        <div className="flex flex-col items-center bg-gray-900 text-red-500 border border-red-900/50 px-6 py-2 rounded-lg font-bold opacity-80">
          <span className="text-xs uppercase">Se Errar</span>
          <span className="text-lg">R$ {currentLadder.errar.toLocaleString('pt-BR')}</span>
        </div>
        <div className="flex flex-col items-center bg-gray-900 text-green-400 border border-green-900/50 px-6 py-2 rounded-lg font-bold opacity-80">
          <span className="text-xs uppercase">Se Acertar</span>
          <span className="text-lg">R$ {currentLadder.acertar.toLocaleString('pt-BR')}</span>
        </div>
      </div>

      {/* MODAL: CARTÕES */}
      {showCardsModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-gray-800 p-8 rounded-2xl border border-gray-600 text-center max-w-md w-full">
            <h3 className="text-2xl font-bold text-yellow-400 mb-2">O Jogo dos Cartões</h3>
            <p className="text-gray-300 mb-6 text-sm">Escolha uma carta. Ela eliminará de 0 a 3 alternativas erradas!</p>
            
            <div className="flex justify-center gap-4 mb-6">
              {[1, 2, 3, 4].map((c) => (
                <button 
                  key={c}
                  onClick={handleDrawCard}
                  className="w-16 h-24 bg-gradient-to-br from-gray-700 to-gray-900 border-2 border-gray-500 rounded-lg shadow-lg hover:scale-110 transition flex items-center justify-center font-bold text-2xl"
                >
                  ❓
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500">Dependendo da sua sorte, o cartão pode não eliminar nenhuma opção.</p>
          </div>
        </div>
      )}

    </div>
  )
}