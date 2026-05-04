'use client'
import Link from 'next/link'

export default function Regras() {
  return (
    <main className="min-h-screen flex flex-col items-center bg-gray-900 text-white p-4 pb-24">
      <div className="w-full max-w-md">
        
        <div className="flex items-center mb-6 mt-2">
          <Link href="/perfil" className="text-gray-400 hover:text-white mr-4 transition">
            ← Voltar
          </Link>
          <h1 className="text-2xl font-bold text-yellow-400">Regras do Bolão 📖</h1>
        </div>

        <div className="space-y-6">
          
          {/* SEÇÃO 1: PONTUAÇÃO BASE */}
          <section className="bg-gray-800 p-5 rounded-2xl border border-gray-700 shadow-lg">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <span>🎯</span> Pontuação Base (Por Jogo)
            </h2>
            <ul className="space-y-3 text-sm text-gray-300">
              <li className="flex justify-between items-center bg-gray-900 p-3 rounded-lg border border-gray-700">
                <span>Placar Exato (Na Mosca)</span>
                <span className="font-bold text-green-400 bg-green-900/30 px-2 py-1 rounded">10 pts</span>
              </li>
              <li className="flex justify-between items-center bg-gray-900 p-3 rounded-lg border border-gray-700">
                <span>Acertar Vencedor e Saldo de Gols</span>
                <span className="font-bold text-yellow-400 bg-yellow-900/30 px-2 py-1 rounded">7 pts</span>
              </li>
              <li className="flex justify-between items-center bg-gray-900 p-3 rounded-lg border border-gray-700">
                <span>Acertar apenas o Vencedor</span>
                <span className="font-bold text-blue-400 bg-blue-900/30 px-2 py-1 rounded">5 pts</span>
              </li>
              <li className="flex justify-between items-center bg-gray-900 p-3 rounded-lg border border-gray-700">
                <span>Acertar gols de um dos times</span>
                <span className="font-bold text-gray-400 bg-gray-700/50 px-2 py-1 rounded">2 pts</span>
              </li>
            </ul>
          </section>

          {/* SEÇÃO 2: EXEMPLO PRÁTICO */}
          <section className="bg-gray-800 p-5 rounded-2xl border border-yellow-600/50 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full bg-yellow-500"></div>
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <span>💡</span> Exemplo Prático
            </h2>
            <div className="bg-gray-900 p-3 rounded-lg text-center mb-4 border border-gray-700">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Seu Palpite foi</p>
              <p className="font-black text-xl">🇧🇷 Brasil <span className="text-yellow-400">2 x 1</span> Argentina 🇦🇷</p>
            </div>
            
            <div className="space-y-2 text-sm text-gray-300">
              <p>✅ Se o jogo terminar <strong className="text-white">2 x 1</strong>: Você ganha <strong className="text-green-400">10 pts</strong> (Placar exato).</p>
              <p>✅ Se o jogo terminar <strong className="text-white">1 x 0</strong>: Você ganha <strong className="text-yellow-400">7 pts</strong> (Acertou que o Brasil vencia com +1 gol de saldo).</p>
              <p>✅ Se o jogo terminar <strong className="text-white">3 x 0</strong>: Você ganha <strong className="text-blue-400">5 pts</strong> (Acertou a vitória do Brasil, mas errou o saldo).</p>
              <p>❌ Se o jogo terminar <strong className="text-white">2 x 2</strong>: Você ganha <strong className="text-gray-400">2 pts</strong> (Errou o vencedor, mas acertou que o Brasil faria 2 gols).</p>
            </div>
          </section>

          {/* SEÇÃO 3: PESOS E FASES */}
          <section className="bg-gray-800 p-5 rounded-2xl border border-gray-700 shadow-lg">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <span>📈</span> Pesos por Fase
            </h2>
            <p className="text-sm text-gray-400 mb-4">
              A pontuação que você fizer em um jogo será multiplicada pelo peso da fase do campeonato. Quanto mais perto da final, mais os jogos valem!
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-gray-900 p-3 rounded-lg border border-gray-700 flex justify-between">
                <span>Fase de Grupos</span><strong className="text-yellow-400">x1</strong>
              </div>
              <div className="bg-gray-900 p-3 rounded-lg border border-gray-700 flex justify-between">
                <span>16-avos e Oitavas</span><strong className="text-yellow-400">x2</strong>
              </div>
              <div className="bg-gray-900 p-3 rounded-lg border border-gray-700 flex justify-between">
                <span>Quartas de Final</span><strong className="text-yellow-400">x3</strong>
              </div>
              <div className="bg-gray-900 p-3 rounded-lg border border-gray-700 flex justify-between">
                <span>Semifinal</span><strong className="text-yellow-400">x4</strong>
              </div>
              <div className="bg-gray-900 p-3 rounded-lg border border-yellow-500/50 flex justify-between col-span-2">
                <span className="font-bold">Final e 3º Lugar</span><strong className="text-yellow-400 font-bold">x5</strong>
              </div>
            </div>
          </section>

          {/* SEÇÃO 4: PALPITES EXTRAS */}
          <section className="bg-gray-800 p-5 rounded-2xl border border-gray-700 shadow-lg">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <span>🏆</span> Palpites Extras
            </h2>
            <p className="text-sm text-gray-400 mb-4">
              Esses palpites devem ser feitos antes do início do torneio. A pontuação será somada ao seu ranking final após o último jogo da Copa.
            </p>
            <ul className="space-y-3 text-sm text-gray-300">
              <li className="flex justify-between border-b border-gray-700 pb-2"><span>Acertar o Campeão</span> <strong className="text-green-400">50 pts</strong></li>
              <li className="flex justify-between border-b border-gray-700 pb-2"><span>Acertar o Vice-Campeão</span> <strong className="text-green-400">30 pts</strong></li>
              <li className="flex justify-between border-b border-gray-700 pb-2"><span>Acertar o Artilheiro</span> <strong className="text-green-400">20 pts</strong></li>
            </ul>
          </section>

          {/* SEÇÃO 5: DESEMPATE */}
          <section className="bg-gray-800 p-5 rounded-2xl border border-gray-700 shadow-lg mb-8">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <span>⚖️</span> Critérios de Desempate
            </h2>
            <p className="text-sm text-gray-400 mb-4">
              Caso dois ou mais participantes terminem o bolão com a mesma pontuação, o desempate será feito na seguinte ordem:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
              <li>Maior número de <strong>Placares Exatos</strong> (Na Mosca).</li>
              <li>Maior número de pontos nos <strong>Palpites Extras</strong>.</li>
              <li>Maior número de acertos de <strong>Vencedor</strong>.</li>
              <li><strong>Data de Confirmação:</strong> Quem pagou a inscrição primeiro leva a vantagem!</li>
            </ol>
          </section>

        </div>
      </div>
    </main>
  )
}