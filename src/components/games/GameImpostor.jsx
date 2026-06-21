'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import ALL_CHALLENGES from './impostorChallenges.json'

const shuffleArray = (array) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

export default function GameImpostor({ onBack }) {
  const [challenge, setChallenge] = useState(null)
  const [board, setBoard] = useState([])
  const [selectedIDs, setSelectedIDs] = useState([])
  const [status, setStatus] = useState('playing')
  const [playedIds, setPlayedIds] = useState([]) // Memória de jogos da sessão
  
  const loadRandomChallenge = () => {
    // Filtra os desafios que ainda não foram jogados
    let available = ALL_CHALLENGES.filter(c => !playedIds.includes(c.id));
    
    // Se zerou o jogo (jogou todos os 50), reseta a memória
    if (available.length === 0) {
      available = ALL_CHALLENGES;
      setPlayedIds([]);
    }
    
    // Sorteia um novo
    const randomIndex = Math.floor(Math.random() * available.length);
    const currentChallenge = available[randomIndex];
    
    // Salva na memória para não repetir
    setPlayedIds(prev => [...prev, currentChallenge.id]);
    
    const shuffledCorrect = shuffleArray(currentChallenge.correct).slice(0, 6);
    const shuffledImpostors = shuffleArray(currentChallenge.impostors).slice(0, 6);
    
    const rawBoard = [
      ...shuffledCorrect.map(name => ({ id: `C-${name}`, name, isImpostor: false })),
      ...shuffledImpostors.map(name => ({ id: `I-${name}`, name, isImpostor: true }))
    ];
    
    setChallenge(currentChallenge);
    setBoard(shuffleArray(rawBoard));
    setSelectedIDs([]);
    setStatus('playing');
  };

  // Carrega o primeiro jogo ao abrir a tela
  useEffect(() => {
    loadRandomChallenge();
  }, []);

  const handleCardClick = (card) => {
    if (status !== 'playing' || selectedIDs.includes(card.id)) return;

    if (card.isImpostor) {
      setSelectedIDs([...selectedIDs, card.id]);
      setStatus('lost');
    } else {
      const newSelected = [...selectedIDs, card.id];
      setSelectedIDs(newSelected);
      if (newSelected.filter(id => id.startsWith('C-')).length === 6) {
        setStatus('won');
      }
    }
  };

  if (!challenge) return <div className="text-white text-center p-10">Aquecendo os motores...</div>;

  const correctCount = selectedIDs.filter(id => id.startsWith('C-')).length;

  return (
    <div className="max-w-3xl mx-auto flex flex-col items-center">
      
      <div className="w-full flex justify-between items-center mb-6">
        <button onClick={onBack} className="text-gray-400 hover:text-white transition flex items-center gap-2">
          ← Voltar
        </button>
        <div className="bg-blue-900/50 text-blue-300 px-4 py-1 rounded-full text-sm font-bold border border-blue-700">
          O Impostor da Copa 🕵️‍♂️
        </div>
      </div>

      <div className="bg-gray-800 w-full p-6 rounded-xl border border-gray-700 text-center mb-8 shadow-lg">
        <h2 className="text-2xl font-black text-white mb-2">{challenge.title}</h2>
        <p className="text-gray-400 text-sm">{challenge.description}</p>
        
        <div className="mt-4 flex justify-center items-center gap-4">
          <div className="bg-gray-900 px-6 py-3 rounded-lg border border-gray-700 shadow-inner">
            <span className="text-sm text-gray-400 block mb-1">Acertos</span>
            <span className="text-3xl font-black text-green-400">{correctCount} <span className="text-gray-600 text-xl">/ 6</span></span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 w-full mb-8">
        {board.map((card) => {
          const isSelected = selectedIDs.includes(card.id);
          const isGameOver = status !== 'playing';
          
          let cardStyle = "bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-blue-500";
          if (isSelected) {
            cardStyle = card.isImpostor 
              ? "bg-red-900/80 border-red-500 text-red-200"
              : "bg-green-900/80 border-green-500 text-green-200";
          } else if (isGameOver) {
            if (card.isImpostor) cardStyle = "bg-gray-900 border-red-900/50 text-red-500/50 opacity-60";
            if (!card.isImpostor) cardStyle = "bg-gray-900 border-green-900/50 text-green-500/50 opacity-60";
          }

          return (
            <motion.button
              key={card.id}
              whileHover={status === 'playing' && !isSelected ? { scale: 1.05 } : {}}
              whileTap={status === 'playing' && !isSelected ? { scale: 0.95 } : {}}
              onClick={() => handleCardClick(card)}
              disabled={isSelected || isGameOver}
              className={`p-4 rounded-xl border-2 font-bold text-sm md:text-base transition-all duration-300 shadow-md flex items-center justify-center min-h-[80px] ${cardStyle}`}
            >
              {card.name}
              {isSelected && card.isImpostor && <span className="absolute top-2 right-2 text-xl">❌</span>}
              {isSelected && !card.isImpostor && <span className="absolute top-2 right-2 text-xl">✅</span>}
            </motion.button>
          )
        })}
      </div>

      {status !== 'playing' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`w-full p-6 rounded-xl border text-center ${
            status === 'won' ? 'bg-green-900/40 border-green-500' : 'bg-red-900/40 border-red-500'
          }`}
        >
          <h3 className={`text-3xl font-black mb-2 ${status === 'won' ? 'text-green-400' : 'text-red-400'}`}>
            {status === 'won' ? 'VISÃO DE JOGO PERFEITA! 🏆' : 'VOCÊ CAIU NO GOLPE! 🚨'}
          </h3>
          <p className="text-gray-300 mb-6">
            {status === 'won' 
              ? 'Você encontrou todos os jogadores corretos e fugiu dos impostores.' 
              : 'Você selecionou um Impostor que não pertence a essa categoria!'}
          </p>
          
          <div className="flex flex-col md:flex-row justify-center gap-4">
            <button 
              onClick={loadRandomChallenge}
              className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-8 rounded-full transition border border-gray-500"
            >
              🔄 Jogar Novamente
            </button>
            <button 
              onClick={() => {
                const texto = status === 'won' 
                  ? `🏆 Joguei "O Impostor" no Bolão Copa 2026 e acertei TUDO!\nCategoria: ${challenge.title}\n\nConsegue bater meu recorde? Acesse bolao-aju.vercel.app`
                  : `🚨 Fui enganado no "O Impostor" do Bolão Copa 2026!\nCategoria: ${challenge.title}\nAcertos: ${correctCount}/6\n\nTente fazer melhor: bolao-aju.vercel.app`;
                navigator.clipboard.writeText(texto);
                alert('Copiado para a área de transferência!');
              }}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded-full transition shadow-[0_0_15px_rgba(37,99,235,0.5)]"
            >
              📱 Compartilhar
            </button>
          </div>
        </motion.div>
      )}

    </div>
  )
}