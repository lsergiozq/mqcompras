import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { AuthProvider } from './AuthContext.jsx'
import './index.css'

// Registro do Service Worker do PWA — tolerante a falha.
// Se o pacote vite-plugin-pwa ainda não estiver instalado, o app continua funcionando.
import('virtual:pwa-register')
  .then(({ registerSW }) => registerSW({ immediate: true }))
  .catch(() => {
    // Sem PWA, sem problema. Pode ser ambiente dev sem o plugin ativo.
  })

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
)
