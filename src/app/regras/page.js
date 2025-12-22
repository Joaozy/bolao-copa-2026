export default function Regras() {
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-yellow-400 mb-4">📜 Regras do Bolão</h1>
      <ul className="list-disc pl-5 space-y-2 text-gray-300">
        <li>Acertou placar exato: <strong>10 pontos</strong></li>
        <li>Acertou vencedor + saldo/gols: <strong>7 pontos</strong></li>
        <li>Acertou apenas vencedor: <strong>5 pontos</strong></li>
        <li>Errou vencedor mas acertou gols de um time: <strong>2 pontos</strong></li>
      </ul>
    </div>
  )
}