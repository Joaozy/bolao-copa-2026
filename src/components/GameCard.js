'use client'
import { useState, useEffect } from 'react'

// Função auxiliar para bandeiras
function getFlagEmoji(countryCode) {
  if (!countryCode) return '🏳️'
  return countryCode.toUpperCase().replace(/./g, char => String.fromCodePoint(char.charCodeAt(0) + 127397))
}

const TeamBadge = ({ team }) => {
  const [imgSrc, setImgSrc] = useState(team?.badge_url)
  useEffect(() => { setImgSrc(team?.badge_url) }, [team?.badge_url])
  const handleError = () => {
    if (team?.name) {
      const slug = team.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-').replace(/[^\w\-]+/g, '') 
      const localPath = `/badges/${slug}.png`
      if (imgSrc !== localPath) setImgSrc(localPath)
    }
  }
  if (!team) return null
  if (!imgSrc) return <span className="text-3xl">{getFlagEmoji(team.flag_code)}</span>
  return <img src={imgSrc} alt={team.name} className="h-10 w-auto object-contain drop-shadow-md" onError={handleError} />
}

export default function GameCard({ game, values, onChange, onToggleEdit, isEditing }) {
  const [travadoPeloHorario, setTravadoPeloHorario] = useState(false)

  if (!game) return null

  useEffect(() => {
    const checarHorario = () => {
      const agora = new Date()
      const dataJogo = new Date(game.start_time)
      if (agora >= dataJogo || game.is_finished) {
        setTravadoPeloHorario(true)
      } else {
        setTravadoPeloHorario(false)
      }
    }
    checarHorario()
  }, [game])

  const handleChange = (field, e) => {
    const valor = e.target.value
    if (valor === '' || (Number(valor) >= 0 && !valor.includes('-'))) {
      onChange(game.id, field, valor)
    }
  }

  // Verifica se tem placar válido (para mostrar na tela)
  const temPlacarOficial = (game.score_a !== null && game.score_a !== undefined) && 
                           (game.score_b !== null && game.score_b !== undefined)
  
  // CORREÇÃO: Só mostra o placar se tiver dados E (o jogo já começou OU já acabou)
  const shouldShowScore = temPlacarOficial && (travadoPeloHorario || game.is_finished)

  const inputsDisabled = travadoPeloHorario || !isEditing

  // --- NOVA LÓGICA DE BADGE (INTELIGENTE) ---
  const renderBadgePontos = () => {
    // CORREÇÃO DO ZERO: Verifica se é undefined ou null explicitamente. Se for 0, passa.
    if (values?.points_awarded === undefined || values?.points_awarded === null || !game.is_finished) return null
    
    const pts = values.points_awarded
    
    // Dados para comparação visual (independente dos pontos)
    const pA = Number(values.scoreA)
    const pB = Number(values.scoreB)
    const rA = game.score_a
    const rB = game.score_b

    let estilo = ''
    let textoTipo = ''

    // Lógica visual baseada no ACERTO, não nos pontos fixos
    if (pA === rA && pB === rB) {
        // NA MOSCA
        estilo = 'bg-yellow-500 text-black border-yellow-300 animate-pulse'
        textoTipo = 'NA MOSCA! 🎯'
    } else {
        const signP = Math.sign(pA - pB)
        const signR = Math.sign(rA - rB)

        if (signP === signR) {
            // Acertou vencedor/empate
            if (pA === rA || pB === rB || (pA - pB) === (rA - rB)) {
                // Vencedor + Gols ou Saldo
                estilo = 'bg-blue-600 text-white border-blue-400'
                textoTipo = 'QUASE! 🥈'
            } else {
                // Só Vencedor
                estilo = 'bg-green-600 text-white border-green-400'
                textoTipo = 'VENCEDOR ✅'
            }
        } else if (pA === rA || pB === rB) {
            // Errou vencedor mas acertou um placar
            estilo = 'bg-gray-600 text-gray-200 border-gray-400'
            textoTipo = 'CONSOLO 🤏'
        } else {
            // Errou tudo
            estilo = 'bg-red-900/80 text-red-200 border-red-800'
            textoTipo = 'ZICOU ❌'
        }
    }

    return (
        <div className={`mt-4 py-1 px-4 rounded font-bold text-center text-xs border uppercase tracking-wider ${estilo}`}>
            {textoTipo} +{pts}
        </div>
    )
  }

  return (
    <div className={`p-4 rounded-xl border w-full max-w-md mb-4 shadow-lg relative overflow-hidden transition-all 
      ${travadoPeloHorario ? 'bg-gray-800/80 border-gray-700 grayscale-[0.2]' : (isEditing ? 'bg-gray-800 border-yellow-500/50' : 'bg-gray-800 border-gray-700')}
    `}>
      
      {travadoPeloHorario && (
        <div className={`absolute top-0 left-0 w-full text-center text-[10px] font-bold py-1 uppercase ${game.is_finished ? 'bg-black/50 text-white' : 'bg-green-600 text-white animate-pulse'}`}>
          {game.is_finished ? 'Encerrado' : 'Em Andamento • Ao Vivo'}
        </div>
      )}

      {!travadoPeloHorario && (
        <button 
          onClick={() => onToggleEdit(game.id)}
          className={`absolute top-2 right-2 p-2 rounded-full transition shadow-md
            ${isEditing 
                ? 'bg-yellow-500 text-black hover:bg-yellow-400' 
                : 'bg-gray-700 text-gray-400 hover:text-white hover:bg-gray-600'}
          `}
          title={isEditing ? "Cancelar edição" : "Editar palpite"}
        >
          {isEditing ? '🔓' : '✏️'}
        </button>
      )}

      <div className="flex justify-center items-center mt-4 mb-4">
        {shouldShowScore ? (
          <div className={`flex items-center gap-3 px-4 py-2 rounded border min-w-[140px] justify-center ${game.is_finished ? 'bg-black/40 border-white/10' : 'bg-green-900/40 border-green-500/30'}`}>
             <span className="text-3xl font-black text-white">{game.score_a}</span>
             
             <div className="flex flex-col items-center justify-center min-w-[60px]">
                <span className={`text-[9px] uppercase font-bold tracking-widest ${game.is_finished ? 'text-gray-500' : 'text-green-400'}`}>
                   {game.is_finished ? 'Final' : 'Ao Vivo'}
                </span>
                
                {game.custom_status && (
                    <span className="text-[10px] font-mono text-yellow-300 animate-pulse font-bold mt-0.5">
                        {game.custom_status}
                    </span>
                )}
             </div>

             <span className="text-3xl font-black text-white">{game.score_b}</span>
          </div>
        ) : (
          <div className="text-gray-400 text-xs bg-gray-900/50 px-3 py-1 rounded flex items-center gap-2">
            <span>📅 {new Date(game.start_time).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'})}</span>
            <span>⏰ {new Date(game.start_time).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</span>
          </div>
        )}
      </div>
      
      <div className="flex justify-between items-center px-2">
        <div className="flex flex-col items-center w-1/3">
          <div className="mb-2 h-10 flex items-center justify-center"><TeamBadge team={game.team_a} /></div>
          <span className="font-bold text-center text-xs leading-tight line-clamp-1">{game.team_a?.name}</span>
        </div>

        <div className="flex flex-col items-center w-1/3">
          <div className="flex items-center gap-2">
            <input type="number" inputMode="numeric" disabled={inputsDisabled} className={`w-10 h-10 text-center text-xl rounded border outline-none transition ${inputsDisabled ? 'bg-gray-900 text-gray-500 border-transparent cursor-not-allowed font-mono' : 'bg-gray-700 text-white border-yellow-500/50 focus:border-yellow-400 focus:bg-gray-600'}`} value={values?.scoreA ?? ''} onChange={(e) => handleChange('scoreA', e)} placeholder="-" />
            <span className="text-gray-600 text-xs">X</span>
            <input type="number" inputMode="numeric" disabled={inputsDisabled} className={`w-10 h-10 text-center text-xl rounded border outline-none transition ${inputsDisabled ? 'bg-gray-900 text-gray-500 border-transparent cursor-not-allowed font-mono' : 'bg-gray-700 text-white border-yellow-500/50 focus:border-yellow-400 focus:bg-gray-600'}`} value={values?.scoreB ?? ''} onChange={(e) => handleChange('scoreB', e)} placeholder="-" />
          </div>
        </div>

        <div className="flex flex-col items-center w-1/3">
           <div className="mb-2 h-10 flex items-center justify-center"><TeamBadge team={game.team_b} /></div>
          <span className="font-bold text-center text-xs leading-tight line-clamp-1">{game.team_b?.name}</span>
        </div>
      </div>

      {renderBadgePontos()}
    </div>
  )
}