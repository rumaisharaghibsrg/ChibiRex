import React, { useState, useEffect, useCallback, useRef } from 'react';
import { EventBus } from '../game/EventBus';

const CONTEXT_THEMES = {
    rexa: {
        bg: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
        border: 'rgba(56, 189, 248, 0.8)',
        shadow: '0 0 24px rgba(14, 165, 233, 0.65)',
        text: '#ffffff',
    },
    manager: {
        bg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        border: 'rgba(52, 211, 153, 0.8)',
        shadow: '0 0 24px rgba(16, 185, 129, 0.65)',
        text: '#ffffff',
    },
    maya: {
        bg: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
        border: 'rgba(251, 113, 133, 0.8)',
        shadow: '0 0 24px rgba(244, 63, 94, 0.65)',
        text: '#ffffff',
    },
    citra: {
        bg: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)',
        border: 'rgba(192, 132, 252, 0.8)',
        shadow: '0 0 24px rgba(168, 85, 247, 0.65)',
        text: '#ffffff',
    },
    rian: {
        bg: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
        border: 'rgba(129, 140, 248, 0.8)',
        shadow: '0 0 24px rgba(99, 102, 241, 0.65)',
        text: '#ffffff',
    },
    budi: {
        bg: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
        border: 'rgba(56, 189, 248, 0.8)',
        shadow: '0 0 24px rgba(2, 132, 199, 0.65)',
        text: '#ffffff',
    },
    tv: {
        bg: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
        border: 'rgba(34, 211, 238, 0.8)',
        shadow: '0 0 24px rgba(6, 182, 212, 0.65)',
        text: '#ffffff',
    },
    doni: {
        bg: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
        border: 'rgba(248, 113, 113, 0.9)',
        shadow: '0 0 26px rgba(239, 68, 68, 0.8)',
        text: '#ffffff',
    },
    coffee: {
        bg: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
        border: 'rgba(251, 191, 36, 0.8)',
        shadow: '0 0 24px rgba(217, 119, 6, 0.65)',
        text: '#ffffff',
    },
    'chair-sit': {
        bg: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
        border: 'rgba(52, 211, 153, 0.8)',
        shadow: '0 0 20px rgba(5, 150, 105, 0.6)',
        text: '#ffffff',
    },
    'chair-stand': {
        bg: 'linear-gradient(135deg, #475569 0%, #334155 100%)',
        border: 'rgba(148, 163, 184, 0.8)',
        shadow: '0 0 20px rgba(71, 85, 105, 0.6)',
        text: '#ffffff',
    },
    none: {
        bg: 'linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.75) 100%)',
        border: 'rgba(100, 116, 139, 0.35)',
        shadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        text: '#94a3b8',
    },
};

/**
 * Smart Contextual Action Button untuk Jempol Kanan (Mobile).
 * Berubah warna, ikon, dan label otomatis sesuai NPC atau objek terdekat.
 */
