import { startTransition, useState, useEffect, useCallback, useRef } from 'react';
import { DndContext, DragOverlay, PointerSensor, closestCenter, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';
import { usePlace } from './PlaceContext';
import { Plus, Search, Edit2, Trash2, Mic, MicOff, GripVertical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import QuantityPickerModal from './QuantityPickerModal';
import { buildProductInsights, getSortedProductMatches } from './productDiscovery';
import useSpeechRecognition, { capitalizeFirst } from './useSpeechRecognition';

function getAreaKey(areaId) {
  return areaId ?? '__no_area__';
}

function CatalogDragPreview({ product }) {
  if (!product) return null;

  return (
    <div
      className="card"
      style={{
        marginBottom: 0,
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        width: 'min(480px, calc(100vw - 32px))',
        boxShadow: 'var(--shadow-lg)',
        border: '1px solid rgba(79, 70, 229, 0.28)',
        background: 'var(--surface)',
      }}
    >
      <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(79, 70, 229, 0.08)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <GripVertical size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{product.name}</div>
      </div>
    </div>
  );
}

function DroppableCatalogGroup({ group, showDragHint, isTargeted, onCreateHere, registerSection, children }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `area-drop-${group.key}`,
    data: {
      type: 'area',
      areaId: group.areaId,
      areaKey: group.key,
      areaName: group.name,
    },
  });

  const highlighted = isTargeted || isOver;

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        registerSection(group.key, node);
      }}
      style={{
        borderRadius: '18px',
        padding: '8px',
        margin: '-8px',
        background: highlighted ? 'rgba(79, 70, 229, 0.06)' : 'transparent',
        boxShadow: highlighted ? 'inset 0 0 0 1px rgba(79, 70, 229, 0.18)' : 'none',
        transition: 'background-color 0.18s ease, box-shadow 0.18s ease',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div>
          <h3 style={{ fontSize: '1.125rem', color: highlighted ? 'var(--primary-hover)' : 'var(--primary)', margin: 0 }}>
            {group.name}
          </h3>
          {showDragHint && (
            <p style={{ marginTop: '4px', fontSize: '0.8rem', color: highlighted ? 'var(--primary)' : 'var(--text-muted)' }}>
              {highlighted ? 'Solte aqui para mover este produto.' : 'Arraste pela alça para reordenar ou mudar de corredor.'}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onCreateHere}
          style={{ background: 'var(--primary)', border: 'none', color: 'white', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px 10px', gap: '4px', fontSize: '0.75rem', fontWeight: 600 }}
        >
          <Plus size={14} /> Novo aqui
        </button>
      </div>
      {children}
    </div>
  );
}

function SortableCatalogItem({ product, areaName, dragEnabled, onEdit, onDelete, onAddToList }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: product.id,
    data: {
      areaName,
      areaId: product.area_id ?? null,
      areaKey: getAreaKey(product.area_id),
      type: 'item',
    },
    disabled: !dragEnabled,
  });

  return (
    <div
      ref={setNodeRef}
      className="card"
      style={{
        marginBottom: 0,
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.85 : 1,
        boxShadow: isDragging ? 'var(--shadow-md)' : 'var(--shadow-sm)',
        border: isDragging ? '1px solid rgba(79, 70, 229, 0.24)' : '1px solid var(--border)',
      }}
    >
      {dragEnabled && (
        <button
          type="button"
          aria-label={`Arrastar ${product.name}`}
          title="Arrastar para reordenar"
          {...attributes}
          {...listeners}
          style={{
            background: 'var(--background)',
            border: 'none',
            cursor: 'grab',
            padding: '8px',
            borderRadius: '8px',
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
      )}

      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 500 }}>{product.name}</div>
      </div>

      <div style={{ display: 'flex', gap: '4px' }}>
        <button type="button" onClick={() => onEdit(product)} className="btn" style={{ padding: '8px', backgroundColor: 'transparent', color: 'var(--primary)' }}>
          <Edit2 size={18} />
        </button>
        <button type="button" onClick={() => onDelete(product)} className="btn" style={{ padding: '8px', backgroundColor: 'transparent', color: 'var(--danger)' }}>
          <Trash2 size={18} />
        </button>
      </div>

      <button type="button" onClick={() => onAddToList(product)} className="btn" style={{ padding: '8px', backgroundColor: 'var(--background)', color: 'var(--primary)' }}>
        <Plus size={20} />
      </button>
    </div>
  );
}

export default function Catalog() {
  const { user } = useAuth();
  const { currentPlaceId } = usePlace();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [areas, setAreas] = useState([]);
  const [productInsights, setProductInsights] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isHeaderElevated, setIsHeaderElevated] = useState(false);
  const [activeViewportAreaKey, setActiveViewportAreaKey] = useState(null);
  const [toastMsg, setToastMsg] = useState('');
  const [quantityDialog, setQuantityDialog] = useState({ open: false, product: null, initialQuantity: '1' });
  const [activeDragProduct, setActiveDragProduct] = useState(null);
  const [overAreaKey, setOverAreaKey] = useState(null);
  const groupSectionRefs = useRef(new Map());
  // Fila de escritas no Supabase para evitar race condition em ordenações rápidas.
  // Cada escrita é encadeada no .then() da anterior, garantindo ordem tanto
  // local quanto remota.
  const writeQueueRef = useRef(Promise.resolve());
  // Espelho do estado `products` para que handlers de drag em sequência rápida
  // sempre operem sobre a versão MAIS RECENTE, sem depender do closure do render
  // anterior nem do `data` congelado no useSortable.
  const productsRef = useRef([]);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

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
    // Espera escritas pendentes terminarem antes de hidratar o estado.
    await writeQueueRef.current.catch(() => {});

    const [{ data }, { data: areaRows }] = await Promise.all([
      supabase
      .from('products')
      .select('*, area:areas(name, order_index)')
      .eq('place_id', currentPlaceId)
      .order('order_index', { ascending: true })
      .order('name', { ascending: true }),
      supabase
        .from('areas')
        .select('id, name, order_index')
        .eq('place_id', currentPlaceId)
        .order('order_index', { ascending: true }),
    ]);

    if (!data) return;

    productsRef.current = data;
    startTransition(() => {
      setProducts(data);
      setAreas(areaRows || []);
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

  // Mantém productsRef sincronizado com cada render.
  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  useEffect(() => {
    const updateHeaderElevation = () => {
      setIsHeaderElevated(window.scrollY > 8);
    };

    updateHeaderElevation();
    window.addEventListener('scroll', updateHeaderElevation, { passive: true });

    return () => {
      window.removeEventListener('scroll', updateHeaderElevation);
    };
  }, []);

  const filteredProducts = searchQuery
    ? getSortedProductMatches(products, searchQuery, productInsights)
    : products;

  const areasById = areas.reduce((acc, area) => {
    acc[area.id] = area;
    return acc;
  }, {});

  const groupedProducts = filteredProducts.reduce((acc, p) => {
    const areaId = p.area_id ?? null;
    const areaKey = getAreaKey(areaId);
    const areaMeta = areaId ? areasById[areaId] : null;
    const areaName = areaMeta?.name || 'Sem Corredor';
    const orderIndex = areaMeta?.order_index ?? 999;
    if (!acc[areaKey]) acc[areaKey] = { key: areaKey, name: areaName, order: orderIndex, areaId, items: [] };
    acc[areaKey].items.push(p);
    return acc;
  }, {});

  Object.values(groupedProducts).forEach((group) => {
    group.items.sort((left, right) => {
      const orderDiff = (left.order_index ?? 0) - (right.order_index ?? 0);
      if (orderDiff !== 0) return orderDiff;
      return left.name.localeCompare(right.name, 'pt-BR');
    });
  });

  const sortedGroups = Object.values(groupedProducts).sort((a, b) => a.order - b.order);

  const registerGroupSection = useCallback((groupKey, node) => {
    if (node) {
      groupSectionRefs.current.set(groupKey, node);
      return;
    }
    groupSectionRefs.current.delete(groupKey);
  }, []);

  useEffect(() => {
    if (searchQuery || sortedGroups.length === 0) {
      startTransition(() => {
        setActiveViewportAreaKey(null);
      });
      return undefined;
    }

    const sectionEntries = sortedGroups
      .map((group) => ({ key: group.key, node: groupSectionRefs.current.get(group.key) }))
      .filter((entry) => entry.node instanceof HTMLElement);

    if (sectionEntries.length === 0) return undefined;

    let frameId = null;

    const updateActiveViewportArea = () => {
      const viewportTop = 104;
      const viewportBottom = window.innerHeight - 96;
      let bestKey = null;
      let bestVisibleHeight = 0;
      let bestTop = Number.POSITIVE_INFINITY;

      sectionEntries.forEach(({ key, node }) => {
        const rect = node.getBoundingClientRect();
        const visibleHeight = Math.min(rect.bottom, viewportBottom) - Math.max(rect.top, viewportTop);

        if (visibleHeight <= 0) return;

        if (visibleHeight > bestVisibleHeight || (visibleHeight === bestVisibleHeight && rect.top < bestTop)) {
          bestKey = key;
          bestVisibleHeight = visibleHeight;
          bestTop = rect.top;
        }
      });

      startTransition(() => {
        setActiveViewportAreaKey((currentKey) => currentKey === bestKey ? currentKey : bestKey);
      });
    };

    const scheduleViewportUpdate = () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(updateActiveViewportArea);
    };

    const observer = new IntersectionObserver(scheduleViewportUpdate, {
      threshold: [0, 0.15, 0.35, 0.55, 0.75],
      rootMargin: '-96px 0px -96px 0px',
    });

    sectionEntries.forEach(({ node }) => observer.observe(node));
    window.addEventListener('resize', scheduleViewportUpdate);
    scheduleViewportUpdate();

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', scheduleViewportUpdate);
      if (frameId !== null) window.cancelAnimationFrame(frameId);
    };
  }, [searchQuery, sortedGroups]);

  const activeViewportGroup = !searchQuery
    ? sortedGroups.find((group) => group.key === activeViewportAreaKey && group.areaId)
    : null;

  const handleHeaderAdd = () => {
    navigate('/add', {
      state: activeViewportGroup?.areaId
        ? { preSelectedArea: activeViewportGroup.areaId }
        : undefined,
    });
  };

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
          // Melhor esforço: se falhar, segue apagando o produto.
        }
      }

      await supabase.from('products').delete().eq('id', product.id);
      setProducts(products.filter(p => p.id !== product.id));
    }
  };

  // Persiste ordem de uma área. Escritas são serializadas via writeQueueRef.
  const enqueueProductOrderWrite = (orderedAreaItems, areaId) => {
    const updates = orderedAreaItems.map((item) => ({
      id: item.id,
      place_id: item.place_id,
      area_id: areaId,
      name: item.name,
      thumbnail_url: item.thumbnail_url,
      order_index: item.order_index,
    }));

    const nextWrite = writeQueueRef.current
      .catch(() => {})
      .then(() => supabase.from('products').upsert(updates));

    writeQueueRef.current = nextWrite;
    return nextWrite;
  };

  const showToast = (message) => {
    setToastMsg(message);
    setTimeout(() => setToastMsg(''), 2500);
  };

  const handleDragStart = (event) => {
    const product = productsRef.current.find((item) => item.id === event.active.id) || null;
    setActiveDragProduct(product);
    setOverAreaKey(product ? getAreaKey(product.area_id ?? null) : null);
  };

  const handleDragOver = (event) => {
    const overItem = event.over?.data.current?.type === 'item'
      ? productsRef.current.find((item) => item.id === event.over.id)
      : null;
    const nextAreaKey = overItem
      ? getAreaKey(overItem.area_id ?? null)
      : (event.over?.data.current?.areaKey || null);
    setOverAreaKey(nextAreaKey);
  };

  const resetDragState = () => {
    setActiveDragProduct(null);
    setOverAreaKey(null);
  };

  const handleDragEnd = (event) => {
    if (searchQuery) return;

    const { active, over } = event;
    if (!over) {
      resetDragState();
      return;
    }

    // CRÍTICO: NÃO confiar em active.data.current.areaId/areaKey. Esse data é
    // capturado quando o useSortable é montado, e fica STALE entre dois drags
    // rápidos (o React pode ainda não ter re-renderizado o item após o primeiro
    // setProducts). Sempre derivar a área atual do estado mais recente via
    // productsRef.current + active.id.
    const currentProducts = productsRef.current;
    const activeProduct = currentProducts.find((item) => item.id === active.id);
    if (!activeProduct) {
      resetDragState();
      return;
    }

    const activeAreaId = activeProduct.area_id ?? null;
    const activeAreaKey = getAreaKey(activeAreaId);

    // Determinar overAreaId: se over for um item, derivar do estado atual;
    // se for uma área, usar o data (montado fresh a cada render).
    const overType = over.data.current?.type;
    let overAreaId;

    if (overType === 'item') {
      const overTargetItem = currentProducts.find((item) => item.id === over.id);
      if (!overTargetItem) {
        resetDragState();
        return;
      }
      overAreaId = overTargetItem.area_id ?? null;
    } else {
      overAreaId = over.data.current?.areaId ?? null;
    }
    const overAreaKey = getAreaKey(overAreaId);

    const lookupAreaName = (areaId) => {
      if (!areaId) return 'Sem Corredor';
      const found = areas.find((a) => a.id === areaId);
      return found?.name || 'Sem Corredor';
    };
    const activeAreaName = lookupAreaName(activeAreaId);
    const overAreaName = lookupAreaName(overAreaId);

    if (active.id === over.id && activeAreaKey === overAreaKey) {
      resetDragState();
      return;
    }

    const sourceItems = currentProducts.filter(
      (product) => getAreaKey(product.area_id ?? null) === activeAreaKey,
    );
    const oldIndex = sourceItems.findIndex((item) => item.id === active.id);
    if (oldIndex === -1) {
      resetDragState();
      return;
    }

    if (activeAreaKey === overAreaKey) {
      let newIndex;
      if (overType === 'item') {
        newIndex = sourceItems.findIndex((item) => item.id === over.id);
        if (newIndex === -1) {
          resetDragState();
          return;
        }
      } else {
        newIndex = sourceItems.length - 1;
      }

      if (newIndex === oldIndex) {
        resetDragState();
        return;
      }

      const reordered = arrayMove(sourceItems, oldIndex, newIndex).map((item, index) => ({
        ...item,
        order_index: index * 10,
        area_id: activeAreaId,
      }));

      const reorderedById = new Map(reordered.map((item) => [item.id, item]));
      const nextProducts = currentProducts.map((product) => reorderedById.get(product.id) || product);
      productsRef.current = nextProducts;
      setProducts(nextProducts);

      enqueueProductOrderWrite(reordered, activeAreaId);
      resetDragState();
      return;
    }

    // Mudança entre corredores
    const destinationItems = currentProducts.filter(
      (product) => getAreaKey(product.area_id ?? null) === overAreaKey,
    );
    const movedItem = { ...sourceItems[oldIndex], area_id: overAreaId };
    const nextSourceItems = sourceItems.filter((item) => item.id !== active.id);
    const nextDestinationItemsRaw = [...destinationItems];
    const insertionIndex = overType === 'item'
      ? destinationItems.findIndex((item) => item.id === over.id)
      : destinationItems.length;

    nextDestinationItemsRaw.splice(
      insertionIndex < 0 ? destinationItems.length : insertionIndex,
      0,
      movedItem,
    );

    const nextSource = nextSourceItems.map((item, index) => ({
      ...item,
      order_index: index * 10,
      area_id: activeAreaId,
    }));
    const nextDestination = nextDestinationItemsRaw.map((item, index) => ({
      ...item,
      order_index: index * 10,
      area_id: overAreaId,
    }));

    const updatedById = new Map(
      [...nextSource, ...nextDestination].map((item) => [item.id, item]),
    );
    const nextProducts = currentProducts.map((product) => updatedById.get(product.id) || product);
    productsRef.current = nextProducts;
    setProducts(nextProducts);

    enqueueProductOrderWrite(nextSource, activeAreaId);
    enqueueProductOrderWrite(nextDestination, overAreaId);
    showToast(`✓ Movido de ${activeAreaName} para ${overAreaName}`);
    resetDragState();
  };

  return (
    <div style={{ paddingBottom: '80px' }}>
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          background: isHeaderElevated ? 'color-mix(in srgb, var(--background) 88%, white 12%)' : 'var(--background)',
          paddingTop: '8px',
          paddingBottom: '12px',
          marginBottom: '12px',
          boxShadow: isHeaderElevated ? '0 8px 18px rgba(15, 23, 42, 0.06)' : 'none',
          borderBottom: isHeaderElevated ? '1px solid color-mix(in srgb, var(--border) 72%, transparent)' : '1px solid transparent',
          backdropFilter: isHeaderElevated ? 'blur(10px)' : 'none',
          WebkitBackdropFilter: isHeaderElevated ? 'blur(10px)' : 'none',
          transition: 'box-shadow 0.18s ease, border-color 0.18s ease, background-color 0.18s ease, backdrop-filter 0.18s ease',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Meu Catálogo</h2>
            {activeViewportGroup && (
              <span
                style={{
                  fontSize: '0.78rem',
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                Novo produto em {activeViewportGroup.name}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleHeaderAdd}
            title={activeViewportGroup ? `Novo em ${activeViewportGroup.name}` : 'Novo produto'}
            className="btn btn-primary"
            style={{ padding: '8px 16px', fontSize: '0.875rem', flexShrink: 0 }}
          >
            <Plus size={18} /> {activeViewportGroup ? 'Novo aqui' : 'Novo'}
          </button>
        </div>
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
      ) : sortedGroups.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '48px' }}>
          <p>Nenhum produto encontrado.</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={resetDragState}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {sortedGroups.map((group) => (
              <DroppableCatalogGroup
                key={group.key}
                group={group}
                showDragHint={!searchQuery}
                isTargeted={!!activeDragProduct && overAreaKey === group.key}
                onCreateHere={() => navigate('/add', { state: { preSelectedArea: group.areaId } })}
                registerSection={registerGroupSection}
              >
                <SortableContext items={group.items.map((product) => product.id)} strategy={verticalListSortingStrategy}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {group.items.map((product) => (
                      <SortableCatalogItem
                        key={product.id}
                        product={product}
                        areaName={group.name}
                        dragEnabled={!searchQuery}
                        onEdit={handleEditProduct}
                        onDelete={handleDeleteProduct}
                        onAddToList={openQuantityDialog}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DroppableCatalogGroup>
            ))}
          </div>

          <DragOverlay>
            <CatalogDragPreview product={activeDragProduct} />
          </DragOverlay>
        </DndContext>
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
