import './globals.css'
import Navbar from '../components/Navbar'
import { Toaster } from 'react-hot-toast'

// Configurações visuais para celular (PWA)
export const viewport = {
  themeColor: "#EAB308",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

// Metadados do site (Título, Descrição e Ícone do App)
export const metadata = {
  title: 'Bolão Copa 2026 🇧🇷',
  description: 'Faça seus palpites, acompanhe o ranking em tempo real e concorra a prêmios incríveis!',
  
  // ---> NOVO: Link para o arquivo que criamos
  manifest: '/manifest.json',
  
  // ---> NOVO: Ícones para a tela inicial (Especialmente iPhone)
  icons: {
    icon: '/icon-512.png',
    apple: '/icon-512.png', // O iPhone procura especificamente por isso
  },

  openGraph: {
    title: 'Bolão Copa 2026 🇧🇷',
    description: 'Faça seus palpites, acompanhe o ranking em tempo real e concorra a prêmios incríveis!',
    url: 'https://seu-link-da-vercel.vercel.app', 
    siteName: 'Bolão Copa 2026',
    images: [
      {
        url: '/og-bolao.jpg', 
        width: 1200,
        height: 630,
        alt: 'Logo Oficial do Bolão Copa 2026',
      },
    ],
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bolão Copa 2026 🇧🇷',
    description: 'Faça seus palpites, acompanhe o ranking em tempo real e concorra a prêmios incríveis!',
    images: ['/og-bolao.jpg'],
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body className="bg-gray-900 text-white">
        <Navbar />
        <div className="container mx-auto">
          {children}
        </div>
        <Toaster 
          position="bottom-center"
          toastOptions={{
            style: {
              background: '#333',
              color: '#fff',
            },
          }}
        />
      </body>
    </html>
  )
}
