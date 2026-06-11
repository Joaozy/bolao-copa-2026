'use client'
import React from 'react'

export default function Premiacoes() {
  return (
    <main className="min-h-screen bg-gray-900 text-white p-4 pb-32 flex flex-col items-center">
      <div className="w-full max-w-md space-y-6">
        
        {/* CABEÇALHO */}
        <div className="text-center space-y-3 mt-4">
          <h1 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">
            🏆 PREMIAÇÃO OFICIAL
          </h1>
          <h2 className="text-lg font-bold text-gray-300">BOLÃO DA COPA 2026 ⚽</h2>
          <div className="bg-yellow-900/20 border border-yellow-500/30 p-4 rounded-xl shadow-lg mt-4">
            <p className="text-sm text-yellow-200/90 italic leading-relaxed">
              Com base em 50 inscritos, nossa premiação vai distribuir <strong className="text-yellow-400">R$ 2.500,00 em dinheiro</strong> e dezenas de prêmios dos nossos parceiros. Tem prêmio até o último jogo da Copa!
            </p>
          </div>
        </div>

        {/* PÓDIO PRINCIPAL */}
        <section className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden shadow-xl">
          <div className="bg-gradient-to-r from-yellow-600 to-yellow-500 p-3 text-center">
            <h3 className="font-black text-black text-lg tracking-wide uppercase">💰 Pódio Principal</h3>
            <p className="text-black/80 text-xs font-bold uppercase">(Ranking Geral)</p>
          </div>
          <div className="p-4 space-y-3">
            {[
              { pos: '1º Lugar (Campeão)', prize: 'R$ 1.200,00 + 1 Cupom Multiviagens (R$ 1.000 OFF)', color: 'text-yellow-400', icon: '🏆' },
              { pos: '2º Lugar', prize: 'R$ 700,00 + 1 Cupom Multiviagens', color: 'text-gray-300', icon: '🥈' },
              { pos: '3º Lugar', prize: 'R$ 450,00 + 1 Cupom Multiviagens', color: 'text-orange-400', icon: '🥉' },
              { pos: '4º Lugar', prize: 'R$ 300,00 + 1 Cupom Multiviagens', color: 'text-white', icon: '🏅' },
              { pos: '5º Lugar', prize: 'R$ 200,00 + 1 Cupom Multiviagens', color: 'text-white', icon: '🏅' },
              { pos: '6º Lugar', prize: 'R$ 150,00 + 1 Cupom Multiviagens', color: 'text-white', icon: '🏅' },
              { pos: '7º Lugar', prize: 'R$ 100,00', color: 'text-white', icon: '🏅' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 bg-gray-900/50 p-3 rounded-xl border border-gray-700/50 hover:bg-gray-700 transition">
                <div className="text-2xl mt-1">{item.icon}</div>
                <div>
                  <div className={`font-bold ${item.color}`}>{item.pos}</div>
                  <div className="text-sm text-gray-300 leading-tight">{item.prize}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* PÉ QUENTE DA SELEÇÃO */}
        <section className="bg-gradient-to-br from-green-900/40 to-yellow-900/20 rounded-2xl border border-green-500/30 overflow-hidden shadow-xl relative">
          <div className="p-4 space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">🇧🇷</span>
              <h3 className="font-black text-green-400 text-lg uppercase">Pé Quente da Seleção</h3>
            </div>
            <p className="text-xs text-gray-400 leading-tight">Quem somar mais pontos analisando APENAS os jogos do Brasil na Copa.</p>
            <div className="mt-3 bg-green-900/30 border border-green-500/20 p-3 rounded-lg flex items-center gap-3">
              <span className="text-xl">🥩</span>
              <p className="text-sm font-bold text-yellow-100">Prêmio: 1 Kit Churrasco <span className="text-green-300 text-xs block font-normal">(Mota Supermercado)</span></p>
            </div>
          </div>
        </section>

        {/* PRÊMIOS POR FASE */}
        <section className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden shadow-xl">
          <div className="bg-gradient-to-r from-blue-900 to-blue-700 p-3 text-center">
            <h3 className="font-black text-white text-lg tracking-wide uppercase">🎯 Prêmios por Fase</h3>
            <p className="text-blue-200 text-xs font-bold uppercase">(Tiros Curtos)</p>
          </div>
          <div className="p-4 space-y-4">
            
            {/* Rodadas */}
            <div className="space-y-2 border-b border-gray-700 pb-4">
              <div className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">●</span><p className="text-sm"><strong className="text-white">Melhor da 1ª Rodada:</strong> <span className="text-gray-300">1 Voucher Lavagem Detalhada (Tubarão StudioCar)</span></p></div>
              <div className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">●</span><p className="text-sm"><strong className="text-white">Melhor da 2ª Rodada:</strong> <span className="text-gray-300">1 Voucher de R$ 50 (Rei Beach)</span></p></div>
              <div className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">●</span><p className="text-sm"><strong className="text-white">Melhor da 3ª Rodada:</strong> <span className="text-gray-300">1 Voucher de R$ 100 (Paraíso das Flores)</span></p></div>
            </div>

            {/* Fase de Grupos */}
            <div className="space-y-2 border-b border-gray-700 pb-4">
              <div className="flex items-start gap-2"><span className="text-purple-400 mt-0.5">●</span><p className="text-sm"><strong className="text-white">Melhor GERAL da Fase de Grupos:</strong> <span className="text-gray-300">1 Kit Churrasco (Esquina da Carne) + 1 Cupom Multiviagens</span></p></div>
              <div className="flex items-start gap-2"><span className="text-purple-400 mt-0.5">●</span><p className="text-sm"><strong className="text-white">Segundo Geral da Fase de Grupos:</strong> <span className="text-gray-300">Cupom de R$ 50 no Rei da Sopa</span></p></div>
            </div>

            {/* Mata Mata */}
            <div className="space-y-2 border-b border-gray-700 pb-4">
              <div className="flex items-start gap-2"><span className="text-red-400 mt-0.5">●</span><p className="text-sm"><strong className="text-white">Melhor das Oitavas:</strong> <span className="text-gray-300">1 Fardo de Heineken (Padre Cícero Delicatessen)</span></p></div>
              <div className="flex items-start gap-2"><span className="text-red-400 mt-0.5">●</span><p className="text-sm"><strong className="text-white">Melhor das Quartas:</strong> <span className="text-gray-300">1 Voucher Lavagem Detalhada</span></p></div>
              <div className="flex items-start gap-2"><span className="text-red-400 mt-0.5">●</span><p className="text-sm"><strong className="text-white">Melhor das Semis e Finais:</strong> <span className="text-gray-300">1 Voucher de R$ 100 (Paraíso das Flores)</span></p></div>
            </div>

            {/* Geral Mata Mata e Extras */}
            <div className="space-y-2">
              <div className="flex items-start gap-2"><span className="text-yellow-400 mt-0.5">●</span><p className="text-sm"><strong className="text-white">Melhor GERAL do Mata Mata:</strong> <span className="text-gray-300">1 FD Heineken + 1 Cupom Multiviagens</span></p></div>
              <div className="flex items-start gap-2"><span className="text-yellow-400 mt-0.5">●</span><p className="text-sm"><strong className="text-white">Segundo melhor geral do Mata Mata:</strong> <span className="text-gray-300">1 brinde Kataryne batalha</span></p></div>
              <div className="flex items-start gap-2"><span className="text-green-400 mt-0.5">●</span><p className="text-sm"><strong className="text-white">Maior Pontuador - Aba Extras:</strong> <span className="text-gray-300">R$ 500 em recarga para carro elétrico (GOTEC)</span></p></div>
            </div>

          </div>
        </section>

        {/* CRITÉRIOS DE DESEMPATE */}
        <section className="bg-gray-800/80 rounded-2xl border border-gray-700 p-5 shadow-lg">
          <div className="flex items-center gap-2 mb-3 border-b border-gray-700 pb-2">
            <span className="text-xl">⚖️</span>
            <h3 className="font-bold text-gray-200">Critérios de Desempate</h3>
          </div>
          <p className="text-xs text-gray-400 mb-3 italic">Para os prêmios de Fases/Rodadas. Caso duas ou mais pessoas empatem nos pontos daquela rodada específica, o desempate será:</p>
          <ul className="space-y-2 text-sm text-gray-300">
            <li className="flex items-start gap-2"><span className="text-gray-500">1.</span> Maior número de placares exatos cravados na rodada.</li>
            <li className="flex items-start gap-2"><span className="text-gray-500">2.</span> Maior número de acertos de vencedor na rodada.</li>
            <li className="flex items-start gap-2"><span className="text-gray-500">3.</span> Quem estiver em uma posição melhor no Ranking Geral do bolão.</li>
            <li className="flex items-start gap-2"><span className="text-gray-500">4.</span> Maior Pontuador em Jogos do Brasil.</li>
          </ul>
        </section>

        <div className="text-center pt-4 pb-8">
          <p className="text-lg font-black text-yellow-400">👉 São muitas chances de ganhar 🚀</p>
        </div>

      </div>
    </main>
  )
}