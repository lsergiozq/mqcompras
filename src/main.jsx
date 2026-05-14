import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { AuthProvider } from './AuthContext.jsx'
import { PlaceProvider } from './PlaceContext.jsx'
import './index.css'

// Registro do Service Worker do PWA — tolerante a falha.
import('virtual:pwa-register')
  .then(({ registerSW }) => registerSW({ immediate: true }))
  .catch(() => {})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <PlaceProvider>
        <App />
      </PlaceProvider>
    </AuthProvider>
  </React.StrictMode>,
)
