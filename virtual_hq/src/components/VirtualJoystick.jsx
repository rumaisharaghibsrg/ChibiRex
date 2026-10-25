import React, { useRef, useState, useEffect, useCallback } from 'react';
import { EventBus } from '../game/EventBus';

const MAX_RADIUS = 42; // px radius maksimum knob dari pusat
const PLAYER_SPEED = 160; // px/detik sesuai MainScene

/**
 * Komponen Virtual Joystick Analog 360 Derajat untuk Kontrol Jempol Kiri (Mobile).
 * Mendukung Multi-touch dan Pointer Fallback untuk emulasi browser.
 */
export default function VirtualJoystick() {
    const containerRef = useRef(null);
    const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
    const [isInteracting, setIsInteracting] = useState(false);
    const activeTouchIdRef = useRef(null);

    const emitMovement = useCallback((vx, vy, active) => {
        const payload = { vx, vy, active };
        EventBus.emit('virtual-joystick-move', payload);
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('virtual-joystick-move', { detail: payload }));
        }
    }, []);

    const handlePointerProcess = useCallback((clientX, clientY) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const dx = clientX - centerX;
        const dy = clientY - centerY;
        const distance = Math.hypot(dx, dy);

        let clampedX = dx;
        let clampedY = dy;
        let intensity = 0;

        if (distance > 0) {
            intensity = Math.min(distance / MAX_RADIUS, 1.0);
            if (distance > MAX_RADIUS) {
                clampedX = (dx / distance) * MAX_RADIUS;
                clampedY = (dy / distance) * MAX_RADIUS;
            }
        }

        setKnobPos({ x: clampedX, y: clampedY });

        // Hitung kecepatan analog proporsional
        const vx = distance > 0 ? (dx / distance) * intensity * PLAYER_SPEED : 0;
        const vy = distance > 0 ? (dy / distance) * intensity * PLAYER_SPEED : 0;

        emitMovement(Math.round(vx), Math.round(vy), true);
    }, [emitMovement]);

    const handleReset = useCallback(() => {
        activeTouchIdRef.current = null;
        setIsInteracting(false);
        setKnobPos({ x: 0, y: 0 });
        emitMovement(0, 0, false);
    }, [emitMovement]);

    // Touch Event Handlers
    const onTouchStart = (e) => {
        e.stopPropagation();
        const touch = e.changedTouches[0];
        if (!touch) return;
        activeTouchIdRef.current = touch.identifier;
        setIsInteracting(true);
        handlePointerProcess(touch.clientX, touch.clientY);
    };

    const onTouchMove = (e) => {
        e.stopPropagation();
        if (activeTouchIdRef.current === null) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if (touch.identifier === activeTouchIdRef.current) {
                handlePointerProcess(touch.clientX, touch.clientY);
                break;
            }
        }
    };

    const onTouchEnd = (e) => {
        e.stopPropagation();
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === activeTouchIdRef.current) {
                handleReset();
                break;
            }
        }
    };

    // Mouse Pointer Handlers (Untuk debugging di desktop/responsive mode)
    const onMouseDown = (e) => {
        if (e.button !== 0) return; // Hanya tombol klik kiri
        setIsInteracting(true);
        activeTouchIdRef.current = 'mouse';
        handlePointerProcess(e.clientX, e.clientY);

        const onMouseMove = (moveEvt) => {
            handlePointerProcess(moveEvt.clientX, moveEvt.clientY);
        };
        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            handleReset();
        };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    // Bersihkan saat unmount
    useEffect(() => {
        return () => {
            emitMovement(0, 0, false);
        };
    }, [emitMovement]);

    return (
        <div
            ref={containerRef}
            className={`virtual-joystick-container ${isInteracting ? 'is-active' : ''}`}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onTouchCancel={handleReset}
            onMouseDown={onMouseDown}
            style={{
                position: 'absolute',
                bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
                left: '20px',
                width: '124px',
                height: '124px',
                borderRadius: '50%',
                pointerEvents: 'auto',
                background: isInteracting 
                    ? 'radial-gradient(circle, rgba(14, 165, 233, 0.25) 0%, rgba(15, 23, 42, 0.75) 75%)'
                    : 'radial-gradient(circle, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.6) 80%)',
                border: isInteracting
                    ? '2px solid rgba(56, 189, 248, 0.7)'
                    : '2px solid rgba(148, 163, 184, 0.25)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                boxShadow: isInteracting
                    ? '0 0 20px rgba(56, 189, 248, 0.4), inset 0 0 14px rgba(56, 189, 248, 0.2)'
                    : '0 8px 24px rgba(0, 0, 0, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 90,
                touchAction: 'none',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s',
            }}
            aria-label="Virtual Joystick"
        >
            {/* Guide crosshair lines subtle */}
            <div style={{
                position: 'absolute',
                width: '1px',
                height: '60%',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                pointerEvents: 'none',
            }} />
            <div style={{
                position: 'absolute',
                width: '60%',
                height: '1px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                pointerEvents: 'none',
            }} />

            {/* Knob / Thumbstick */}
            <div
                className="joystick-knob"
                style={{
                    position: 'absolute',
                    width: '52px',
                    height: '52px',
                    borderRadius: '50%',
                    background: isInteracting
                        ? 'radial-gradient(circle at 35% 35%, #38bdf8 0%, #0284c7 70%, #0369a1 100%)'
                        : 'radial-gradient(circle at 35% 35%, #94a3b8 0%, #475569 70%, #334155 100%)',
                    transform: `translate3d(${knobPos.x}px, ${knobPos.y}px, 0)`,
                    transition: isInteracting ? 'none' : 'transform 0.15s cubic-bezier(0.2, 0.8, 0.2, 1)',
                    boxShadow: isInteracting
                        ? '0 0 16px rgba(56, 189, 248, 0.8), 0 4px 8px rgba(0, 0, 0, 0.5)'
                        : '0 4px 10px rgba(0, 0, 0, 0.45)',
                    border: '2px solid rgba(255, 255, 255, 0.4)',
                    pointerEvents: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <div style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255, 255, 255, 0.35)',
                }} />
            </div>
        </div>
    );
}
