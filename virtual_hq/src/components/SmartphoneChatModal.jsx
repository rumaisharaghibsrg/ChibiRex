/**
 * SmartphoneChatModal.jsx — Interactive Handheld Intercom / Smartphone UI
 *
 * Konsep: "Smartphone / Interkom Perusahaan" (Company Handheld Device)
 * Fitur:
 *  - Slide-Up / Slide-Down smooth CSS transitions
 *  - Non-blocking gameplay overlay
 *  - Smart Input Focus Trapping (menonaktifkan kontrol WASD Phaser saat mengetik)
 *  - Quick Action Chips
 *  - Jawaban dari Rexa Copilot (Claude di Lambda, POST {VITE_COPILOT_URL}/tanya) untuk toko yang diawasi; tanpa
 *    Copilot, pertanyaan diteruskan ke NPC yang membacakan data API (src/lib/npc.js). Tidak ada jawaban tetap.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { EventBus } from '../game/EventBus';
import { useStore } from '../context/StoreContext';
import { api, COPILOT_URL } from '../lib/api';
import { laporanNpc, laporanNpcJaringan } from '../lib/npc';
import './SmartphoneChatModal.css';

const tunda = (ms) => new Promise((r) => setTimeout(r, ms));
const jam = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// Teks **tebal** dari Copilot dan laporan NPC ditampilkan tebal; sisanya teks biasa.
function TeksTebal({ teks }) {
    return teks.split(/(\*\*[^*]+\*\*)/g).map((bagian, i) => (
        bagian.startsWith('**') && bagian.endsWith('**')
            ? <strong key={i}>{bagian.slice(2, -2)}</strong>
            : <React.Fragment key={i}>{bagian}</React.Fragment>
    ));
}

// Kumpulan Prompt Pintas Cepat (Quick Action Chips)
const QUICK_CHIPS = [
    { label: '📦 Audit Gudang Maya', query: 'Bagaimana hasil audit stok fisik di gudang?' },
    { label: '💼 Realokasi Kas Citra', query: 'Berapa modal yang diselamatkan dan ke mana sebaiknya dialihkan?' },
    { label: '🛡️ Guardrail Rian', query: 'Bagaimana status keamanan Guardrail dan circuit breaker saat ini?' },
    { label: '📊 Health Score Budi', query: 'Bagaimana performa Store Health Score toko kita?' },
];

// ── Pemetaan Intent & Routing NPC Intercom ──────────────────────────────────
const NPC_ROUTING = [
    {
        id: 'maya',
        name: 'Maya',
        role: 'Auditor Stok & Gudang',
        location: 'Ruang Gudang & Arsip',
        regex: /(stok(\s+)?fisik|opname|selisih|gudang|hitung(\s+)?manual|rak|expired|kadaluarsa|rusak|pecah|cacat|confidence(\s+)?score|karton|maya)/i,
        callingText: 'Tunggu sebentar ya Manager, saya sambungkan ke **Maya** di Ruang Gudang & Arsip untuk memeriksa kondisi stok fisik dan hasil opname terbaru...',
        callingTag: 'Calling Maya...',
        typingStatus: 'Rexa sedang menelepon Maya (Auditor Stok)...',
    },
    {
        id: 'citra',
        name: 'Citra',
        role: 'Financial Strategist',
        location: 'Meja Rapat War Room',
        regex: /(alokasi|realokasi|anggaran|saving|hemat|kas(\s+)?toko|dana|modal|deadstock|hold|substitusi|duit|keuangan|citra)/i,
        callingText: 'Saya hubungi **Citra** di Meja Meeting War Room untuk memverifikasi kalkulasi alokasi kas dan penyelamatan modal belanja...',
        callingTag: 'Calling Citra...',
        typingStatus: 'Rexa sedang menelepon Citra (Finance)...',
    },
    {
        id: 'rian',
        name: 'Rian',
        role: 'Security & Guardrail Admin',
        location: 'Gerbang Server & Konsol',
        regex: /(guardrail|circuit(\s+)?breaker|keamanan|aman|limit|batas|anomali|outlier|tripped|terputus|sentinel|rian)/i,
        callingText: 'Menghubungi konsol keamanan **Rian** di Gerbang Server untuk memeriksa integritas guardrail & circuit breaker...',
        callingTag: 'Calling Rian...',
        typingStatus: 'Rexa sedang menelepon Rian (Guardrail Admin)...',
    },
    {
        id: 'budi',
        name: 'Pak Budi',
        role: 'Store Operations Director',
        location: 'Layar Smart Screen Eksekutif',
        regex: /(health(\s+)?score|kesehatan|kpi|performa|kinerja|direktur|ringkasan|cabang|target|evaluasi|budi)/i,
        callingText: 'Menyambungkan interkom ke ruang presentasi **Pak Budi** untuk menarik Health Score dan peringkat toko ini...',
        callingTag: 'Calling Pak Budi...',
        typingStatus: 'Rexa sedang menelepon Pak Budi (Director)...',
    },
];

function detectTargetNPC(query) {
    for (const npc of NPC_ROUTING) {
        if (npc.regex.test(query)) {
            return npc;
        }
    }
    return null;
}

export function SmartphoneChatModal({ isOpen: externalIsOpen, onClose }) {
    const { currentStore, mode } = useStore();
    const storeId = currentStore?.id || 74;
    const modeJaringan = mode === 'jaringan';
    const [internalOpen, setInternalOpen] = useState(false);
    const [currentTime, setCurrentTime] = useState('09:41');
    const [inputQuery, setInputQuery] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [typingStatus, setTypingStatus] = useState('Rexa sedang menganalisis data...');
    const [messages, setMessages] = useState([
        {
            id: 'init-1',
            sender: 'assistant',
            text: 'Halo Manager! Saya **Rexa** (AI Inventory & Cash Copilot).\n\nSaya menjawab dari data toko yang sedang Anda awasi: stok, draf PO, Hold Reorder, modal, guardrail, dan Health Score. ' +
                (COPILOT_URL ? 'Jawaban saya memakai Claude di Amazon Bedrock dan hanya membaca data.' : 'Copilot (Claude) belum diatur, jadi pertanyaan saya teruskan ke staf yang membacakan data API.'),
            tag: COPILOT_URL ? 'Rexa Copilot · Claude' : 'Data API',
            timestamp: jam(),
        },
    ]);

    const chatFeedRef = useRef(null);
    const inputRef = useRef(null);

    // Sinkronisasi prop eksternal jika dikontrol oleh parent (App.jsx)
    useEffect(() => {
        if (externalIsOpen !== undefined) {
            setInternalOpen(Boolean(externalIsOpen));
        }
    }, [externalIsOpen]);

    // Listener langsung ke Window & EventBus (Fail-Safe & Multi-Trigger)
    useEffect(() => {
        let lastToggle = 0;
        const handleToggle = () => {
            const now = Date.now();
            if (now - lastToggle < 200) return;
            lastToggle = now;
            setInternalOpen((prev) => !prev);
        };
        const handleOpen = () => {
            setInternalOpen(true);
        };
        const handleClose = () => {
            setInternalOpen(false);
            if (onClose) onClose();
        };

        window.addEventListener('toggle-smartphone-chat', handleToggle);
        window.addEventListener('open-smartphone-chat', handleOpen);
        window.addEventListener('close-smartphone-chat', handleClose);
        EventBus.on('toggle-smartphone-chat', handleToggle);
        EventBus.on('open-smartphone-chat', handleOpen);
        EventBus.on('close-smartphone-chat', handleClose);

        return () => {
            window.removeEventListener('toggle-smartphone-chat', handleToggle);
            window.removeEventListener('open-smartphone-chat', handleOpen);
            window.removeEventListener('close-smartphone-chat', handleClose);
            EventBus.removeListener('toggle-smartphone-chat', handleToggle);
            EventBus.removeListener('open-smartphone-chat', handleOpen);
            EventBus.removeListener('close-smartphone-chat', handleClose);
        };
    }, [onClose]);

    const isOpen = internalOpen;

    // ── Update Jam Digital di Status Bar ───────────────────────────────────────
    useEffect(() => {
        const updateClock = () => {
            const now = new Date();
            setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        };
        updateClock();
        const timer = setInterval(updateClock, 30000);
        return () => clearInterval(timer);
    }, []);

    // ── Auto Scroll ke Pesan Terbaru ──────────────────────────────────────────
    const scrollToBottom = useCallback(() => {
        if (chatFeedRef.current) {
            chatFeedRef.current.scrollTop = chatFeedRef.current.scrollHeight;
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
        }
    }, [messages, isTyping, isOpen, scrollToBottom]);

    // ── Focus Trapping Events untuk Phaser ────────────────────────────────────
    const handleInputFocus = () => {
        EventBus.emit('chat-input-focus', true);
        window.dispatchEvent(new CustomEvent('chat-input-focus', { detail: { isFocused: true } }));
    };

    const handleInputBlur = () => {
        EventBus.emit('chat-input-focus', false);
        window.dispatchEvent(new CustomEvent('chat-input-focus', { detail: { isFocused: false } }));
    };

    // ── Tangani Shortcut ESC ──────────────────────────────────────────────────
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) {
                handleInputBlur();
                setInternalOpen(false);
                if (onClose) onClose();
                window.dispatchEvent(new CustomEvent('close-smartphone-chat'));
                EventBus.emit('close-smartphone-chat');
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // ── Jawaban: Copilot (Claude) kalau diatur, selain itu laporan data dari NPC yang dituju ──────────────
    const jawab = async (pertanyaan, npc, riwayat) => {
        if (COPILOT_URL) {
            try {
                const r = await api.tanyaCopilot(storeId, pertanyaan, riwayat);
                return { text: r.jawaban, tag: npc ? `Copilot · bersama ${npc.name}` : 'Rexa Copilot · Claude' };
            } catch (e) {
                if (!npc) return { text: `Copilot belum bisa menjawab: ${e.message}`, tag: 'Copilot gagal' };
                // Ada NPC yang cocok: tetap jawab dari data API.
            }
        }
        if (npc) {
            try {
                const l = modeJaringan ? await laporanNpcJaringan(npc.id) : await laporanNpc(npc.id, storeId);
                return {
                    text: `📞 **Laporan ${npc.name} (${npc.role}):**\n\n"${l.dialogue}."\n\n` +
                        l.metrics.map((m) => `• **${m.label}**: ${m.value}`).join('\n'),
                    tag: modeJaringan ? 'Data API · Semua Toko' : `Data API · Toko ${storeId}`,
                };
            } catch (e) {
                return { text: `${npc.name} tidak bisa membaca data toko: ${e.message}`, tag: 'API tidak terjangkau' };
            }
        }
        return {
            text: 'Rexa Copilot (Claude) belum diatur untuk Virtual HQ (VITE_COPILOT_URL kosong), jadi saya belum bisa menjawab pertanyaan bebas. ' +
                'Saya bisa meneruskan ke **Maya** (stok fisik), **Citra** (modal dan realokasi), **Rian** (guardrail), atau **Pak Budi** (Health Score); coba tombol pintas di atas.',
            tag: 'Copilot belum diatur',
        };
    };

    // ── Kirim Pesan User & Pemicu Respons Rexa ─────────────────────────────────
    const handleSend = async (overrideQuery) => {
        const textToSend = (overrideQuery || inputQuery).trim();
        if (!textToSend || isTyping) return;

        // Riwayat untuk Copilot: hanya tanya-jawab, tanpa pesan "menyambungkan..."
        const riwayat = messages.filter((m) => m.riwayat).slice(-8)
            .map((m) => ({ peran: m.sender === 'user' ? 'user' : 'assistant', teks: m.text }));
        setMessages((prev) => [...prev, { id: `usr-${Date.now()}`, sender: 'user', text: textToSend, timestamp: jam(), riwayat: true }]);
        setInputQuery('');
        setIsTyping(true);

        const targetNPC = detectTargetNPC(textToSend);
        let dering = Promise.resolve();
        if (targetNPC) {
            // ── SISTEM INTERKOM 2-FASE (Rexa ↔ NPC Calling System) ────────────
            setTypingStatus(targetNPC.typingStatus);
            await tunda(350);
            setMessages((prev) => [...prev, {
                id: `call-${Date.now()}`,
                sender: 'assistant',
                text: targetNPC.callingText,
                tag: targetNPC.callingTag,
                timestamp: jam(),
            }]);
            // Dispatch event panggilan interkom ke Phaser Canvas (3000ms dering)
            const intercomPayload = { npcId: targetNPC.id, caller: 'rexa', duration: 3000, topic: targetNPC.role };
            window.dispatchEvent(new CustomEvent('npc-intercom-call', { detail: intercomPayload }));
            EventBus.emit('npc-intercom-call', intercomPayload);
            dering = tunda(3000);
        } else {
            setTypingStatus(COPILOT_URL ? 'Rexa sedang membaca data toko...' : 'Rexa sedang menganalisis data...');
        }

        const [balasan] = await Promise.all([jawab(textToSend, targetNPC, riwayat), dering]);
        setMessages((prev) => [...prev, {
            id: `ast-${Date.now()}`,
            sender: 'assistant',
            text: balasan.text,
            tag: balasan.tag,
            timestamp: jam(),
            riwayat: true,
        }]);
        setIsTyping(false);
        setTypingStatus('Rexa sedang menganalisis data...');
    };

    // ── Bersihkan Riwayat Chat ────────────────────────────────────────────────
    const handleClearChat = () => {
        setMessages([
            {
                id: `reset-${Date.now()}`,
                sender: 'assistant',
                text: `Riwayat percakapan telah dibersihkan. Ada yang ingin Anda tanyakan tentang Toko ${storeId}, Manager?`,
                tag: 'System Ready',
                timestamp: jam(),
            },
        ]);
    };

    return (
        <div
            id="smartphone-chat-widget"
            className={`smartphone-chat-container ${isOpen ? 'open' : 'closed'}`}
            style={{
                position: 'absolute',
                bottom: '16px',
                right: '16px',
                width: '340px',
                height: '540px',
                maxHeight: 'calc(100% - 32px)',
                zIndex: 9999,
                transform: isOpen ? 'translateY(0) scale(1)' : 'translateY(115%) scale(0.92)',
                opacity: isOpen ? 1 : 0,
                pointerEvents: isOpen ? 'auto' : 'none',
                transition: 'transform 0.32s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease-out',
            }}
            role="dialog"
            aria-label="Rexa Smartphone Intercom"
        >
            {/* ── Dynamic Island / Top Status Bar ─────────────────────────── */}
            <div className="phone-status-bar">
                <span>{currentTime}</span>
                <div className="phone-notch-pill" />
                <div className="phone-status-icons">
                    <span>📶 5G</span>
                    <span>🔋 98%</span>
                </div>
            </div>

            {/* ── App Header ──────────────────────────────────────────────── */}
            <div className="phone-header">
                <div className="phone-header-left">
                    <div className="phone-avatar-wrap">
                        <span>🦖</span>
                        <div className="phone-avatar-pulse" />
                    </div>
                    <div className="phone-header-info">
                        <div className="phone-title">
                            <span>Rexa Copilot</span>
                            <span style={{ fontSize: '9px', background: '#0284c7', color: '#fff', padding: '1px 4px', borderRadius: '4px' }}>AI</span>
                        </div>
                        <div className="phone-subtitle">● Online • Toko {storeId}</div>
                    </div>
                </div>

                <div className="phone-header-actions">
                    <button
                        onClick={handleClearChat}
                        className="phone-icon-btn"
                        title="Bersihkan Percakapan"
                        aria-label="Clear chat"
                    >
                        ↺
                    </button>
                    <button
                        onClick={() => {
                            handleInputBlur();
                            setInternalOpen(false);
                            if (onClose) onClose();
                            window.dispatchEvent(new CustomEvent('close-smartphone-chat'));
                            EventBus.emit('close-smartphone-chat');
                        }}
                        className="phone-icon-btn"
                        title="Tutup [C] / [ESC]"
                        aria-label="Close phone"
                    >
                        ✕
                    </button>
                </div>
            </div>

            {/* ── Quick Chips Carousel ────────────────────────────────────── */}
            <div className="phone-chips-bar">
                {QUICK_CHIPS.map((chip, idx) => (
                    <button
                        key={idx}
                        onClick={() => handleSend(chip.query)}
                        className="phone-chip"
                        title={chip.query}
                    >
                        {chip.label}
                    </button>
                ))}
            </div>

            {/* ── Chat Messages Feed ──────────────────────────────────────── */}
            <div className="phone-chat-feed" ref={chatFeedRef}>
                {messages.map((m) => {
                    const isUser = m.sender === 'user';
                    return (
                        <div key={m.id} className={`chat-bubble-wrap ${isUser ? 'user' : 'assistant'}`}>
                            <div className={`chat-bubble ${isUser ? 'user' : 'assistant'}`}>
                                {m.text.split('\n').map((line, i) => (
                                    <React.Fragment key={i}>
                                        <TeksTebal teks={line} />
                                        {i !== m.text.split('\n').length - 1 && <br />}
                                    </React.Fragment>
                                ))}
                            </div>
                            <div className="chat-meta">
                                {!isUser && m.tag && (
                                    <span className="chat-badge-tag">{m.tag}</span>
                                )}
                                {!isUser && m.confidence && (
                                    <span className="chat-confidence">{m.confidence}%</span>
                                )}
                                <span>{m.timestamp}</span>
                            </div>
                        </div>
                    );
                })}

                {/* Typing Indicator */}
                {isTyping && (
                    <div className="typing-indicator-wrap">
                        <div className="typing-dots">
                            <div className="typing-dot" />
                            <div className="typing-dot" />
                            <div className="typing-dot" />
                        </div>
                        <span className="typing-text">{typingStatus}</span>
                    </div>
                )}
            </div>

            {/* ── Input Bar ───────────────────────────────────────────────── */}
            <div className="phone-input-bar">
                <input
                    ref={inputRef}
                    type="text"
                    className="phone-input"
                    placeholder="Tanya Rexa tentang kas, stok, atau PO..."
                    value={inputQuery}
                    onChange={(e) => setInputQuery(e.target.value)}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                />
                <button
                    onClick={() => handleSend()}
                    disabled={!inputQuery.trim() || isTyping}
                    className="phone-send-btn"
                    title="Kirim Pesan (Enter)"
                    aria-label="Send message"
                >
                    ➤
                </button>
            </div>
        </div>
    );
}
export default SmartphoneChatModal;
