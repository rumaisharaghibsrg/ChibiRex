/**
 * TimeSimulationContext.jsx — Jam simulasi Virtual HQ, tersambung ke jam simulasi API Rexa
 *
 * Tanggal di game sama dengan tanggal di dashboard: dibaca dari GET /simulasi (dicek ulang tiap 15 detik, jadi
 * perubahan dari dashboard ikut terlihat), dan tombol lompatan waktu memanggil /simulasi/maju, /mundur, atau /kembali
 * sehingga stok, PO dalam pengiriman, dan Health Score ikut berubah. Animasi warp Phaser tetap memakai EventBus
 * ('timeline-shift' -> 'timeline-shift-completed'); tanggal baru diterapkan setelah animasinya selesai.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { EventBus } from '../game/EventBus';
import { api, beritahuDataBerubah } from '../lib/api';
import {
    BASELINE_DATE,
    calculateNewDate,
    formatIndonesianDate,
    formatIndonesianDayAndDate,
    formatISODate,
} from '../utils/TimeEngine';

const TimeSimulationContext = createContext(null);
const INTERVAL_CEK_MS = 15000;

function setGlobal(hari, warping) {
    if (typeof window === 'undefined') return;
    window.CURRENT_SIMULATED_DATE = calculateNewDate(BASELINE_DATE, hari).iso;
    window.CURRENT_DAYS_OFFSET = hari;
    window.IS_TIME_WARPING = warping;
}

export function TimeSimulationProvider({ children }) {
    const [daysOffset, setDaysOffset] = useState(0);
    const [hariMaks, setHariMaks] = useState(90);
    const [isWarping, setIsWarping] = useState(false);
    const [apiOnline, setApiOnline] = useState(null); // null = belum dicek
    const hariRef = useRef(0);
    const warpRef = useRef(false);
    const targetRef = useRef(null); // hari dari jawaban API, diterapkan setelah animasi warp selesai

    const terapkanHari = useCallback((hari) => {
        const berubah = hari !== hariRef.current;
        hariRef.current = hari;
        setDaysOffset(hari);
        setGlobal(hari, warpRef.current);
        if (berubah) beritahuDataBerubah();
    }, []);

    // ── Baca jam simulasi dari API saat mulai, lalu berkala (perubahan dari dashboard ikut terlihat) ─────────
    useEffect(() => {
        setGlobal(0, false);
        let aktif = true;
        const cek = () => api.simulasi()
            .then((s) => {
                if (!aktif) return;
                setApiOnline(true);
                setHariMaks(s.hari_maks);
                if (!warpRef.current) terapkanHari(s.hari_ke);
            })
            .catch(() => aktif && setApiOnline(false));
        cek();
        const ulang = setInterval(cek, INTERVAL_CEK_MS);
        return () => {
            aktif = false;
            clearInterval(ulang);
        };
    }, [terapkanHari]);

    const selesaiWarp = useCallback(() => {
        if (!warpRef.current) return;
        warpRef.current = false;
        setIsWarping(false);
        if (targetRef.current !== null) terapkanHari(targetRef.current);
        targetRef.current = null;
        setGlobal(hariRef.current, false);
    }, [terapkanHari]);

    // ── Sinyal selesai dari animasi Phaser (timeline-shift-completed) ─────────────
    useEffect(() => {
        const handleWarpCompleted = () => {
            selesaiWarp();
            // Sinyal unfreeze pemain eksplisit
            EventBus.emit('unfreeze-player');
            window.dispatchEvent(new CustomEvent('unfreeze-player'));
        };
        EventBus.on('timeline-shift-completed', handleWarpCompleted);
        window.addEventListener('timeline-shift-completed', handleWarpCompleted);
        return () => {
            EventBus.removeListener('timeline-shift-completed', handleWarpCompleted);
            window.removeEventListener('timeline-shift-completed', handleWarpCompleted);
        };
    }, [selesaiWarp]);

    /**
     * Geser waktu lewat API: hari > 0 maju, hari < 0 mundur, null kembali ke 31 Des 2016. Mengembalikan pesan galat
     * (string) kalau API menolak, atau null kalau berhasil dan animasi warp dimulai.
     */
    const geserWaktu = useCallback(async (hari) => {
        if (warpRef.current) return null;
        warpRef.current = true;
        setIsWarping(true);
        setGlobal(hariRef.current, true);

        let s;
        try {
            s = hari === null ? await api.kembaliSimulasi()
                : hari > 0 ? await api.majuSimulasi(hari) : await api.mundurSimulasi(-hari);
        } catch (e) {
            warpRef.current = false;
            setIsWarping(false);
            setGlobal(hariRef.current, false);
            return e.message;
        }

        const previousOffset = hariRef.current;
        const targetCalc = calculateNewDate(BASELINE_DATE, s.hari_ke);
        targetRef.current = s.hari_ke;
        const payload = {
            daysAdded: s.hari_ke - previousOffset,
            previousOffset,
            targetOffset: s.hari_ke,
            daysOffset: s.hari_ke,
            targetDate: targetCalc.iso,
            targetDateFormatted: targetCalc.formatted,
            targetFullFormatted: targetCalc.fullFormatted,
            isReset: hari === null,
        };
        EventBus.emit('timeline-shift', payload);
        window.dispatchEvent(new CustomEvent('timeline-shift', { detail: payload }));

        // Fail-safe: kalau animasi kanvas tidak mengirim sinyal selesai, tanggal tetap diterapkan setelah 2,5 detik.
        setTimeout(() => {
            if (!warpRef.current) return;
            console.warn('[TIME ENGINE] ⚠️ Fail-safe timeout (2500ms) membebaskan Asynchronous Lock.');
            selesaiWarp();
            EventBus.emit('unfreeze-player');
            window.dispatchEvent(new CustomEvent('unfreeze-player'));
        }, 2500);
        return null;
    }, [selesaiWarp]);

    const triggerTimeWarp = useCallback((hari) => geserWaktu(hari), [geserWaktu]);
    const resetTimeToBaseline = useCallback(() => geserWaktu(null), [geserWaktu]);

    const currentSimulatedDate = calculateNewDate(BASELINE_DATE, daysOffset).date;

    return (
        <TimeSimulationContext.Provider
            value={{
                currentSimulatedDate,
                daysOffset,
                hariMaks,
                isWarping,
                apiOnline,
                formattedDate: formatIndonesianDate(currentSimulatedDate),
                fullFormattedDate: formatIndonesianDayAndDate(currentSimulatedDate),
                isoDate: formatISODate(currentSimulatedDate),
                triggerTimeWarp,
                resetTimeToBaseline,
            }}
        >
            {children}
        </TimeSimulationContext.Provider>
    );
}

export function useTimeSimulation() {
    const ctx = useContext(TimeSimulationContext);
    if (!ctx) {
        throw new Error('useTimeSimulation must be used within a TimeSimulationProvider');
    }
    return ctx;
}

export default TimeSimulationContext;
