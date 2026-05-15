import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';
import { usePlace } from './PlaceContext';
import { ArrowLeft, Mic, MicOff /*, Camera */ } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import useSpeechRecognition, { capitalizeFirst } from './useSpeechRecognition';
// import { compressImage } from './imageUtils'; // [IMG-OFF] reativar quando voltar com upload de imagens

export default function AddProduct() {
  const { user } = useAuth();
  const { currentPlaceId, places } = usePlace();
  const navigate = useNavigate();
  const location = useLocation();
  const editingProduct = location.state?.product || null;
  const preSelectedArea = location.state?.preSelectedArea || null;
  const suggestedName = location.state?.suggestedName || null;

  const [areas, setAreas] = useState([]);
  const [name, setName] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  // [IMG-OFF] estados de imagem desabilitados para economizar Storage no Supabase.
  // const [imageFile, setImageFile] = useState(null);
  // const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  // Mitigante 2: também adicionar este produto a outros Locais do usuário
  const [alsoAddToPlaces, setAlsoAddToPlaces] = useState([]);

  const otherPlaces = (places || []).filter(p => p.id !== currentPlaceId);
  const showAlsoAdd = !editingProduct && otherPlaces.length > 0;

  // Reconhecimento de voz para ditar o nome do produto.
  const {
    supported: voiceSupported,
    listening,
    transcript,
    error: voiceError,
    start: startVoice,
    stop: stopVoice,
    reset: resetVoice,
  } = useSpeechRecognition({ lang: 'pt-BR' });

  useEffect(() => {
    if (user && currentPlaceId) loadAreas();
  }, [user, currentPlaceId]);

  useEffect(() => {
    if (editingProduct && areas.length > 0) {
      setName(editingProduct.name);
      setSelectedArea(editingProduct.area_id);
      // [IMG-OFF] desabilitado para não exibir/atualizar imagens enquanto a captura está off.
      // if (editingProduct.thumbnail_url) {
      //   setImagePreview(editingProduct.thumbnail_url);
      // }
    } else if (preSelectedArea && areas.length > 0) {
      setSelectedArea(preSelectedArea);
    }
  }, [editingProduct, preSelectedArea, areas]);

  // Vindo do reconhecimento de voz (botão "Cadastrar" do VoiceResultModal):
  // pré-preenche o campo de Nome com o nome falado (já capitalizado).
  // Só dispara uma vez, quando suggestedName chega, e só se não está editando.
  useEffect(() => {
    if (suggestedName && !editingProduct) {
      setName(suggestedName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestedName]);

  // Quando o usuário termina de ditar (listening: true -> false) e há transcrição,
  // preenche o campo Nome com a fala capitalizada.
  useEffect(() => {
    if (listening) return;
    if (!transcript) return;
    setName(capitalizeFirst(transcript));
    resetVoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening, transcript]);

  // Tratamento de erros do microfone (permissão, sem rede, etc.)
  useEffect(() => {
    if (!voiceError) return;
    const messages = {
      'not-allowed': 'Você precisa permitir o uso do microfone no navegador.',
      'no-speech': 'Não ouvi nada. Tente de novo.',
      'audio-capture': 'Não consegui acessar o microfone.',
      'network': 'Sem internet para o reconhecimento de voz.',
    };
    alert(messages[voiceError] || 'Erro no reconhecimento de voz. Tente novamente.');
    resetVoice();
  }, [voiceError, resetVoice]);

  const handleVoiceClick = () => {
    if (listening) {
      stopVoice();
    } else {
      startVoice();
    }
  };

  const loadAreas = async () => {
    const { data } = await supabase
      .from('areas')
      .select('*')
      .eq('place_id', currentPlaceId)
      .order('order_index');
    setAreas(data || []);
    if (data && data.length > 0 && !editingProduct && !preSelectedArea) {
      setSelectedArea(data[0].id);
    }
  };

  // [IMG-OFF] captura de foto desabilitada (controle de custo do Storage). Reativar quando voltar com imagens.
  // const handleImageChange = async (e) => {
  //   if (e.target.files && e.target.files[0]) {
  //     const file = e.target.files[0];
  //     const compressedFile = await compressImage(file);
  //     setImageFile(compressedFile);
  //     setImagePreview(URL.createObjectURL(compressedFile));
  //   }
  // };

  const togglePlaceChip = (placeId) => {
    setAlsoAddToPlaces(prev =>
      prev.includes(placeId) ? prev.filter(id => id !== placeId) : [...prev, placeId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !currentPlaceId) {
      alert('Preencha o nome!');
      return;
    }
    setLoading(true);

    try {
      // [IMG-OFF] mantém qualquer thumbnail já existente, mas não envia novas imagens.
      let thumbnailUrl = editingProduct?.thumbnail_url || null;

      // [IMG-OFF] upload desabilitado. Para reativar, descomentar o bloco abaixo
      // e os 'useState' / 'handleImageChange' / JSX do card de foto.
      // if (imageFile) {
      //   const fileName = `${currentPlaceId}/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
      //   const { error: uploadError } = await supabase.storage.from('thumbnails').upload(fileName, imageFile);
      //   if (!uploadError) {
      //     const { data } = supabase.storage.from('thumbnails').getPublicUrl(fileName);
      //     thumbnailUrl = data.publicUrl;
      //   }
      // }

      if (editingProduct) {
        const { error: productError } = await supabase.from('products').update({
          area_id: selectedArea || null,
          name,
          thumbnail_url: thumbnailUrl
        }).eq('id', editingProduct.id);

        if (productError) throw productError;
        navigate('/catalog');
      } else {
        // Local atual
        const { count } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('area_id', selectedArea || null);
        const newIndex = (count || 0) * 10;

        const { error: productError } = await supabase.from('products').insert([{
          place_id: currentPlaceId,
          area_id: selectedArea || null,
          name: name.trim(),
          thumbnail_url: thumbnailUrl,
          order_index: newIndex
        }]);

        if (productError) throw productError;

        // Mitigante 2: também adicionar a outros Locais selecionados (sem area_id, sem reuso da imagem na pasta de outro Local — a URL pública vale igual)
        if (alsoAddToPlaces.length > 0) {
          const extraInserts = alsoAddToPlaces.map(pid => ({
            place_id: pid,
            area_id: null, // o outro Local pode ter corredores diferentes; usuário ajusta depois
            name: name.trim(),
            thumbnail_url: thumbnailUrl,
            order_index: 0
          }));
          await supabase.from('products').insert(extraInserts);
        }

        const extraMsg = alsoAddToPlaces.length > 0
          ? ` (também em ${alsoAddToPlaces.length} ${alsoAddToPlaces.length === 1 ? 'outro Local' : 'outros Locais'})`
          : '';
        setSuccessMsg(`"${name}" foi salvo!${extraMsg}`);
        setName('');
        // [IMG-OFF]
        // setImageFile(null);
        // setImagePreview(null);
        setAlsoAddToPlaces([]);
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
          <div style={{ position: 'relative' }}>
            <input
              className="input-field"
              placeholder={listening ? 'Ouvindo... fale o nome' : 'Ex: Leite Integral'}
              value={name}
              onChange={e => setName(e.target.value)}
              style={voiceSupported ? { paddingRight: '46px' } : undefined}
              required
            />
            {voiceSupported && (
              <button
                type="button"
                onClick={handleVoiceClick}
                aria-label={listening ? 'Parar gravação' : 'Falar o nome do produto'}
                title={listening ? 'Parar gravação' : 'Falar o nome do produto'}
                style={{
                  position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)',
                  width: '36px', height: '36px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: listening ? 'var(--danger)' : 'var(--background)',
                  border: 'none', borderRadius: '50%', cursor: 'pointer',
                  transition: 'background 0.2s',
                  animation: listening ? 'pulse 1.2s ease-in-out infinite' : 'none',
                }}
              >
                {listening ? <MicOff size={18} color="white" /> : <Mic size={18} color="var(--primary)" />}
              </button>
            )}
          </div>
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Corredor (Área)</label>
          <select
            className="input-field"
            value={selectedArea}
            onChange={e => setSelectedArea(e.target.value)}
          >
            <option value="">Sem corredor</option>
            {areas.map(area => (
              <option key={area.id} value={area.id}>{area.name}</option>
            ))}
          </select>
        </div>

        {/* [IMG-OFF] Card de foto desabilitado para controlar custo do Supabase Storage.
            Para reativar, trocar `false` por `true` e descomentar os imports/states/handler de imagem acima. */}
        {false && (
          <div className="card" style={{ marginBottom: 0 }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Foto (opcional)</label>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
              {editingProduct && editingProduct.thumbnail_url
                ? 'Tire uma nova foto se quiser substituir a atual.'
                : 'Tire uma foto para facilitar na hora de achar no mercado.'}
            </p>

            {/*
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
            */}
          </div>
        )}

        {showAlsoAdd && (
          <div className="card" style={{ marginBottom: 0 }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Adicionar também em</label>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Toque nos Locais onde você também quer cadastrar este produto.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {otherPlaces.map(p => {
                const active = alsoAddToPlaces.includes(p.id);
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => togglePlaceChip(p.id)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '999px',
                      border: `1px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
                      backgroundColor: active ? 'var(--primary)' : 'var(--surface)',
                      color: active ? '#fff' : 'var(--text-main)',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {active ? '✓ ' : ''}{p.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={loading} style={{ padding: '16px', fontSize: '1.125rem' }}>
          {loading ? 'Salvando...' : (editingProduct ? 'Salvar Alterações' : 'Salvar e Adicionar Outro')}
        </button>

        {successMsg && (
          <div style={{ padding: '12px', backgroundColor: 'var(--secondary)', color: 'white', borderRadius: '8px', textAlign: 'center', fontWeight: 500 }}>
            ✓ {successMsg}
          </div>
        )}
      </form>
    </div>
  );
}
