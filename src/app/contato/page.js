'use client'
import { useState } from 'react'

export default function Contato() {
  // 1. CONFIGURE AQUI SEU NÚMERO (DDI + DDD + Numero)
  const ADMIN_PHONE = '5579991159138' 
  
  // Mensagem que já vem escrita quando a pessoa clica
  const DEFAULT_MESSAGE = 'Olá! Vim pelo site do Bolão e preciso de ajuda.'

  // Link mágico do WhatsApp
  const whatsappLink = `https://wa.me/${ADMIN_PHONE}?text=${encodeURIComponent(DEFAULT_MESSAGE)}`

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 flex flex-col items-center">
      
      {/* CABEÇALHO */}
      <div className="text-center mb-10 mt-6">
        <h1 className="text-3xl md:text-4xl font-bold text-yellow-400 mb-2">Central de Ajuda 📞</h1>
        <p className="text-gray-400">Tem alguma dúvida ou precisa validar seu pagamento?</p>
      </div>

      {/* CARTÃO PRINCIPAL (WHATSAPP) */}
      <div className="w-full max-w-md bg-gray-800 p-8 rounded-2xl border border-gray-700 shadow-2xl text-center transform hover:scale-[1.02] transition duration-300">
        <div className="w-20 h-20 bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/30">
          <svg className="w-10 h-10 text-green-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
          </svg>
        </div>

        <h2 className="text-xl font-bold text-white mb-2">Fale com o Administrador</h2>
        <p className="text-gray-400 text-sm mb-6">
          Envie o comprovante de pagamento ou tire dúvidas sobre as regras do bolão.
        </p>

        <a 
          href={whatsappLink} 
          target="_blank" 
          rel="noopener noreferrer"
          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-lg flex items-center justify-center gap-3 transition shadow-lg shadow-green-900/20"
        >
          <span>💬</span> Chamar no WhatsApp
        </a>
      </div>

      {/* SEÇÃO DE DÚVIDAS RÁPIDAS (FAQ) */}
      <div className="w-full max-w-md mt-12">
        <h3 className="text-gray-500 font-bold uppercase text-xs tracking-wider mb-4 ml-2">Dúvidas Comuns</h3>
        
        <div className="space-y-3">
          <DetailsCard 
            pergunta="Como valido minha participação?" 
            resposta="Após fazer o Pix, envie o comprovante no WhatsApp acima. O administrador irá liberar seu acesso manualmente." 
          />
          <DetailsCard 
            pergunta="Até quando posso palpitar?" 
            resposta="Você pode alterar seus palpites até o horário exato do início de cada jogo." 
          />
          <DetailsCard 
            pergunta="Como funciona a pontuação?" 
            resposta="Acesse a aba 'Regras' no menu para ver todos os detalhes de pontos (10, 7, 5 e 2)." 
          />
        </div>
      </div>

    </div>
  )
}

// Componentezinho para as perguntas abrirem e fecharem (Acordeão)
function DetailsCard({ pergunta, resposta }) {
  const [open, setOpen] = useState(false)
  
  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      <button 
        onClick={() => setOpen(!open)}
        className="w-full flex justify-between items-center p-4 text-left hover:bg-gray-700/50 transition"
      >
        <span className="font-bold text-sm text-gray-200">{pergunta}</span>
        <span className={`text-yellow-400 transform transition ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>
      
      {open && (
        <div className="p-4 pt-0 text-sm text-gray-400 bg-gray-700/20 border-t border-gray-700/50">
          {resposta}
        </div>
      )}
    </div>
  )
}