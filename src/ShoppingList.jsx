import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, Plus, Search, Image as ImageIcon, ShoppingBag } from 'lucide-react';

export default function ShoppingList() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [familyId, setFamilyId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [allProducts, setAllProducts] = useState([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    let { data: userFamilies } = await supabase.from('user_families').select('family_id').eq('user_id', user.id);
    
    let fid = null;
    if (!userFamilies || userFamilies.length === 0) {
      const { data: newFamily } = await supabase.from('families').insert([{ name: 'Minha Família' }]).select().single();
      fid = newFamily.id;
      await supabase.from('user_families').insert([{ user_id: user.id, family_id: fid }]);

      const defaultAreas = ['Hortifruti', 'Padaria', 'Frios', 'Açougue', 'Limpeza', 'Mercearia'];
      const areasToInsert = defaultAreas.map((name, index) => ({ family_id: fid, name, order_index: index }));
      await supabase.from('areas').insert(areasToInsert);
    } else {
      fid = userFamilies[0].family_id;
    }

    setFamilyId(fid);
    fetchItems(fid);

    const { data: products } = await supabase.from('products').select('*').eq('family_id', fid);
    if (products) setAllProducts(products);

    // Tempo Real (Realtime)
    const channel = supabase.channel(`list_updates_${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'list_items', filter: `family_id=eq.${fid}` }, () => {
        fetchItems(fid); 
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  };

  const fetchItems = async (fid) => {
    const { data } = await supabase
      .from('list_items')
      .select(`
        id, quantity, is_purchased,
        product:products(id, name, thumbnail_url, area_id, order_index, area:areas(id, name, order_index))
      `)
      .eq('family_id', fid)
      .is('archived_at', null);

    if (data) setItems(data);
  };

  const togglePurchased = async (id, currentStatus) => {
    setItems(items.map(item => item.id === id ? { ...item, is_purchased: !currentStatus } : item));
    await supabase.from('list_items').update({ is_purchased: !currentStatus }).eq('id', id);
  };

  const addExistingProduct = async (product) => {
    setSearchQuery('');
    setShowAutocomplete(false);
    
    let qty = window.prompt('Quantidade?', '1');
    if (qty === null) return;
    if (qty.trim() === '') qty = '1';
    
    const { data: existingArray } = await supabase.from('list_items').select('*').eq('product_id', product.id).limit(1);
    const existing = existingArray && existingArray.length > 0 ? existingArray[0] : null;

    if (existing) {
      if (!existing.is_purchased) {
        alert('Este item já está na sua lista de compras! Você pode alterar a quantidade clicando no número abaixo do nome dele.');
        return;
      } else {
        await supabase.from('list_items').update({ is_purchased: false, quantity: qty }).eq('id', existing.id);
      }
    } else {
      await supabase.from('list_items').insert([{
        family_id: familyId,
        product_id: product.id,
        quantity: qty,
        is_purchased: false
      }]);
    }
  };

  const finishShopping = async () => {
    if (window.confirm('Tem certeza que deseja finalizar as compras? Os itens marcados serão movidos para o Histórico.')) {
      const purchasedIds = items.filter(i => i.is_purchased).map(i => i.id);
      if (purchasedIds.length > 0) {
        const archivedAt = new Date().toISOString();
        await supabase.from('list_items').update({ archived_at: archivedAt }).in('id', purchasedIds);
        // Remoção otimista para sentir instantâneo (o realtime confirma depois)
        setItems(prev => prev.filter(i => !purchasedIds.includes(i.id)));
      }
    }
  };

  // Agrupa os itens pela "Área" para facilitar no mercado
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

  // Ordena pela posição definida manualmente no catálogo (fallback alfabético)
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

  const sortedAreas = Object.keys(groupedItems).sort((a, b) => groupedItems[a].order - groupedItems[b].order);
  const filteredCatalog = allProducts.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 5);
  const showCatalogDropdown = showAutocomplete && searchQuery.length > 0;

  const totalCount = items.length;
  const purchasedCount = items.filter(i => i.is_purchased).length;
  const progressPercent = totalCount > 0 ? Math.round((purchasedCount / totalCount) * 100) : 0;

  return (
    <div style={{ paddingBottom: '80px' }}>
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

      <div style={{ position: 'relative', marginBottom: '24px', zIndex: 20 }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={20} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
            <input 
              className="input-field" 
              placeholder="O que está faltando?" 
              style={{ paddingLeft: '40px' }}
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setShowAutocomplete(true); }}
              onFocus={() => setShowAutocomplete(true)}
            />
          </div>
          <Link to="/add" className="btn btn-primary" style={{ padding: '0 16px' }}>
            <Plus />
          </Link>
        </div>

        {showCatalogDropdown && (
          <div className="card" style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '8px', padding: '8px 0', zIndex: 100 }}>
            {filteredCatalog.map(p => (
              <div 
                key={p.id} 
                onClick={() => addExistingProduct(p)}
                style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
              >
                {p.thumbnail_url ? (
                  <img src={p.thumbnail_url} alt="" style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 32, height: 32, borderRadius: 4, backgroundColor: 'var(--background)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ImageIcon size={16} color="var(--text-muted)" />
                  </div>
                )}
                <span>{p.name}</span>
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
            
            return (
              <div key={areaName}>
                <h3 style={{ fontSize: '1.125rem', marginBottom: '12px', color: 'var(--primary)' }}>
                  {areaName}
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {group.items.map(item => (
                    <div key={item.id} className="card" onClick={() => togglePurchased(item.id, item.is_purchased)}
                         style={{ marginBottom: 0, padding: '12px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', transition: 'all 0.2s' }}>
                      <Circle color="var(--text-muted)" size={24} />
                      
                      {item.product.thumbnail_url ? (
                        <img src={item.product.thumbnail_url} style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: 'var(--background)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <ImageIcon size={20} color="var(--text-muted)" />
                        </div>
                      )}
                      
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>{item.product.name}</div>
                        <div 
                          style={{ fontSize: '0.875rem', color: 'var(--primary)', cursor: 'pointer', display: 'inline-block', padding: '2px 6px', backgroundColor: 'var(--background)', borderRadius: '4px', marginTop: '4px', fontWeight: 500 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            const newQty = window.prompt('Nova quantidade (Digite 0 para remover):', item.quantity);
                            if (newQty !== null && newQty.trim() !== '') {
                              if (newQty.trim() === '0') {
                                supabase.from('list_items').delete().eq('id', item.id).then(() => fetchItems(familyId));
                              } else {
                                supabase.from('list_items').update({ quantity: newQty.trim() }).eq('id', item.id).then(() => fetchItems(familyId));
                              }
                            }
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
                        
                        {item.product.thumbnail_url && (
                          <img src={item.product.thumbnail_url} style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', filter: 'grayscale(100%)' }} />
                        )}
                        
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
        <div style={{ position: 'fixed', bottom: '24px', left: '0', right: '0', display: 'flex', justifyContent: 'center', padding: '0 20px', zIndex: 30 }}>
          <button onClick={finishShopping} className="btn btn-primary" style={{ width: '100%', maxWidth: '600px', padding: '16px', boxShadow: 'var(--shadow-lg)', backgroundColor: 'var(--secondary)' }}>
            Finalizar Compra (Comprei!)
          </button>
        </div>
      )}
    </div>
  );
}
