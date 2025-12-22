export default function Noticias() {
  const sites = [
    { nome: 'Globo Esporte', url: 'https://ge.globo.com/futebol/copa-do-mundo/', cor: 'bg-green-600' },
    { nome: 'UOL Esporte', url: 'https://www.uol.com.br/esporte/futebol/copa-do-mundo/', cor: 'bg-yellow-600' },
    { nome: 'FIFA Oficial', url: 'https://www.fifa.com/fifaplus/pt', cor: 'bg-blue-600' }
  ]

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-8">📰 Notícias da Copa</h1>
      <div className="grid gap-4">
        {sites.map(site => (
          <a key={site.nome} href={site.url} target="_blank" rel="noopener noreferrer" 
             className={`p-6 rounded-xl text-white font-bold text-xl hover:opacity-90 transition ${site.cor}`}>
            Ler no {site.nome} ↗
          </a>
        ))}
      </div>
    </div>
  )
}