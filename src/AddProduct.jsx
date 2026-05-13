import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';
import { ArrowLeft, Camera } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { compressImage } from './imageUtils';

export default function AddProduct() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const editingProduct = location.state?.product || null;
  const preSelectedArea = location.state?.preSelectedArea || null;

  const [areas, setAreas] = useState([]);
  const [name, setName] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [familyId, setFamilyId] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    loadAreas();
  }, [user]);

  useEffect(() => {
    if (editingProduct && areas.length > 0) {
      setName(editingProduct.name);
      setSelectedArea(editingProduct.area_id);
      if (editingProduct.thumbnail_url) {
        setImagePreview(editingProduct.thumbnail_url);
      }
    } else if (preSelectedArea && areas.length > 0) {
      setSelectedArea(preSelectedArea);
    }
  }, [editingProduct, preSelectedArea, areas]);

  const loadAreas = async () => {
    let { data: userFamilies } = await supabase.from('user_families').select('family_id').eq('user_id', user.id);
    
    let fid = null;
    if (!userFamilies || userFamilies.length === 0) {
      const { data: newFamily } = await supabase.from('families').insert([{ name: 'Minha Família' }]).select().single();
      fid = newFamily.id;
      await supabase.from('user_families').insert([{ user_id: user.id, family_id: fid }]);

      const defaultAreas = ['Hortifruti', 'Padaria', 'Frios', 'Açougue', 'Limpeza', 'Mercearia'];
      const areasToInsert = defaultAreas.map((n, index) => ({ family_id: fid, name: n, order_index: index }));
      await supabase.from('areas').insert(areasToInsert);
    } else {
      fid = userFamilies[0].family_id;
    }

    setFamilyId(fid);

    const { data } = await supabase.from('areas').select('*').eq('family_id', fid).order('order_index');
    setAreas(data || []);
    if (data && data.length > 0 && !editingProduct) setSelectedArea(data[0].id);
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
    if (!name || !selectedArea || !familyId) {
      alert('Preencha o nome e o corredor!');
      return;
    }
    setLoading(true);

    try {
      let thumbnailUrl = editingProduct?.thumbnail_url || null;

      if (imageFile) {
        const fileName = `${familyId}/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
        const { error: uploadError } = await supabase.storage.from('thumbnails').upload(fileName, imageFile);
        if (!uploadError) {
          const { data } = supabase.storage.from('thumbnails').getPublicUrl(fileName);
          thumbnailUrl = data.publicUrl;
        }
      }

      if (editingProduct) {
        // Atualiza
        const { error: productError } = await supabase.from('products').update({
          area_id: selectedArea,
          name,
          thumbnail_url: thumbnailUrl
        }).eq('id', editingProduct.id);
        
        if (productError) throw productError;
        navigate('/catalog');
      } else {
        // Pega o número de itens na área para colocar no fim da fila
        const { count } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('area_id', selectedArea);
        const newIndex = (count || 0) * 10;

        // Insere
        const { error: productError } = await supabase.from('products').insert([{
          family_id: familyId,
          area_id: selectedArea,
          name: name.trim(),
          thumbnail_url: thumbnailUrl,
          order_index: newIndex
        }]);

        if (productError) throw productError;
        
        // Em vez de voltar, limpa o formulário para adicionar outro!
        setSuccessMsg(`"${name}" foi salvo!`);
        setName('');
        setImageFile(null);
        setImagePreview(null);
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar produto. Tente novamente.');
    }
    setLoading(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px', gap: '12px' }}>
        <Link to="/catalog" style={{ color: 'var(--text-main)' }}><ArrowLeft /></Link>
        <h2 style={{ fontSize: '1.25rem' }}>{editingProduct ? 'Editar Produto' : 'Novo Produto'}</h2>
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
            {editingProduct && editingProduct.thumbnail_url 
              ? 'Tire uma nova foto se quiser substituir a atual.'
              : 'Tire uma foto para facilitar na hora de achar no mercado.'}
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
          {loading ? 'Salvando...' : (editingProduct ? 'Salvar Alterações' : 'Salvar e Adicionar Outro')}
        </button>

        {successMsg && (
          <div style={{ padding: '12px', backgroundColor: 'var(--secondary)', color: 'white', borderRadius: '8px', textAlign: 'center', fontWeight: 500, animation: 'fadeIn 0.3s ease' }}>
            ✓ {successMsg}
          </div>
        )}
      </form>
    </div>
  );
}
