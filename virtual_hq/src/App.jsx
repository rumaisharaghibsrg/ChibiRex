/**
 * App.jsx — Virtual HQ (Rexa Office)
 *
 * Mengintegrasikan:
 *  - PhaserGame (Kanvas game 2D RPG)
 *  - EventBus (Jembatan komunikasi Phaser ↔ React)
 *  - ThoughtBubble (Visualisasi pemikiran AI Agent Rexa)
 *  - ApprovalModal (Meja Manajer: 1-Click PO Approval ke SAP S/4HANA)
 *  - Integrasi API REST ChibiRex lewat src/lib/api.js (alamat dari VITE_API_URL, sama dengan dashboard)
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { PhaserGame }   from './PhaserGame';
import { EventBus }     from './game/EventBus';
import { ThoughtBubble } from './components/ThoughtBubble';
import { AgentJaringanBubble } from './components/AgentJaringanBubble';
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
import { api, beritahuDataBerubah, COPILOT_URL, urlDashboard, urlDashboardJaringan } from './lib/api';
import { laporanNpc, laporanNpcJaringan } from './lib/npc';
import { bacaLaporanJaringan, simpanLaporanJaringan } from './lib/laporanJaringan';
import './game/StoreCrisisState';

function App() {
    const phaserRef = useRef();
    const { isMobileScreen, isTouch, shouldShowMobileControls } = useDeviceDetect();
    const { currentStore, switchStore, mode, keModeJaringan, storesList } = useStore();
    const { daysOffset, isWarping, formattedDate, isoDate, apiOnline } = useTimeSimulation();
    // Mode Semua Toko: staf melapor untuk seluruh jaringan dan Rexa menjalankan Agent Jaringan (seperti halaman
    // Semua Toko di dashboard). Mode toko: semuanya untuk toko yang diawasi.
    const modeJaringan = mode === 'jaringan';
    const [currentScene, setCurrentScene] = useState('');
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

    // ── Panel laporan staf (Maya, Citra, Rian, Pak Budi) ─────────────────────
    // Laporan disimpan per (staf, toko) setelah dibaca dan ditampilkan lagi setiap panel dibuka; data baru hanya
    // diambil lewat tombol "Muat Ulang".
    const [isNpcModalOpen, setIsNpcModalOpen] = useState(false);
    const [activeNpcId, setActiveNpcId]       = useState('maya');
    const [laporanStaf, setLaporanStaf]       = useState({}); // `${staf}:${toko}` -> {dialogue, metrics, gagal, tanggal}
    const [memuatStaf, setMemuatStaf]         = useState({}); // `${staf}:${toko}` -> true selama dibaca
    const laporanStafRef = useRef({});
    const memuatStafRef  = useRef(new Set());
    const tanggalSimRef  = useRef(formattedDate);
    useEffect(() => { laporanStafRef.current = laporanStaf; }, [laporanStaf]);
    useEffect(() => { tanggalSimRef.current = formattedDate; }, [formattedDate]);

    // ── Modal yang memblokir permainan (formulir aksi). Panel laporan (bubble agent, staf, Doni, Smart TV) tidak
    //    termasuk: pemain tetap bebas bergerak selama panel itu terbuka (Directive v5.3) ──
    const isAnyModalOpen = Boolean(
        isHelpModalOpen ||
        isRegionalModalOpen ||
        isTimeModalOpen ||
        isApprovalModalOpen ||
        isChatOpen ||
        isDrawerOpen
    );

    // ── Status Sesi AI Agent Rexa ─────────────────────────────────────────────
    // Alur agent: jalankan -> pemain tetap bebas bergerak (agent menganalisis di latar) -> selesai -> log (langkah,
    // ringkasan atau alasan gagal) bisa dilihat kapan saja -> agent baru dijalankan lagi hanya lewat "Jalankan Ulang".
    // Bubble tidak pernah tertutup otomatis; pergi (bergeser), ✕, atau Esc hanya menyembunyikannya, lognya tetap.
    // Log terakhir toko yang diawasi dibaca dari API, jadi tetap ada setelah halaman dimuat ulang.
    const [agentRunning, setAgentRunning]   = useState(false);
    const [agentStatus, setAgentStatus]     = useState(''); // 'MEMULAI', 'BERJALAN', 'SELESAI', 'GAGAL'
    const [currentStep, setCurrentStep]     = useState(null);
    const [stepCount, setStepCount]         = useState(0);
    const [summary, setSummary]             = useState('');
    const [errorMessage, setErrorMessage]   = useState('');
    const [bubbleTerbuka, setBubbleTerbuka] = useState(false);
    const [tokoLog, setTokoLog]             = useState(null); // toko pemilik log agent yang ditampilkan
    const adaHasil = agentStatus === 'SELESAI' || agentStatus === 'GAGAL';

    const pollingTimerRef = useRef(null);
    // Panel laporan (bubble agent, staf, Doni, Smart TV) tidak membekukan pemain. Begitu pemain pergi (bergeser lebih
    // dari setengah petak dari posisinya saat panel dibuka), panel ditutup; isinya tetap tersimpan.
    const posisiPemainRef  = useRef(null);
    const jangkarRef       = useRef(null);
    const adaPanelRef      = useRef(false);
    const agentRunningRef  = useRef(false);
    const adaPanel = bubbleTerbuka || isNpcModalOpen || isCrisisModalOpen || tvMode === 'inspect';
    const [versiPanel, setVersiPanel] = useState(0); // naik setiap panel dibuka: titik acuan "pergi" diatur ulang
    const tandaiPanelDibuka = useCallback(() => setVersiPanel((v) => v + 1), []);
    useEffect(() => { agentRunningRef.current = agentRunning; }, [agentRunning]);
    useEffect(() => {
        adaPanelRef.current = adaPanel;
        jangkarRef.current = adaPanel ? posisiPemainRef.current : null;
    }, [adaPanel, versiPanel]);
    const tutupPanel = useCallback(() => {
        setBubbleTerbuka(false);
        setIsNpcModalOpen(false);
        setIsCrisisModalOpen(false);
        setTvMode((m) => (m === 'inspect' ? (isNearTVRef.current ? 'peek' : 'hidden') : m));
    }, []);

    const clearAllTimers = useCallback(() => {
        if (pollingTimerRef.current) {
            clearInterval(pollingTimerRef.current);
            pollingTimerRef.current = null;
        }
    }, []);

    // Run selesai atau gagal: bubble dibiarkan seperti apa adanya sampai pemain menutupnya.
    const selesaiRun = useCallback(() => setAgentRunning(false), []);

    // Tampilkan run dari API (GET /agent-runs/{id} atau GET /agent-runs) di state bubble.
    const terapkanRun = useCallback((run) => {
        const steps = run.langkah || [];
        setStepCount(steps.length);
        setCurrentStep(steps.length > 0 ? steps[steps.length - 1] : null);
        const status = run.status || (run.berhasil ? 'SELESAI' : 'GAGAL'); // jejak lama belum punya kolom status
        // MENUNGGU = mode antrian, tugas belum diambil worker agent di laptop.
        setAgentStatus(status === 'MENUNGGU' ? 'MEMULAI' : status);
        if (status === 'SELESAI') setSummary(run.jawaban || 'Tinjauan toko selesai. Draf PO siap ditinjau manajer.');
        if (status === 'GAGAL') setErrorMessage(run.pesan || 'Agent gagal dijalankan.');
        return status;
    }, []);

    // ── Mulai Polling Status Agen Setiap 2000ms ───────────────────────────────
    const startPolling = useCallback((activeRunId) => {
        clearAllTimers();
        let gagalBeruntun = 0;

        pollingTimerRef.current = setInterval(async () => {
            try {
                const status = terapkanRun(await api.statusAgent(activeRunId));
                gagalBeruntun = 0;
                if (status === 'SELESAI' || status === 'GAGAL') {
                    clearAllTimers();
                    beritahuDataBerubah();
                    selesaiRun();
                }
            } catch (err) {
                // Satu permintaan gagal (misalnya cold start) belum berarti agent gagal; tiga kali beruntun baru dilaporkan.
                gagalBeruntun += 1;
                if (gagalBeruntun < 3) return;
                clearAllTimers();
                setAgentStatus('GAGAL');
                setErrorMessage(`Status agent tidak bisa dibaca: ${err.message}`);
                selesaiRun();
            }
        }, 2000);
    }, [clearAllTimers, terapkanRun, selesaiRun]);

    // ── Mode Semua Toko: Agent Jaringan (Lambda Copilot, POST /jaringan) ─────────────────────────────
    // Alurnya sama dengan agent toko: pemain bebas bergerak selama analisis, laporan terakhir tersimpan (localStorage,
    // dipakai bersama halaman Semua Toko di dashboard) dan bisa dibuka kapan saja; "Jalankan Ulang" menganalisis lagi.
    const [laporanJaringan, setLaporanJaringan] = useState(bacaLaporanJaringan);
    const [jaringanBerjalan, setJaringanBerjalan] = useState(false);
    const [galatJaringan, setGalatJaringan]       = useState(null);
    const [detikJaringan, setDetikJaringan]       = useState(0);
    const jaringanBerjalanRef = useRef(false);
    useEffect(() => {
        if (!jaringanBerjalan) return undefined;
        const mulai = Date.now();
        setDetikJaringan(0);
        const ulang = setInterval(() => setDetikJaringan(Math.round((Date.now() - mulai) / 1000)), 1000);
        return () => clearInterval(ulang);
    }, [jaringanBerjalan]);

    const bukaBubble = useCallback(() => {
        setBubbleTerbuka(true);
        tandaiPanelDibuka();
    }, [tandaiPanelDibuka]);

    const jalankanJaringan = useCallback(async () => {
        if (jaringanBerjalanRef.current) return;
        bukaBubble();
        if (!COPILOT_URL) {
            setGalatJaringan('Agent Jaringan berjalan di Lambda Copilot, yang belum diatur untuk Virtual HQ ini (VITE_COPILOT_URL).');
            return;
        }
        jaringanBerjalanRef.current = true;
        setJaringanBerjalan(true);
        setGalatJaringan(null);
        try {
            const hasil = { ...(await api.analisisJaringan('id')), dibuat_pada: new Date().toISOString() };
            setLaporanJaringan(hasil);
            simpanLaporanJaringan(hasil);
        } catch (err) {
            setGalatJaringan(err.message);
        } finally {
            jaringanBerjalanRef.current = false;
            setJaringanBerjalan(false);
        }
    }, [bukaBubble]);

    // ── Jalankan agent (pertama kali, "Jalankan Ulang", atau "Tugaskan Agent" dari Crisis Hub) ─────────
    // Di mode Semua Toko (atau payload {jaringan: true}) yang dijalankan Agent Jaringan.
    const handleTriggerAgent = useCallback(async ({ store, jaringan } = {}) => {
        if (jaringan || (modeJaringan && !store)) {
            jalankanJaringan();
            return;
        }
        if (agentRunning) return; // Cegah pemanggilan ganda

        const activeStoreId = parseInt(store || currentStore?.id || 74, 10);

        // Pemain tidak dibekukan: agent bekerja di latar, bubble menampilkan langkahnya selama pemain di dekat Rexa.
        clearAllTimers();
        setTokoLog(activeStoreId);
        setAgentRunning(true);
        setAgentStatus('MEMULAI');
        setCurrentStep(null);
        setStepCount(0);
        setSummary('');
        setErrorMessage('');
        setBubbleTerbuka(true);
        tandaiPanelDibuka();

        try {
            // 3. Antrikan agent di API (mode antrian: worker di laptop mengambilnya), lalu pantau langkahnya.
            const data = await api.mulaiAgent(activeStoreId);
            terapkanRun(data);
            startPolling(data.run_id);
        } catch (err) {
            // Agent lain sedang berjalan (misalnya dari dashboard): ikuti run itu, jangan mulai yang baru.
            if (err.kode === 'AGENT_SEDANG_BERJALAN' && err.detail?.run_id) {
                setAgentStatus('BERJALAN');
                startPolling(err.detail.run_id);
                return;
            }
            console.warn('[VirtualHQ] Agent Rexa tidak bisa dimulai:', err);
            setAgentStatus('GAGAL');
            setErrorMessage(err.message);
            selesaiRun();
        }
    }, [agentRunning, clearAllTimers, startPolling, terapkanRun, selesaiRun, currentStore, tandaiPanelDibuka, modeJaringan, jalankanJaringan]);

    // Status agent sesuai mode: agent toko, atau Agent Jaringan di mode Semua Toko.
    const sedangJalan = modeJaringan ? jaringanBerjalan : agentRunning;
    const adaLog = modeJaringan ? Boolean(laporanJaringan || galatJaringan) : adaHasil;
    const logGagal = modeJaringan ? Boolean(galatJaringan) && !laporanJaringan : agentStatus === 'GAGAL';

    // ── Interaksi dengan Rexa (E atau tombol di dekatnya): kalau sudah ada log, bukakan lognya; kalau belum, jalankan ──
    const handleRexa = useCallback(() => {
        if (sedangJalan || adaLog) bukaBubble();
        else handleTriggerAgent();
    }, [sedangJalan, adaLog, bukaBubble, handleTriggerAgent]);

    // ── Tutup bubble agent (bergeser, ✕, Esc): log tetap tersimpan; kalau agent masih bekerja, ia lanjut di latar ──
    const handleTutupBubble = useCallback(() => setBubbleTerbuka(false), []);

    // Ganti mode (toko <-> Semua Toko): panel yang terbuka milik mode lama, jadi ditutup.
    useEffect(() => {
        tutupPanel();
    }, [mode, tutupPanel]);

    // ── Run terakhir toko yang diawasi (saat dibuka dan setiap ganti toko) ─────────────────────────
    const storeIdAktif = currentStore?.id || 74;
    useEffect(() => {
        if (agentRunningRef.current) return undefined;
        let aktif = true;
        Promise.all([api.agentAktif().catch(() => null), api.riwayatAgent(30).catch(() => [])]).then(([jalan, runs]) => {
            if (!aktif || agentRunningRef.current) return;
            setBubbleTerbuka(false);
            setSummary('');
            setErrorMessage('');
            setTokoLog(storeIdAktif);
            if (jalan && jalan.store === storeIdAktif) {
                // Agent untuk toko ini sedang berjalan (misalnya dari dashboard): ikut dipantau.
                setAgentRunning(true);
                terapkanRun(jalan);
                startPolling(jalan.run_id);
                return;
            }
            const terakhir = runs.find((r) => r.store === storeIdAktif);
            if (terakhir) {
                terapkanRun(terakhir);
            } else {
                setAgentStatus('');
                setCurrentStep(null);
                setStepCount(0);
            }
        });
        return () => {
            aktif = false;
        };
    }, [storeIdAktif, terapkanRun, startPolling]);

    // ── Buka Modal Approval saat Tombol 'E' Ditekan di Meja Manajer ───────────
    const handleOpenApprovalModal = useCallback(() => {
        EventBus.emit('freeze-player');
        setIsApprovalModalOpen(true);
    }, []);

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

    // ── Buka State Inspect (1/4 Layar Sidebar): pemain tetap bisa bergerak; pergi = tutup ──
    const handleOpenTVInspect = useCallback(() => {
        setTvMode('inspect');
        tandaiPanelDibuka();
    }, [tandaiPanelDibuka]);

    // ── Tutup State Inspect: switch ke peek/hidden ────
    const handleCloseTV = useCallback(() => {
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

    // ── Kontrol Buka/Tutup Crisis Hub Doni (panel laporan, tanpa membekukan pemain) ──────────────
    const handleOpenCrisisModal = useCallback(() => {
        setIsNpcModalOpen(false);
        setIsCrisisModalOpen(true);
        tandaiPanelDibuka();
    }, [tandaiPanelDibuka]);

    const handleCloseCrisisModal = useCallback(() => {
        setIsCrisisModalOpen(false);
    }, []);

    // ── Kontrol Buka/Tutup Regional Command Center (80 Cabang) ────────────────
    const handleOpenRegionalModal = useCallback(() => {
        if (isWarping) return;
        EventBus.emit('freeze-player');
        setIsRegionalModalOpen(true);
    }, [isWarping]);

    const handleCloseRegionalModal = useCallback(() => {
        setIsRegionalModalOpen(false);
        EventBus.emit('unfreeze-player');
        window.dispatchEvent(new CustomEvent('unfreeze-player'));
    }, []);

    // ── Kontrol Buka/Tutup Time Simulation Modal (+1 Hari, +7 Hari, Reset) ───
    const handleOpenTimeModal = useCallback(() => {
        if (isWarping) return;
        EventBus.emit('freeze-player');
        setIsTimeModalOpen(true);
    }, [isWarping]);

    const handleCloseTimeModal = useCallback(() => {
        setIsTimeModalOpen(false);
        if (!isWarping) {
            EventBus.emit('unfreeze-player');
            window.dispatchEvent(new CustomEvent('unfreeze-player'));
        }
    }, [isWarping]);

    // ── Kontrol Buka/Tutup Help Controls Modal (Panduan Navigasi & Pintasan) ──
    const handleOpenHelpModal = useCallback(() => {
        if (isWarping) return;
        EventBus.emit('freeze-player');
        setIsHelpModalOpen(true);
    }, [isWarping]);

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
                if (isWarping) return false;
                EventBus.emit('freeze-player');
                return true;
            }
        });
    }, [isWarping]);

    // ── Panel laporan staf: tersimpan per (staf, toko); "Muat Ulang" mengambil data baru ─────────
    const handleCloseNpcModal = useCallback(() => {
        setIsNpcModalOpen(false);
    }, []);

    // target = nomor toko, atau 'jaringan' untuk mode Semua Toko
    const muatLaporanStaf = useCallback(async (id, store) => {
        const kunci = `${id}:${store}`;
        if (memuatStafRef.current.has(kunci)) return; // event buka sering terkirim ganda dalam satu tekan E
        memuatStafRef.current.add(kunci);
        setMemuatStaf((m) => ({ ...m, [kunci]: true }));
        try {
            const laporan = store === 'jaringan' ? await laporanNpcJaringan(id) : await laporanNpc(id, store);
            setLaporanStaf((c) => ({ ...c, [kunci]: { ...laporan, gagal: false, tanggal: tanggalSimRef.current } }));
        } catch (err) {
            console.warn(`[App] Laporan ${id} tidak bisa dibaca:`, err);
            setLaporanStaf((c) => ({
                ...c,
                [kunci]: {
                    dialogue: `Data toko belum bisa dibaca, jadi saya belum bisa melapor. ${err.message}`,
                    metrics: [],
                    gagal: true,
                    tanggal: tanggalSimRef.current,
                },
            }));
        } finally {
            memuatStafRef.current.delete(kunci);
            setMemuatStaf((m) => ({ ...m, [kunci]: false }));
        }
    }, []);

    const handleOpenNpcModal = useCallback((payload) => {
        const id = (payload?.npcId || payload?.npc || 'maya').toLowerCase();
        const store = modeJaringan ? 'jaringan' : (currentStore?.id || 74);
        setActiveNpcId(id);
        setIsCrisisModalOpen(false);
        setIsNpcModalOpen(true);
        tandaiPanelDibuka();
        // Laporan yang sudah pernah dibaca langsung ditampilkan lagi; baru dibaca dari API kalau belum ada.
        if (!laporanStafRef.current[`${id}:${store}`]) muatLaporanStaf(id, store);
    }, [currentStore, modeJaringan, muatLaporanStaf, tandaiPanelDibuka]);

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
            if (isApprovalModalOpen) handleCloseApprovalModal();
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
            handleRexa();
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
        isApprovalModalOpen,
        tvMode,
        isHelpModalOpen,
        isTimeModalOpen,
        isRegionalModalOpen,
        managerInRange,
        rexaInRange,
        handleOpenNpcModal,
        handleOpenApprovalModal,
        handleCloseApprovalModal,
        handleCloseHelpModal,
        handleCloseTimeModal,
        handleCloseRegionalModal,
        handleRexa,
        handleOpenTVInspect,
        handleOpenCrisisModal,
    ]);

    // ── Global Hotkey C, X (Help), & E (Interaksi) Listener di Window (Directive v4.9 & v5.6) ────────
    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            const target = e.target;
            const tag = target?.tagName?.toLowerCase();
            if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;

            if (e.key === 'Escape' && adaPanel && !isAnyModalOpen) {
                tutupPanel();
            } else if (e.key === 'c' || e.key === 'C') {
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
    }, [handleToggleChat, handleToggleHelpModal, triggerProximityAction, adaPanel, isAnyModalOpen, tutupPanel]);

    // ── Setup Event Listeners dari Phaser & Window ────────────────────────────
    useEffect(() => {
        const onSceneReady = (scene) => setCurrentScene(scene.scene.key);
        const onPlayerMoved = (pos) => {
            posisiPemainRef.current = pos;
            if (!adaPanelRef.current) return;
            // Pemain pergi (bergeser lebih dari setengah petak): panel laporan ditutup, isinya tetap tersimpan.
            if (!jangkarRef.current) {
                jangkarRef.current = pos;
            } else if (Math.hypot(pos.x - jangkarRef.current.x, pos.y - jangkarRef.current.y) > 16) {
                tutupPanel();
            }
        };
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
        // E di dekat Rexa (Phaser) membuka log kalau sudah ada; 'jalankan-agent' (Jalankan Ulang, Crisis Hub) selalu menjalankan.
        EventBus.on('trigger-agent-analysis', handleRexa);
        EventBus.on('jalankan-agent', handleTriggerAgent);
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
            EventBus.removeListener('trigger-agent-analysis', handleRexa);
            EventBus.removeListener('jalankan-agent', handleTriggerAgent);
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
        };
    }, [handleTriggerAgent, handleRexa, tutupPanel, handleOpenApprovalModal, handleTVProximity, handleOpenTVInspect, handleToggleChat, handleOpenChat, handleCloseChat, handleOpenCrisisModal, handleOpenRegionalModal, handleOpenTimeModal, handleOpenNpcModal, triggerProximityAction]);

    // Timer agent (polling dan hitung mundur pencairan pemain) hanya dibersihkan saat App dilepas. Kalau ikut cleanup
    // efek listener di atas, timer terhapus setiap handler berganti identitas (misalnya data toko dimuat ulang saat
    // agent selesai), sehingga bubble tidak pernah tertutup dan pemain tetap beku.
    useEffect(() => clearAllTimers, [clearAllTimers]);

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
                                        {modeJaringan ? '🌐 SEMUA' : `#${currentStore?.id || 74}`}
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
                                <span>{modeJaringan
                                    ? `🌐 SEMUA TOKO (${storesList.length})`
                                    : `🏬 STORE #${currentStore?.id || 74} (${currentStore?.city || 'PAENTMARWY'})`}</span>
                                <span style={{ fontSize: '9px', color: '#6ee7b7' }}>▼ GANTI</span>
                            </span>
                            {!modeJaringan && (
                                <button
                                    type="button"
                                    onClick={keModeJaringan}
                                    title="Pindah ke mode Semua Toko: staf melapor untuk seluruh jaringan dan Rexa menjalankan Agent Jaringan"
                                    style={{
                                        fontSize: '10px',
                                        fontFamily: 'monospace',
                                        padding: '2px 8px',
                                        borderRadius: '5px',
                                        backgroundColor: 'rgba(56, 189, 248, 0.12)',
                                        color: '#7dd3fc',
                                        border: '1px solid rgba(56, 189, 248, 0.4)',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                    }}
                                >
                                    🌐 SEMUA TOKO
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Central Status Indicator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {sedangJalan ? (
                        <button
                            type="button"
                            onClick={bukaBubble}
                            title={bubbleTerbuka ? 'Agent Rexa sedang bekerja (Esc untuk lanjut berjalan)' : 'Klik untuk melihat langkah agent lagi'}
                            style={{
                                cursor: bubbleTerbuka ? 'default' : 'pointer',
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
                            <span>{modeJaringan
                                ? `🌐 AGENT JARINGAN · ${detikJaringan} DTK`
                                : `⚡ REXA IN PATROL · TOKO ${tokoLog} · LANGKAH #${stepCount || 1}`}{bubbleTerbuka ? '' : ' · LIHAT'}</span>
                        </button>
                    ) : adaLog && !bubbleTerbuka && !isApprovalModalOpen ? (
                        <button
                            type="button"
                            onClick={bukaBubble}
                            title="Buka lagi hasil agent terakhir untuk toko ini"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '4px 14px',
                                borderRadius: '9999px',
                                background: logGagal ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                border: `1px solid ${logGagal ? 'rgba(248, 113, 113, 0.5)' : 'rgba(52, 211, 153, 0.5)'}`,
                                color: logGagal ? '#f87171' : '#34d399',
                                fontSize: '11px',
                                fontFamily: 'monospace',
                                fontWeight: '700',
                                cursor: 'pointer',
                            }}
                        >
                            <span>{modeJaringan
                                ? (logGagal ? '⚠️ AGENT JARINGAN GAGAL · LIHAT' : `✅ LAPORAN JARINGAN · ${laporanJaringan?.toko?.length ?? 0} TOKO PRIORITAS · LIHAT`)
                                : `${logGagal ? '⚠️ AGENT GAGAL' : '✅ HASIL AGENT'} TOKO ${tokoLog} · ${stepCount} LANGKAH · LIHAT`}</span>
                        </button>
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
                    <div className="hud-tag" style={{ gap: '6px' }} title="Status koneksi REST API Rexa (dicek tiap 15 detik)">
                        <span
                            className={`status-dot ${apiOnline ? 'live' : ''}`}
                            style={apiOnline === false ? { backgroundColor: '#ef4444', boxShadow: '0 0 8px #ef4444' } : undefined}
                        />
                        <span>API: <strong style={{ color: apiOnline === false ? '#f87171' : '#38bdf8' }}>
                            {apiOnline === null ? 'MEMERIKSA' : apiOnline ? 'ONLINE' : 'OFFLINE'}
                        </strong></span>
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
                    {rexaInRange && !bubbleTerbuka && !isApprovalModalOpen && (
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
                            {!shouldShowMobileControls && <kbd className="keycap active">E</kbd>}
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
                            {!shouldShowMobileControls && <kbd className="keycap active">E</kbd>}
                        </div>
                    )}

                    {/* Kembali ke dashboard web untuk toko yang sama */}
                    <a
                        href={modeJaringan ? urlDashboardJaringan() : urlDashboard(currentStore?.id || 74)}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 12px',
                            borderRadius: '9999px',
                            backgroundColor: 'rgba(16, 185, 129, 0.15)',
                            border: '1px solid rgba(52, 211, 153, 0.45)',
                            color: '#6ee7b7',
                            fontSize: '11px',
                            fontFamily: 'monospace',
                            fontWeight: '700',
                            textDecoration: 'none',
                            transition: 'all 0.15s ease',
                        }}
                        title="Kembali ke dashboard Rexa untuk toko yang sedang diawasi"
                    >
                        <span>📊 Dashboard</span>
                    </a>

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
                        {!shouldShowMobileControls && <kbd className="keycap active" style={{ fontSize: '9px', padding: '1px 5px' }}>C</kbd>}
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
                {modeJaringan && (
                    <AgentJaringanBubble
                        visible={bubbleTerbuka}
                        berjalan={jaringanBerjalan}
                        detik={detikJaringan}
                        laporan={laporanJaringan}
                        galat={galatJaringan}
                        tanggalSekarang={isoDate}
                        screenPos={rexaScreenPos}
                        onTutup={handleTutupBubble}
                        onJalankanUlang={jalankanJaringan}
                        onBukaToko={(s) => {
                            setBubbleTerbuka(false);
                            switchStore(s);
                        }}
                    />
                )}
                <ThoughtBubble
                    visible={!modeJaringan && bubbleTerbuka && (agentRunning || adaHasil)}
                    onTutup={handleTutupBubble}
                    onJalankanUlang={agentRunning ? null : () => handleTriggerAgent({ store: String(tokoLog || storeIdAktif) })}
                    status={agentStatus}
                    currentStep={currentStep}
                    stepCount={stepCount}
                    summary={summary}
                    errorMessage={errorMessage}
                    screenPos={rexaScreenPos}
                />

                {/* Pill Aksi Interaktif saat Dekat Rexa */}
                {rexaInRange && !bubbleTerbuka && !isApprovalModalOpen && (
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
                            onClick={handleRexa}
                            className="action-pill action-pill-rexa"
                            style={{ position: 'static', transform: 'none' }}
                            title={sedangJalan || adaLog ? 'Buka log agent (jalankan ulang dari bubble)' : modeJaringan ? 'Jalankan Agent Jaringan untuk semua toko' : `Picu analisis inventaris & draf PO Toko ${currentStore?.id || 74}`}
                        >
                            {!shouldShowMobileControls && <kbd className="keycap active">E</kbd>}
                            <span>{sedangJalan ? 'Lihat Agent' : adaLog ? 'Lihat Hasil Agent' : modeJaringan ? 'Analisis Semua Toko' : 'Analisis Toko'}</span>
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
                            {!shouldShowMobileControls && <kbd className="keycap active">C</kbd>}
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
                        {!shouldShowMobileControls && <kbd className="keycap active">E</kbd>}
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
                store={modeJaringan ? null : (currentStore?.id || 74)}
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
                laporan={laporanStaf[`${activeNpcId}:${modeJaringan ? 'jaringan' : storeIdAktif}`]}
                isLoading={Boolean(memuatStaf[`${activeNpcId}:${modeJaringan ? 'jaringan' : storeIdAktif}`])}
                tanggalSekarang={formattedDate}
                onMuatUlang={() => muatLaporanStaf(activeNpcId, modeJaringan ? 'jaringan' : storeIdAktif)}
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
                apiOnline={apiOnline}
                dashboardHref={modeJaringan ? urlDashboardJaringan() : urlDashboard(currentStore?.id || 74)}
                modeJaringan={modeJaringan}
                jumlahToko={storesList.length}
            />
        </div>
    );
}

export default App;
