import { supabase } from './supabase'

export default function Auth() {
  const handleGoogleLogin = async () => {
    // Se a pessoa clicou em um link de convite antes de logar, mandamos ela direto
    // para /join/:token assim que o login terminar.
    const pendingToken = window.localStorage.getItem('pendingJoinToken');
    const redirectTo = pendingToken
      ? `${window.location.origin}/join/${pendingToken}`
      : window.location.origin;

    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo }
    })
  }

  // Mostra um aviso amistoso se há convite pendente
  const pendingToken = typeof window !== 'undefined'
    ? window.localStorage.getItem('pendingJoinToken')
    : null;

  return (
    <div className="card" style={{ textAlign: 'center', padding: '2rem 1rem' }}>
      <h2 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>
        {pendingToken ? 'Você foi convidado!' : 'Acesse seu Local'}
      </h2>
      <p style={{ color: 'var(--text-muted)' }}>
        {pendingToken
          ? 'Faça login com Google para entrar no Local compartilhado.'
          : 'Faça login com sua conta Google para ver suas listas de compras.'}
      </p>

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
