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
  title: 'Bolão Copa 2026',
  description: 'O melhor bolão do mundo',
  manifest: '/manifest.json', // Link essencial para o PWA
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
