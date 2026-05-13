import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';
import { Copy, Users, ListTree } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [familyId, setFamilyId] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) loadFamily();
  }, [user]);

  const loadFamily = async () => {
    let { data: userFamilies } = await supabase.from('user_families').select('family_id').eq('user_id', user.id);
    if (userFamilies && userFamilies.length > 0) {
      setFamilyId(userFamilies[0].family_id);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(familyId);
    alert('Código copiado! Envie no WhatsApp para sua família colar aqui.');
  };

  const handleJoinFamily = async (e) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    
    // Validação básica do UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(inviteCode.trim())) {
      alert('Código inválido. Verifique se copiou e colou inteiro sem espaços a mais.');
      return;
    }

    setLoading(true);
    try {
      // Verifica se a família destino existe
      const { data: family } = await supabase.from('families').select('id').eq('id', inviteCode.trim()).single();
      if (!family) {
        alert('Família não encontrada com esse código.');
        setLoading(false);
        return;
      }

      // Remove da família antiga e insere na nova (mais seguro do que UPDATE em chaves primárias compostas)
      await supabase.from('user_families').delete().eq('user_id', user.id);
      
      const { error } = await supabase.from('user_families').insert([{ 
        user_id: user.id, 
        family_id: inviteCode.trim() 
      }]);

      if (error) throw error;

      alert('Sincronizado com sucesso! Agora vocês dividem a mesma lista.');
      window.location.href = '/'; // Força um reload completo para recarregar todos os dados
    } catch (err) {
      console.error(err);
      alert('Erro ao tentar entrar na família.');
    }
    setLoading(false);
  };

  return (
    <div style={{ paddingBottom: '80px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px', gap: '12px' }}>
        <h2 style={{ fontSize: '1.5rem' }}>Configurações</h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Menu de Corredores */}
        <Link to="/areas" className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', textDecoration: 'none', color: 'inherit', marginBottom: 0 }}>
          <div style={{ padding: '12px', backgroundColor: 'rgba(79, 70, 229, 0.1)', borderRadius: '12px' }}>
            <ListTree color="var(--primary)" size={24} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '1.125rem', marginBottom: '4px' }}>Organizar Corredores</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Mude a ordem das áreas do seu mercado</p>
          </div>
        </Link>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />

        {/* Compartilhamento */}
        <div>
          <h3 style={{ fontSize: '1.125rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={20} color="var(--primary)" />
            Compartilhar Lista
          </h3>
          
          <div className="card">
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Seu código de convite. Envie para quem vai dividir as compras com você:
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                className="input-field" 
                value={familyId} 
                readOnly 
                style={{ backgroundColor: 'var(--background)', color: 'var(--text-muted)', fontSize: '0.7rem', fontFamily: 'monospace' }}
              />
              <button onClick={copyToClipboard} className="btn btn-primary" style={{ padding: '0 16px' }}>
                <Copy size={20} />
              </button>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 0 }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Recebeu um código? Cole aqui para entrar na família de outra pessoa:
            </p>
            <form onSubmit={handleJoinFamily} style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
              <input 
                className="input-field" 
                placeholder="Cole o código grande aqui" 
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value)}
                required
              />
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Sincronizando...' : 'Entrar na Família'}
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
