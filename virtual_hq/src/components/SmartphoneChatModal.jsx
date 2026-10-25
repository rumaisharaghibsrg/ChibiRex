/**
 * SmartphoneChatModal.jsx — Interactive Handheld Intercom / Smartphone UI
 *
 * Konsep: "Smartphone / Interkom Perusahaan" (Company Handheld Device)
 * Fitur:
 *  - Slide-Up / Slide-Down smooth CSS transitions
 *  - Non-blocking gameplay overlay
 *  - Smart Input Focus Trapping (menonaktifkan kontrol WASD Phaser saat mengetik)
 *  - Quick Action Chips
 *  - Respon domain-grounded Rexa Copilot (Guardrail, Suppression Engine, Health Score)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { EventBus } from '../game/EventBus';
import './SmartphoneChatModal.css';

// Kumpulan Prompt Pintas Cepat (Quick Action Chips)
const QUICK_CHIPS = [
    { label: '📦 Audit Gudang Maya', query: 'Bagaimana hasil audit stok fisik di gudang?' },
    { label: '💼 Realokasi Kas Citra', query: 'Berapa modal kas yang diselamatkan dari deadstock sirup?' },
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
        generateReply: () => ({
            text: '📞 **Laporan Langsung dari Maya (Auditor Stok):**\n\n> "Halo Rexa, halo Manager! Baru saja saya cek rak dan dokumen inventaris gudang. Untuk stok di rak utama tercatat aman terkendali. Pada SKU slow-moving (Sirup Hazelnut Gourmet), terdapat penyesuaian selisih **-4 botol** karena retur botol rusak kemarin, dan Data Confidence saat ini berada di level aman **0.88** (di atas ambang batas 0.85). Rekomendasi saya: selesaikan verifikasi audit di meja saya sebelum merilis PO SAP baru!"\n\n📦 **Ringkasan Audit Maya:**\n• **Kondisi Fisik**: Rak tertata rapi, batch expired aman s/d 2027\n• **Data Confidence Score**: 0.88 (Normal & Terverifikasi)\n• **Status Kunci PO**: Siap dirilis setelah audit tuntas.',
            tag: 'Warehouse Opname',
            confidence: 98.6,
        }),
    },
    {
        id: 'citra',
        name: 'Citra',
        role: 'Financial Strategist',
        location: 'Meja Rapat War Room',
        regex: /(alokasi|realokasi|anggaran|saving|hemat|kas(\s+)?toko|dana|modal|deadstock|hold|substitusi|monin|hazelnut|duit|keuangan|citra)/i,
        callingText: 'Saya hubungi **Citra** di Meja Meeting War Room untuk memverifikasi kalkulasi alokasi kas dan penyelamatan modal belanja...',
        callingTag: 'Calling Citra...',
        typingStatus: 'Rexa sedang menelepon Citra (Finance)...',
        generateReply: () => ({
            text: '📞 **Laporan Keuangan dari Citra (Finance Strategist):**\n\n> "Selamat pagi Manager! Dari sisi arus kas, penahanan PO SKU Sirup Hazelnut Gourmet terbukti sangat efektif. Kita berhasil **menyelamatkan kas lancar sebesar Rp 5.500.000**. Dana tersebut tidak mengendap sia-sia, melainkan telah saya realokasikan 100% untuk menambah modal restock **Kopi Arabika Specialty** yang memiliki perputaran 3.8x lebih cepat. Likuiditas kas toko kita minggu ini sangat sehat!"\n\n💼 **Rincian Realokasi Finansial Toko 74:**\n• **Modal Diselamatkan**: Rp 5.500.000 (dari hold deadstock)\n• **Target Alokasi**: Restock Kopi Arabika Specialty\n• **Proyeksi Margin Tambahan**: +Rp 1.450.000 dalam 14 hari operasional.',
            tag: 'Cash Optimization',
            confidence: 99.2,
        }),
    },
    {
        id: 'rian',
        name: 'Rian',
        role: 'Security & Guardrail Admin',
        location: 'Gerbang Server & Konsol',
        regex: /(guardrail|circuit(\s+)?breaker|keamanan|aman|limit|batas|50(\s+)?(juta|jt)|anomali|outlier|tripped|terputus|sentinel|rian)/i,
        callingText: 'Menghubungi konsol keamanan **Rian** di Gerbang Server untuk memeriksa integritas guardrail & circuit breaker...',
        callingTag: 'Calling Rian...',
        typingStatus: 'Rexa sedang menelepon Rian (Guardrail Admin)...',
        generateReply: () => ({
            text: '📞 **Laporan Keamanan Sistem dari Rian (Guardrail Admin):**\n\n> "Konsol Gerbang Kepatuhan online, Manager. Seluruh parameter keamanan pengadaan berstatus **HIJAU / NORMAL**. Tidak ada indikasi runaway agent dari AI. Total PO hari ini baru mencapai **Rp 13.678.880** dari kuota limit harian Rp 50.000.000. Circuit Breaker terkunci rapat dalam posisi operasional standar."\n\n🛡️ **Status Parameter Sentinel:**\n• **Circuit Breaker**: 🟢 **NORMAL / CLOSED** (Operasional Lancar)\n• **Batas PO Harian**: Rp 50.000.000 (Sisa Kuota Aman: Rp 36.321.120)\n• **Anomaly Outlier Detector**: 0 Transaksi di luar toleransi 3-sigma.',
            tag: 'Security Sentinel',
            confidence: 99.8,
        }),
    },
    {
        id: 'budi',
        name: 'Pak Budi',
        role: 'Store Operations Director',
        location: 'Layar Smart Screen Eksekutif',
        regex: /(health(\s+)?score|kesehatan|kpi|performa|kinerja|toko(\s+)?74|direktur|ringkasan|cabang|target|evaluasi|budi)/i,
        callingText: 'Menyambungkan interkom ke ruang presentasi **Pak Budi** untuk menarik ringkasan KPI eksekutif Toko 74...',
        callingTag: 'Calling Pak Budi...',
        typingStatus: 'Rexa sedang menelepon Pak Budi (Director)...',
        generateReply: () => ({
            text: '📞 **Evaluasi Eksekutif dari Pak Budi (Director):**\n\n> "Kerja bagus untuk tim Toko 74 hari ini, Manager! Berdasarkan dashboard pantauan saya di smart screen, **Overall Store Health Score kita berada di angka 91.0 / 100** (Predikat: Prima). Ketersediaan stok mencapai 94% dan perputaran barang 88%. Sinergi antara audit fisik gudang dan disiplin arus kas berjalan sangat solid!"\n\n📊 **Pilar Evaluasi Toko 74:**\n• **Ketersediaan Barang**: 94% (Hanya 2 SKU mendekati safety stock)\n• **Perputaran Stok**: 88% (Arus keluar-masuk barang stabil)\n• **Stabilitas Finansial**: 91% (Kas terhindar dari deadstock)\n• **Peringkat Regional**: Peringkat #2 Store Sehat se-Jabodetabek.',
            tag: 'Executive KPI',
            confidence: 98.4,
        }),
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
    const [internalOpen, setInternalOpen] = useState(false);
    const [currentTime, setCurrentTime] = useState('09:41');
    const [inputQuery, setInputQuery] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [typingStatus, setTypingStatus] = useState('Rexa sedang menganalisis data...');
    const [messages, setMessages] = useState([
        {
            id: 'init-1',
            sender: 'assistant',
            text: 'Halo Manager! Saya **Rexa** (AI Inventory & Cash Copilot).\n\nSaya memantau stok dan arus kas Toko 74 secara real-time. Anda bisa bertanya tentang sisa anggaran kas, status guardrail belanja, atau memeriksa kesehatan inventaris toko.',
            tag: 'System Ready',
            confidence: 99.8,
            timestamp: '09:40',
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

    // ── Logika Evaluasi Jawaban Cerdas Rexa ───────────────────────────────────
    const generateRexaReply = (query) => {
        const q = query.toLowerCase();

        if (q.includes('anggaran') || q.includes('kas') || q.includes('belanja') || q.includes('sisa')) {
            return {
                text: 'Berdasarkan monitor **Guardrail Rian**, batas pengadaan harian Toko 74 adalah **Rp 50.000.000**.\n\nHari ini telah diterbitkan PO senilai **Rp 13.678.880**, sehingga **sisa kuota belanja aman adalah Rp 36.321.120**.\n\nStatus Circuit Breaker: 🟢 **NORMAL** (Tidak ada anomali lonjakan transaksi).',
                tag: 'Guardrail Verified',
                confidence: 99.4,
            };
        }

        if (q.includes('guardrail') || q.includes('breaker') || q.includes('keamanan') || q.includes('rian')) {
            return {
                text: 'Status Sistem Pengaman (Security Sentinel):\n• **Circuit Breaker**: 🟢 **NORMAL / TERTUTUP** (Operasional lancar)\n• **Outlier Threshold**: 3-Sigma Batas Standar\n• **Data Confidence Minimum**: 0.85\n• **Batas PO Harian**: Rp 50.000.000\n\nSemua transaksi draf PO dievaluasi secara otomatis sebelum diteruskan ke Meja Manajer.',
                tag: 'Security Status',
                confidence: 99.1,
            };
        }

        if (q.includes('sirup') || q.includes('hazelnut') || q.includes('deadstock') || q.includes('hold')) {
            return {
                text: 'Reorder **SKU-002 (Sirup Hazelnut Gourmet)** berstatus **Hold Reorder** karena 3 faktor:\n1. **Permintaan Menurun**: Tren penjualan turun drastis (0.28x dari normal).\n2. **Korelasi Substitusi**: 84% pembeli beralih ke *Sirup Karamel Monin* tanpa batal beli.\n3. **Penyelamatan Modal**: Menghemat **Rp 5.500.000** yang langsung dialihkan ke *Kopi Arabika Specialty*.',
                tag: 'Suppression Engine',
                confidence: 97.8,
            };
        }

        if (q.includes('health') || q.includes('kesehatan') || q.includes('performa') || q.includes('skor') || q.includes('toko')) {
            return {
                text: 'Kondisi Kesehatan Inventaris **Toko 74 (Q4 2026)**:\n• **Ketersediaan**: 94% (Hanya 2 SKU mendekati reorder point)\n• **Perputaran Barang**: 88% (Arus keluar-masuk barang prima)\n• **Stabilitas Kas**: 91% (Kas terlindungi dari deadstock)\n\nOverall Store Health Score: 🟢 **91.0 / 100** (Kategori Prima).',
                tag: 'Executive KPI',
                confidence: 98.2,
            };
        }

        // Respon default cerdas
        return {
            text: `Halo Manager! Saya telah menerima pesan: *"${query}"*.\n\nSaya dapat memverifikasi status kas, menganalisis penahanan restock produk lambat, atau memeriksa metrik kesehatan operasional Toko 74. Silakan gunakan tombol pintas di atas atau tanyakan metrik spesifik!`,
            tag: 'Copilot Assistant',
            confidence: 95.0,
        };
    };

    // ── Kirim Pesan User & Pemicu Respons Rexa ─────────────────────────────────
    const handleSend = (overrideQuery) => {
        const textToSend = overrideQuery || inputQuery;
        if (!textToSend.trim() || isTyping) return;

        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const userMsg = {
            id: `usr-${Date.now()}`,
            sender: 'user',
            text: textToSend.trim(),
            timestamp: timeStr,
        };

        setMessages((prev) => [...prev, userMsg]);
        setInputQuery('');
        setIsTyping(true);

        const targetNPC = detectTargetNPC(textToSend);

        if (targetNPC) {
            // ── SISTEM INTERKOM 2-FASE (Rexa ↔ NPC Calling System) ────────────
            setTypingStatus(targetNPC.typingStatus);

            // Fase 1: Transisi Panggilan Rexa (delay 350ms)
            setTimeout(() => {
                const callTransitionMsg = {
                    id: `call-${Date.now()}`,
                    sender: 'assistant',
                    text: targetNPC.callingText,
                    tag: targetNPC.callingTag,
                    confidence: 99.0,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                };

                setMessages((prev) => [...prev, callTransitionMsg]);

                // Dispatch event panggilan interkom ke Phaser Canvas (3000ms dering)
                const intercomPayload = {
                    npcId: targetNPC.id,
                    caller: 'rexa',
                    duration: 3000,
                    topic: targetNPC.role,
                };
                window.dispatchEvent(new CustomEvent('npc-intercom-call', { detail: intercomPayload }));
                EventBus.emit('npc-intercom-call', intercomPayload);

                // Fase 2: Respons Balasan Persona Data NPC (setelah 3000ms durasi dering)
                setTimeout(() => {
                    const finalReply = targetNPC.generateReply(textToSend);
                    const assistantMsg = {
                        id: `ast-${Date.now()}`,
                        sender: 'assistant',
                        text: finalReply.text,
                        tag: finalReply.tag,
                        confidence: finalReply.confidence,
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    };

                    setMessages((prev) => [...prev, assistantMsg]);
                    setIsTyping(false);
                    setTypingStatus('Rexa sedang menganalisis data...');
                }, 3000);
            }, 350);
        } else {
            // ── Respons Standar Rexa (General / Non-Intercom) ──────────────────
            setTypingStatus('Rexa sedang menganalisis data...');
            setTimeout(() => {
                const reply = generateRexaReply(textToSend);
                const assistantMsg = {
                    id: `ast-${Date.now()}`,
                    sender: 'assistant',
                    text: reply.text,
                    tag: reply.tag,
                    confidence: reply.confidence,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                };

                setMessages((prev) => [...prev, assistantMsg]);
                setIsTyping(false);
            }, 650);
        }
    };

    // ── Bersihkan Riwayat Chat ────────────────────────────────────────────────
    const handleClearChat = () => {
        setMessages([
            {
                id: `reset-${Date.now()}`,
                sender: 'assistant',
                text: 'Riwayat percakapan telah dibersihkan. Ada informasi operasional Toko 74 lain yang ingin Anda analisis, Manager?',
                tag: 'System Ready',
                confidence: 99.8,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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
                        <div className="phone-subtitle">● Online • Toko 74</div>
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
                                        {line}
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
