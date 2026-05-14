import { supabase } from './supabase';

export async function fetchActiveCatalogPresets() {
  const { data, error } = await supabase
    .from('catalog_presets')
    .select('id, slug, name, description, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function applyCatalogPreset(placeId, presetSlug) {
  const { error } = await supabase.rpc('apply_catalog_preset', {
    p_place_id: placeId,
    p_preset_slug: presetSlug,
  });

  if (error) throw error;
}
