import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';
import { ArrowLeft, Camera } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { compressImage } from './imageUtils';

export default function AddProduct() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [areas, setAreas] = useState([]);
  const [name, setName] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAreas();
  }, [user]);

  const loadAreas = async () => {
    const { data: userFamilies } = await supabase.from('user_families').select('family_id').eq('user_id', user.id);
    if (userFamilies && userFamilies.length > 0) {
      const { data } = await supabase.from('areas').select('*').eq('family_id', userFamilies[0].family_id).order('order_index');
      setAreas(data || []);
      if (data && data.length > 0) setSelectedArea(data[0].id);
    }
  };

  const handleImageChange = async (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const compressedFile = await compressImage(file);
      setImageFile(compressedFile);
      setImagePreview(URL.createObjectURL(compressedFile));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !selectedArea) return;
    setLoading(true);

    try {
      const { data: userFamilies } = await supabase.from('user_families').select('family_id').eq('user_id', user.id).single();
      const familyId = userFamilies.family_id;

      let thumbnailUrl = null;

      if (imageFile) {
        const fileName = `${familyId}/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
        const { error: uploadError } = await supabase.storage.from('thumbnails').upload(fileName, imageFile);
        if (!uploadError) {
          const { data } = supabase.storage.from('thumbnails').getPublicUrl(fileName);
          thumbnailUrl = data.publicUrl;
        }
      }

      // Salva no catálogo
      const { data: product } = await supabase.from('products').insert([{
        family_id: familyId,
        area_id: selectedArea,
        name,
        thumbnail_url: thumbnailUrl
      }]).select().single();

      // Já adiciona direto na lista de compras ativa
      await supabase.from('list_items').insert([{
        family_id: familyId,
        product_id: product.id,
        quantity: '1',
        is_purchased: false
      }]);

      navigate('/');
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar produto');
    }
    setLoading(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px', gap: '12px' }}>
        <Link to="/" style={{ color: 'var(--text-main)' }}><ArrowLeft /></Link>
        <h2 style={{ fontSize: '1.25rem' }}>Novo Produto</h2>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="card" style={{ marginBottom: 0 }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Nome do Produto</label>
          <input 
            className="input-field" 
            placeholder="Ex: Leite Integral" 
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Corredor (Área)</label>
          <select 
            className="input-field" 
            value={selectedArea}
            onChange={e => setSelectedArea(e.target.value)}
            required
          >
            {areas.map(area => (
              <option key={area.id} value={area.id}>{area.name}</option>
            ))}
          </select>
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Foto (opcional)</label>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
            Tire uma foto para facilitar na hora de achar no mercado. A imagem será comprimida automaticamente.
          </p>
          
          <label style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            border: '2px dashed var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px',
            cursor: 'pointer', backgroundColor: 'var(--background)', color: 'var(--primary)',
            position: 'relative', overflow: 'hidden'
          }}>
            <input 
              type="file" 
              accept="image/*" 
              capture="environment" 
              onChange={handleImageChange}
              style={{ display: 'none' }}
            />
            {imagePreview ? (
              <img src={imagePreview} alt="Preview" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <>
                <Camera size={32} style={{ marginBottom: '8px' }} />
                <span style={{ fontWeight: 600 }}>Tirar foto</span>
              </>
            )}
          </label>
        </div>

        <button type="submit" className="btn btn-primary" disabled={loading} style={{ padding: '16px', fontSize: '1.125rem' }}>
          {loading ? 'Salvando...' : 'Adicionar à Lista'}
        </button>
      </form>
    </div>
  );
}
