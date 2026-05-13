import { supabase } from './supabase'

export default function Auth() {
  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    })
  }

  return (
    <div className="card" style={{ textAlign: 'center', padding: '2rem 1rem' }}>
      <h2 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Acesse sua Família</h2>
      <p style={{ color: 'var(--text-muted)' }}>Faça login com sua conta Google para ver a lista de compras da sua casa.</p>
      
      <button 
        onClick={handleGoogleLogin} 
        className="btn btn-primary" 
        style={{ marginTop: '24px', width: '100%', backgroundColor: '#4285F4' }}
      >
        Entrar com Google
      </button>
    </div>
  )
}
