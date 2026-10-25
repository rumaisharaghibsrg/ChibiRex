import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { EventBus } from '../game/EventBus';
import { DEFAULT_STORE, STORES_MASTER_REGISTRY, formatStoreName } from '../data/storesRegistry';
import { fetchWithTimeout } from '../utils/NPCFallbackData';

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
    const [currentStore, setCurrentStore] = useState(DEFAULT_STORE);
    const [storesList, setStoresList] = useState(STORES_MASTER_REGISTRY);
    const [isLoadingStores, setIsLoadingStores] = useState(false);

    // Inisialisasi window global agar kode Phaser / non-React dapat membaca cabang aktif secara sinkron
    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.CURRENT_STORE = DEFAULT_STORE;
        }
    }, []);

    // 1. Muat data riil dari backend GET /stores (jika backend aktif)
    useEffect(() => {
        let isMounted = true;
        async function loadStoresFromBackend() {
            setIsLoadingStores(true);
            try {
                const res = await fetchWithTimeout('http://localhost:8000/stores', {}, 3000);
                if (res.success && Array.isArray(res.data) && res.data.length > 0 && isMounted) {
                    const merged = res.data.map((s) => {
                        const fallback = STORES_MASTER_REGISTRY.find((item) => item.id === s.store) || {};
                        return {
                            id: s.store,
                            city: s.kota || fallback.city || `CABANG-${s.store}`,
                            name: `Toko ${s.store} - ${s.kota || fallback.city || 'CABANG'}`,
                            skuCount: s.sku_aktif || fallback.skuCount || 3000,
                            reorderNeededCount: s.perlu_reorder || 0,
                            healthScore: fallback.healthScore || 90.0,
                            status: s.perlu_reorder > 10 ? 'WARNING' : 'PRIMA',
                        };
                    });
                    setStoresList(merged);
                }
            } catch (err) {
                console.warn('[StoreContext] Backend /stores offline, menggunakan static fallback registry:', err);
            } finally {
                if (isMounted) setIsLoadingStores(false);
            }
        }
        loadStoresFromBackend();
        return () => { isMounted = false; };
    }, []);

    // 2. Fungsi peralihan cabang (Instant Reactive Switch & Broadcast)
    const switchStore = useCallback((storeId) => {
        const idNum = parseInt(storeId, 10);
        const target = storesList.find((s) => s.id === idNum) || 
                       STORES_MASTER_REGISTRY.find((s) => s.id === idNum) || 
                       DEFAULT_STORE;

        setCurrentStore(target);

        // Update global runtime
        if (typeof window !== 'undefined') {
            window.CURRENT_STORE = target;
        }

        // Siarkan ke Phaser & Window listener
        EventBus.emit('store-changed', target);
        window.dispatchEvent(new CustomEvent('store-changed', { detail: target }));

        console.log(`%c[MULTI-TENANT] 🏬 Beralih ke Cabang: ${formatStoreName(target)} (ID: ${target.id})`, 'color: #38bdf8; font-weight: bold;');
    }, [storesList]);

    return (
        <StoreContext.Provider value={{ currentStore, storesList, isLoadingStores, switchStore }}>
            {children}
        </StoreContext.Provider>
    );
}

export function useStore() {
    const ctx = useContext(StoreContext);
    if (!ctx) {
        throw new Error('useStore must be used within a StoreProvider');
    }
    return ctx;
}

export default StoreContext;
