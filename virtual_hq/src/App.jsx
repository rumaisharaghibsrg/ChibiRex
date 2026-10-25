/**
 * App.jsx — Virtual HQ (Rexa Office)
 *
 * Mengintegrasikan:
 *  - PhaserGame (Kanvas game 2D RPG)
 *  - EventBus (Jembatan komunikasi Phaser ↔ React)
 *  - ThoughtBubble (Visualisasi pemikiran AI Agent Rexa)
 *  - ApprovalModal (Meja Manajer: 1-Click PO Approval ke SAP S/4HANA)
 *  - Integrasi API REST ChibiRex (POST /agent-runs/mulai, GET /agent-runs/{id}, GET/POST /purchase-orders)
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { PhaserGame }   from './PhaserGame';
import { EventBus }     from './game/EventBus';
import { ThoughtBubble } from './components/ThoughtBubble';
import { ApprovalModal } from './components/ApprovalModal';
import { GlobalStatsTVModal } from './components/GlobalStatsTVModal';
import { SmartphoneChatModal } from './components/SmartphoneChatModal';
import { CrisisCommandModal } from './components/CrisisCommandModal';
import { NPCDialogModal } from './components/NPCDialogModal';
import { RegionalDashboardModal } from './components/RegionalDashboardModal';
import { TimeSimulationModal } from './components/TimeSimulationModal';
import { HelpControlsModal } from './components/HelpControlsModal';
import { useDeviceDetect } from './utils/useDeviceDetect';
import VirtualJoystick from './components/VirtualJoystick';
import SmartActionButton from './components/SmartActionButton';
import MobileRexaCallButton from './components/MobileRexaCallButton';
import MobileDrawerMenu from './components/MobileDrawerMenu';
import { useStore } from './context/StoreContext';
import { useTimeSimulation } from './context/TimeSimulationContext';
import { NPC_FALLBACK_REGISTRY, fetchWithTimeout, getNPCFallback } from './utils/NPCFallbackData';
import './game/StoreCrisisState';

const API_BASE = 'http://localhost:8000';

function App() {
    const phaserRef = useRef();
    const { isMobileScreen, isTouch, shouldShowMobileControls } = useDeviceDetect();
    const { currentStore, switchStore } = useStore();
    const { currentSimulatedDate, daysOffset, isWarping, formattedDate } = useTimeSimulation();
    const [currentScene, setCurrentScene] = useState('');
    const [playerPos, setPlayerPos]       = useState({ x: 0, y: 0 });
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    // ── Status Regional Command Center (80 Cabang DuckDB) ────────────────────
    const [isRegionalModalOpen, setIsRegionalModalOpen] = useState(false);

    // ── Status Time Simulation Modal (+1 Hari, +7 Hari, Reset) ───────────────
    const [isTimeModalOpen, setIsTimeModalOpen] = useState(false);

    // ── Status Help Controls Modal (Panduan Navigasi & Pintasan Keyboard) ────
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

    // ── Status Proximity & Posisi Layar Rexa ──────────────────────────────────
    const [rexaInRange, setRexaInRange]     = useState(false);
    const [rexaScreenPos, setRexaScreenPos] = useState({ x: 220, y: 150 });

    // ── Status Proximity & Posisi Layar Meja Manajer ──────────────────────────
    const [managerInRange, setManagerInRange]     = useState(false);
    const [managerScreenPos, setManagerScreenPos] = useState({ x: 780, y: 150 });
    const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);

    // ── Status Dual-State Smart TV (hidden / peek / inspect) ──────────────────
    const [tvMode, setTvMode] = useState('hidden'); // 'hidden' | 'peek' | 'inspect'
    const isNearTVRef         = useRef(false);
    const activeContextRef    = useRef('none');
    const activeNpcNearRef    = useRef(null);

    // ── Status Smartphone Chat Copilot (Handheld Intercom) ───────────────────
    const [isChatOpen, setIsChatOpen] = useState(false);

    // ── Status Emergency Crisis Hub Modal (Koordinator Doni) ──────────────────
    const [isCrisisModalOpen, setIsCrisisModalOpen] = useState(false);
    const [isCrisisActive, setIsCrisisActive]       = useState(false);

    // ── Status NPC Quick Dialog Modal (Graceful Degradation & Fallback) ───────
    const [isNpcModalOpen, setIsNpcModalOpen] = useState(false);
    const [activeNpcId, setActiveNpcId]       = useState('maya');
    const [npcDialogue, setNpcDialogue]       = useState('');
    const [npcMetrics, setNpcMetrics]         = useState([]);
    const [isNpcFallback, setIsNpcFallback]   = useState(false);
    const [isNpcLoading, setIsNpcLoading]     = useState(false);

    // ── Deteksi Apakah Ada Modal / Sheet yang Sedang Terbuka (Directive v5.3) ──
    const isAnyModalOpen = Boolean(
        isHelpModalOpen ||
        isRegionalModalOpen ||
        isTimeModalOpen ||
        isApprovalModalOpen ||
        isCrisisModalOpen ||
        isNpcModalOpen ||
        isChatOpen ||
        tvMode === 'inspect' ||
        isDrawerOpen
    );

    // ── Status Sesi AI Agent Rexa ─────────────────────────────────────────────
    const [agentRunning, setAgentRunning]   = useState(false);
    const [agentStatus, setAgentStatus]     = useState(''); // 'MEMULAI', 'BERJALAN', 'SELESAI', 'GAGAL'
    const [runId, setRunId]                 = useState(null);
    const [currentStep, setCurrentStep]     = useState(null);
    const [stepCount, setStepCount]         = useState(0);
    const [summary, setSummary]             = useState('');
    const [errorMessage, setErrorMessage]   = useState('');
    const [countdown, setCountdown]         = useState(5);
    const [isRexaFallback, setIsRexaFallback] = useState(false);

    const pollingTimerRef   = useRef(null);
    const countdownTimerRef = useRef(null);

    // ── Bersihkan Timer saat Unmount ──────────────────────────────────────────
    const clearAllTimers = useCallback(() => {
        if (pollingTimerRef.current) {
            clearInterval(pollingTimerRef.current);
            pollingTimerRef.current = null;
        }
        if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
        }
    }, []);

    // ── Hitung Mundur 5 Detik Sebelum Menutup Bubble & Unfreeze Player ─────────
    const startCloseCountdown = useCallback(() => {
        let count = 5;
        setCountdown(count);

        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

        countdownTimerRef.current = setInterval(() => {
            count -= 1;
            setCountdown(count);

            if (count <= 0) {
                clearInterval(countdownTimerRef.current);
                countdownTimerRef.current = null;

                // Tutup thought bubble dan kembalikan kontrol gerak ke pemain!
                setAgentRunning(false);
                setAgentStatus('');
                EventBus.emit('unfreeze-player');
            }
        }, 1000);
    }, []);

    // ── Mulai Polling Status Agen Setiap 2000ms ───────────────────────────────
    const startPolling = useCallback((activeRunId) => {
        if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);

        pollingTimerRef.current = setInterval(async () => {
            try {
                const res = await fetch(`${API_BASE}/agent-runs/${activeRunId}`);
                if (!res.ok) return;

                const data = await res.json();
                const steps = data.langkah || [];
                const latestStep = steps.length > 0 ? steps[steps.length - 1] : null;

                setStepCount(steps.length);
                setCurrentStep(latestStep);
                setAgentStatus(data.status || 'BERJALAN');

                // Jika status sudah "SELESAI"
                if (data.status === 'SELESAI') {
                    if (pollingTimerRef.current) {
                        clearInterval(pollingTimerRef.current);
                        pollingTimerRef.current = null;
                    }
                    setSummary(data.jawaban || 'Tinjauan toko selesai. Draf PO siap ditinjau manajer.');
                    startCloseCountdown();
                }

                // Jika status "GAGAL"
                else if (data.status === 'GAGAL') {
                    if (pollingTimerRef.current) {
                        clearInterval(pollingTimerRef.current);
                        pollingTimerRef.current = null;
                    }
                    console.warn('[VirtualHQ] Status agen GAGAL. Mengaktifkan silent fallback Rexa.');
                    setAgentStatus('SELESAI');
                    setSummary(NPC_FALLBACK_REGISTRY.rexa.sentence);
                    setIsRexaFallback(true);
                    setErrorMessage('');
                    startCloseCountdown();
                }
            } catch (err) {
                console.warn('[VirtualHQ] Polling error. Mengaktifkan silent fallback Rexa:', err);
                if (pollingTimerRef.current) {
                    clearInterval(pollingTimerRef.current);
                    pollingTimerRef.current = null;
                }
                setAgentStatus('SELESAI');
                setSummary(NPC_FALLBACK_REGISTRY.rexa.sentence);
                setIsRexaFallback(true);
                setErrorMessage('');
                startCloseCountdown();
            }
        }, 2000);
    }, [startCloseCountdown]);

    // ── Eksekusi Pemanggilan API saat Tombol 'E' Ditekan di Rexa ──────────────
    const handleTriggerAgent = useCallback(async ({ store } = {}) => {
        if (agentRunning || isApprovalModalOpen) return; // Cegah pemanggilan ganda

        const activeStoreId = parseInt(store || currentStore?.id || 74, 10);
        const activeStoreCity = currentStore?.city || 'PAENTMARWY';

        // 1. Bekukan gerakan pemain
        EventBus.emit('freeze-player');

        // 2. Inisialisasi tampilan ThoughtBubble
        clearAllTimers();
        setAgentRunning(true);
        setAgentStatus('MEMULAI');
        setCurrentStep(null);
        setStepCount(0);
        setSummary('');
        setErrorMessage('');
        setCountdown(5);
        setIsRexaFallback(false);

        try {
            // 3. POST ke http://localhost:8000/agent-runs/mulai dengan timeout 3000ms
            const res = await fetchWithTimeout(
                `${API_BASE}/agent-runs/mulai`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ store: activeStoreId }),
                },
                3000
            );

            if (!res.success || res.isFallback || !res.data) {
                throw new Error(res.error || 'Tidak dapat terhubung ke Backend API (port 8000).');
            }

            const data = res.data;
            const newRunId = data.run_id;

            setRunId(newRunId);
            setAgentStatus(data.status || 'BERJALAN');

            // 4. Jalankan interval polling setiap 2000ms
            startPolling(newRunId);
        } catch (err) {
            console.warn('[VirtualHQ] Backend offline/timeout saat memicu agen Rexa. Mengaktifkan silent fallback:', err);
            const fallbackData = getNPCFallback('rexa', activeStoreId, activeStoreCity);
            setAgentStatus('SELESAI');
            setSummary(fallbackData.sentence);
            setIsRexaFallback(true);
            setErrorMessage('');
            startCloseCountdown();
        }
    }, [agentRunning, isApprovalModalOpen, clearAllTimers, startPolling, startCloseCountdown, currentStore]);

    // ── Buka Modal Approval saat Tombol 'E' Ditekan di Meja Manajer ───────────
    const handleOpenApprovalModal = useCallback(() => {
        if (agentRunning) return;
        EventBus.emit('freeze-player');
        setIsApprovalModalOpen(true);
    }, [agentRunning]);

    // ── Tutup Modal Approval & Kembalikan Kontrol Gerak Karakter ──────────────
    const handleCloseApprovalModal = useCallback(() => {
        setIsApprovalModalOpen(false);
        EventBus.emit('unfreeze-player');
    }, []);

    // ── Proximity Smart TV: Memicu State Peek (1/8 Layar) tanpa freeze ────────
    const handleTVProximity = useCallback((data) => {
        const active = data?.active ?? data?.detail?.active ?? false;
        isNearTVRef.current = active;
        setTvMode((prev) => {
            if (prev === 'inspect') return prev; // Tetap buka inspect jika user sedang melihat detail
            return active ? 'peek' : 'hidden';
        });
    }, []);

    // ── Buka State Inspect (1/4 Layar Sidebar): Membekukan pergerakan player ──
    const handleOpenTVInspect = useCallback(() => {
        if (agentRunning) return;
        EventBus.emit('freeze-player');
        setTvMode('inspect');
    }, [agentRunning]);

    // ── Tutup State Inspect: Kembalikan gerak pemain & switch ke peek/hidden ────
    const handleCloseTV = useCallback(() => {
        EventBus.emit('unfreeze-player');
        setTvMode(isNearTVRef.current ? 'peek' : 'hidden');
    }, []);

    // ── Kontrol Buka/Tutup Smartphone Chat (Hotkey C & Trigger UI) ────────────
    const lastToggleChatRef = useRef(0);
    const handleToggleChat = useCallback(() => {
        const now = Date.now();
        if (now - lastToggleChatRef.current < 200) return;
        lastToggleChatRef.current = now;
        setIsChatOpen((prev) => !prev);
    }, []);

    const handleOpenChat = useCallback(() => {
        setIsChatOpen(true);
    }, []);

    const handleCloseChat = useCallback(() => {
        setIsChatOpen(false);
    }, []);

    // ── Kontrol Buka/Tutup Emergency Crisis Hub Modal (Doni) ──────────────────
    const handleOpenCrisisModal = useCallback(() => {
        EventBus.emit('freeze-player');
        setIsCrisisModalOpen(true);
    }, []);

    const handleCloseCrisisModal = useCallback(() => {
        setIsCrisisModalOpen(false);
        EventBus.emit('unfreeze-player');
    }, []);

    // ── Kontrol Buka/Tutup Regional Command Center (80 Cabang) ────────────────
    const handleOpenRegionalModal = useCallback(() => {
        if (agentRunning || isWarping) return;
        EventBus.emit('freeze-player');
        setIsRegionalModalOpen(true);
    }, [agentRunning, isWarping]);

    const handleCloseRegionalModal = useCallback(() => {
        setIsRegionalModalOpen(false);
        EventBus.emit('unfreeze-player');
        window.dispatchEvent(new CustomEvent('unfreeze-player'));
    }, []);

    // ── Kontrol Buka/Tutup Time Simulation Modal (+1 Hari, +7 Hari, Reset) ───
    const handleOpenTimeModal = useCallback(() => {
        if (agentRunning || isWarping) return;
        EventBus.emit('freeze-player');
        setIsTimeModalOpen(true);
    }, [agentRunning, isWarping]);

    const handleCloseTimeModal = useCallback(() => {
        setIsTimeModalOpen(false);
        if (!isWarping) {
            EventBus.emit('unfreeze-player');
            window.dispatchEvent(new CustomEvent('unfreeze-player'));
        }
    }, [isWarping]);

    // ── Kontrol Buka/Tutup Help Controls Modal (Panduan Navigasi & Pintasan) ──
    const handleOpenHelpModal = useCallback(() => {
        if (agentRunning || isWarping) return;
        EventBus.emit('freeze-player');
        setIsHelpModalOpen(true);
    }, [agentRunning, isWarping]);

    const handleCloseHelpModal = useCallback(() => {
        setIsHelpModalOpen(false);
        EventBus.emit('unfreeze-player');
        window.dispatchEvent(new CustomEvent('unfreeze-player'));
    }, []);

    const handleToggleHelpModal = useCallback(() => {
        setIsHelpModalOpen((prev) => {
            if (prev) {
                EventBus.emit('unfreeze-player');
                window.dispatchEvent(new CustomEvent('unfreeze-player'));
                return false;
            } else {
                if (agentRunning || isWarping) return false;
                EventBus.emit('freeze-player');
                return true;
            }
        });
    }, [agentRunning, isWarping]);

    // ── Kontrol Buka/Tutup NPC Quick Dialog Modal (Graceful Fallback) ─────────
    const handleCloseNpcModal = useCallback(() => {
        setIsNpcModalOpen(false);
        EventBus.emit('unfreeze-player');
        window.dispatchEvent(new CustomEvent('unfreeze-player'));
    }, []);

    const handleOpenNpcModal = useCallback(async (payload) => {
        const id = (payload?.npcId || payload?.npc || 'maya').toLowerCase();
        setActiveNpcId(id);
        setIsNpcModalOpen(true);
        setIsNpcLoading(true);
        EventBus.emit('freeze-player');

        const storeId = currentStore?.id || 74;
        const storeCity = currentStore?.city || 'PAENTMARWY';
        const fallbackConfig = getNPCFallback(id, storeId, storeCity, daysOffset);

        try {
            const endpoint = `${API_BASE}${fallbackConfig.endpoint}`;
            const res = await fetchWithTimeout(endpoint, {}, 2500);

            if (res.success && !res.isFallback && res.data) {
                setIsNpcFallback(false);

                if (id === 'maya') {
                    const selisihList = Array.isArray(res.data) ? res.data : (res.data.data || []);
                    const countSelisih = selisihList.length;
                    setNpcDialogue(
                        countSelisih > 0
                            ? `Halo Manager! Dari hasil opname fisik gudang Toko ${storeId} (${storeCity}) per ${formattedDate}, terdapat ${countSelisih} SKU dengan selisih stok fisik vs sistem yang memerlukan verifikasi lebih lanjut.`
                            : fallbackConfig.sentence
                    );
                    setNpcMetrics([
                        { label: 'Status Opname', value: countSelisih === 0 ? 'Terverifikasi (FIFO)' : `${countSelisih} Perlu Verifikasi`, color: countSelisih === 0 ? '#4ade80' : '#fbbf24' },
                        { label: 'Data Confidence', value: countSelisih === 0 ? '0.94 / 1.00' : '0.86 / 1.00', color: '#38bdf8' },
                        { label: 'Selisih Kritis', value: `${countSelisih} SKU`, color: countSelisih === 0 ? '#4ade80' : '#f87171' },
                        { label: 'Status Kunci PO', value: countSelisih === 0 ? 'Terbuka (Aman)' : 'Terkunci Sementara', color: countSelisih === 0 ? '#4ade80' : '#fbbf24' },
                    ]);
                } else if (id === 'citra') {
                    const savedCash = res.data.total_saved_cash || res.data.kas_diselamatkan || 'Rp 18.500.000';
                    setNpcDialogue(
                        `Selamat siang, Manager! Saya baru saja meninjau neraca belanja Toko ${storeId} (${storeCity}) per ${formattedDate}. Likuiditas kas berada dalam batas aman. Alokasi belanja terkendali dan modal operasional terhindar dari deadstock produk lambat.`
                    );
                    setNpcMetrics([
                        { label: 'Kas Diselamatkan', value: typeof savedCash === 'number' ? `Rp ${savedCash.toLocaleString('id-ID')}` : String(savedCash), color: '#4ade80' },
                        { label: 'Exploratory Budget', value: '10% (Aktif)', color: '#fbbf24' },
                        { label: 'Rasio Likuiditas', value: '1.42 (Sehat)', color: '#38bdf8' },
                        { label: 'Deadstock Terkunci', value: 'Rp 0 (Terkendali)', color: '#4ade80' },
                    ]);
                } else if (id === 'rian') {
                    const isTripped = Boolean(res.data.circuit_breaker_tripped);
                    setNpcDialogue(
                        isTripped
                            ? `Peringatan Manager! Terdeteksi anomali pada sistem Toko ${storeId} per ${formattedDate}. Circuit Breaker dalam kondisi TRIPPED dan membekukan sementara gateway penerbitan PO ke SAP S/4HANA.`
                            : fallbackConfig.sentence
                    );
                    setNpcMetrics([
                        { label: 'Circuit Breaker', value: isTripped ? 'TRIPPED (BAHAYA)' : 'NORMAL (TERTUTUP)', color: isTripped ? '#ef4444' : '#4ade80' },
                        { label: 'Batas PO Harian', value: 'Rp 50.000.000', color: '#38bdf8' },
                        { label: 'Sisa Kuota Belanja', value: 'Rp 36.321.120', color: '#4ade80' },
                        { label: 'Anomali 3-Sigma', value: isTripped ? 'Terdeteksi' : '0 Terdeteksi', color: isTripped ? '#ef4444' : '#4ade80' },
                    ]);
                } else if (id === 'budi') {
                    const score = res.data.health_score || res.data.overall_score || 92.4;
                    setNpcDialogue(
                        `Kerja bagus untuk seluruh tim toko hari ini, Manager! Evaluasi operasional harian Toko ${storeId} (${storeCity}) per ${formattedDate} menunjukkan tren yang sangat memuaskan. Store Health Score kita berada di zona prima dan seluruh divisi bekerja selaras.`
                    );
                    setNpcMetrics([
                        { label: 'Store Health Score', value: `${score} / 100`, color: '#4ade80' },
                        { label: 'Ketersediaan Rak', value: '95%', color: '#38bdf8' },
                        { label: 'Perputaran Stok', value: '89%', color: '#38bdf8' },
                        { label: 'Peringkat Regional', value: '#2 Jabodetabek', color: '#fbbf24' },
                    ]);
                } else {
                    setNpcDialogue(fallbackConfig.sentence);
                    setNpcMetrics(fallbackConfig.metrics);
                }
            } else {
                setIsNpcFallback(true);
                setNpcDialogue(fallbackConfig.sentence);
                setNpcMetrics(fallbackConfig.metrics);
            }
        } catch (err) {
            console.warn(`[App] Silent fallback dialog untuk ${id}:`, err);
            setIsNpcFallback(true);
            setNpcDialogue(fallbackConfig.sentence);
            setNpcMetrics(fallbackConfig.metrics);
        } finally {
            setIsNpcLoading(false);
        }
    }, [currentStore, agentRunning, isWarping, daysOffset, formattedDate]);

    // ── Universal Proximity Interaction Handler (Directive v5.6) ─────────────
    // Dipanggil serentak oleh Keyboard Desktop ('E') dan Smart Action Button Mobile
    const triggerProximityAction = useCallback((eventOrPayload) => {
        // 1. Validasi target event: jika sedang mengetik di input/textarea, abaikan
        if (eventOrPayload?.target) {
            const tag = eventOrPayload.target.tagName?.toLowerCase();
            if (tag === 'input' || tag === 'textarea' || eventOrPayload.target.isContentEditable) return;
        }

        // 2. Jika ada modal yang sedang terbuka, tuts 'E' bertindak sebagai Universal Toggle untuk menutupnya
        if (isAnyModalOpen) {
            if (isNpcModalOpen) handleCloseNpcModal();
            else if (isApprovalModalOpen) handleCloseApprovalModal();
            else if (isCrisisModalOpen) handleCloseCrisisModal();
            else if (tvMode === 'inspect') handleCloseTV();
            else if (isHelpModalOpen) handleCloseHelpModal();
            else if (isTimeModalOpen) handleCloseTimeModal();
            else if (isRegionalModalOpen) handleCloseRegionalModal();
            return;
        }

        // 3. Ekstrak payload dari tombol mobile jika tersedia
        const payload = (eventOrPayload && !eventOrPayload.key) ? (eventOrPayload.detail || eventOrPayload) : null;
        let targetNpc = payload?.npcId || (['maya', 'citra', 'rian', 'budi'].includes(payload?.context) ? payload.context : null);
        let targetContext = payload?.context || null;

        // 4. Jika payload tidak spesifik, gunakan cache proximity terkini di React
        if (!targetNpc) {
            targetNpc = activeNpcNearRef.current;
        }
        if (!targetContext) {
            targetContext = activeContextRef.current;
        }

        // 5. Fallback ke state Phaser scene secara langsung (Zero Lag)
        const scene = phaserRef.current?.scene;
        if (!targetNpc && scene) {
            if (scene.isNearRian) targetNpc = 'rian';
            else if (scene.isNearMaya) targetNpc = 'maya';
            else if (scene.isNearCitra) targetNpc = 'citra';
            else if (scene.isNearBudi) targetNpc = 'budi';
        }
        if (!targetContext && scene) {
            if (scene.isNearManager) targetContext = 'manager';
            else if (scene.isNearRexa) targetContext = 'rexa';
            else if (scene.isNearTV) targetContext = 'tv';
            else if (scene.isNearDoni) targetContext = 'doni';
        }

        // 6. Eksekusi Pembukaan Modal Sesuai Target Terdeteksi
        if (targetNpc) {
            // Langsung buka modal NPC di React (Rian, Maya, Citra, Budi)
            handleOpenNpcModal({ npcId: targetNpc });
            if (scene && typeof scene._handlePlayerInteraction === 'function') {
                scene._handlePlayerInteraction({ npcId: targetNpc });
            }
            return;
        }

        if (targetContext === 'manager' || managerInRange || scene?.isNearManager) {
            handleOpenApprovalModal();
            return;
        }

        if (targetContext === 'rexa' || rexaInRange || scene?.isNearRexa) {
            handleTriggerAgent();
            return;
        }

        if (targetContext === 'tv' || tvMode === 'peek' || scene?.isNearTV) {
            handleOpenTVInspect();
            return;
        }

        if (targetContext === 'doni' || scene?.isNearDoni) {
            handleOpenCrisisModal();
            return;
        }

        // 7. Jika di luar objek khusus, delegasikan ke Phaser (seduh kopi, duduk di kursi)
        if (scene && typeof scene._handlePlayerInteraction === 'function') {
            scene._handlePlayerInteraction();
        }
    }, [
        isAnyModalOpen,
        isNpcModalOpen,
        isApprovalModalOpen,
        isCrisisModalOpen,
        tvMode,
        isHelpModalOpen,
        isTimeModalOpen,
        isRegionalModalOpen,
        managerInRange,
        rexaInRange,
        handleOpenNpcModal,
        handleCloseNpcModal,
        handleOpenApprovalModal,
        handleCloseApprovalModal,
        handleCloseCrisisModal,
        handleCloseTV,
        handleCloseHelpModal,
        handleCloseTimeModal,
        handleCloseRegionalModal,
        handleTriggerAgent,
        handleOpenTVInspect,
        handleOpenCrisisModal,
    ]);

    // ── Global Hotkey C, X (Help), & E (Interaksi) Listener di Window (Directive v4.9 & v5.6) ────────
    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            const target = e.target;
            const tag = target?.tagName?.toLowerCase();
            if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;

            if (e.key === 'c' || e.key === 'C') {
                handleToggleChat();
            } else if (e.key.toLowerCase() === 'x' || e.key === 'h' || e.key === 'H' || e.key === '?') {
                e.preventDefault();
                handleToggleHelpModal();
            } else if (e.key.toLowerCase() === 'e') {
                e.preventDefault();
                triggerProximityAction(e);
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [handleToggleChat, handleToggleHelpModal, triggerProximityAction]);

    // ── Setup Event Listeners dari Phaser & Window ────────────────────────────
    useEffect(() => {
        const onSceneReady = (scene) => setCurrentScene(scene.scene.key);
        const onPlayerMoved = (pos) => setPlayerPos(pos);
        const onRexaProximity = ({ inRange }) => setRexaInRange(inRange);
        const onRexaScreenPos = (pos) => setRexaScreenPos(pos);
        const onManagerProximity = ({ inRange }) => setManagerInRange(inRange);
        const onManagerScreenPos = (pos) => setManagerScreenPos(pos);

        EventBus.on('current-scene-ready', onSceneReady);
        EventBus.on('player-moved', onPlayerMoved);
        EventBus.on('rexa-proximity', onRexaProximity);
        EventBus.on('rexa-screen-pos', onRexaScreenPos);
        EventBus.on('manager-proximity', onManagerProximity);
        EventBus.on('manager-screen-pos', onManagerScreenPos);
        EventBus.on('trigger-agent-analysis', handleTriggerAgent);
        EventBus.on('open-approval-modal', handleOpenApprovalModal);
        window.addEventListener('open-approval-modal', handleOpenApprovalModal);

        // Smart TV Listeners (EventBus & Window CustomEvent)
        EventBus.on('global-tv-proximity', handleTVProximity);
        window.addEventListener('global-tv-proximity', handleTVProximity);
        EventBus.on('open-global-tv-modal', handleOpenTVInspect);
        window.addEventListener('open-global-tv-modal', handleOpenTVInspect);

        // Smartphone Chat Listeners (EventBus & Window CustomEvent)
        EventBus.on('toggle-smartphone-chat', handleToggleChat);
        window.addEventListener('toggle-smartphone-chat', handleToggleChat);
        EventBus.on('open-smartphone-chat', handleOpenChat);
        window.addEventListener('open-smartphone-chat', handleOpenChat);
        EventBus.on('close-smartphone-chat', handleCloseChat);
        window.addEventListener('close-smartphone-chat', handleCloseChat);

        // Emergency Crisis Hub Listeners (Doni)
        const onCrisisTriggered = () => setIsCrisisActive(true);
        const onCrisisResolved = () => setIsCrisisActive(false);

        EventBus.on('open-crisis-hub-modal', handleOpenCrisisModal);
        window.addEventListener('open-crisis-hub-modal', handleOpenCrisisModal);
        EventBus.on('store-crisis-triggered', onCrisisTriggered);
        window.addEventListener('store-crisis-triggered', onCrisisTriggered);
        EventBus.on('store-crisis-resolved', onCrisisResolved);
        window.addEventListener('store-crisis-resolved', onCrisisResolved);

        // NPC Quick Dialog Listeners (Maya, Citra, Rian, Pak Budi)
        const handleOpenStockModal = () => handleOpenNpcModal({ npcId: 'maya' });
        const handleOpenReallocModal = () => handleOpenNpcModal({ npcId: 'citra' });
        const handleOpenGuardrailModal = () => handleOpenNpcModal({ npcId: 'rian' });
        const handleOpenIntelModal = () => handleOpenNpcModal({ npcId: 'budi' });

        const onOpenNpcDialog = (data) => {
            const payload = data?.detail || data;
            handleOpenNpcModal(payload);
        };

        EventBus.on('open-stock-modal', handleOpenStockModal);
        EventBus.on('open-reallocation-modal', handleOpenReallocModal);
        EventBus.on('open-guardrail-modal', handleOpenGuardrailModal);
        EventBus.on('open-intelligence-modal', handleOpenIntelModal);
        EventBus.on('open-npc-dialog-modal', onOpenNpcDialog);
        window.addEventListener('open-npc-dialog-modal', onOpenNpcDialog);

        // Proximity Cache Listeners untuk React (Directive v5.6)
        const onSmartActionContext = (data) => {
            const payload = data?.detail || data;
            const type = payload?.type || 'none';
            activeContextRef.current = type;
            if (['maya', 'citra', 'rian', 'budi'].includes(type)) {
                activeNpcNearRef.current = type;
            } else if (!payload?.isActive) {
                if (activeNpcNearRef.current === type) {
                    activeNpcNearRef.current = null;
                }
            }
        };

        const onMayaProx = ({ inRange }) => {
            if (inRange) activeNpcNearRef.current = 'maya';
            else if (activeNpcNearRef.current === 'maya') activeNpcNearRef.current = null;
        };
        const onCitraProx = ({ inRange }) => {
            if (inRange) activeNpcNearRef.current = 'citra';
            else if (activeNpcNearRef.current === 'citra') activeNpcNearRef.current = null;
        };
        const onRianProx = ({ inRange }) => {
            if (inRange) activeNpcNearRef.current = 'rian';
            else if (activeNpcNearRef.current === 'rian') activeNpcNearRef.current = null;
        };
        const onBudiProx = ({ inRange }) => {
            if (inRange) activeNpcNearRef.current = 'budi';
            else if (activeNpcNearRef.current === 'budi') activeNpcNearRef.current = null;
        };

        EventBus.on('smart-action-context-changed', onSmartActionContext);
        window.addEventListener('smart-action-context-changed', onSmartActionContext);
        EventBus.on('maya-proximity', onMayaProx);
        EventBus.on('citra-proximity', onCitraProx);
        EventBus.on('rian-proximity', onRianProx);
        EventBus.on('budi-proximity', onBudiProx);

        // Universal Interaction Listener untuk Mobile & EventBus (Directive v5.6)
        EventBus.on('mobile-action-pressed', triggerProximityAction);
        EventBus.on('action-button-pressed', triggerProximityAction);
        EventBus.on('trigger-smart-action', triggerProximityAction);
        window.addEventListener('mobile-action-pressed', triggerProximityAction);
        window.addEventListener('action-button-pressed', triggerProximityAction);
        window.addEventListener('trigger-smart-action', triggerProximityAction);

        // Regional Command Center Listeners (80 Cabang DuckDB)
        EventBus.on('open-regional-dashboard', handleOpenRegionalModal);
        window.addEventListener('open-regional-dashboard', handleOpenRegionalModal);

        // Time Simulation Modal Listeners (+1 Hari, +7 Hari, Reset)
        EventBus.on('open-time-simulation-modal', handleOpenTimeModal);
        window.addEventListener('open-time-simulation-modal', handleOpenTimeModal);

        // Timeline Shift Completion Handler (Release lock & unfreeze player fail-safe)
        const onTimelineShiftCompleted = () => {
            setIsTimeModalOpen(false);
            EventBus.emit('unfreeze-player');
            window.dispatchEvent(new CustomEvent('unfreeze-player'));
        };
        EventBus.on('timeline-shift-completed', onTimelineShiftCompleted);
        window.addEventListener('timeline-shift-completed', onTimelineShiftCompleted);

        return () => {
            EventBus.removeListener('current-scene-ready', onSceneReady);
            EventBus.removeListener('player-moved', onPlayerMoved);
            EventBus.removeListener('rexa-proximity', onRexaProximity);
            EventBus.removeListener('rexa-screen-pos', onRexaScreenPos);
            EventBus.removeListener('manager-proximity', onManagerProximity);
            EventBus.removeListener('manager-screen-pos', onManagerScreenPos);
            EventBus.removeListener('trigger-agent-analysis', handleTriggerAgent);
            EventBus.removeListener('open-approval-modal', handleOpenApprovalModal);
            window.removeEventListener('open-approval-modal', handleOpenApprovalModal);

            EventBus.removeListener('global-tv-proximity', handleTVProximity);
            window.removeEventListener('global-tv-proximity', handleTVProximity);
            EventBus.removeListener('open-global-tv-modal', handleOpenTVInspect);
            window.removeEventListener('open-global-tv-modal', handleOpenTVInspect);

            EventBus.removeListener('open-regional-dashboard', handleOpenRegionalModal);
            window.removeEventListener('open-regional-dashboard', handleOpenRegionalModal);

            EventBus.removeListener('open-time-simulation-modal', handleOpenTimeModal);
            window.removeEventListener('open-time-simulation-modal', handleOpenTimeModal);
            EventBus.removeListener('timeline-shift-completed', onTimelineShiftCompleted);
            window.removeEventListener('timeline-shift-completed', onTimelineShiftCompleted);

            EventBus.removeListener('toggle-smartphone-chat', handleToggleChat);
            window.removeEventListener('toggle-smartphone-chat', handleToggleChat);
            EventBus.removeListener('open-smartphone-chat', handleOpenChat);
            window.removeEventListener('open-smartphone-chat', handleOpenChat);
            EventBus.removeListener('close-smartphone-chat', handleCloseChat);
            window.removeEventListener('close-smartphone-chat', handleCloseChat);

            EventBus.removeListener('open-crisis-hub-modal', handleOpenCrisisModal);
            window.removeEventListener('open-crisis-hub-modal', handleOpenCrisisModal);
            EventBus.removeListener('store-crisis-triggered', onCrisisTriggered);
            window.removeEventListener('store-crisis-triggered', onCrisisTriggered);
            EventBus.removeListener('store-crisis-resolved', onCrisisResolved);
            window.removeEventListener('store-crisis-resolved', onCrisisResolved);

            EventBus.removeListener('open-stock-modal', handleOpenStockModal);
            EventBus.removeListener('open-reallocation-modal', handleOpenReallocModal);
            EventBus.removeListener('open-guardrail-modal', handleOpenGuardrailModal);
            EventBus.removeListener('open-intelligence-modal', handleOpenIntelModal);
            EventBus.removeListener('open-npc-dialog-modal', onOpenNpcDialog);
            window.removeEventListener('open-npc-dialog-modal', onOpenNpcDialog);
            EventBus.removeListener('smart-action-context-changed', onSmartActionContext);
            window.removeEventListener('smart-action-context-changed', onSmartActionContext);
            EventBus.removeListener('maya-proximity', onMayaProx);
            EventBus.removeListener('citra-proximity', onCitraProx);
            EventBus.removeListener('rian-proximity', onRianProx);
            EventBus.removeListener('budi-proximity', onBudiProx);

            EventBus.removeListener('mobile-action-pressed', triggerProximityAction);
            EventBus.removeListener('action-button-pressed', triggerProximityAction);
            EventBus.removeListener('trigger-smart-action', triggerProximityAction);
            window.removeEventListener('mobile-action-pressed', triggerProximityAction);
            window.removeEventListener('action-button-pressed', triggerProximityAction);
            window.removeEventListener('trigger-smart-action', triggerProximityAction);
            clearAllTimers();
        };
    }, [handleTriggerAgent, handleOpenApprovalModal, handleTVProximity, handleOpenTVInspect, handleToggleChat, handleOpenChat, handleCloseChat, handleOpenCrisisModal, handleOpenRegionalModal, handleOpenTimeModal, handleOpenNpcModal, clearAllTimers, triggerProximityAction]);

    return (
        <div
            id="app"
            style={{
                position: 'fixed',
                inset: 0,
                width: '100vw',
                height: '100vh',
                overflow: 'hidden',
                background: 'radial-gradient(circle at 50% 15%, #151828 0%, #080911 100%)',
                userSelect: 'none',
            }}
        >
            {/* Header Status Bar — Cyberpunk Floating Absolute Command Header */}
            <header
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: isMobileScreen ? '50px' : '56px',
                    padding: isMobileScreen ? '0 12px' : '0 24px',
                    background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.85) 0%, rgba(15, 23, 42, 0.45) 85%, rgba(15, 23, 42, 0) 100%)',
                    backdropFilter: 'blur(16px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
                    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.25)',
                    zIndex: 50,
                }}
            >
                {isMobileScreen ? (
                    /* ── Diet Header (Mobile Mode < 768px) ── */
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        {/* Left: Compact Store Badge */}
                        <div
                            onClick={handleOpenRegionalModal}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                cursor: 'pointer',
                            }}
                            title="Klik untuk membuka Regional Command Center"
                        >
                            <div
                                style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '8px',
                                    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(99, 102, 241, 0.2) 100%)',
                                    border: '1px solid rgba(245, 158, 11, 0.4)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '18px',
                                }}
                            >
                                🦖
                            </div>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{
                                        fontFamily: 'monospace',
                                        fontWeight: '900',
                                        fontSize: '13px',
                                        background: 'linear-gradient(90deg, #38bdf8 0%, #818cf8 100%)',
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                    }}>
                                        CHIBIREX
                                    </span>
                                    <span style={{
                                        fontSize: '10px',
                                        backgroundColor: 'rgba(16, 185, 129, 0.15)',
                                        color: '#34d399',
                                        padding: '1px 6px',
                                        borderRadius: '4px',
                                        border: '1px solid rgba(16, 185, 129, 0.4)',
                                        fontWeight: '700',
                                        fontFamily: 'monospace',
                                    }}>
                                        #{currentStore?.id || 74}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Right: Date Capsule + Hamburger Menu Button */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {/* Temporal Simulation Widget Capsule */}
                            <div
                                onClick={handleOpenTimeModal}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '3px 8px',
                                    borderRadius: '9999px',
                                    background: daysOffset > 0 ? 'rgba(245, 158, 11, 0.22)' : 'rgba(30, 41, 59, 0.85)',
                                    border: daysOffset > 0 ? '1px solid rgba(245, 158, 11, 0.6)' : '1px solid rgba(148, 163, 184, 0.3)',
                                    color: daysOffset > 0 ? '#fbbf24' : '#e2e8f0',
                                    fontSize: '11px',
                                    fontFamily: 'monospace',
                                    fontWeight: '700',
                                    cursor: isWarping ? 'not-allowed' : 'pointer',
                                }}
                                title="Simulasi Waktu"
                            >
                                <span style={{ fontSize: '12px' }}>📅</span>
                                <span>{formattedDate}</span>
                                {daysOffset > 0 && (
                                    <span style={{
                                        fontSize: '9px',
                                        padding: '1px 4px',
                                        borderRadius: '3px',
                                        backgroundColor: 'rgba(245, 158, 11, 0.35)',
                                        color: '#fbbf24',
                                    }}>
                                        +{daysOffset}H
                                    </span>
                                )}
                            </div>

                            {/* Hamburger Button */}
                            <button
                                type="button"
                                onClick={() => setIsDrawerOpen(true)}
                                style={{
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '8px',
                                    background: isCrisisActive ? 'rgba(239, 68, 68, 0.25)' : 'rgba(30, 41, 59, 0.85)',
                                    border: isCrisisActive ? '1px solid #ef4444' : '1px solid rgba(148, 163, 184, 0.3)',
                                    color: isCrisisActive ? '#ef4444' : '#f8fafc',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '18px',
                                    cursor: 'pointer',
                                    position: 'relative',
                                }}
                                aria-label="Buka Menu Navigasi"
                            >
                                ☰
                                {isCrisisActive && (
                                    <span style={{
                                        position: 'absolute',
                                        top: '-3px',
                                        right: '-3px',
                                        width: '10px',
                                        height: '10px',
                                        borderRadius: '50%',
                                        backgroundColor: '#ef4444',
                                        border: '2px solid #0f172a',
                                        boxShadow: '0 0 6px #ef4444',
                                    }} />
                                )}
                            </button>
                        </div>
                    </div>
                ) : (
                    /* ── Desktop Command Header (>= 768px) ── */
                    <>
                {/* Brand & Store Badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div
                        style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(99, 102, 241, 0.2) 100%)',
                            border: '1px solid rgba(245, 158, 11, 0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '20px',
                            boxShadow: '0 0 15px rgba(245, 158, 11, 0.2)',
                        }}
                    >
                        🦖
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                                style={{
                                    fontFamily: 'monospace',
                                    fontWeight: '900',
                                    fontSize: '15px',
                                    letterSpacing: '0.05em',
                                    background: 'linear-gradient(90deg, #38bdf8 0%, #818cf8 50%, #f59e0b 100%)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                }}
                            >
                                CHIBIREX
                            </span>
                            <span
                                style={{
                                    fontSize: '10px',
                                    fontFamily: 'monospace',
                                    color: '#64748b',
                                    fontWeight: '600',
                                    letterSpacing: '0.08em',
                                }}
                            >
                                VIRTUAL HQ v2.0
                            </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                            <span
                                onClick={handleOpenRegionalModal}
                                title="Klik untuk membuka Regional Command Center & mengganti cabang pengawasan (80 Cabang)"
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontSize: '10px',
                                    fontFamily: 'monospace',
                                    padding: '2px 8px',
                                    borderRadius: '5px',
                                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                                    color: '#34d399',
                                    border: '1px solid rgba(16, 185, 129, 0.4)',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.25)';
                                    e.currentTarget.style.borderColor = '#34d399';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.15)';
                                    e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.4)';
                                }}
                            >
                                <span>🏬 STORE #{currentStore?.id || 74} ({currentStore?.city || 'PAENTMARWY'})</span>
                                <span style={{ fontSize: '9px', color: '#6ee7b7' }}>▼ GANTI</span>
                            </span>
                        </div>
                    </div>
                </div>

                {/* Central Status Indicator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {agentRunning ? (
                        <div
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '4px 14px',
                                borderRadius: '9999px',
                                background: 'rgba(245, 158, 11, 0.15)',
                                border: '1px solid rgba(245, 158, 11, 0.5)',
                                color: '#fbbf24',
                                fontSize: '11px',
                                fontFamily: 'monospace',
                                fontWeight: '700',
                                boxShadow: '0 0 15px rgba(245, 158, 11, 0.25)',
                            }}
                        >
                            <span className="status-dot pulse-amber" />
                            <span>⚡ REXA IN PATROL · LANGKAH #{stepCount || 1}</span>
                        </div>
                    ) : isApprovalModalOpen ? (
                        <div
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '4px 14px',
                                borderRadius: '9999px',
                                background: 'rgba(56, 189, 248, 0.15)',
                                border: '1px solid rgba(56, 189, 248, 0.5)',
                                color: '#38bdf8',
                                fontSize: '11px',
                                fontFamily: 'monospace',
                                fontWeight: '700',
                                boxShadow: '0 0 15px rgba(56, 189, 248, 0.25)',
                            }}
                        >
                            <span className="status-dot" style={{ backgroundColor: '#38bdf8', boxShadow: '0 0 8px #38bdf8' }} />
                            <span>📋 MEJA MANAJER · REVIEW & SAP APPROVAL</span>
                        </div>
                    ) : (
                        <div
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '4px 14px',
                                borderRadius: '9999px',
                                background: 'rgba(30, 41, 59, 0.6)',
                                border: '1px solid rgba(71, 85, 105, 0.5)',
                                color: '#94a3b8',
                                fontSize: '11px',
                                fontFamily: 'monospace',
                            }}
                        >
                            <span className="status-dot live" />
                            <span>STANDBY · SIAP PATROLI</span>
                        </div>
                    )}
                </div>

                {/* Right Meta Badges */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {/* Backend API Health Status */}
                    <div className="hud-tag" style={{ gap: '6px' }} title="Status Koneksi REST API ChibiRex">
                        <span className="status-dot live" />
                        <span>API: <strong style={{ color: '#38bdf8' }}>:8000</strong></span>
                    </div>

                    {/* Temporal Simulation Widget Capsule */}
                    <div
                        onClick={handleOpenTimeModal}
                        className="hud-tag"
                        style={{
                            gap: '6px',
                            cursor: isWarping ? 'not-allowed' : 'pointer',
                            background: daysOffset > 0 ? 'rgba(245, 158, 11, 0.18)' : 'rgba(30, 41, 59, 0.85)',
                            border: daysOffset > 0 ? '1px solid rgba(245, 158, 11, 0.6)' : '1px solid rgba(148, 163, 184, 0.3)',
                            color: daysOffset > 0 ? '#fbbf24' : '#e2e8f0',
                            transition: 'all 0.18s ease',
                            boxShadow: daysOffset > 0 ? '0 0 14px rgba(245, 158, 11, 0.3)' : 'none',
                        }}
                        onMouseEnter={(e) => {
                            if (isWarping) return;
                            e.currentTarget.style.borderColor = '#fbbf24';
                            e.currentTarget.style.background = 'rgba(245, 158, 11, 0.28)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = daysOffset > 0 ? 'rgba(245, 158, 11, 0.6)' : 'rgba(148, 163, 184, 0.3)';
                            e.currentTarget.style.background = daysOffset > 0 ? 'rgba(245, 158, 11, 0.18)' : 'rgba(30, 41, 59, 0.85)';
                        }}
                        title="Simulasi Waktu (+1 Hari, +7 Hari, Reset ke 31 Des 2016)"
                    >
                        <span style={{ fontSize: '12px' }}>📅</span>
                        <strong style={{ color: daysOffset > 0 ? '#fbbf24' : '#e2e8f0', letterSpacing: '0.02em' }}>
                            {formattedDate}
                        </strong>
                        <span
                            style={{
                                fontSize: '9px',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                backgroundColor: daysOffset > 0 ? 'rgba(245, 158, 11, 0.35)' : 'rgba(148, 163, 184, 0.2)',
                                color: daysOffset > 0 ? '#fbbf24' : '#94a3b8',
                                fontWeight: '800',
                            }}
                        >
                            {daysOffset === 0 ? 'BASELINE' : `+${daysOffset}H`}
                        </span>
                        <span style={{ fontSize: '9px', color: '#94a3b8' }}>▼</span>
                    </div>

                    {/* Proximity Hotkey Pill: Rexa */}
                    {rexaInRange && !agentRunning && !isApprovalModalOpen && (
                        <div
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '3px 10px',
                                borderRadius: '9999px',
                                backgroundColor: 'rgba(245, 158, 11, 0.2)',
                                border: '1px solid rgba(245, 158, 11, 0.7)',
                                color: '#fbbf24',
                                fontSize: '11px',
                                fontFamily: 'monospace',
                                fontWeight: '700',
                                animation: 'pulse-glow 1.2s ease-in-out infinite alternate',
                            }}
                        >
                            <span>⚡ Dekat Rexa</span>
                            <kbd className="keycap active">E</kbd>
                        </div>
                    )}

                    {/* Proximity Hotkey Pill: Manajer */}
                    {managerInRange && !agentRunning && !isApprovalModalOpen && (
                        <div
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '3px 10px',
                                borderRadius: '9999px',
                                backgroundColor: 'rgba(56, 189, 248, 0.2)',
                                border: '1px solid rgba(56, 189, 248, 0.7)',
                                color: '#38bdf8',
                                fontSize: '11px',
                                fontFamily: 'monospace',
                                fontWeight: '700',
                                animation: 'pulse-cyan 1.2s ease-in-out infinite alternate',
                            }}
                        >
                            <span>📋 Dekat Manajer</span>
                            <kbd className="keycap active">E</kbd>
                        </div>
                    )}

                    {/* Tombol Interkom Smartphone Rexa [C] */}
                    <button
                        onClick={handleToggleChat}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 12px',
                            borderRadius: '9999px',
                            backgroundColor: isChatOpen ? 'rgba(56, 189, 248, 0.3)' : 'rgba(30, 41, 59, 0.85)',
                            border: isChatOpen ? '1px solid #38bdf8' : '1px solid rgba(148, 163, 184, 0.3)',
                            color: isChatOpen ? '#38bdf8' : '#e2e8f0',
                            fontSize: '11px',
                            fontFamily: 'monospace',
                            fontWeight: '700',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            boxShadow: isChatOpen ? '0 0 12px rgba(56, 189, 248, 0.3)' : 'none',
                        }}
                        title="Buka / Tutup Smartphone Chat Rexa (Hotkey: C)"
                    >
                        <span>📱 Rexa Chat</span>
                        <kbd className="keycap active" style={{ fontSize: '9px', padding: '1px 5px' }}>C</kbd>
                    </button>

                    {/* Tombol Emergency Crisis Hub Doni */}
                    <button
                        onClick={handleOpenCrisisModal}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 12px',
                            borderRadius: '9999px',
                            backgroundColor: isCrisisActive ? '#ef4444' : 'rgba(30, 41, 59, 0.85)',
                            border: isCrisisActive ? '1px solid #f87171' : '1px solid rgba(148, 163, 184, 0.3)',
                            color: isCrisisActive ? '#ffffff' : '#fb923c',
                            fontSize: '11px',
                            fontFamily: 'monospace',
                            fontWeight: '700',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            animation: isCrisisActive ? 'pulse-glow 1s infinite alternate' : 'none',
                            boxShadow: isCrisisActive ? '0 0 16px rgba(239, 68, 68, 0.7)' : 'none',
                        }}
                        title={isCrisisActive ? '🚨 KRISIS AKTIF! Klik untuk buka Crisis Command Hub' : 'Buka Crisis Command Hub Doni (Koordinator)'}
                    >
                        <span>{isCrisisActive ? '🚨 KRISIS AKTIF' : '🏃 Doni Hub'}</span>
                    </button>
                </div>
                </>
            )}
            </header>

            {/* Container Game Canvas & Overlay React (100% Fullscreen Viewport) */}
            <main
                style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    overflow: 'hidden',
                    zIndex: 1,
                }}
            >
                <PhaserGame
                    ref={phaserRef}
                    currentActiveScene={(scene) => setCurrentScene(scene.scene.key)}
                />

                {/* ── Visualisasi Pemikiran (Thought Bubble React) ─────────── */}
                <ThoughtBubble
                    visible={agentRunning}
                    status={agentStatus}
                    currentStep={currentStep}
                    stepCount={stepCount}
                    summary={summary}
                    errorMessage={errorMessage}
                    screenPos={rexaScreenPos}
                    countdown={countdown}
                    isFallback={isRexaFallback}
                />

                {/* Pill Aksi Interaktif saat Dekat Rexa */}
                {rexaInRange && !agentRunning && !isApprovalModalOpen && (
                    <div
                        style={{
                            position: 'absolute',
                            left: `${rexaScreenPos.x}px`,
                            top: `${Math.max(35, rexaScreenPos.y + 42)}px`,
                            display: 'flex',
                            gap: '6px',
                            transform: 'translateX(-50%)',
                            zIndex: 25,
                        }}
                    >
                        <button
                            onClick={() => handleTriggerAgent({ store: String(currentStore?.id || 74) })}
                            className="action-pill action-pill-rexa"
                            style={{ position: 'static', transform: 'none' }}
                            title={`Picu analisis inventaris & draf PO Toko ${currentStore?.id || 74}`}
                        >
                            <kbd className="keycap active">E</kbd>
                            <span>Analisis Toko</span>
                        </button>
                        <button
                            onClick={handleOpenChat}
                            className="action-pill action-pill-rexa"
                            style={{
                                position: 'static',
                                transform: 'none',
                                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                                borderColor: '#38bdf8',
                                boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)',
                            }}
                            title="Buka Smartphone Chat dengan Rexa"
                        >
                            <kbd className="keycap active">C</kbd>
                            <span>Chat Copilot</span>
                        </button>
                    </div>
                )}

                {/* Pill Aksi Interaktif saat Dekat Meja Manajer */}
                {managerInRange && !agentRunning && !isApprovalModalOpen && (
                    <button
                        onClick={handleOpenApprovalModal}
                        className="action-pill action-pill-manager"
                        style={{
                            left: `${managerScreenPos.x}px`,
                            top: `${Math.max(35, managerScreenPos.y + 42)}px`,
                        }}
                        title="Buka Meja Manajer untuk 1-Click Approval PO ke SAP"
                    >
                        <kbd className="keycap active">E</kbd>
                        <span>Review PO Toko</span>
                    </button>
                )}
            </main>

            {/* ── Kontrol Dual-Thumb Touch Mobile (Virtual Joystick, Rexa Call, & Smart Action) ── */}
            {shouldShowMobileControls && (
                <div
                    className={`mobile-controls-overlay ${isAnyModalOpen ? 'is-hidden' : ''}`}
                    style={{
                        position: 'absolute',
                        inset: 0,
                        pointerEvents: 'none',
                        zIndex: 45,
                        opacity: isAnyModalOpen ? 0 : 1,
                        visibility: isAnyModalOpen ? 'hidden' : 'visible',
                        transition: 'opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                >
                    <VirtualJoystick />
                    <MobileRexaCallButton
                        isChatOpen={isChatOpen}
                        onToggleChat={handleToggleChat}
                        agentRunning={agentRunning}
                    />
                    <SmartActionButton />
                </div>
            )}

            {/* ── Modal Dialogs & Bottom Sheets (Top-Level Stacking Context) ─────── */}

            {/* ── Modal Approval PO ke SAP S/4HANA (Overlay Penuh) ─────── */}
            <ApprovalModal
                isOpen={isApprovalModalOpen}
                onClose={handleCloseApprovalModal}
            />

            {/* ── Smart TV Responsive Dual-State (1/8 Peek & 1/4 Inspect) ── */}
            <GlobalStatsTVModal
                mode={tvMode}
                onInspect={handleOpenTVInspect}
                onClose={handleCloseTV}
            />

            {/* ── Smartphone Chat Copilot (Handheld Intercom) ─────────── */}
            <SmartphoneChatModal
                isOpen={isChatOpen}
                onClose={handleCloseChat}
            />

            {/* ── Emergency Crisis Command Hub (Koordinator Doni) ─────── */}
            <CrisisCommandModal
                isOpen={isCrisisModalOpen}
                onClose={handleCloseCrisisModal}
            />

            {/* ── Interactive NPC Quick Dialog Modal (Graceful Fallback) ── */}
            <NPCDialogModal
                isOpen={isNpcModalOpen}
                npcId={activeNpcId}
                dialogue={npcDialogue}
                metrics={npcMetrics}
                isFallback={isNpcFallback}
                isLoading={isNpcLoading}
                onClose={handleCloseNpcModal}
            />

            {/* ── Multi-Tenant Regional Command Center (80 Cabang DuckDB) ─ */}
            <RegionalDashboardModal
                isOpen={isRegionalModalOpen}
                onClose={handleCloseRegionalModal}
            />

            {/* ── Temporal Simulation Control Modal (+1 Hari, +7 Hari, Reset) ─ */}
            <TimeSimulationModal
                isOpen={isTimeModalOpen}
                onClose={handleCloseTimeModal}
            />

            {/* ── Panduan Navigasi & Pintasan Keyboard (Help Controls Modal) ─ */}
            <HelpControlsModal
                isOpen={isHelpModalOpen}
                onClose={handleCloseHelpModal}
            />

            {/* Floating Action Button (FAB) Help [ ? ] — Pojok Kanan Bawah (Desktop) */}
            {!shouldShowMobileControls && (
                <button
                    className="help-fab-btn"
                    onClick={handleToggleHelpModal}
                    style={{
                        position: 'absolute',
                        bottom: '20px',
                        right: '20px',
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        background: isHelpModalOpen ? 'rgba(56, 189, 248, 0.35)' : 'rgba(15, 23, 42, 0.85)',
                        border: isHelpModalOpen ? '1.5px solid #38bdf8' : '1px solid rgba(56, 189, 248, 0.4)',
                        boxShadow: isHelpModalOpen
                            ? '0 0 20px rgba(56, 189, 248, 0.6)'
                            : '0 6px 20px rgba(0, 0, 0, 0.5), 0 0 12px rgba(56, 189, 248, 0.2)',
                        backdropFilter: 'blur(12px)',
                        color: '#f8fafc',
                        fontSize: '18px',
                        fontWeight: '900',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        zIndex: 60,
                        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.1)';
                        e.currentTarget.style.borderColor = '#38bdf8';
                        e.currentTarget.style.boxShadow = '0 0 22px rgba(56, 189, 248, 0.6)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.borderColor = isHelpModalOpen ? '#38bdf8' : 'rgba(56, 189, 248, 0.4)';
                        e.currentTarget.style.boxShadow = isHelpModalOpen
                            ? '0 0 20px rgba(56, 189, 248, 0.6)'
                            : '0 6px 20px rgba(0, 0, 0, 0.5), 0 0 12px rgba(56, 189, 248, 0.2)';
                    }}
                    title="Panduan Kontrol & Navigasi (Hotkey: X)"
                >
                    ?
                </button>
            )}

            {/* ── Mobile Off-Canvas Drawer Menu (Navigasi Sekunder) ── */}
            <MobileDrawerMenu
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                currentStore={currentStore}
                onOpenRegionalModal={handleOpenRegionalModal}
                onOpenTimeModal={handleOpenTimeModal}
                onToggleChat={handleToggleChat}
                onOpenCrisisModal={handleOpenCrisisModal}
                onOpenHelpModal={handleToggleHelpModal}
                isChatOpen={isChatOpen}
                isCrisisActive={isCrisisActive}
                agentRunning={agentRunning}
                formattedDate={formattedDate}
                daysOffset={daysOffset}
                stepCount={stepCount}
            />
        </div>
    );
}

export default App;
