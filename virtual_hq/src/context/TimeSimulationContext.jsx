/**
 * TimeSimulationContext.jsx — Global Time Engine State Provider
 *
 * Mengelola state temporal Virtual HQ:
 *  - Tanggal simulasi aktif (currentSimulatedDate)
 *  - Offset hari dari baseline (daysOffset, default 0)
 *  - Asynchronous Warp Lock (isWarping) untuk mencegah race condition
 *  - Komunikasi dua arah dengan Phaser melalui EventBus ('timeline-shift', 'timeline-shift-completed')
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { EventBus } from '../game/EventBus';
import {
    BASELINE_DATE,
    BASELINE_DATE_STR,
    calculateNewDate,
    formatIndonesianDate,
    formatIndonesianDayAndDate,
    formatISODate,
} from '../utils/TimeEngine';

const TimeSimulationContext = createContext(null);

export function TimeSimulationProvider({ children }) {
    const [currentSimulatedDate, setCurrentSimulatedDate] = useState(BASELINE_DATE);
    const [daysOffset, setDaysOffset] = useState(0);
    const [isWarping, setIsWarping] = useState(false);
    const [pendingTarget, setPendingTarget] = useState(null);

    // Inisialisasi window global agar non-React runtime (seperti Phaser) dapat membaca tanggal secara sinkron
    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.CURRENT_SIMULATED_DATE = BASELINE_DATE_STR;
            window.CURRENT_DAYS_OFFSET = 0;
            window.IS_TIME_WARPING = false;
        }
    }, []);

    // ── Listener Sinyal Selesai dari Animasi Phaser (timeline-shift-completed) ───
    useEffect(() => {
        const handleWarpCompleted = (payload) => {
            const data = payload?.detail || payload || {};
            const finalDaysOffset = typeof data.targetOffset === 'number'
                ? data.targetOffset
                : (typeof data.daysOffset === 'number' ? data.daysOffset : (pendingTarget?.targetOffset ?? 0));
            const newDateCalc = calculateNewDate(BASELINE_DATE, finalDaysOffset);

            setCurrentSimulatedDate(newDateCalc.date);
            setDaysOffset(finalDaysOffset);
            setIsWarping(false);
            setPendingTarget(null);

            if (typeof window !== 'undefined') {
                window.CURRENT_SIMULATED_DATE = newDateCalc.iso;
                window.CURRENT_DAYS_OFFSET = finalDaysOffset;
                window.IS_TIME_WARPING = false;
            }

            // Sinyal unfreeze pemain eksplisit
            EventBus.emit('unfreeze-player');
            window.dispatchEvent(new CustomEvent('unfreeze-player'));

            console.log(
                `%c[TIME ENGINE] ⏳ Lompatan Waktu Selesai! Tanggal Sekarang: ${newDateCalc.fullFormatted} (+${finalDaysOffset} Hari)`,
                'color: #f59e0b; font-weight: bold;'
            );
        };

        EventBus.on('timeline-shift-completed', handleWarpCompleted);
        window.addEventListener('timeline-shift-completed', handleWarpCompleted);

        return () => {
            EventBus.removeListener('timeline-shift-completed', handleWarpCompleted);
            window.removeEventListener('timeline-shift-completed', handleWarpCompleted);
        };
    }, [pendingTarget]);

    // ── Memicu Percepatan Waktu (+1, +7, dll) ──────────────────────────────────
    const triggerTimeWarp = useCallback((additionalDays) => {
        if (isWarping) return; // Cegah pemicu ganda selama warp

        const targetOffset = daysOffset + additionalDays;
        const targetCalc = calculateNewDate(BASELINE_DATE, targetOffset);

        setIsWarping(true);
        setPendingTarget({ targetOffset, targetCalc });

        if (typeof window !== 'undefined') {
            window.IS_TIME_WARPING = true;
        }

        const payload = {
            daysAdded: additionalDays,
            previousOffset: daysOffset,
            targetOffset: targetOffset,
            daysOffset: targetOffset,
            targetDate: targetCalc.iso,
            targetDateFormatted: targetCalc.formatted,
            targetFullFormatted: targetCalc.fullFormatted,
            isReset: false,
        };

        // Siarkan event ke Phaser & Window
        EventBus.emit('timeline-shift', payload);
        window.dispatchEvent(new CustomEvent('timeline-shift', { detail: payload }));

        // Fail-safe release: jika ada kendala di kanvas, kunci otomatis dilepaskan pada 2500ms
        setTimeout(() => {
            setIsWarping((prev) => {
                if (prev) {
                    console.warn('[TIME ENGINE] ⚠️ Fail-safe timeout (2500ms) membebaskan Asynchronous Lock.');
                    if (typeof window !== 'undefined') window.IS_TIME_WARPING = false;
                    EventBus.emit('unfreeze-player');
                    window.dispatchEvent(new CustomEvent('unfreeze-player'));
                    return false;
                }
                return prev;
            });
        }, 2500);
    }, [daysOffset, isWarping]);

    // ── Reset Waktu ke Baseline (31 Des 2016) ─────────────────────────────────
    const resetTimeToBaseline = useCallback(() => {
        if (isWarping || daysOffset === 0) return;

        const targetOffset = 0;
        const targetCalc = calculateNewDate(BASELINE_DATE, 0);

        setIsWarping(true);
        setPendingTarget({ targetOffset: 0, targetCalc });

        if (typeof window !== 'undefined') {
            window.IS_TIME_WARPING = true;
        }

        const payload = {
            daysAdded: -daysOffset,
            previousOffset: daysOffset,
            targetOffset: 0,
            daysOffset: 0,
            targetDate: BASELINE_DATE_STR,
            targetDateFormatted: targetCalc.formatted,
            targetFullFormatted: targetCalc.fullFormatted,
            isReset: true,
        };

        EventBus.emit('timeline-shift', payload);
        window.dispatchEvent(new CustomEvent('timeline-shift', { detail: payload }));

        // Fail-safe release untuk reset
        setTimeout(() => {
            setIsWarping((prev) => {
                if (prev) {
                    console.warn('[TIME ENGINE] ⚠️ Fail-safe timeout (2500ms) membebaskan Asynchronous Lock.');
                    if (typeof window !== 'undefined') window.IS_TIME_WARPING = false;
                    EventBus.emit('unfreeze-player');
                    window.dispatchEvent(new CustomEvent('unfreeze-player'));
                    return false;
                }
                return prev;
            });
        }, 2500);
    }, [daysOffset, isWarping]);

    const formattedDate = formatIndonesianDate(currentSimulatedDate);
    const fullFormattedDate = formatIndonesianDayAndDate(currentSimulatedDate);
    const isoDate = formatISODate(currentSimulatedDate);

    return (
        <TimeSimulationContext.Provider
            value={{
                currentSimulatedDate,
                daysOffset,
                isWarping,
                formattedDate,
                fullFormattedDate,
                isoDate,
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
