'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient' // Ajuste o caminho se necessário

export default function Parceiros() {
  const [sponsors, setSponsors] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchSponsors() {
      const { data } = await supabase
        .from('sponsors')
        .select('*')
        .eq('is_active', true)
        .order('order_index')
      
      if (data) setSponsors(data)
      setLoading(false)
    }
    fetchSponsors()
  }, [])

  // Função para verificar se a "descrição" é na verdade o link de um panfleto/imagem
  const isImage = (text) => {
    if (!text) return false;
    // Checa se termina com formato de imagem ou se é um link do imgur
    return text.match(/\.(jpeg|jpg|gif|png|webp)(\?.*)?$/i) != null || text.includes('imgur.com');
  }

  // Função para transformar o contato em um botão chique se for um link
  const formatContact = (contact) => {
    if (!contact) return null;
    if (contact.startsWith('http')) {
      return (
        <a 
          href={contact} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="inline-flex items-center justify-center mt-4 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-6 rounded-full text-sm shadow-lg transition-transform hover:scale-105"
        >
          📲 Visitar Página / Instagram
        </a>
      )
    }
    return <p className="mt-4 text-sm text-purple-400 font-bold bg-purple-900/20 inline-block px-4 py-2 rounded-lg border border-purple-500/30">Contato: {contact}</p>
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 flex flex-col items-center pb-24">
      
      <div className="text-center mb-8 mt-4 animate-fade-in">
        <h1 className="text-3xl font-bold text-yellow-400 mb-3">🤝 Nossos Parceiros</h1>
        <p className="text-gray-400 text-sm max-w-md mx-auto">
          Conheça as marcas que fazem o nosso bolão acontecer e garantem as premiações mais tops da rodada!
        </p>
      </div>

      {loading ? (
        <div className="text-gray-500 animate-pulse mt-10 font-bold tracking-widest uppercase text-sm">Carregando parceiros...</div>
      ) : sponsors.length > 0 ? (
        <div className="w-full max-w-2xl flex flex-col gap-8 animate-fade-in">
          {sponsors.map(sponsor => (
            <div key={sponsor.id} className="bg-gray-800 rounded-2xl overflow-hidden border border-gray-700 shadow-2xl flex flex-col">
              
              {/* Cabeçalho do Card */}
              <div className="p-4 bg-gradient-to-r from-gray-800 to-gray-700 border-b border-gray-600 flex items-center gap-4">
                {sponsor.logo_url ? (
                  <img src={sponsor.logo_url} alt={sponsor.name} className="w-16 h-16 rounded-full object-cover border-2 border-gray-500 bg-white shadow-md" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gray-700 border-2 border-gray-500 flex items-center justify-center text-2xl shadow-md">
                    🤝
                  </div>
                )}
                <div>
                  <h2 className="text-xl font-bold text-white">{sponsor.name}</h2>
                </div>
              </div>

              {/* Corpo do Card (História ou Panfleto) */}
              <div className="p-6 bg-gray-900/50 flex flex-col items-center text-center md:items-start md:text-left">
                {isImage(sponsor.description) ? (
                   <img src={sponsor.description} alt={`Banner ${sponsor.name}`} className="w-full rounded-xl object-contain max-h-[500px] border border-gray-700 shadow-inner" />
                ) : (
                   <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">
                     {sponsor.description || 'Apoiador oficial do nosso bolão!'}
                   </p>
                )}
                
                {/* Contato / Botão */}
                <div className="w-full text-center md:text-left">
                   {formatContact(sponsor.contact_info)}
                </div>
              </div>

            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-gray-800/50 w-full max-w-2xl rounded-xl border border-gray-700 border-dashed mt-4">
          <div className="text-5xl mb-4 opacity-80">🏆</div>
          <p className="text-gray-400 font-bold">Ainda não há parceiros cadastrados.</p>
        </div>
      )}
    </div>
  )
}