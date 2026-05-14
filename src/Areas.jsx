import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';
import { usePlace } from './PlaceContext';
import { ArrowLeft, ArrowUp, ArrowDown, Plus, Trash2, Edit2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Areas() {
  const { user } = useAuth();
  const { currentPlaceId } = usePlace();
  const [areas, setAreas] = useState([]);
  const [newArea, setNewArea] = useState('');

  useEffect(() => {
    if (user && currentPlaceId) loadAreas();
  }, [user, currentPlaceId]);

  const loadAreas = async () => {
    const { data: areasData } = await supabase
      .from('areas')
      .select('*')
      .eq('place_id', currentPlaceId)
      .order('order_index', { ascending: true });
    if (areasData) setAreas(areasData);
  };

  const handleAddArea = async (e) => {
    e.preventDefault();
    if (!newArea.trim() || !currentPlaceId) return;

    const newIndex = areas.length;
    const { data, error } = await supabase
      .from('areas')
      .insert([{ place_id: currentPlaceId, name: newArea.trim(), order_index: newIndex }])
      .select()
      .single();

    if (!error && data) {
      setAreas([...areas, data]);
      setNewArea('');
    }
  };

  const handleDeleteArea = async (id) => {
    await supabase.from('areas').delete().eq('id', id);
    setAreas(areas.filter(a => a.id !== id));
  };

  const handleEditArea = async (area) => {
    const newName = window.prompt('Novo nome do corredor:', area.name);
    if (newName !== null && newName.trim() !== '' && newName.trim() !== area.name) {
      await supabase.from('areas').update({ name: newName.trim() }).eq('id', area.id);
      setAreas(areas.map(a => a.id === area.id ? { ...a, name: newName.trim() } : a));
    }
  };

  const moveArea = async (index, direction) => {
    if ((direction === -1 && index === 0) || (direction === 1 && index === areas.length - 1)) return;

    const newAreas = [...areas];
    const targetIndex = index + direction;

    const temp = newAreas[index];
    newAreas[index] = newAreas[targetIndex];
    newAreas[targetIndex] = temp;

    setAreas(newAreas);

    const updates = newAreas.map((area, i) => ({
      id: area.id,
      place_id: area.place_id,
      name: area.name,
      order_index: i
    }));

    await supabase.from('areas').upsert(updates);
  };

  return (
    <div style={{ paddingBottom: '80px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', gap: '12px' }}>
        <Link to="/settings" style={{ color: 'var(--text-main)' }}><ArrowLeft /></Link>
        <h2 style={{ fontSize: '1.25rem' }}>Organizar Corredores</h2>
      </div>

      <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '0.875rem' }}>
        Use as setas (⬆️ e ⬇️) para colocar as áreas na mesma ordem do seu supermercado favorito.
      </p>

      <form onSubmit={handleAddArea} style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <input type="text" value={newArea} onChange={(e) => setNewArea(e.target.value)} placeholder="Nova área (ex: Bebidas)" className="input-field" />
        <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem' }}>
          <Plus size={20} />
        </button>
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {areas.map((area, index) => (
          <div key={area.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 0, padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '4px', background: 'var(--background)', borderRadius: '8px' }}>
                <button
                  onClick={() => moveArea(index, -1)}
                  disabled={index === 0}
                  style={{ background: 'none', border: 'none', cursor: index === 0 ? 'default' : 'pointer', padding: '4px', opacity: index === 0 ? 0.3 : 1, display: 'flex' }}
                >
                  <ArrowUp size={18} color="var(--primary)" />
                </button>
                <button
                  onClick={() => moveArea(index, 1)}
                  disabled={index === areas.length - 1}
                  style={{ background: 'none', border: 'none', cursor: index === areas.length - 1 ? 'default' : 'pointer', padding: '4px', opacity: index === areas.length - 1 ? 0.3 : 1, display: 'flex' }}
                >
                  <ArrowDown size={18} color="var(--primary)" />
                </button>
              </div>

              <span style={{ fontWeight: 600, fontSize: '1.05rem' }}>{area.name}</span>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => handleEditArea(area)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px' }}>
                <Edit2 color="var(--primary)" size={20} />
              </button>
              <button onClick={() => handleDeleteArea(area.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px' }}>
                <Trash2 color="var(--danger)" size={20} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
