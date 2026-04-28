'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function SponsorBanner() {
  const [banners, setBanners] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    async function fetchBanners() {
      // Busca apenas banners ativos e ordenados
      const { data } = await supabase
        .from('banners')
        .select('*')
        .eq('is_active', true)
        .order('order_index')
      
      if (data) setBanners(data)
    }
    fetchBanners()
  }, [])

  // Efeito para trocar o banner a cada 5 segundos
  useEffect(() => {
    if (banners.length <= 1) return // Não precisa rotacionar se tiver só 1 ou nenhum

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % banners.length)
    }, 5000)

    return () => clearInterval(interval)
  }, [banners.length])

  // Se não houver banners, o componente fica invisível para não ocupar espaço
  if (banners.length === 0) return null

  const currentBanner = banners[currentIndex]

  return (
    // Altura ajustada: h-20 no mobile, h-24 no tablet, h-28 no PC (Fica sempre como uma faixa)
    <div className="w-full max-w-4xl mx-auto mb-6 rounded-lg overflow-hidden border border-gray-700 shadow-lg bg-gray-900 relative h-20 sm:h-24 md:h-28 flex items-center justify-center">
      {currentBanner.link_url ? (
        <a href={currentBanner.link_url} target="_blank" rel="noopener noreferrer" className="block w-full h-full flex items-center justify-center">
          <img 
            src={currentBanner.image_url} 
            alt="Patrocinador do Bolão" 
            /* object-contain faz a mágica de caber tudo sem cortar. max-h-full garante que não estoure */
            className="max-w-full max-h-full object-contain transition-opacity duration-500"
          />
        </a>
      ) : (
        <img 
          src={currentBanner.image_url} 
          alt="Patrocinador do Bolão" 
          /* object-contain faz a mágica de caber tudo sem cortar. max-h-full garante que não estoure */
          className="max-w-full max-h-full object-contain transition-opacity duration-500"
        />
      )}
      
      {/* Pontinhos de navegação (Dots) - Ajustados para ficar discretos */}
      {banners.length > 1 && (
        <div className="absolute bottom-1 left-0 right-0 flex justify-center gap-1.5">
          {banners.map((_, idx) => (
            <div 
              key={idx} 
              className={`w-1.5 h-1.5 rounded-full transition-colors ${idx === currentIndex ? 'bg-yellow-400' : 'bg-gray-500/50'}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}