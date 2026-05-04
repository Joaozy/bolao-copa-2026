'use client'
import Link from 'next/link'

export default function Premiacao() {
  return (
    <main className="min-h-screen flex flex-col items-center bg-gray-900 text-white p-4 pb-24">
      <div className="w-full max-w-md">
        
        <div className="flex items-center mb-6 mt-2">
          <Link href="/perfil" className="text-gray-400 hover:text-white mr-4 transition">
            ← Voltar
          </Link>
          <h1 className="text-2xl font-bold text-yellow-400">Premiações 🎁</h1>
        </div>

        <div className="space-y-4">
          
          {/* PRÊMIO PRINCIPAL (DINHEIRO) */}
          <div className="bg-gray-800 p-6 rounded-2xl border border-yellow-500 shadow-lg shadow-yellow-900/20 text-center relative overflow-hidden">
            <div className="absolute -right-4 -top-4 opacity-10 text-8xl">💰</div>
            <h2 className="text-yellow-400 font-black text-2xl mb-1">1º LUGAR</h2>
            <p className="text-gray-300 text-sm mb-3 font-medium uppercase tracking-wider">Campeão do Bolão</p>
            <div className="text-4xl font-black text-white">Mais de R$ 1.000,00</div>
            <p className="text-xs text-gray-500 mt-2">Valor em dinheiro direto na conta! (O valor total pode aumentar conforme o número de inscritos).</p>
          </div>

          <div className="flex items-center justify-center gap-4 py-4">
            <div className="h-px bg-gray-700 flex-1"></div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Prêmios Extras & Sorteios</span>
            <div className="h-px bg-gray-700 flex-1"></div>
          </div>

          <p className="text-sm text-center text-gray-400 mb-4 px-2">
            Além do prêmio em dinheiro, os participantes vão concorrer a uma chuva de prêmios fornecidos pelos nossos parceiros oficiais!
          </p>

          {/* AVISO SOBRE A DISTRIBUIÇÃO */}
          <div className="bg-yellow-900/30 border border-yellow-600/50 p-4 rounded-xl mb-6 text-center shadow-lg">
            <p className="text-xs text-yellow-300 font-medium leading-relaxed">
               ⚠️ <strong className="font-bold">Atenção:</strong> A forma exata de distribuição dos prêmios abaixo (como posição no ranking de extras, sorteios ou metas) será definida e anunciada em breve para todos os inscritos!
            </p>
          </div>

          {/* LISTA DE PRÊMIOS EXTRAS (GRID MODERNO) */}
          <div className="grid grid-cols-1 gap-3 mb-8">
            
            <div className="bg-gray-800 p-4 rounded-xl border border-gray-600 flex items-center gap-4">
              <div className="bg-red-900/50 w-12 h-12 flex items-center justify-center rounded-full text-2xl flex-shrink-0">✈️</div>
              <div>
                <h3 className="font-bold text-white text-sm">8x Vouchers de R$ 1.000,00 OFF</h3>
                <p className="text-xs text-gray-400">Em pacotes de viagem da Multiviagens (você + acompanhante)</p>
              </div>
            </div>

            <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 flex items-center gap-4">
              <div className="bg-blue-900/50 w-12 h-12 flex items-center justify-center rounded-full text-2xl flex-shrink-0">🦈</div>
              <div>
                <h3 className="font-bold text-white text-sm">2x Lavagens Detalhadas</h3>
                <p className="text-xs text-gray-400">Tubarão StudioCar</p>
              </div>
            </div>

            <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 flex items-center gap-4">
              <div className="bg-pink-900/50 w-12 h-12 flex items-center justify-center rounded-full text-2xl flex-shrink-0">🌸</div>
              <div>
                <h3 className="font-bold text-white text-sm">2x Vouchers de R$ 100,00</h3>
                <p className="text-xs text-gray-400">Em compras no Paraíso das Flores</p>
              </div>
            </div>

            <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 flex items-center gap-4">
              <div className="bg-orange-900/50 w-12 h-12 flex items-center justify-center rounded-full text-2xl flex-shrink-0">🍲</div>
              <div>
                <h3 className="font-bold text-white text-sm">2x Vouchers de R$ 50,00</h3>
                <p className="text-xs text-gray-400">Consumo no Rei da Sopa e Rei Beach</p>
              </div>
            </div>

            <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 flex items-center gap-4">
              <div className="bg-green-900/50 w-12 h-12 flex items-center justify-center rounded-full text-2xl flex-shrink-0">⚡</div>
              <div>
                <h3 className="font-bold text-white text-sm">R$ 500,00 em Créditos</h3>
                <p className="text-xs text-gray-400">Para recarga de carro elétrico na GOTEC</p>
              </div>
            </div>

            <div className="flex gap-3">
                <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 flex-1 flex flex-col items-center text-center justify-center gap-2">
                <span className="text-2xl">🥩</span>
                <div>
                    <h3 className="font-bold text-white text-xs leading-tight mb-1">1 Kit Churrasco Completo</h3>
                    <p className="text-[10px] text-gray-400 leading-tight">Mota Supermercado</p>
                </div>
                </div>

                <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 flex-1 flex flex-col items-center text-center justify-center gap-2">
                <span className="text-2xl">🍖</span>
                <div>
                    <h3 className="font-bold text-white text-xs leading-tight mb-1">1 Kit Churrasco Premium</h3>
                    <p className="text-[10px] text-gray-400 leading-tight">Esquina da Carne</p>
                </div>
                </div>
            </div>

            <div className="bg-gray-800 p-4 rounded-xl border border-yellow-600/30 flex items-center gap-4">
              <div className="bg-yellow-900/50 w-12 h-12 flex items-center justify-center rounded-full text-2xl flex-shrink-0">💎</div>
              <div>
                <h3 className="font-bold text-white text-sm">1 Brinde Especial e Exclusivo</h3>
                <p className="text-xs text-gray-400">Kataryne Batalha Joias</p>
              </div>
            </div>

          </div>

        </div>
      </div>
    </main>
  )
}