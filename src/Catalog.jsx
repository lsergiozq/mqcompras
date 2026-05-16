import { startTransition, useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';
import { usePlace } from './PlaceContext';
import { Plus, Search, ArrowUp, ArrowDown, Edit2, Trash2, Mic, MicOff } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import QuantityPickerModal from './QuantityPickerModal';
import { buildProductInsights, getSortedProductMatches } from './productDiscovery';
import useSpeechRecognition, { capitalizeFirst } from './useSpeechRecognition';

export default function Catalog() {
  const { user } = useAuth();
  const { currentPlaceId } = usePlace();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [productInsights, setProductInsights] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [quantityDialog, setQuantityDialog] = useState({ open: false, product: null, initialQuantity: '1' });

  // Reconhecimento de voz para busca no catálogo
  const {
    supported: voiceSupported,
    listening,
    transcript,
    error: voiceError,
    start: startVoice,
    stop: stopVoice,
    reset: resetVoice,
  } = useSpeechRecognition({ lang: 'pt-BR' });

  // Quando o usuário termina de ditar, joga a fala (capitalizada) no campo de busca.
  useEffect(() => {
    if (listening) return;
    if (!transcript) return;
    startTransition(() => {
      setSearchQuery(capitalizeFirst(transcript));
    });
    resetVoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening, transcript]);

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
    if (listening) stopVoice(); else startVoice();
  };

  const loadCatalog = useCallback(async () => {
    const { data } = await supabase
      .from('products')
      .select('*, area:areas(name, order_index)')
      .eq('place_id', currentPlaceId)
      .order('order_index', { ascending: true })
      .order('name', { ascending: true });

    if (!data) return;

    startTransition(() => {
      setProducts(data);
    });

    const productIds = data.map((product) => product.id);
    if (productIds.length === 0) {
      startTransition(() => {
        setProductInsights({});
      });
      return;
    }

    const { data: usageRows } = await supabase
      .from('list_items')
      .select('product_id, added_at, archived_at')
      .eq('place_id', currentPlaceId)
      .in('product_id', productIds);

    startTransition(() => {
      setProductInsights(buildProductInsights(usageRows || []));
    });
  }, [currentPlaceId]);

  useEffect(() => {
    if (user && currentPlaceId) loadCatalog();
  }, [user, currentPlaceId, loadCatalog]);

  const filteredProducts = searchQuery
    ? getSortedProductMatches(products, searchQuery, productInsights)
    : products;

  const groupedProducts = filteredProducts.reduce((acc, p) => {
    const areaName = p.area?.name || 'Sem Corredor';
    const areaId = p.area_id;
    const orderIndex = p.area?.order_index ?? 999;
    if (!acc[areaName]) acc[areaName] = { order: orderIndex, areaId: areaId, items: [] };
    acc[areaName].items.push(p);
    return acc;
  }, {});

  const sortedAreas = Object.keys(groupedProducts).sort((a, b) => groupedProducts[a].order - groupedProducts[b].order);

  const closeQuantityDialog = () => {
    setQuantityDialog({ open: false, product: null, initialQuantity: '1' });
  };

  const openQuantityDialog = (product) => {
    setQuantityDialog({ open: true, product, initialQuantity: '1' });
  };

  const addToShoppingList = async (productId, quantity) => {
    const qty = quantity.trim() || '1';

    const { data: existingArray } = await supabase
      .from('list_items')
      .select('*')
      .eq('product_id', productId)
      .eq('place_id', currentPlaceId)
      .is('archived_at', null)
      .limit(1);
    const existing = existingArray && existingArray.length > 0 ? existingArray[0] : null;

    if (existing) {
      await supabase.from('list_items').update({ is_purchased: false, quantity: qty }).eq('id', existing.id);
    } else {
      await supabase.from('list_items').insert([{
        place_id: currentPlaceId,
        product_id: productId,
        quantity: qty,
        is_purchased: false
      }]);
    }

    closeQuantityDialog();
    setToastMsg('✓ Adicionado à lista');
    setTimeout(() => setToastMsg(''), 2500);
    loadCatalog();
  };

  const handleEditProduct = (product) => {
    navigate('/add', { state: { product } });
  };

  const handleDeleteProduct = async (product) => {
    if (window.confirm(`Tem certeza que deseja apagar "${product.name}" do catálogo e de todas as listas?`)) {
      await supabase.from('list_items').delete().eq('product_id', product.id);

      if (product.thumbnail_url) {
        try {
          const urlParts = product.thumbnail_url.split('/');
          const fileName = urlParts.pop();
          const folderName = urlParts.pop();
          await supabase.storage.from('thumbnails').remove([`${folderName}/${fileName}`]);
        } catch {
          // Melhor esforço: se falhar ao limpar o Storage, segue apagando o produto.
        }
      }

      await supabase.from('products').delete().eq('id', product.id);
      setProducts(products.filter(p => p.id !== product.id));
    }
  };

  const moveProduct = async (areaName, index, direction) => {
    const areaItems = groupedProducts[areaName].items;
    if ((direction === -1 && index === 0) || (direction === 1 && index === areaItems.length - 1)) return;

    const targetIndex = index + direction;

    const newProducts = [...products];
    const p1 = areaItems[index];
    const p2 = areaItems[targetIndex];

    const idx1 = newProducts.findIndex(p => p.id === p1.id);
    const idx2 = newProducts.findIndex(p => p.id === p2.id);

    if (p1.order_index === p2.order_index || p1.order_index === null) {
        areaItems.forEach((item, i) => {
            item.order_index = i * 10;
        });
    }

    const tempOrder = p1.order_index;
    p1.order_index = p2.order_index;
    p2.order_index = tempOrder;

    newProducts[idx1] = p1;
    newProducts[idx2] = p2;

    newProducts.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    setProducts([...newProducts]);

    const updates = areaItems.map((item) => ({
      id: item.id,
      place_id: item.place_id,
      area_id: item.area_id,
      name: item.name,
      thumbnail_url: item.thumbnail_url,
      order_index: item.order_index
    }));

    await supabase.from('products').upsert(updates);
  };

  return (
    <div style={{ paddingBottom: '80px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.5rem' }}>Meu Catálogo</h2>
        <Link to="/add" className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.875rem' }}>
          <Plus size={18} /> Novo
        </Link>
      </div>

      <div style={{ position: 'relative', marginBottom: '24px' }}>
        <Search size={20} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
        <input
          className="input-field"
          placeholder={listening ? 'Ouvindo... fale o nome' : 'Buscar nos meus catálogos...'}
          style={{ paddingLeft: '40px', paddingRight: voiceSupported ? '46px' : '14px' }}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        {voiceSupported && (
          <button
            type="button"
            onClick={handleVoiceClick}
            aria-label={listening ? 'Parar gravação' : 'Buscar por voz'}
            title={listening ? 'Parar gravação' : 'Buscar por voz'}
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

      {products.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
          <p>Você ainda não cadastrou nenhum produto.</p>
          <p style={{ fontSize: '0.875rem', marginTop: '8px' }}>Cadastre os produtos que você consome clicando em "Novo".</p>
        </div>
      ) : sortedAreas.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '48px' }}>
          <p>Nenhum produto encontrado.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {sortedAreas.map(areaName => (
            <div key={areaName}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '1.125rem', color: 'var(--primary)', margin: 0 }}>{areaName}</h3>
                <button
                  onClick={() => navigate('/add', { state: { preSelectedArea: groupedProducts[areaName].areaId } })}
                  style={{ background: 'var(--primary)', border: 'none', color: 'white', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px 10px', gap: '4px', fontSize: '0.75rem', fontWeight: 600 }}
                >
                  <Plus size={14} /> Novo aqui
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {groupedProducts[areaName].items.map((p, index) => (
                  <div key={p.id} className="card" style={{ marginBottom: 0, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '12px' }}>

                    {!searchQuery && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '2px', background: 'var(--background)', borderRadius: '6px' }}>
                        <button onClick={() => moveProduct(areaName, index, -1)} disabled={index === 0} style={{ background: 'none', border: 'none', cursor: index === 0 ? 'default' : 'pointer', padding: '2px', opacity: index === 0 ? 0.3 : 1, display: 'flex' }}>
                          <ArrowUp size={16} color="var(--primary)" />
                        </button>
                        <button onClick={() => moveProduct(areaName, index, 1)} disabled={index === groupedProducts[areaName].items.length - 1} style={{ background: 'none', border: 'none', cursor: index === groupedProducts[areaName].items.length - 1 ? 'default' : 'pointer', padding: '2px', opacity: index === groupedProducts[areaName].items.length - 1 ? 0.3 : 1, display: 'flex' }}>
                          <ArrowDown size={16} color="var(--primary)" />
                        </button>
                      </div>
                    )}

                    {/* [IMG-OFF] Thumbnail desabilitada para economizar Storage.
                    {p.thumbnail_url ? (
                      <img src={p.thumbnail_url} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 40, height: 40, borderRadius: 6, backgroundColor: 'var(--background)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ImageIcon size={20} color="var(--text-muted)" />
                      </div>
                    )}
                    */}

                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500 }}>{p.name}</div>
                    </div>

                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={() => handleEditProduct(p)} className="btn" style={{ padding: '8px', backgroundColor: 'transparent', color: 'var(--primary)' }}>
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => handleDeleteProduct(p)} className="btn" style={{ padding: '8px', backgroundColor: 'transparent', color: 'var(--danger)' }}>
                        <Trash2 size={18} />
                      </button>
                    </div>

                    <button onClick={() => openQuantityDialog(p)} className="btn" style={{ padding: '8px', backgroundColor: 'var(--background)', color: 'var(--primary)' }}>
                      <Plus size={20} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {toastMsg && (
        <div style={{
          position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
          backgroundColor: 'var(--primary)', color: 'white',
          padding: '12px 24px', borderRadius: '24px',
          boxShadow: 'var(--shadow-lg)', zIndex: 1000,
          animation: 'fadeInOut 2.5s ease forwards',
          fontWeight: 600, whiteSpace: 'nowrap'
        }}>
          {toastMsg}
        </div>
      )}

      <QuantityPickerModal
        key={quantityDialog.product?.id || 'catalog-quantity'}
        open={quantityDialog.open}
        title="Quantidade"
        itemName={quantityDialog.product?.name}
        initialQuantity={quantityDialog.initialQuantity}
        confirmLabel="Adicionar"
        onCancel={closeQuantityDialog}
        onConfirm={(quantity) => addToShoppingList(quantityDialog.product.id, quantity)}
      />
    </div>
  );
}