export default function SmartActionButton() {
    const [context, setContext] = useState({
        type: 'none',
        label: 'JELAJAH',
        icon: '🚶',
        isActive: false,
    });
    const [isPressed, setIsPressed] = useState(false);
    const lastTriggerTimeRef = useRef(0);

    useEffect(() => {
        const handleContextChange = (data) => {
            if (!data) return;
            setContext({
                type: data.type || 'none',
                label: data.label || 'JELAJAH',
                icon: data.icon || '🚶',
                isActive: Boolean(data.isActive),
            });
        };

        EventBus.on('smart-action-context-changed', handleContextChange);
        const onCustomEvent = (e) => handleContextChange(e.detail);
        window.addEventListener('smart-action-context-changed', onCustomEvent);

        return () => {
            EventBus.off('smart-action-context-changed', handleContextChange);
            window.removeEventListener('smart-action-context-changed', onCustomEvent);
        };
    }, []);

    const handleActionPress = useCallback((e) => {
        // 1. Cegah default touch behavior agar tidak double-fire
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        if (!context.isActive) return;

        const now = Date.now();
        if (now - lastTriggerTimeRef.current < 250) return;
        lastTriggerTimeRef.current = now;

        // Haptic feedback jika didukung device
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try { navigator.vibrate(25); } catch (_) {}
        }

        // 2. THE NUCLEAR OPTION: Simulasikan ketukan keyboard 'e' secara native (Directive v5.7)
        // Ini akan menipu sistem Phaser/React agar mengira tuts 'e' benar-benar ditekan di keyboard
        const keydownEvent = new KeyboardEvent('keydown', {
            key: 'e',
            code: 'KeyE',
            keyCode: 69,
            which: 69,
            bubbles: true,
            cancelable: true,
        });
        window.dispatchEvent(keydownEvent);
        document.dispatchEvent(keydownEvent);

        // 3. Simulasikan keyup setelah delay sangat singkat untuk melengkapi siklus penekanan tombol
        setTimeout(() => {
            const keyupEvent = new KeyboardEvent('keyup', {
                key: 'e',
                code: 'KeyE',
                keyCode: 69,
                which: 69,
                bubbles: true,
                cancelable: true,
            });
            window.dispatchEvent(keyupEvent);
            document.dispatchEvent(keyupEvent);
        }, 50);

        // 4. Cadangan event bus untuk redundansi
        const payload = {
            context: context.type,
            npcId: ['maya', 'citra', 'rian', 'budi'].includes(context.type) ? context.type : null,
            label: context.label,
        };
        EventBus.emit('mobile-action-pressed', payload);
        EventBus.emit('action-button-pressed', payload);
        EventBus.emit('trigger-smart-action', payload);
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('mobile-action-pressed', { detail: payload }));
            window.dispatchEvent(new CustomEvent('action-button-pressed', { detail: payload }));
            window.dispatchEvent(new CustomEvent('trigger-smart-action', { detail: payload }));
        }
    }, [context.isActive, context.type, context.label]);

    const theme = CONTEXT_THEMES[context.type] || CONTEXT_THEMES.none;

    return (
        <button
            type="button"
            className={`smart-action-btn ${context.isActive ? 'is-active pulse-glow' : 'is-inactive'}`}
            disabled={!context.isActive}
            onPointerDown={() => setIsPressed(true)}
            onPointerUp={() => setIsPressed(false)}
            onPointerCancel={() => setIsPressed(false)}
            onClick={handleActionPress}
            onTouchEnd={handleActionPress}
            style={{
                position: 'absolute',
                bottom: 'calc(34px + env(safe-area-inset-bottom, 0px))',
                right: '20px',
                width: '84px',
                height: '84px',
                borderRadius: '50%',
                background: theme.bg,
                border: `2.5px solid ${theme.border}`,
                boxShadow: context.isActive ? theme.shadow : '0 4px 12px rgba(0,0,0,0.3)',
                color: theme.text,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: context.isActive ? 'pointer' : 'default',
                pointerEvents: 'auto',
                zIndex: 90,
                touchAction: 'manipulation',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                WebkitTapHighlightColor: 'transparent',
                transform: isPressed ? 'scale(0.92)' : 'scale(1)',
                opacity: context.isActive ? 1 : 0.45,
                transition: 'transform 0.1s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.2s, background 0.25s, border-color 0.25s, box-shadow 0.25s',
                padding: '4px',
            }}
            aria-label={context.isActive ? `Aksi: ${context.label}` : 'Tidak ada objek di dekat player'}
        >
            <span style={{ fontSize: '26px', lineHeight: 1, marginBottom: '3px' }}>
                {context.icon}
            </span>
            <span style={{
                fontSize: '10px',
                fontWeight: 800,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                maxWidth: '74px',
                textAlign: 'center',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                textShadow: '0 1px 3px rgba(0,0,0,0.7)',
            }}>
                {context.label}
            </span>
            {context.isActive && (
                <span style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-4px',
                    backgroundColor: '#0f172a',
                    border: '1.5px solid #38bdf8',
                    color: '#38bdf8',
                    fontSize: '9px',
                    fontWeight: 800,
                    padding: '1px 5px',
                    borderRadius: '8px',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.5)',
                }}>
                    TAP
                </span>
            )}
        </button>
    );
}
