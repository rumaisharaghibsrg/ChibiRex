import React, { useState } from 'react';

/**
 * MobileRexaCallButton - Mini Floating Button (Cyber-Glass)
 * Diletakkan di tepi kanan layar, sedikit di atas Smart Action Button (jempol kanan)
 * untuk memanggil Smartphone Rexa Copilot secara instan (1-tap). (Directive v5.2)
 */
export default function MobileRexaCallButton({ isChatOpen, onToggleChat, agentRunning }) {
    const [isPressed, setIsPressed] = useState(false);

    const handleClick = () => {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try { navigator.vibrate(15); } catch (_) {}
        }
        if (onToggleChat) onToggleChat();
    };

    return (
        <button
            type="button"
            className="mobile-rexa-call-btn"
            onPointerDown={() => setIsPressed(true)}
            onPointerUp={() => { setIsPressed(false); handleClick(); }}
            onPointerCancel={() => setIsPressed(false)}
            style={{
                position: 'absolute',
                bottom: 'calc(130px + env(safe-area-inset-bottom, 0px))',
                right: '40px',
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: isChatOpen
                    ? 'linear-gradient(135deg, rgba(14, 165, 233, 0.45) 0%, rgba(2, 132, 199, 0.75) 100%)'
                    : 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)',
                border: isChatOpen ? '2px solid #38bdf8' : '1.5px solid rgba(56, 189, 248, 0.45)',
                boxShadow: isChatOpen
                    ? '0 0 18px rgba(56, 189, 248, 0.7), 0 4px 12px rgba(0, 0, 0, 0.5)'
                    : '0 4px 14px rgba(0, 0, 0, 0.45), 0 0 10px rgba(56, 189, 248, 0.25)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                pointerEvents: 'auto',
                zIndex: 46,
                touchAction: 'manipulation',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                WebkitTapHighlightColor: 'transparent',
                transform: isPressed ? 'scale(0.9)' : 'scale(1)',
                transition: 'transform 0.1s cubic-bezier(0.2, 0.8, 0.2, 1), background 0.2s, border-color 0.2s, box-shadow 0.2s',
            }}
            aria-label="Panggil Rexa AI Copilot"
            title="Panggil Rexa AI Copilot (Hotkey: C)"
        >
            <span style={{ fontSize: '18px', lineHeight: 1 }}>📱</span>

            {/* Indikator Agent Patrol / Analyzing */}
            {agentRunning && (
                <span style={{
                    position: 'absolute',
                    top: '-2px',
                    right: '-2px',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: '#f59e0b',
                    border: '2px solid #0f172a',
                    boxShadow: '0 0 8px #f59e0b',
                    animation: 'pulse-glow 1s infinite alternate',
                }} />
            )}
        </button>
    );
}
