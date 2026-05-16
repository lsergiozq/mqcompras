import { startTransition, useState, useEffect } from 'react';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';
import { usePlace } from './PlaceContext';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, Plus, Search, ShoppingBag, Mic, MicOff } from 'lucide-react';
import QuantityPickerModal from './QuantityPickerModal';
import { buildProductInsights, formatLastPurchaseText, getSortedProductMatches } from './productDiscovery';
import useSpeechRecognition, { splitVoiceTranscript, capitalizeFirst } from './useSpeechRecognition';
import VoiceResultModal from './VoiceResultModal';

export default function ShoppingList() {
  const { user } = useAuth();
  const { currentPlaceId } = usePlace();
  const [items, setItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [allProducts, setAllProducts] = useState([]);
  const [productInsights, setProductInsights] = useState({});
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [quantityDialog, setQuantityDialog] = useState({ open: false, mode: 'add', product: null, item: null, initialQuantity: '1' });

  // === Entrada por voz ===
  const { supported: voiceSupported, listening, transcript, error: voiceError, start: startVoice, stop: stopVoice, reset: resetVoice } = useSpeechRecognition({ lang: 'pt-BR' });
  const [voiceModal, setVoiceModal] = useState({ open: false, transcript: '', matched: [], unmatched: [] });

  useEffect(() => {
    if (!user || !currentPlaceId) return;

    fetchItems(currentPlaceId);
    loadCatalog(currentPlaceId);

    const channel = supabase.channel(`list_updates_${currentPlaceId}_${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'list_items', filter: `place_id=eq.${currentPlaceId}` }, () => {
        fetchItems(currentPlaceId);
        loadCatalog(currentPlaceId);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, currentPlaceId]);

  async function loadCatalog(pid) {
    const { data: products } = await supabase.from('products').select('*').eq('place_id', pid);
    if (!products) return;

    setAllProducts(products);

    const productIds = products.map((product) => product.id);
    if (productIds.length === 0) {
      setProductInsights({});
      return;
    }

    const { data: usageRows } = await supabase
      .from('list_items')
      .select('product_id, added_at, archived_at')
      .eq('place_id', pid)
      .in('product_id', productIds);

    setProductInsights(buildProductInsights(usageRows || []));
  }

  async function fetchItems(pid) {
    const { data } = await supabase
      .from('list_items')
      .select(`
        id, quantity, is_purchased,
        product:products(id, name, thumbnail_url, area_id, order_index, area:areas(id, name, order_index))
      `)
      .eq('place_id', pid)
      .is('archived_at', null);

    if (data) setItems(data);
  }

  // Quando o usuário para de falar (listening: true -> false) e há transcrição, processa.
  useEffect(() => {
    if (listening) return;       // ainda gravando
    if (!transcript) return;     // não falou nada
    if (allProducts.length === 0) return;

    const phrases = splitVoiceTranscript(transcript);
    const matched = [];
    const unmatched = [];
    const usedIds = new Set();

    for (const rawPhrase of phrases) {
      const phrase = capitalizeFirst(rawPhrase);
      // Aproveita o mesmo matching usado no autocomplete (fuzzy + prioridade por uso)
      const candidates = getSortedProductMatches(allProducts, phrase, productInsights);
      const best = candidates.find(p => !usedIds.has(p.id));
      if (best) {
        usedIds.add(best.id);
        matched.push({ phrase, product: best });
      } else {
        unmatched.push(phrase);
      }
    }

    startTransition(() => {
      setVoiceModal({ open: true, transcript, matched, unmatched });
    });
    resetVoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening, transcript]);

  // Tratar erro do microfone (permissão negada, sem internet, etc.)
  useEffect(() => {
    if (!voiceError) return;
    const errorMessages = {
      'not-allowed': 'Você precisa permitir o uso do microfone no navegador.',
      'no-speech': 'Não ouvi nada. Tente de novo.',
      'audio-capture': 'Não consegui acessar o microfone.',
      'network': 'Sem internet para o reconhecimento de voz.',
    };
    alert(errorMessages[voiceError] || 'Erro no reconhecimento de voz. Tente novamente.');
    resetVoice();
  }, [voiceError, resetVoice]);

  const handleVoiceClick = () => {
    if (listening) {
      stopVoice();
    } else {
      startVoice();
    }
  };

  const closeVoiceModal = () => setVoiceModal({ open: false, transcript: '', matched: [], unmatched: [] });

  const handleVoiceConfirm = async (products) => {
    if (!products || products.length === 0) {
      closeVoiceModal();
      return;
    }

    // Para cada produto, se já existe um item ativo, reativa; senão insere.
    const productIds = products.map(p => p.id);
    const { data: existing } = await supabase
      .from('list_items')
      .select('id, product_id, is_purchased')
      .eq('place_id', currentPlaceId)
      .in('product_id', productIds)
      .is('archived_at', null);

    const existingByProduct = new Map((existing || []).map(e => [e.product_id, e]));
    const toInsert = [];
    const toReactivate = [];

    for (const p of products) {
      const e = existingByProduct.get(p.id);
      if (e) {
        if (e.is_purchased) toReactivate.push(e.id);
      } else {
        toInsert.push({
          place_id: currentPlaceId,
          product_id: p.id,
          quantity: '1',
          is_purchased: false,
        });
      }
    }

    if (toInsert.length > 0)    await supabase.from('list_items').insert(toInsert);
    if (toReactivate.length > 0) await supabase.from('list_items').update({ is_purchased: false, quantity: '1' }).in('id', toReactivate);

    closeVoiceModal();
    fetchItems(currentPlaceId);
    loadCatalog(currentPlaceId);
  };

  const togglePurchased = async (id, currentStatus) => {
    setItems(items.map(item => item.id === id ? { ...item, is_purchased: !currentStatus } : item));
    await supabase.from('list_items').update({ is_purchased: !currentStatus }).eq('id', id);
  };

  const closeQuantityDialog = () => {
    setQuantityDialog({ open: false, mode: 'add', product: null, item: null, initialQuantity: '1' });
  };

  const openAddQuantityDialog = (product) => {
    setSearchQuery('');
    setShowAutocomplete(false);

    setQuantityDialog({ open: true, mode: 'add', product, item: null, initialQuantity: '1' });
  };

  const handleAddExistingProduct = async (product, quantity) => {
    const qty = quantity.trim() || '1';

    const { data: existingArray } = await supabase.from('list_items').select('*').eq('product_id', product.id).eq('place_id', currentPlaceId).is('archived_at', null).limit(1);
    const existing = existingArray && existingArray.length > 0 ? existingArray[0] : null;

    if (existing) {
      await supabase.from('list_items').update({ is_purchased: false, quantity: qty }).eq('id', existing.id);
    } else {
      await supabase.from('list_items').insert([{
        place_id: currentPlaceId,
        product_id: product.id,
        quantity: qty,
        is_purchased: false
      }]);
    }

    closeQuantityDialog();
    fetchItems(currentPlaceId);
    loadCatalog(currentPlaceId);
  };

  const handleUpdateQuantity = async (item, quantity) => {
    const nextQuantity = quantity.trim();
    if (!nextQuantity) return;

    await supabase.from('list_items').update({ quantity: nextQuantity }).eq('id', item.id);
    closeQuantityDialog();
    fetchItems(currentPlaceId);
  };

  const handleRemoveItem = async (item) => {
    await supabase.from('list_items').delete().eq('id', item.id);
    closeQuantityDialog();
    fetchItems(currentPlaceId);
  };

  const finishShopping = async () => {
    if (window.confirm('Tem certeza que deseja finalizar as compras? Os itens marcados serão movidos para o Histórico.')) {
      const purchasedIds = items.filter(i => i.is_purchased).map(i => i.id);
      if (purchasedIds.length > 0) {
        const archivedAt = new Date().toISOString();
        await supabase.from('list_items').update({ archived_at: archivedAt }).in('id', purchasedIds);
        setItems(prev => prev.filter(i => !purchasedIds.includes(i.id)));
      }
    }
  };

  // Agrupa por área
  const groupedItems = items.reduce((acc, item) => {
    const areaName = item.product.area?.name || 'Sem Corredor';
    const orderIndex = item.product.area?.order_index ?? 999;
    if (!acc[areaName]) acc[areaName] = { order: orderIndex, items: [], purchased: [] };

    if (item.is_purchased) {
      acc[areaName].purchased.push(item);
    } else {
      acc[areaName].items.push(item);
    }
    return acc;
  }, {});

  Object.keys(groupedItems).forEach(key => {
    groupedItems[key].items.sort((a, b) => {
      if (a.product.order_index === b.product.order_index) return a.product.name.localeCompare(b.product.name);
      return (a.product.order_index || 0) - (b.product.order_index || 0);
    });
    groupedItems[key].purchased.sort((a, b) => {
      if (a.product.order_index === b.product.order_index) return a.product.name.localeCompare(b.product.name);
      return (a.product.order_index || 0) - (b.product.order_index || 0);
    });
  });

  // Corredores 100% comprados (todos os itens já riscados, sem nenhum item pendente) vão pro fim da lista.
  const sortedAreas = Object.keys(groupedItems).sort((a, b) => {
    const ga = groupedItems[a];
    const gb = groupedItems[b];
    const aDone = ga.items.length === 0 && ga.purchased.length > 0;
    const bDone = gb.items.length === 0 && gb.purchased.length > 0;
    if (aDone !== bDone) return aDone ? 1 : -1; // o que não está done vem primeiro
    return ga.order - gb.order;
  });
  const filteredCatalog = getSortedProductMatches(allProducts, searchQuery, productInsights).slice(0, 5);
  const showCatalogDropdown = showAutocomplete && searchQuery.length > 0;

  const totalCount = items.length;
  const purchasedCount = items.filter(i => i.is_purchased).length;
  const progressPercent = totalCount > 0 ? Math.round((purchasedCount / totalCount) * 100) : 0;

  return (
    <div style={{ paddingBottom: items.some(i => i.is_purchased) ? '160px' : '80px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '1.5rem' }}>Lista de Compras</h2>
      </div>

      {totalCount > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div className="progress-bar-label">
            <span>{purchasedCount} de {totalCount} {totalCount === 1 ? 'item' : 'itens'}</span>
            <span className="progress-percent">{progressPercent}%</span>
          </div>
          <div className="progress-bar-wrapper" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100}>
            <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      )}

      <div style={{ position: 'relative', marginBottom: '24px', zIndex: 5 }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={20} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
            <input
              className="input-field"
              placeholder={listening ? 'Ouvindo... fale os itens' : 'O que está faltando?'}
              style={{ paddingLeft: '40px', paddingRight: voiceSupported ? '44px' : '14px' }}
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setShowAutocomplete(true); }}
              onFocus={() => setShowAutocomplete(true)}
            />
            {voiceSupported && (
              <button
                type="button"
                onClick={handleVoiceClick}
                aria-label={listening ? 'Parar gravação' : 'Falar itens da lista'}
                title={listening ? 'Parar gravação' : 'Falar itens (ex: "leite, pão, sabão")'}
                style={{
                  position: 'absolute', right: '6px', top: '6px',
                  width: '34px', height: '34px',
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
          <Link to="/add" className="btn btn-primary" style={{ padding: '0 16px' }}>
            <Plus />
          </Link>
        </div>

        {showCatalogDropdown && (
          <div className="card" style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '8px', padding: '8px 0', zIndex: 6 }}>
            {filteredCatalog.map(p => (
              <div
                key={p.id}
                onClick={() => openAddQuantityDialog(p)}
                style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
              >
                {/* [IMG-OFF] Miniatura desabilitada. Para reativar, restaurar bloco original.
                {p.thumbnail_url ? (
                  <img src={p.thumbnail_url} alt="" style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 32, height: 32, borderRadius: 4, backgroundColor: 'var(--background)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ImageIcon size={16} color="var(--text-muted)" />
                  </div>
                )}
                */}
                <div>
                  <div>{p.name}</div>
                  {productInsights[p.id]?.lastPurchasedAt && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {formatLastPurchaseText(productInsights[p.id].lastPurchasedAt)}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {filteredCatalog.length === 0 && (
              <div style={{ padding: '12px 16px', color: 'var(--text-muted)', textAlign: 'center' }}>
                Produto não encontrado. <br/> Clique em <b>+</b> para cadastrar e tirar foto.
              </div>
            )}
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
          <ShoppingBag size={48} style={{ opacity: 0.2, margin: '0 auto 16px' }} />
          <p>Sua lista está vazia.</p>
          <p style={{ fontSize: '0.875rem', marginTop: '8px' }}>Use a barra acima para adicionar produtos.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {sortedAreas.map(areaName => {
            const group = groupedItems[areaName];
            if (group.items.length === 0 && group.purchased.length === 0) return null;

            const areaDone = group.items.length === 0 && group.purchased.length > 0;

            return (
              <div key={areaName} style={{ opacity: areaDone ? 0.7 : 1, transition: 'opacity 0.2s' }}>
                <h3 style={{
                  fontSize: '1.125rem',
                  marginBottom: '12px',
                  color: areaDone ? 'var(--secondary)' : 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'color 0.2s',
                }}>
                  {areaName}
                  {areaDone && <CheckCircle2 size={18} color="var(--secondary)" />}
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {group.items.map(item => (
                    <div key={item.id} className="card" onClick={() => togglePurchased(item.id, item.is_purchased)}
                         style={{ marginBottom: 0, padding: '12px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', transition: 'all 0.2s' }}>
                      <Circle color="var(--text-muted)" size={24} />

                      {/* [IMG-OFF] Thumbnail desabilitada.
                      {item.product.thumbnail_url ? (
                        <img src={item.product.thumbnail_url} style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: 'var(--background)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <ImageIcon size={20} color="var(--text-muted)" />
                        </div>
                      )}
                      */}

                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>{item.product.name}</div>
                        {productInsights[item.product.id]?.lastPurchasedAt && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                            {formatLastPurchaseText(productInsights[item.product.id].lastPurchasedAt)}
                          </div>
                        )}
                        <div
                          style={{ fontSize: '0.875rem', color: 'var(--primary)', cursor: 'pointer', display: 'inline-block', padding: '2px 6px', backgroundColor: 'var(--background)', borderRadius: '4px', marginTop: '4px', fontWeight: 500 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setQuantityDialog({ open: true, mode: 'edit', product: item.product, item, initialQuantity: item.quantity || '1' });
                          }}
                        >
                          Qtd: {item.quantity}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {group.purchased.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: group.items.length > 0 ? '8px' : '0' }}>
                    {group.purchased.map(item => (
                      <div key={item.id} className="card" onClick={() => togglePurchased(item.id, item.is_purchased)}
                           style={{ marginBottom: 0, padding: '12px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', opacity: 0.6, backgroundColor: 'var(--background)' }}>
                        <CheckCircle2 color="var(--secondary)" size={24} />

                        {/* [IMG-OFF] Thumbnail desabilitada.
                        {item.product.thumbnail_url && (
                          <img src={item.product.thumbnail_url} style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', filter: 'grayscale(100%)' }} />
                        )}
                        */}

                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, textDecoration: 'line-through' }}>{item.product.name}</div>
                          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '4px' }}>Qtd: {item.quantity}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {items.some(i => i.is_purchased) && (
        <div style={{ position: 'fixed', bottom: 'calc(64px + env(safe-area-inset-bottom, 0px) + 12px)', left: '0', right: '0', display: 'flex', justifyContent: 'center', padding: '0 16px', zIndex: 30, pointerEvents: 'none' }}>
          <button
            onClick={finishShopping}
            className="btn btn-primary"
            style={{
              width: '100%',
              maxWidth: '600px',
              padding: '16px',
              boxShadow: 'var(--shadow-lg)',
              backgroundColor: 'var(--secondary)',
              pointerEvents: 'auto',
            }}
          >
            Finalizar Compra (Comprei!)
          </button>
        </div>
      )}

      <VoiceResultModal
        open={voiceModal.open}
        transcript={voiceModal.transcript}
        matched={voiceModal.matched}
        unmatched={voiceModal.unmatched}
        onCancel={closeVoiceModal}
        onConfirm={handleVoiceConfirm}
      />

      <QuantityPickerModal
        key={`${quantityDialog.mode}-${quantityDialog.item?.id || quantityDialog.product?.id || 'shopping-quantity'}-${quantityDialog.initialQuantity}`}
        open={quantityDialog.open}
        title={quantityDialog.mode === 'edit' ? 'Alterar quantidade' : 'Quantidade'}
        itemName={quantityDialog.product?.name}
        initialQuantity={quantityDialog.initialQuantity}
        confirmLabel={quantityDialog.mode === 'edit' ? 'Salvar' : 'Adicionar'}
        allowRemove={quantityDialog.mode === 'edit'}
        onCancel={closeQuantityDialog}
        onRemove={() => handleRemoveItem(quantityDialog.item)}
        onConfirm={(quantity) => {
          if (quantityDialog.mode === 'edit') {
            handleUpdateQuantity(quantityDialog.item, quantity);
            return;
          }

          handleAddExistingProduct(quantityDialog.product, quantity);
        }}
      />
    </div>
  );
}
