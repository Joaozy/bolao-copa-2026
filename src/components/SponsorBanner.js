'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function SponsorBanner() {
  const [banners, setBanners] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    async function fetchBanners() {
      const { data } = await supabase
        .from('banners')
        .select('*')
        .eq('is_active', true)
        .order('order_index')
      
      if (data) setBanners(data)
    }
    fetchBanners()
  }, [])

  useEffect(() => {
    if (banners.length <= 1) return

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % banners.length)
    }, 5000) // Troca a cada 5 segundos

    return () => clearInterval(interval)
  }, [banners.length])

  if (banners.length === 0) return null

  return (
    <div className="w-full max-w-4xl mx-auto mb-6 rounded-lg overflow-hidden border border-gray-700 shadow-lg bg-gray-900 relative h-20 sm:h-24 md:h-28 flex items-center justify-center">
      
      {/* Aqui fazemos o "Crossfade": Empilhamos todos os banners e controlamos a opacidade */}
      {banners.map((banner, index) => {
        const isActive = index === currentIndex;
        
        return (
          <div 
            key={banner.id}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${isActive ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
          >
            {banner.link_url ? (
              <a href={banner.link_url} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
                <img 
                  src={banner.image_url} 
                  alt={`Patrocinador ${index + 1}`} 
                  className="w-full h-full object-fill"
                />
              </a>
            ) : (
              <img 
                src={banner.image_url} 
                alt={`Patrocinador ${index + 1}`} 
                className="w-full h-full object-fill"
              />
            )}
          </div>
        )
      })}
      
      {/* Pontinhos de navegação (Dots) - Modernizados */}
      {banners.length > 1 && (
        <div className="absolute bottom-1.5 left-0 right-0 flex justify-center gap-1.5 z-20">
          {banners.map((_, idx) => (
            <div 
              key={idx} 
              // Se estiver ativo, ele fica mais largo e amarelo. Se inativo, fica redondinho e cinza.
              className={`h-1.5 rounded-full transition-all duration-500 ease-in-out ${idx === currentIndex ? 'w-4 bg-yellow-400' : 'w-1.5 bg-gray-400/60'}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}