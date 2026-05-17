import { startTransition, useState, useEffect, useCallback } from 'react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';
import { usePlace } from './PlaceContext';
import { ArrowLeft, Plus, Trash2, Edit2, GripVertical } from 'lucide-react';
import { Link } from 'react-router-dom';
import { normalizeSearchText } from './productDiscovery';

function SortableAreaItem({ area, onEdit, onDelete }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: area.id });

  return (
    <div
      ref={setNodeRef}
      className="card"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 0,
        padding: '12px 16px',
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.85 : 1,
        boxShadow: isDragging ? 'var(--shadow-md)' : 'var(--shadow-sm)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
        <button
          type="button"
          aria-label={`Arrastar ${area.name}`}
          title="Arrastar para reordenar"
          {...attributes}
          {...listeners}
          style={{
            background: 'var(--background)',
            border: 'none',
            cursor: 'grab',
            padding: '8px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            touchAction: 'none',
            color: 'var(--primary)',
            flexShrink: 0,
          }}
        >
          <GripVertical size={18} />
        </button>

        <span style={{ fontWeight: 600, fontSize: '1.05rem', minWidth: 0 }}>{area.name}</span>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="button" onClick={() => onEdit(area)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px' }}>
          <Edit2 color="var(--primary)" size={20} />
        </button>
        <button type="button" onClick={() => onDelete(area)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px' }}>
          <Trash2 color="var(--danger)" size={20} />
        </button>
      </div>
    </div>
  );
}

export default function Areas() {
  const { user } = useAuth();
  const { currentPlaceId } = usePlace();
  const [areas, setAreas] = useState([]);
  const [newArea, setNewArea] = useState('');
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const loadAreas = useCallback(async () => {
    const { data: areasData } = await supabase
      .from('areas')
      .select('*')
      .eq('place_id', currentPlaceId)
      .order('order_index', { ascending: true });
    if (areasData) {
      startTransition(() => {
        setAreas(areasData);
      });
    }
  }, [currentPlaceId]);

  useEffect(() => {
    if (user && currentPlaceId) loadAreas();
  }, [user, currentPlaceId, loadAreas]);

  const hasDuplicateAreaName = (candidateName, ignoreId = null) => {
    const normalizedCandidate = normalizeSearchText(candidateName);
    if (!normalizedCandidate) return false;

    return areas.some((area) => (
      area.id !== ignoreId
      && normalizeSearchText(area.name) === normalizedCandidate
    ));
  };

  const handleAddArea = async (e) => {
    e.preventDefault();
    if (!newArea.trim() || !currentPlaceId) return;

    const trimmedName = newArea.trim();
    if (hasDuplicateAreaName(trimmedName)) {
      alert('Já existe um corredor com esse nome neste Local.');
      return;
    }

    const newIndex = areas.length;
    const { data, error } = await supabase
      .from('areas')
      .insert([{ place_id: currentPlaceId, name: trimmedName, order_index: newIndex }])
      .select()
      .single();

    if (!error && data) {
      setAreas([...areas, data]);
      setNewArea('');
    }
  };

  const handleDeleteArea = async (area) => {
    if (!window.confirm(`Tem certeza que deseja apagar o corredor "${area.name}"? Os produtos deste corredor ficarão sem corredor associado.`)) {
      return;
    }
    await supabase.from('areas').delete().eq('id', area.id);
    setAreas(areas.filter(a => a.id !== area.id));
  };

  const handleEditArea = async (area) => {
    const newName = window.prompt('Novo nome do corredor:', area.name);
    if (newName === null) return;

    const trimmedName = newName.trim();
    if (!trimmedName || trimmedName === area.name) return;

    if (hasDuplicateAreaName(trimmedName, area.id)) {
      alert('Já existe um corredor com esse nome neste Local.');
      return;
    }

    await supabase.from('areas').update({ name: trimmedName }).eq('id', area.id);
    setAreas(areas.map(a => a.id === area.id ? { ...a, name: trimmedName } : a));
  };

  const saveAreaOrder = async (orderedAreas) => {
    setAreas(orderedAreas);

    const updates = orderedAreas.map((area, index) => ({
      id: area.id,
      place_id: area.place_id,
      name: area.name,
      order_index: index,
    }));

    await supabase.from('areas').upsert(updates);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = areas.findIndex((area) => area.id === active.id);
    const newIndex = areas.findIndex((area) => area.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(areas, oldIndex, newIndex);
    await saveAreaOrder(reordered);
  };

  return (
    <div style={{ paddingBottom: '80px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', gap: '12px' }}>
        <Link to="/settings" style={{ color: 'var(--text-main)' }}><ArrowLeft /></Link>
        <h2 style={{ fontSize: '1.25rem' }}>Organizar Corredores</h2>
      </div>

      <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '0.875rem' }}>
        Arraste os corredores pela alça para colocar as áreas na mesma ordem do seu supermercado favorito.
      </p>

      <form onSubmit={handleAddArea} style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <input type="text" value={newArea} onChange={(e) => setNewArea(e.target.value)} placeholder="Nova área (ex: Bebidas)" className="input-field" />
        <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem' }}>
          <Plus size={20} />
        </button>
      </form>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={areas.map((area) => area.id)} strategy={verticalListSortingStrategy}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {areas.map((area) => (
              <SortableAreaItem
                key={area.id}
                area={area}
                onEdit={handleEditArea}
                onDelete={handleDeleteArea}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
