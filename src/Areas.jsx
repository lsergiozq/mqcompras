import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';
import { ArrowLeft, GripVertical, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Areas() {
  const { user } = useAuth();
  const [areas, setAreas] = useState([]);
  const [newArea, setNewArea] = useState('');
  const [familyId, setFamilyId] = useState(null);

  useEffect(() => {
    if (user) {
      loadFamilyAndAreas();
    }
  }, [user]);

  const loadFamilyAndAreas = async () => {
    let { data: userFamilies } = await supabase
      .from('user_families')
      .select('family_id')
      .eq('user_id', user.id);

    let fid = null;

    if (!userFamilies || userFamilies.length === 0) {
      const { data: newFamily } = await supabase
        .from('families')
        .insert([{ name: 'Minha Família' }])
        .select()
        .single();
      
      fid = newFamily.id;
      await supabase.from('user_families').insert([{ user_id: user.id, family_id: fid }]);

      const defaultAreas = ['Hortifruti', 'Padaria', 'Frios', 'Açougue', 'Limpeza', 'Mercearia'];
      const areasToInsert = defaultAreas.map((name, index) => ({
        family_id: fid,
        name,
        order_index: index
      }));
      await supabase.from('areas').insert(areasToInsert);
    } else {
      fid = userFamilies[0].family_id;
    }
    
    setFamilyId(fid);

    const { data: areasData } = await supabase
      .from('areas')
      .select('*')
      .eq('family_id', fid)
      .order('order_index', { ascending: true });

    if (areasData) setAreas(areasData);
  };

  const handleAddArea = async (e) => {
    e.preventDefault();
    if (!newArea.trim() || !familyId) return;

    const newIndex = areas.length;
    const { data, error } = await supabase
      .from('areas')
      .insert([{ family_id: familyId, name: newArea.trim(), order_index: newIndex }])
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

  // Drag and drop
  const [draggedItem, setDraggedItem] = useState(null);

  const handleDragStart = (e, index) => {
    setDraggedItem(areas[index]);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    const draggedOverItem = areas[index];

    if (draggedItem === draggedOverItem) return;

    let items = areas.filter(item => item !== draggedItem);
    items.splice(index, 0, draggedItem);
    
    setAreas(items);
  };

  const handleDragEnd = async () => {
    setDraggedItem(null);
    const updates = areas.map((area, index) => ({
      id: area.id,
      family_id: area.family_id,
      name: area.name,
      order_index: index
    }));
    
    await supabase.from('areas').upsert(updates);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', gap: '12px' }}>
        <Link to="/" style={{ color: 'var(--text-main)' }}><ArrowLeft /></Link>
        <h2 style={{ fontSize: '1.25rem' }}>Organizar Corredores</h2>
      </div>

      <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '0.875rem' }}>
        Arraste e solte para colocar as áreas na mesma ordem do seu supermercado favorito.
      </p>

      <form onSubmit={handleAddArea} style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <input
          type="text"
          value={newArea}
          onChange={(e) => setNewArea(e.target.value)}
          placeholder="Nova área (ex: Bebidas)"
          className="input-field"
        />
        <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem' }}>
          <Plus size={20} />
        </button>
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {areas.map((area, index) => (
          <div
            key={area.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className="card"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: 0,
              padding: '12px 16px',
              cursor: 'grab',
              opacity: draggedItem?.id === area.id ? 0.5 : 1
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <GripVertical color="var(--text-muted)" size={20} />
              <span style={{ fontWeight: 500 }}>{area.name}</span>
            </div>
            <button 
              onClick={() => handleDeleteArea(area.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
            >
              <Trash2 color="var(--danger)" size={18} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
