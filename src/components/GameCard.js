import React from 'react';

export default function GameCard({ game, values, isEditing, onChange, onToggleEdit }) {
  const dataJogo = new Date(game.start_time);
  const dataFormatada = dataJogo.toLocaleString('pt-BR', { 
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
  });

  // Lógica para descobrir se o jogo já tem placar real rodando no banco
  const temPlacarReal = game.score_a !== null && game.score_b !== null && game.score_a !== undefined;
  const placarRealA = game.score_a ?? 0;
  const placarRealB = game.score_b ?? 0;

  // Lógica do Palpite do Usuário
  const palpiteA = values?.scoreA ?? '';
  const palpiteB = values?.scoreB ?? '';
  const temPalpite = palpiteA !== '' && palpiteB !== '';

  // Identificação de Status Visual (Ao Vivo, Fim, ou Data)
  const isLive = game.custom_status && game.custom_status !== 'FIM' && game.custom_status !== 'INTERVALO';
  const isFinished = game.custom_status === 'FIM' || game.status_short === 'FT' || game.status_short === 'PEN' || game.status_short === 'AET';

  // Truque inteligente: A tela 'Home' não envia a propriedade 'custom_status', ela fica undefined.
  // Já o 'Calendario' envia como null ou string. Assim sabemos em qual tela estamos para esconder o lápis!
  const isHome = game.custom_status === undefined;
  const showEditButton = !isEditing && onToggleEdit && isHome && !temPlacarReal;

  return (
    <div className="bg-gray-800/80 rounded-2xl p-5 shadow-lg border border-gray-700 relative w-full flex flex-col items-center">

      {/* Botão de Editar (Lápis - Aparece APENAS na Home para jogos que não começaram) */}
      {showEditButton && (
         <button onClick={() => onToggleEdit(game.id)} className="absolute top-4 right-4 bg-gray-700/50 hover:bg-gray-600 p-2 rounded-full text-white transition">
            ✏️
         </button>
      )}

      {/* HEADER DA CARTA */}
      <div className="flex flex-col items-center mb-5">
         <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest bg-gray-900 px-3 py-1 rounded-full border border-gray-800">
            COMPETIÇÃO • {game.round}
         </span>

         <div className="mt-3">
            {game.custom_status ? (
               <span className={`text-[11px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider shadow-sm
                  ${isFinished 
                    ? 'bg-gray-700/80 text-gray-300 border border-gray-600' 
                    : 'bg-red-900/40 text-red-500 animate-pulse border border-red-500/30'}`
               }>
                  {isFinished ? 'FIM DE JOGO' : `🔴 ${game.custom_status}`}
               </span>
            ) : (
               <span className="text-xs text-gray-300 font-medium bg-gray-900/50 px-3 py-1 rounded-full">
                 🗓️ {dataFormatada}
               </span>
            )}
         </div>
      </div>

      {/* CONTEÚDO PRINCIPAL (Times e Placar) */}
      <div className="flex justify-between items-center w-full">
        
        {/* TEAM A (Mandante) */}
        <div className="flex flex-col items-center w-1/3">
           <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center p-1.5 mb-2 shadow-inner border border-gray-300">
              <img src={game.team_a?.badge_url || '/placeholder.png'} alt={game.team_a?.name} className="w-full h-full object-contain" />
           </div>
           <span className="text-sm font-bold text-center leading-tight text-gray-200">{game.team_a?.name}</span>
        </div>

        {/* CENTRO: PLACAR OU INPUTS DE PALPITE */}
        <div className="flex flex-col items-center justify-center w-1/3 px-2">
           {isEditing ? (
              // ---------------------------------------------------
              // MODO EDIÇÃO: O usuário está digitando o palpite
              // ---------------------------------------------------
              <div className="flex items-center gap-2">
                 <input type="number" min="0" className="w-12 h-12 bg-gray-900 border border-gray-600 rounded-xl text-center font-bold text-xl text-white focus:border-yellow-400 outline-none transition shadow-inner" value={palpiteA} onChange={(e) => onChange(game.id, 'scoreA', e.target.value)} />
                 <span className="text-gray-500 font-bold text-sm">X</span>
                 <input type="number" min="0" className="w-12 h-12 bg-gray-900 border border-gray-600 rounded-xl text-center font-bold text-xl text-white focus:border-yellow-400 outline-none transition shadow-inner" value={palpiteB} onChange={(e) => onChange(game.id, 'scoreB', e.target.value)} />
              </div>
           ) : (
              // ---------------------------------------------------
              // MODO VISUALIZAÇÃO: Jogo ao Vivo/Finalizado ou Palpite Travado
              // ---------------------------------------------------
              <div className="flex flex-col items-center w-full">
                 {temPlacarReal ? (
                    <>
                       {/* Placar Real GIGANTE */}
                       <div className="flex items-center justify-center gap-3 w-full mb-1">
                          <span className="text-4xl font-black text-white drop-shadow-md">{placarRealA}</span>
                          <span className="text-gray-500 font-bold text-lg">x</span>
                          <span className="text-4xl font-black text-white drop-shadow-md">{placarRealB}</span>
                       </div>
                       
                       {/* Mini Badge com o Palpite do Usuário */}
                       {temPalpite ? (
                          <div className="bg-gray-900/80 px-3 py-1 rounded-full border border-gray-700 mt-2 flex items-center gap-1.5 shadow-sm">
                             <span className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">Seu Palpite:</span>
                             <span className="text-xs text-yellow-400 font-black">{palpiteA} - {palpiteB}</span>
                          </div>
                       ) : (
                          <div className="bg-gray-900/80 px-3 py-1 rounded-full border border-red-900/30 mt-2 shadow-sm">
                             <span className="text-[9px] text-red-400 uppercase font-bold tracking-wider">Sem Palpite</span>
                          </div>
                       )}
                    </>
                 ) : (
                    // Jogo ainda não começou, mostra só as caixinhas bonitinhas com o palpite feito
                    <div className="flex items-center justify-center gap-3">
                       <div className="w-12 h-12 flex items-center justify-center bg-gray-900 border border-gray-700 rounded-xl text-xl font-bold text-yellow-500 shadow-inner">{palpiteA !== '' ? palpiteA : '-'}</div>
                       <span className="text-gray-600 font-bold text-sm">X</span>
                       <div className="w-12 h-12 flex items-center justify-center bg-gray-900 border border-gray-700 rounded-xl text-xl font-bold text-yellow-500 shadow-inner">{palpiteB !== '' ? palpiteB : '-'}</div>
                    </div>
                 )}
              </div>
           )}
        </div>

        {/* TEAM B (Visitante) */}
        <div className="flex flex-col items-center w-1/3">
           <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center p-1.5 mb-2 shadow-inner border border-gray-300">
              <img src={game.team_b?.badge_url || '/placeholder.png'} alt={game.team_b?.name} className="w-full h-full object-contain" />
           </div>
           <span className="text-sm font-bold text-center leading-tight text-gray-200">{game.team_b?.name}</span>
        </div>
        
      </div>
    </div>
  );
}