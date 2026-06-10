'use client'
import React, { useState, useEffect } from 'react'

// Nova função para pegar a URL da bandeira de alta qualidade do FlagCDN
function getFlagUrl(countryCode) {
  if (!countryCode) return '';
  return `https://flagcdn.com/24x18/${countryCode.toLowerCase()}.png`;
}

// Componente refeito para exibir imagens ao invés de Emojis do sistema
const TeamBadge = ({ team }) => {
  const [imgSrc, setImgSrc] = useState(team?.badge_url)

  useEffect(() => { 
    setImgSrc(team?.badge_url) 
  }, [team?.badge_url])

  // Se der erro ao carregar a imagem do banco, tenta carregar uma local
  const handleError = () => {
    if (team?.name) {
      const slug = team.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-').replace(/[^\w\-]+/g, '') 
      const localPath = `/badges/${slug}.png`
      if (imgSrc !== localPath) setImgSrc(localPath)
    }
  }

  if (!team) return null
  
  // AQUI É A TRAVA DAS BANDEIRAS: 
  // Se não houver escudo salvo, desenhamos a bandeira do FlagCDN.
  // Evitamos usar o Emoji porque Androids antigos e Windows não renderizam eles.
  if (!imgSrc && team.flag_code) {
      return (
        <img 
          src={getFlagUrl(team.flag_code)} 
          alt={team.name} 
          className="w-6 h-4 inline mr-2 object-cover shadow-sm border border-gray-700 rounded-sm" 
        />
      )
  }
  
  return <img src={imgSrc} alt={team.name} className="w-6 h-6 inline mr-2 object-contain" onError={handleError} />
}

export default function GameCard({ game, values, isEditing, onChange, onToggleEdit }) {
  if (!game) return null;
  const isStarted = new Date(game.start_time) < new Date();

  const valA = values?.scoreA ?? ''
  const valB = values?.scoreB ?? ''
  const isLocked = isStarted && !isEditing

  const dataJogo = new Date(game.start_time)
  const isHoje = dataJogo.toDateString() === new Date().toDateString()
  const dataFormatada = isHoje 
    ? `Hoje, ${dataJogo.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
    : dataJogo.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

  // Usamos os nomes que já chegam traduzidos do page.js!
  const nomeTimeA = game.team_a?.name || '---'
  const nomeTimeB = game.team_b?.name || '---'

  return (
    <div className={`relative p-4 rounded-2xl border transition-all duration-300 shadow-md
      ${isLocked 
        ? 'bg-gray-800/40 border-gray-700 opacity-90 grayscale-[20%]' 
        : (isEditing 
            ? 'bg-gray-800 border-yellow-500 shadow-yellow-900/20 transform scale-[1.02] z-10' 
            : 'bg-gray-800 border-gray-600 hover:border-gray-500 hover:bg-gray-700/80')
      }
    `}>
      {/* Se no page.js passamos um "custom_status", exibe ele no lugar de "Encerrado" */}
      {isLocked && (
        <div className="absolute top-2 right-3 text-xs font-bold text-gray-400 bg-gray-900 px-2 py-0.5 rounded-full border border-gray-700">
          {game.custom_status || '🔒 Encerrado'}
        </div>
      )}
      
      {!isLocked && (
        <button 
          onClick={() => onToggleEdit(game.id)}
          className={`absolute top-2 right-2 p-2 rounded-full transition shadow text-xs
            ${isEditing ? 'bg-yellow-500 text-black hover:bg-yellow-400' : 'bg-gray-700 text-white hover:bg-gray-600'}
          `}
          title={isEditing ? 'Confirmar' : 'Editar Palpite'}
        >
          {isEditing ? '✓' : '✏️'}
        </button>
      )}

      <div className="text-center mb-4 pt-1">
        <span className="text-[10px] uppercase tracking-widest font-bold text-gray-400 bg-gray-900 px-3 py-1 rounded-full border border-gray-700">
          {game.competition?.name || 'Competição'} • {game.round || 'Fase'}
        </span>
        <div className={`text-xs mt-2 font-medium ${isHoje ? 'text-green-400' : 'text-gray-400'}`}>
          📅 {dataFormatada}
        </div>
      </div>

      <div className="flex justify-between items-center px-2">
        {/* TIME A */}
        <div className="flex flex-col items-center w-1/3">
          <div className="mb-2 p-2 bg-gray-900 rounded-full shadow-inner border border-gray-700">
             <TeamBadge team={game.team_a} />
          </div>
          <span className="text-xs font-bold text-center text-gray-200 line-clamp-2 h-8 leading-tight">{nomeTimeA}</span>
        </div>

        {/* PLACAR CENTRO */}
        <div className="flex items-center gap-3 w-1/3 justify-center mt-[-10px]">
          <input 
            type="number" 
            className={`w-12 h-12 text-center text-xl font-black rounded-xl border transition-all outline-none hide-arrows
              ${isLocked 
                ? 'bg-gray-900 border-gray-700 text-gray-400 cursor-not-allowed shadow-inner' 
                : (isEditing 
                    ? 'bg-gray-900 border-yellow-400 text-white shadow-inner focus:ring-2 focus:ring-yellow-500/50' 
                    : 'bg-gray-800 border-gray-600 text-white cursor-pointer hover:bg-gray-700')
              }
            `}
            value={valA}
            onChange={(e) => onChange(game.id, 'scoreA', e.target.value)}
            disabled={!isEditing}
            placeholder="-"
          />
          
          <span className="text-gray-500 font-black text-sm">x</span>
          
          <input 
            type="number" 
            className={`w-12 h-12 text-center text-xl font-black rounded-xl border transition-all outline-none hide-arrows
              ${isLocked 
                ? 'bg-gray-900 border-gray-700 text-gray-400 cursor-not-allowed shadow-inner' 
                : (isEditing 
                    ? 'bg-gray-900 border-yellow-400 text-white shadow-inner focus:ring-2 focus:ring-yellow-500/50' 
                    : 'bg-gray-800 border-gray-600 text-white cursor-pointer hover:bg-gray-700')
              }
            `}
            value={valB}
            onChange={(e) => onChange(game.id, 'scoreB', e.target.value)}
            disabled={!isEditing}
            placeholder="-"
          />
        </div>

        {/* TIME B */}
        <div className="flex flex-col items-center w-1/3">
          <div className="mb-2 p-2 bg-gray-900 rounded-full shadow-inner border border-gray-700">
             <TeamBadge team={game.team_b} />
          </div>
          <span className="text-xs font-bold text-center text-gray-200 line-clamp-2 h-8 leading-tight">{nomeTimeB}</span>
        </div>
      </div>
    </div>
  )
}