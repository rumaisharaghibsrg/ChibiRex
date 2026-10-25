import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { EventBus } from '../game/EventBus';
import { DEFAULT_STORE, STORES_MASTER_REGISTRY, formatStoreName } from '../data/storesRegistry';
import { api, DATA_BERUBAH } from '../lib/api';

const StoreContext = createContext(null);

// Baris GET /jaringan/ringkasan (atau GET /stores kalau statistik jaringan belum ada di API) ke bentuk yang dipakai game.
const dariApi = (t) => ({
    id: t.store,
    city: t.kota,
    name: `Toko ${t.store} - ${t.kota}`,
    skuCount: t.sku_aktif,
    reorderNeededCount: t.perlu_reorder,
    healthScore: t.health_score ?? null,
    riskHighCount: t.sku_risiko_tinggi ?? null,
    heldCapitalIdr: t.modal_tertahan_idr ?? null,
});

export function StoreProvider({ children }) {
    const [currentStore, setCurrentStore] = useState(DEFAULT_STORE);
    const [storesList, setStoresList] = useState(STORES_MASTER_REGISTRY);
    const [isLoadingStores, setIsLoadingStores] = useState(false);
    const [statsTersedia, setStatsTersedia] = useState(false); // Health Score per toko dari API

    // Inisialisasi window global agar kode Phaser / non-React dapat membaca cabang aktif secara sinkron
    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.CURRENT_STORE = DEFAULT_STORE;
        }
    }, []);

    // 1. Muat statistik semua toko dari API; dimuat ulang setiap hari simulasi atau data toko berubah.
    useEffect(() => {
        let isMounted = true;
        async function loadStoresFromBackend() {
            setIsLoadingStores(true);
            try {
                let daftar;
                let lengkap = true;
                try {
                    daftar = (await api.jaringan()).toko;
                } catch {
                    daftar = await api.stores(); // API lama tanpa /jaringan: tanpa Health Score
                    lengkap = false;
                }
                if (!isMounted) return;
                const toko = daftar.map(dariApi);
                setStoresList(toko);
                setStatsTersedia(lengkap);
                setCurrentStore((lama) => {
                    const baru = toko.find((t) => t.id === lama.id) || lama;
                    if (typeof window !== 'undefined') window.CURRENT_STORE = baru;
                    return baru;
                });
            } catch (err) {
                console.warn('[StoreContext] API tidak terjangkau, memakai daftar toko statis tanpa statistik:', err);
            } finally {
                if (isMounted) setIsLoadingStores(false);
            }
        }
        loadStoresFromBackend();
        EventBus.on(DATA_BERUBAH, loadStoresFromBackend);
        return () => {
            isMounted = false;
            EventBus.removeListener(DATA_BERUBAH, loadStoresFromBackend);
        };
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
        <StoreContext.Provider value={{ currentStore, storesList, isLoadingStores, statsTersedia, switchStore }}>
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
