import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';

const PlaceContext = createContext({});
const LS_KEY = 'currentPlaceId';

export const PlaceProvider = ({ children }) => {
  const { user } = useAuth();
  const [places, setPlaces] = useState([]);          // [{ id, name }]
  const [currentPlaceId, setCurrentPlaceId] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadPlaces = useCallback(async () => {
    if (!user) {
      setPlaces([]);
      setCurrentPlaceId(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    // 1) Busca relações user_places
    const { data: ups } = await supabase
      .from('user_places')
      .select('place_id')
      .eq('user_id', user.id);

    const ids = (ups || []).map(u => u.place_id);
    if (ids.length === 0) {
      setPlaces([]);
      setCurrentPlaceId(null);
      setLoading(false);
      return;
    }

    // 2) Busca dados dos Locais
    const { data: rows } = await supabase
      .from('places')
      .select('id, name')
      .in('id', ids)
      .order('name', { ascending: true });

    const list = rows || [];
    setPlaces(list);

    // 3) Define Local atual: usa localStorage se ainda for válido; senão, o primeiro
    const saved = window.localStorage.getItem(LS_KEY);
    const valid = list.find(p => p.id === saved);
    setCurrentPlaceId(valid ? valid.id : list[0].id);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadPlaces();
  }, [loadPlaces]);

  // Persiste a escolha
  useEffect(() => {
    if (currentPlaceId) {
      window.localStorage.setItem(LS_KEY, currentPlaceId);
    }
  }, [currentPlaceId]);

  const switchPlace = useCallback((id) => {
    setCurrentPlaceId(id);
  }, []);

  const refreshPlaces = useCallback(() => loadPlaces(), [loadPlaces]);

  const currentPlace = places.find(p => p.id === currentPlaceId) || null;

  return (
    <PlaceContext.Provider value={{
      places,
      currentPlace,
      currentPlaceId,
      loading,
      switchPlace,
      refreshPlaces,
    }}>
      {children}
    </PlaceContext.Provider>
  );
};

export const usePlace = () => useContext(PlaceContext);
