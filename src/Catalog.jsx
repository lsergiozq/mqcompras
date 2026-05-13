import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';
import { Plus, Search, Image as ImageIcon, ArrowUp, ArrowDown, Edit2, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function Catalog() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [familyId, setFamilyId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (user) loadCatalog();
  }, [user]);

  const loadCatalog = async () => {
    let { data: userFamilies } = await supabase.from('user_families').select('family_id').eq('user_id', user.id);
    let fid = null;
    if (!userFamilies || userFamilies.length === 0) return;
    fid = userFamilies[0].family_id;
    setFamilyId(fid);

    const { data } = await supabase
      .from('products')
      .select('*, area:areas(name, order_index)')
      .eq('family_id', fid)
      .order('order_index', { ascending: true })
      .order('name', { ascending: true }); // Fallback para alfabético caso tenham index igual
    
    if (data) setProducts(data);
  };

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const groupedProducts = filteredProducts.reduce((acc, p) => {
    const areaName = p.area?.name || 'Sem Corredor';
    const areaId = p.area_id;
    const orderIndex = p.area?.order_index ?? 999;
    if (!acc[areaName]) acc[areaName] = { order: orderIndex, areaId: areaId, items: [] };
    acc[areaName].items.push(p);
    return acc;
  }, {});

  const sortedAreas = Object.keys(groupedProducts).sort((a, b) => groupedProducts[a].order - groupedProducts[b].order);

  const addToShoppingList = async (productId) => {
    let qty = window.prompt('Quantidade?', '1');
    if (qty === null) return;
    if (qty.trim() === '') qty = '1';

    const { data: existingArray } = await supabase.from('list_items').select('*').eq('product_id', productId).limit(1);
    const existing = existingArray && existingArray.length > 0 ? existingArray[0] : null;

    if (existing) {
      if (!existing.is_purchased) {
        alert('Este item já está na sua lista de compras! Se quiser alterar a quantidade, vá na aba "Lista" e toque no número.');
        return;
      } else {
        await supabase.from('list_items').update({ is_purchased: false, quantity: qty }).eq('id', existing.id);
      }
    } else {
      await supabase.from('list_items').insert([{
        family_id: familyId,
        product_id: productId,
        quantity: qty,
        is_purchased: false
      }]);
    }
    alert('Adicionado à lista de compras!');
  };

  const handleEditProduct = (product) => {
    navigate('/add', { state: { product } });
  };

  const handleDeleteProduct = async (product) => {
    if (window.confirm(`Tem certeza que deseja apagar "${product.name}" do catálogo e de todas as listas?`)) {
      // 1. Remove from shopping list first to avoid FK constraint errors
      await supabase.from('list_items').delete().eq('product_id', product.id);
      
      // 2. Remove image from storage if exists
      if (product.thumbnail_url) {
        try {
          const urlParts = product.thumbnail_url.split('/');
          const fileName = urlParts.pop();
          const folderName = urlParts.pop();
          await supabase.storage.from('thumbnails').remove([`${folderName}/${fileName}`]);
        } catch(e) {}
      }

      // 3. Remove product
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

    // Se as ordens forem iguais (ex: tudo começa em 0), arruma a sequência toda 
    if (p1.order_index === p2.order_index || p1.order_index === null) {
        areaItems.forEach((item, i) => {
            item.order_index = i * 10; // Espaçamento para facilitar upserts futuros
        });
    }

    const tempOrder = p1.order_index;
    p1.order_index = p2.order_index;
    p2.order_index = tempOrder;

    newProducts[idx1] = p1;
    newProducts[idx2] = p2;
    
    newProducts.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    setProducts([...newProducts]);

    // Upsert na tabela apenas os itens dessa área
    const updates = areaItems.map((item) => ({
      id: item.id,
      family_id: item.family_id,
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
          placeholder="Buscar nos meus produtos..." 
          style={{ paddingLeft: '40px' }}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      {products.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
          <p>Você ainda não cadastrou nenhum produto.</p>
          <p style={{ fontSize: '0.875rem', marginTop: '8px' }}>Cadastre os produtos que sua casa consome clicando em "Novo".</p>
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

                    {p.thumbnail_url ? (
                      <img src={p.thumbnail_url} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 40, height: 40, borderRadius: 6, backgroundColor: 'var(--background)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ImageIcon size={20} color="var(--text-muted)" />
                      </div>
                    )}
                    
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500 }}>{p.name}</div>
                    </div>
                    
                    {!searchQuery && (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => handleEditProduct(p)} className="btn" style={{ padding: '8px', backgroundColor: 'transparent', color: 'var(--primary)' }}>
                          <Edit2 size={18} />
                        </button>
                        <button onClick={() => handleDeleteProduct(p)} className="btn" style={{ padding: '8px', backgroundColor: 'transparent', color: 'var(--danger)' }}>
                          <Trash2 size={18} />
                        </button>
                      </div>
                    )}
                    
                    <button onClick={() => addToShoppingList(p.id)} className="btn" style={{ padding: '8px', backgroundColor: 'var(--background)', color: 'var(--primary)' }}>
                      <Plus size={20} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
