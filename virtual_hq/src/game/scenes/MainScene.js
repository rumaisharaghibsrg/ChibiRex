/**
 * MainScene.js — Virtual HQ: Rexa Office
 *
 * Peta kantor prosedural 2D top-down dengan:
 *  - Tilemap grid (lantai, dinding, meja, kursi, tanaman)
 *  - Avatar pemain (sprite 32x32folk) dengan animasi 4 arah
 *  - Pergerakan WASD & Arrow Keys + physics arcade
 *  - Collision dengan dinding dan furnitur
 *  - Sprite NPC Rexa & Meja Manajer
 *  - Deteksi Proximity (< 50px) ke Rexa & Meja Manajer
 *  - Tombol 'E' Interaksi untuk Analisis Toko dan Approval PO
 *  - Freeze/Unfreeze movement saat AI berpikir atau modal terbuka
 *  - EventBus bridge ke React (untuk ThoughtBubble & ApprovalModal)
 */

import * as Phaser from 'phaser';
import { EventBus } from '../EventBus';
import { playEmergencyKlaxonSFX } from '../StoreCrisisState';

// ─── Konstanta Layout (Compact & Cozy Startup Office) ───────────────────────
const TILE_SIZE      = 32;   // px per tile
const MAP_COLS       = 24;   // lebar peta dalam tile (24 × 32 = 768 px)
const MAP_ROWS       = 16;   // tinggi peta dalam tile (16 × 32 = 512 px)
const PLAYER_SPEED    = 160;  // px/detik
const PROXIMITY_DIST = 50;   // pixel jangkauan interaksi (sesuai instruksi < 50px)

// ─── Layout Spritesheet 32x32folk.png ────────────────────────────────────────
//
// Dimensi: 384×256px = 12 kolom × 8 baris, total 96 frame (@32×32px)
//
// FORMAT: RPG Maker / LPC — 4 KARAKTER per baris, 4 BARIS per set animasi
//
//   Setiap BARIS berisi 4 karakter × 3 frame berjalan = 12 frame:
//     Col  0- 2 → Karakter A walk
//     Col  3- 5 → Karakter B walk
//     Col  6- 8 → Karakter C walk
//     Col  9-11 → Karakter D walk
//
//   Setiap KARAKTER punya 4 baris (1 arah per baris):
//     Row 0 → walk-DOWN
//     Row 1 → walk-LEFT
//     Row 2 → walk-RIGHT
//     Row 3 → walk-UP
//
//   Satu set karakter (A,B,C,D) menempati 4 baris berturut-turut.
//   Jadi di sheet 8 baris ini ada 2 SET karakter (baris 0-3 dan baris 4-7):
//
//   SET 1 (baris 0-3):
//     Char A = kolom 0-2   → Player (Manager)
//     Char B = kolom 3-5   → NPC Rexa
//     Char C = kolom 6-8   → NPC lain / Manager
//     Char D = kolom 9-11  → NPC lain
//
//   Rumus frame untuk KARAKTER ke-charIdx (0-based) dan ARAH ke-dir (0=down,1=left,2=right,3=up):
//     baseCol  = charIdx * 3          // kolom awal karakter di baris manapun
//     frameDir = dir * 12             // offset baris (dir × 12 frame per baris)
//     frame[0] = frameDir + baseCol
//     frame[1] = frameDir + baseCol + 1
//     frame[2] = frameDir + baseCol + 2

const CHARS_PER_SET   = 4;   // 4 karakter per set horizontal (LPC grid)
const FRAMES_PER_CHAR = 3;   // 3 frame per karakter per arah
const COLS            = 12;  // total frame per baris spritesheet (12 kolom @32px)
const ROWS_PER_SET    = 4;   // 4 baris per set arah (Down, Left, Right, Up)

// Indeks karakter (0-7):
// Set 0 (Baris 0-3):
const CHAR_IDX_PLAYER  = 0;   // Char 0: Player (Jilbab merah)
const CHAR_IDX_REXA    = 1;   // Char 1: Rexa (Kemeja teal / Copilot AI)
const CHAR_IDX_MANAGER = 2;   // Char 2: Manajer (Jas formal / Approval Desk)
const CHAR_IDX_BUDI    = 3;   // Char 3: Pak Budi (Rambut putih eksekutif / Operations Director)
// Set 1 (Baris 4-7):
const CHAR_IDX_CITRA   = 4;   // Char 4: Citra (Pirang kemeja gelap / Financial Strategist)
const CHAR_IDX_MAYA    = 5;   // Char 5: Maya (Gaun pink / Auditor Stok & Gudang)
const CHAR_IDX_RIAN    = 6;   // Char 6: Rian (Jaket abu-abu teknisi / Security & Guardrail Sentinel)
const CHAR_IDX_DONI    = 7;   // Char 7: Doni (Jaket oranye lapangan / Koordinator Operasional)

// Indeks arah → baris dalam set
const DIR_DOWN  = 0;   // row offset 0
const DIR_LEFT  = 1;   // row offset 1
const DIR_RIGHT = 2;   // row offset 2
const DIR_UP    = 3;   // row offset 3

const FRAME_W = 32;
const FRAME_H = 32;

/**
 * Formula Matematis Frame Spritesheet (Anti-Bleeding LPC 2-Set Matrix)
 * Menghitung array 3 frame walk untuk karakter charIdx (0..7) dan arah dirIdx (0..3)
 */
function charFrames(charIdx, dirIdx) {
    const setIdx = Math.floor(charIdx / CHARS_PER_SET);
    const colInSet = charIdx % CHARS_PER_SET;
    const rowOffset = (setIdx * ROWS_PER_SET + dirIdx) * COLS;
    const base = rowOffset + (colInSet * FRAMES_PER_CHAR);
    return [base, base + 1, base + 2];
}

// ─── Definisi Peta (array 2D) & Tipe Tile (Cozy Startup Office) ─────────────
// Tipe Tile:
//  0  = Koridor / Walkway Terrazzo batu hangat
//  1  = Dinding luar perimeter 2.5D solid
//  2  = Kolom / Sekat kayu arsitektural (Wood slat partition)
//  3  = Meja kerja kayu / meeting
//  4  = Kursi kantor ergonomis charcoal
//  5  = Tanaman hias pot (Potted plant)
//  6  = Water dispenser & Coffee bar station
//  7  = Sekat partisi kaca modern (Cubicle glass wall)
//  8  = Rak Buku & File Binder Kayu (Bookshelves)
//  9  = Papan Whiteboard / Smart Presentation Screen
//  10 = Lantai Kayu / Parket Cerah (Ruang Rexa)
//  11 = Lantai Marmer Putih Eksekutif (Ruang Manajer)
//  12 = Lantai Karpet Hangat Oat/Beige (Meeting / Lounge)
//  13 = Karpet Aksen Meja & Entrance (Executive Accent Rugs)
//  14 = Sofa Lounge empuk (Cozy Modular Sofa)
//  15 = Meja Kopi Kaca Lounge (Coffee Table)
//  16 = Mesin Printer & Filing Cabinet (Lemari arsip PO)
//  17 = Server Rack AI Mini Mainframe (Lampu LED)
//  18 = Counter Pantry / Snack Bar

function buildMapData() {
    const W = MAP_COLS; // 24
    const H = MAP_ROWS; // 16
    const m = [];

    // 1. Inisialisasi dasar lantai & dinding perimeter
    for (let r = 0; r < H; r++) {
        m[r] = [];
        for (let c = 0; c < W; c++) {
            if (r === 0 || r === H - 1 || c === 0 || c === W - 1) {
                m[r][c] = 1; // Dinding luar perimeter
            } else if (r <= 6 && c >= 1 && c <= 6) {
                m[r][c] = 10; // Zona 1: Ruang Rexa (Parket Kayu Cerah)
            } else if (r <= 6 && c >= 17 && c <= 22) {
                m[r][c] = 11; // Zona 2: Ruang Manajer (Marmer Putih Eksekutif)
            } else if (r <= 6 && c >= 7 && c <= 16) {
                m[r][c] = 12; // Zona 3: Meeting / War Room (Karpet Oat/Navy)
            } else if (r >= 8 && c >= 1 && c <= 8) {
                m[r][c] = 12; // Zona 4: Pantry & Coffee Lounge (Karpet Hangat)
            } else if (r >= 8 && c >= 15 && c <= 22) {
                m[r][c] = 10; // Zona 5: Station Operasional & Hot-desk (Parket Kayu)
            } else {
                m[r][c] = 0;  // Koridor / Walkway Tengah Terrazzo
            }
        }
    }

    // Pintu masuk utama di dinding bawah (row 15, col 11-12)
    // Karpet penyambut (Welcome Mat)
    m[14][11] = 13; m[14][12] = 13;

    // ── Sekat Partisi Kaca Modern (Cubicle Glass Walls) ───────────────────────
    // Sekat Ruang Rexa (col 7, rows 1-6) - Pintu masuk partisi terbuka di rows 4-5
    for (let r = 1; r <= 6; r++) {
        if (r !== 4 && r !== 5) m[r][7] = 7;
    }
    // Sekat Ruang Manajer (col 16, rows 1-6) - Pintu masuk partisi terbuka di rows 4-5
    for (let r = 1; r <= 6; r++) {
        if (r !== 4 && r !== 5) m[r][16] = 7;
    }
    // Sekat kayu akustik pemisah lorong tengah & lounge (row 7)
    // Celah 2 tile untuk pintu otomatis: Rexa (cols 4-5), War Room (cols 11-12), Manajer (cols 18-19)
    for (let c = 1; c <= 22; c++) {
        if (c !== 4 && c !== 5 && c !== 11 && c !== 12 && c !== 18 && c !== 19) {
            m[7][c] = 2; // Sekat arsitektural
        }
    }

    // ── Karpet Aksen Eksekutif (Type 13) ─────────────────────────────────────
    // Karpet bawah meja Rexa (row 2-4, col 2-5)
    for (let r = 2; r <= 4; r++) {
        for (let c = 2; c <= 5; c++) {
            m[r][c] = 13;
        }
    }
    // Karpet bawah meja Manajer (row 2-4, col 18-21)
    for (let r = 2; r <= 4; r++) {
        for (let c = 18; c <= 21; c++) {
            m[r][c] = 13;
        }
    }
    // Karpet Meeting Room (Royal Navy di bawah meja rapat)
    for (let r = 2; r <= 5; r++) {
        for (let c = 9; c <= 14; c++) {
            m[r][c] = 13;
        }
    }

    // ── ZONA 1: RUANG REXA (AI COPILOT STATION) ──────────────────────────────
    // Meja kerja Rexa (row 3, col 3-4)
    m[3][3] = 3; m[3][4] = 3;
    m[2][3] = 4; // Kursi Rexa
    // Whiteboard analitik AI di dinding atas (row 1, col 3-4)
    m[1][3] = 9; m[1][4] = 9;
    // Rak buku teknis AI di dinding (row 1, col 1-2)
    m[1][1] = 8; m[1][2] = 8;
    // Server Rack AI Mini Mainframe (row 1, col 6)
    m[1][6] = 17;
    // Tanaman hias pot Rexa (row 6, col 1)
    m[6][1] = 5;

    // ── ZONA 2: RUANG MANAJER & APPROVAL STATION ─────────────────────────────
    // Meja kerja Manajer (row 3, col 19-20)
    m[3][19] = 3; m[3][20] = 3;
    m[2][20] = 4; // Kursi Manajer
    // Lemari arsip berkas PO SAP di dinding kanan (row 1, col 21-22)
    m[1][21] = 16; m[1][22] = 16;
    // Rak piala toko & binder laporan manajerial (row 1, col 18-19)
    m[1][18] = 8; m[1][19] = 8;
    // Tanaman hias pot Manajer (row 6, col 22)
    m[6][22] = 5;

    // ── ZONA 3: MEETING & PRESENTATION ROOM (CENTER) ─────────────────────────
    // Smart Presentation Screen di dinding atas (row 1, col 11-12)
    m[1][11] = 9; m[1][12] = 9;
    // Whiteboard meeting diagram (row 1, col 9)
    m[1][9] = 9;
    // Meja Meeting (row 3-4, col 10-13)
    m[3][10] = 3; m[3][11] = 3; m[3][12] = 3; m[3][13] = 3;
    m[4][10] = 3; m[4][11] = 3; m[4][12] = 3; m[4][13] = 3;
    // Kursi Meeting (atas, bawah, samping)
    m[2][10] = 4; m[2][11] = 4; m[2][12] = 4; m[2][13] = 4; // Kursi atas
    m[5][10] = 4; m[5][11] = 4; m[5][12] = 4; m[5][13] = 4; // Kursi bawah
    m[3][9]  = 4; m[4][9]  = 4;                              // Kursi samping kiri
    m[3][14] = 4; m[4][14] = 4;                              // Kursi samping kanan
    // Water Dispenser di dekat meeting room (row 1, col 8)
    m[1][8] = 6;
    // Tanaman hias ruang meeting (row 1, col 14)
    m[1][14] = 5;

    // ── ZONA 4: PANTRY & COFFEE LOUNGE (BAWAH KIRI) ──────────────────────────
    // Counter pantry & snack bar (row 9, col 1-2)
    m[9][1] = 18; m[9][2] = 18;
    // Coffee bar machine & water cooler (row 9, col 3)
    m[9][3] = 6;
    // Sofa modular lounge santai (row 12, col 2-4)
    m[12][2] = 14; m[12][3] = 14; m[12][4] = 14;
    // Sofa samping (row 13, col 2)
    m[13][2] = 14;
    // Meja kopi kaca (row 13, col 3-4)
    m[13][3] = 15; m[13][4] = 15;
    // Tanaman hias lounge (row 14, col 1)
    m[14][1] = 5;
    // Rak majalah di dinding pantry (row 8, col 2) - dipindah dari col 4 agar jalur masuk Rexa di col 4-5 bebas hambatan
    m[8][2] = 8;

    // ── ZONA 5: OPERATIONS, PRINTING & HOT-DESK (BAWAH KANAN) ────────────────
    // Printer Station & Lemari Arsip Logam (row 9, col 21-22)
    m[9][21] = 16; m[9][22] = 16;
    // Meja Hot-desk kerja tim (row 12, col 18-20)
    m[12][18] = 3; m[12][19] = 3; m[12][20] = 3;
    // Kursi hot-desk (row 11, col 18-20 & row 13, col 18-20)
    m[11][18] = 4; m[11][19] = 4; m[11][20] = 4;
    m[13][18] = 4; m[13][19] = 4; m[13][20] = 4;
    // Tanaman hias sudut operasional (row 14, col 22)
    m[14][22] = 5;

    // ── ENTRANCE & WALKWAY AKSEN ─────────────────────────────────────────────
    // Tanaman penyambut di samping lorong masuk utama (row 14, col 10 & 13)
    m[14][10] = 5;
    m[14][13] = 5;

    return m;
}

// ─── Palet Warna Tile & Zona Lantai (Modern Office / AI Town Palette) ────────
const TILE_COLORS = {
    0:  0xf4f1ea,  // Koridor / Hallway: Terrazzo batu hangat cerah ala kantor modern
    1:  0x475569,  // Dinding luar solid: Modern architectural slate
    2:  0x78716c,  // Dinding sekat/pilar: Architectural warm timber & stone
    3:  0xd4a373,  // Meja kayu: Scandinavian warm natural oak
    4:  0x334155,  // Kursi kantor: Ergonomic charcoal mesh
    5:  0x15803d,  // Tanaman: Hijau subur segar
    6:  0xf8fafc,  // Water cooler base: Putih bersih modern
    7:  0x94a3b8,  // Sekat partisi kaca: Frame chrome & aluminium
    8:  0x8d5b28,  // Rak buku kayu (Bookshelf)
    9:  0xf8fafc,  // Whiteboard / Smart Screen
    10: 0xf6e5cb,  // Zona 1 (Rexa): Lantai Kayu / Parket Cerah (Light Birch Parquet)
    11: 0xf8fafc,  // Zona 2 (Manajer): Lantai Marmer Putih Eksekutif
    12: 0xede8df,  // Zona 3 (Lounge): Lantai Karpet Hangat Oat/Beige Modern
    13: 0xdbeafe,  // Karpet aksen di bawah meja (Executive Accent Rug)
    14: 0x0f766e,  // Sofa lounge empuk (Teal modern)
    15: 0xd4a373,  // Meja kopi kaca lounge
    16: 0x64748b,  // Lemari arsip logam & printer
    17: 0x0f172a,  // Server Rack AI Mini Mainframe
    18: 0xb45309,  // Counter pantry & snack bar
};

const TILE_BORDER = {
    0:  0xe5e0d5,
    1:  0x334155,
    2:  0x57534e,
    3:  0xfaedcd,
    4:  0x64748b,
    5:  0x16a34a,
    6:  0xe2e8f0,
    7:  0x38bdf8,
    8:  0x5c3818,
    9:  0x94a3b8,
    10: 0xdfcaa8,
    11: 0xe2e8f0,
    12: 0xdcd5c9,
    13: 0x93c5fd,
    14: 0x115e59,
    15: 0xbc6c25,
    16: 0x475569,
    17: 0x334155,
    18: 0x92400e,
};

// ─── KELAS PINTU GESER OTOMATIS (DUAL-PANEL AUTOMATIC SLIDING DOOR) ───────────
class SlidingDoor {
    constructor(scene, config) {
        this.scene = scene;
        this.id = config.id;
        this.type = config.type; // 'horizontal' | 'vertical'
        this.cx = config.cx;
        this.cy = config.cy;
        this.isOpen = false;
        this.isAnimating = false;

        // 1. Static Physics Colliders (2 tiles per celah pintu)
        this.colliders = [];
        for (const t of config.tiles) {
            const colTile = config.doorGroup.create(t.x, t.y, 'tile-collider');
            colTile.setVisible(false);
            colTile.refreshBody();
            this.colliders.push(colTile);
        }

        // 2. Buat 2 Daun Pintu menggunakan Phaser.GameObjects.Rectangle
        if (this.type === 'horizontal') {
            const panelW = 31;
            const panelH = 18;
            this.initial1 = { x: this.cx - 16, y: this.cy };
            this.initial2 = { x: this.cx + 16, y: this.cy };
            this.target1  = { x: this.initial1.x - 32, y: this.initial1.y };
            this.target2  = { x: this.initial2.x + 32, y: this.initial2.y };

            this.panel1 = scene.add.rectangle(this.initial1.x, this.initial1.y, panelW, panelH, 0x38bdf8, 0.55);
            this.panel2 = scene.add.rectangle(this.initial2.x, this.initial2.y, panelW, panelH, 0x38bdf8, 0.55);
            this.sensor = scene.add.circle(this.cx, this.cy - 12, 2.5, 0x06b6d4).setDepth(8);
        } else {
            // Pintu Vertikal (Sekat Ruangan)
            const panelW = 18;
            const panelH = 31;
            this.initial1 = { x: this.cx, y: this.cy - 16 };
            this.initial2 = { x: this.cx, y: this.cy + 16 };
            this.target1  = { x: this.initial1.x, y: this.initial1.y - 32 };
            this.target2  = { x: this.initial2.x, y: this.initial2.y + 32 };

            this.panel1 = scene.add.rectangle(this.initial1.x, this.initial1.y, panelW, panelH, 0x38bdf8, 0.55);
            this.panel2 = scene.add.rectangle(this.initial2.x, this.initial2.y, panelW, panelH, 0x38bdf8, 0.55);
            this.sensor = scene.add.circle(this.cx, this.cy - 30, 2.5, 0x06b6d4).setDepth(8);
        }

        // Styling frame aluminium & depth daun pintu
        this.panel1.setStrokeStyle(1.5, 0x94a3b8, 0.95).setDepth(7);
        this.panel2.setStrokeStyle(1.5, 0x94a3b8, 0.95).setDepth(7);
    }

    open() {
        if (this.isOpen && !this.isAnimating) return;
        this.isOpen = true;
        this.isAnimating = true;

        // Matikan collision seketika saat buka agar player bisa lewat mulus
        for (const col of this.colliders) {
            col.body.enable = false;
        }

        if (this.sensor) this.sensor.setFillStyle(0x22c55e); // Neon hijau saat terbuka

        this.scene.tweens.killTweensOf([this.panel1, this.panel2]);

        this.scene.tweens.add({
            targets: this.panel1,
            x: this.target1.x,
            y: this.target1.y,
            duration: 250,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                this.isAnimating = false;
            }
        });

        this.scene.tweens.add({
            targets: this.panel2,
            x: this.target2.x,
            y: this.target2.y,
            duration: 250,
            ease: 'Cubic.easeOut',
        });
    }

    close(playerX, playerY) {
        if (!this.isOpen && !this.isAnimating) return;

        // Safety guard: jangan tutup jika player masih berada di dalam area pintu (< 65px)
        const dist = Phaser.Math.Distance.Between(playerX, playerY, this.cx, this.cy);
        if (dist < 65) return;

        this.isOpen = false;
        this.isAnimating = true;

        if (this.sensor) this.sensor.setFillStyle(0x06b6d4); // Cyan standby saat tertutup

        this.scene.tweens.killTweensOf([this.panel1, this.panel2]);

        this.scene.tweens.add({
            targets: this.panel1,
            x: this.initial1.x,
            y: this.initial1.y,
            duration: 250,
            ease: 'Cubic.easeInOut',
            onComplete: () => {
                this.isAnimating = false;
                // Nyalakan kembali collision hanya jika pintu memang masih tertutup
                if (!this.isOpen) {
                    for (const col of this.colliders) {
                        col.body.enable = true;
                    }
                }
            }
        });

        this.scene.tweens.add({
            targets: this.panel2,
            x: this.initial2.x,
            y: this.initial2.y,
            duration: 250,
            ease: 'Cubic.easeInOut',
        });
    }

    update(playerX, playerY) {
        const dist = Phaser.Math.Distance.Between(playerX, playerY, this.cx, this.cy);

        if (dist < 60 && !this.isOpen) {
            this.open();
        } else if (dist >= 75 && this.isOpen) {
            this.close(playerX, playerY);
        }
    }
}

// ─── SCENE UTAMA ─────────────────────────────────────────────────────────────
export class MainScene extends Phaser.Scene {
    constructor() {
        super('MainScene');
        this.isPlayerFrozen      = false;
        this._isChatInputFocused = false;
        this._lastModalCloseTime = 0;
        this.isNearRexa          = false;
        this.isNearManager       = false;
        this.isNearMaya          = false;
        this.isNearCitra         = false;
        this.isNearRian          = false;
        this.isNearBudi          = false;
        this.isNearTV            = false;
        this.isNearCoffee        = false;
        this._nearestChair       = null;
        this._sittableChairs     = [];
        this._livingNPCs         = {};
        this._lastCoffeeRoutineCheck = 0;
        this._doors              = [];
        this.autoCrisisEnabled   = true;
        this.autoCrisisTimer     = null;
        this._activeCheatToast   = null;
        this._cheatHoldingUR     = false;
        this._cheatUsedNumber    = false;
    }

    preload() {
        // Spritesheet karakter 32x32folk (12 frame per baris, 8 baris)
        this.load.spritesheet('characters', 'assets/characters/32x32folk.png', {
            frameWidth:  FRAME_W,
            frameHeight: FRAME_H,
        });
    }

    create() {
        const W = MAP_COLS * TILE_SIZE;
        const H = MAP_ROWS * TILE_SIZE;

        // Atur batas dunia game & kamera
        this.cameras.main.setBounds(0, 0, W, H);
        this.physics.world.setBounds(0, 0, W, H);

        // ── Buat Groups Fisika ────────────────────────────────────────────────
        this._wallGroup = this.physics.add.staticGroup();
        this._objGroup  = this.physics.add.staticGroup();
        this._doorGroup = this.physics.add.staticGroup();

        // ── Render Peta ───────────────────────────────────────────────────────
        this._mapData = buildMapData();
        this._buildMap();

        // ── Sistem Pintu Otomatis (Automatic Sliding Doors) ──────────────────
        this._createDoors();

        // ── Buat Animasi Karakter ─────────────────────────────────────────────
        this._createAnimations();

        // ── Spawn NPC Rexa & Meja Manajer ────────────────────────────────────
        this._createRexaNPC();
        this._createManagerDesk();

        // ── Spawn 4 NPC Baru Fungsional (Tugas C: Maya, Citra, Rian, Pak Budi)
        this._createMayaNPC();
        this._createCitraNPC();
        this._createRianNPC();
        this._createBudiNPC();

        // ── Spawn NPC Doni (Koordinator Operasional / AI Waypoint Patroli) ────
        this._createDoniNPC();

        // ── Objek Visual Smart TV (Command Center) di Dinding Lorong Tengah ───
        this._createSmartTV();

        // ── Tugas A: Mesin Kopi Espresso Bar & Kursi Santai (x: 482, y: 263) ──
        this._createCoffeeStation();

        // ── Tugas B: Inisialisasi Zona Kursi Duduk (Sittable Zones) ────────────
        this._initSittableChairs();

        // ── Tugas D: Inisialisasi AI Living Office & Rutinitas Kopi 4 NPC ──────
        this._initLivingOfficeRoutines();

        // ── Directive v3.2: Desk Clipping Surfaces, Mini Laptops & Typing Bubbles ─
        this._createDeskClipsAndLaptops();
        this._initTypingBubbleLoop();

        // ── Spawn Player Avatar (Pintu Masuk Utama) ─────────────────────────
        const spawnX = 11 * TILE_SIZE + TILE_SIZE;     // 368 px (Depan entrance)
        const spawnY = 13 * TILE_SIZE + TILE_SIZE / 2; // 432 px

        // FIX: Spawn player dengan frame idle-down yang benar
        // charFrames(CHAR_IDX_PLAYER, DIR_DOWN)[1] = frame tengah row 0, col 0 = frame 1
        this.player = this.physics.add.sprite(spawnX, spawnY, 'characters', charFrames(CHAR_IDX_PLAYER, DIR_DOWN)[1]);
        this.player.setCollideWorldBounds(true);
        this.player.setDepth(10);
        this.player.isSitting = false;

        // Hitbox pas di bagian kaki/badan bawah (gaya 2.5D RPG)
        this.player.body.setSize(18, 16);
        this.player.body.setOffset(7, 14);

        // ── Label Nama Player (High-contrast floating badge) ──────────────────
        this._nameTag = this.add.text(spawnX, spawnY - 20, 'Kamu (Manager)', {
            fontSize: '11px',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            color: '#4ade80',
            backgroundColor: '#0f172ae8',
            padding: { x: 7, y: 3 },
            stroke: '#000000',
            strokeThickness: 2,
        }).setDepth(11).setOrigin(0.5, 1);

        // ── Sistem Collision ──────────────────────────────────────────────────
        this.physics.add.collider(this.player, this._wallGroup);
        this.physics.add.collider(this.player, this._objGroup);
        this.physics.add.collider(this.player, this._doorGroup);

        // ── Drop Shadow Dinamis Player (Tugas C: Lighting & Shadows) ─────────
        this._playerShadow = this.add.graphics().setDepth(9);

        // ── Kamera Mengikuti Player dengan Easing Halus (Tugas C: Camera Polish)
        // Lerp 0.05 memberikan efek drifting kamera yang halus dan sinematik
        this.cameras.main.startFollow(this.player, true, 0.05, 0.05);
        this.cameras.main.setZoom(1.5);

        // ── Input Keyboard (WASD, Arrow Keys, E Interaksi) ───────────────────
        this._keys = this.input.keyboard.addKeys({
            up:    'W',
            down:  'S',
            left:  'A',
            right: 'D',
            upArr:    'UP',
            downArr:  'DOWN',
            leftArr:  'LEFT',
            rightArr: 'RIGHT',
            interact: 'E',
        });

        // ── Tombol Keyboard Developer Cheat & Chat Rexa ──────────────────────
        this._keyU = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.U);
        this._keyR = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
        this._key1 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
        this._key2 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);
        this._key3 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE);
        this._key4 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR);
        this._num1 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.NUMPAD_ONE);
        this._num2 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.NUMPAD_TWO);
        this._num3 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.NUMPAD_THREE);
        this._num4 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.NUMPAD_FOUR);

        // ── Dedicated Key [C] untuk Toggle Smartphone Chat Rexa ───────────────
        const keyC = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C);
        this._keyC = keyC;
        this._lastChatToggleTime = 0;
        const triggerToggleChat = () => {
            if (this._isChatInputFocused) return;
            const now = Date.now();
            if (now - this._lastChatToggleTime < 250) return;
            this._lastChatToggleTime = now;
            window.dispatchEvent(new CustomEvent('toggle-smartphone-chat'));
            EventBus.emit('toggle-smartphone-chat');
        };

        keyC.on('down', triggerToggleChat);

        // ── Tombol/Ikon UI Interaktif di Pojok Kanan Atas Canvas Phaser ───────
        const cam = this.cameras.main;
        // Hitung koordinat kamera untuk menempatkan HUD di pojok kanan atas layar (screen coords: x=885, y=24)
        const hudX = (cam.width * 0.5) + (885 - cam.width * 0.5) / cam.zoom;
        const hudY = (cam.height * 0.5) + (24 - cam.height * 0.5) / cam.zoom;

        const hudBtnContainer = this.add.container(hudX, hudY)
            .setScrollFactor(0)
            .setDepth(9999)
            .setScale(1 / cam.zoom); // Skala 1x terhadap layar aktual

        const hudBg = this.add.rectangle(0, 0, 136, 28, 0x0f172a, 0.92)
            .setStrokeStyle(1.5, 0x38bdf8, 0.85)
            .setOrigin(0.5, 0.5);

        const hudText = this.add.text(0, 0, '📱 Rexa Chat [C]', {
            fontSize: '11px',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            color: '#38bdf8',
        }).setOrigin(0.5, 0.5);

        hudBtnContainer.add([hudBg, hudText]);
        hudBtnContainer.setSize(136, 28);
        hudBtnContainer.setInteractive(
            new Phaser.Geom.Rectangle(-68, -14, 136, 28),
            Phaser.Geom.Rectangle.Contains
        );
        hudBtnContainer.input.cursor = 'pointer';

        hudBtnContainer.on('pointerover', () => {
            hudBg.setFillStyle(0x0284c7, 0.95);
            hudBg.setStrokeStyle(2, 0xbae6fd, 1);
            hudText.setColor('#ffffff');
        });

        hudBtnContainer.on('pointerout', () => {
            hudBg.setFillStyle(0x0f172a, 0.92);
            hudBg.setStrokeStyle(1.5, 0x38bdf8, 0.85);
            hudText.setColor('#38bdf8');
        });

        hudBtnContainer.on('pointerdown', (pointer) => {
            if (pointer.button !== 0) return;
            triggerToggleChat();
        });

        // ── Listener Smart Input Focus Trapping dari React ────────────────────
        EventBus.on('chat-input-focus', (isFocused) => {
            this._isChatInputFocused = Boolean(isFocused);
        });
        window.addEventListener('chat-input-focus', (e) => {
            this._isChatInputFocused = Boolean(e.detail?.isFocused ?? e.detail);
        });

        // Simpan arah terakhir player untuk animasi idle
        this._lastDir = 'down';

        // ── UI Prompt Interaksi Proximity Rexa (Dunia Game) ───────────────────
        this._rexaPrompt = this.add.text(
            this.rexaSprite.x,
            this.rexaSprite.y + 36,
            '⚡ [E: Analisis Toko]  💬 [C: Chat]',
            {
                fontSize: '11px',
                fontFamily: 'monospace',
                fontWeight: 'bold',
                color: '#ffffff',
                backgroundColor: '#d97706',
                padding: { x: 8, y: 4 },
                stroke: '#78350f',
                strokeThickness: 2,
            }
        )
        .setOrigin(0.5, 0)
        .setDepth(20)
        .setVisible(false);

        // ── UI Prompt Interaksi Proximity Meja Manajer (Dunia Game) ───────────
        this._managerPrompt = this.add.text(
            this.managerSprite.x,
            this.managerSprite.y + 36,
            '📋 [Tekan E untuk Review PO]',
            {
                fontSize: '11px',
                fontFamily: 'monospace',
                fontWeight: 'bold',
                color: '#ffffff',
                backgroundColor: '#0284c7',
                padding: { x: 8, y: 4 },
                stroke: '#075985',
                strokeThickness: 2,
            }
        )
        .setOrigin(0.5, 0)
        .setDepth(20)
        .setVisible(false);

        // ── UI Prompt Interaksi Proximity Maya (Dunia Game) ───────────────────
        this._mayaPrompt = this.add.text(
            this.mayaSprite.x,
            this.mayaSprite.y + 36,
            '📦 [Tekan E untuk Audit Stok]',
            {
                fontSize: '11px',
                fontFamily: 'monospace',
                fontWeight: 'bold',
                color: '#ffffff',
                backgroundColor: '#db2777',
                padding: { x: 8, y: 4 },
                stroke: '#9d174d',
                strokeThickness: 2,
            }
        )
        .setOrigin(0.5, 0)
        .setDepth(20)
        .setVisible(false);

        // ── UI Prompt Interaksi Proximity Citra (Dunia Game) ──────────────────
        this._citraPrompt = this.add.text(
            this.citraSprite.x,
            this.citraSprite.y + 36,
            '💼 [Tekan E untuk Realokasi Kas]',
            {
                fontSize: '11px',
                fontFamily: 'monospace',
                fontWeight: 'bold',
                color: '#ffffff',
                backgroundColor: '#0284c7',
                padding: { x: 8, y: 4 },
                stroke: '#075985',
                strokeThickness: 2,
            }
        )
        .setOrigin(0.5, 0)
        .setDepth(20)
        .setVisible(false);

        // ── UI Prompt Interaksi Proximity Rian (Dunia Game) ───────────────────
        this._rianPrompt = this.add.text(
            this.rianSprite.x,
            this.rianSprite.y + 36,
            '🛡️ [Tekan E untuk Guardrail Status]',
            {
                fontSize: '11px',
                fontFamily: 'monospace',
                fontWeight: 'bold',
                color: '#ffffff',
                backgroundColor: '#dc2626',
                padding: { x: 8, y: 4 },
                stroke: '#991b1b',
                strokeThickness: 2,
            }
        )
        .setOrigin(0.5, 0)
        .setDepth(20)
        .setVisible(false);

        // ── UI Prompt Interaksi Proximity Pak Budi (Dunia Game) ────────────────
        this._budiPrompt = this.add.text(
            this.budiSprite.x,
            this.budiSprite.y + 36,
            '📊 [Tekan E untuk Store Intelligence]',
            {
                fontSize: '11px',
                fontFamily: 'monospace',
                fontWeight: 'bold',
                color: '#ffffff',
                backgroundColor: '#059669',
                padding: { x: 8, y: 4 },
                stroke: '#065f46',
                strokeThickness: 2,
            }
        )
        .setOrigin(0.5, 0)
        .setDepth(20)
        .setVisible(false);

        // ── UI Prompt Interaksi Mesin Kopi (Tugas A) ─────────────────────────
        this._coffeePrompt = this.add.text(
            482,
            295,
            '☕ [Tekan E: Buat Kopi]',
            {
                fontSize: '11px',
                fontFamily: 'monospace',
                fontWeight: 'bold',
                color: '#ffffff',
                backgroundColor: '#b45309',
                padding: { x: 8, y: 4 },
                stroke: '#78350f',
                strokeThickness: 2,
            }
        )
        .setOrigin(0.5, 0)
        .setDepth(20)
        .setVisible(false);

        // ── UI Prompt Interaksi Kursi / Sittable Zones (Tugas B) ──────────────
        this._chairPrompt = this.add.text(
            0,
            0,
            '🪑 [Tekan E: Duduk]',
            {
                fontSize: '11px',
                fontFamily: 'monospace',
                fontWeight: 'bold',
                color: '#ffffff',
                backgroundColor: '#475569',
                padding: { x: 8, y: 4 },
                stroke: '#1e293b',
                strokeThickness: 2,
            }
        )
        .setOrigin(0.5, 0)
        .setDepth(20)
        .setVisible(false);

        // ── Event Listener Freeze / Unfreeze Movement ─────────────────────────
        EventBus.on('freeze-player', () => {
            this.isPlayerFrozen = true;
            if (this.player && this.player.body) {
                this.player.setVelocity(0, 0);
                // FIX: gunakan prefix 'player-' agar tidak salah ambil animasi NPC
                this.player.anims.play(`player-idle-${this._lastDir}`, true);
            }
            if (this._rexaPrompt) this._rexaPrompt.setVisible(false);
            if (this._managerPrompt) this._managerPrompt.setVisible(false);
            if (this._mayaPrompt) this._mayaPrompt.setVisible(false);
            if (this._citraPrompt) this._citraPrompt.setVisible(false);
            if (this._rianPrompt) this._rianPrompt.setVisible(false);
            if (this._budiPrompt) this._budiPrompt.setVisible(false);
            if (this._tvPrompt) this._tvPrompt.setVisible(false);
            if (this._doniPrompt) this._doniPrompt.setVisible(false);
            if (this._coffeePrompt) this._coffeePrompt.setVisible(false);
            if (this._chairPrompt) this._chairPrompt.setVisible(false);
        });

        const handleUnfreeze = () => {
            this._unfreezePlayer();
        };
        EventBus.on('unfreeze-player', handleUnfreeze);
        window.addEventListener('unfreeze-player', handleUnfreeze);

        // ── Listener Sistem Interkom NPC (Rexa ↔ NPC Calling System) ─────────
        this._activeCallingBadges = {};
        this._lastIntercomCallTime = {};

        const handleIntercomCall = (data) => {
            const payload = data?.detail || data;
            if (!payload || !payload.npcId) return;
            const npcId = String(payload.npcId).toLowerCase();
            const now = Date.now();
            if (this._lastIntercomCallTime[npcId] && (now - this._lastIntercomCallTime[npcId] < 500)) {
                return; // Debounce multi-events (window vs EventBus)
            }
            this._lastIntercomCallTime[npcId] = now;
            this._playNPCIntercomAnimation(npcId, payload.duration || 3000);
        };

        EventBus.on('npc-intercom-call', handleIntercomCall);
        window.addEventListener('npc-intercom-call', handleIntercomCall);

        // ── Listener Krisis Toko Darurat (Web Audio Klaxon SFX) ───────────────
        const handleCrisisTriggered = () => {
            playEmergencyKlaxonSFX();
        };
        EventBus.on('store-crisis-triggered', handleCrisisTriggered);
        window.addEventListener('store-crisis-triggered', handleCrisisTriggered);

        // ── Listener Telemetry Sync saat Cabang Toko Berganti (Directive v4.1) ─
        const handleStoreChanged = (store) => {
            const data = store?.detail || store;
            this._playTelemetrySyncAnimation(data);
        };
        EventBus.on('store-changed', handleStoreChanged);
        window.addEventListener('store-changed', handleStoreChanged);

        // ── Listener Timeline Shift saat Simulasi Waktu Melompat (Directive v4.3) ─
        let lastTimelineShiftTime = 0;
        const handleTimelineShift = (payload) => {
            const now = Date.now();
            if (now - lastTimelineShiftTime < 500) return; // Cegah eksekusi ganda dari EventBus + Window dispatch
            lastTimelineShiftTime = now;
            const data = payload?.detail || payload;
            this._playTimelineShiftAnimation(data);
        };
        EventBus.on('timeline-shift', handleTimelineShift);
        window.addEventListener('timeline-shift', handleTimelineShift);

        // ── Sistem Auto-Crisis Organik 30 Menit (Looping) ─────────────────────
        const AUTO_CRISIS_INTERVAL = 30 * 60 * 1000; // 30 Menit (1.800.000 ms)
        this.autoCrisisTimer = this.time.addEvent({
            delay: AUTO_CRISIS_INTERVAL,
            loop: true,
            callback: () => {
                if (!this.autoCrisisEnabled) return;
                const isCrisis = Boolean(window.StoreCrisisState?.isCrisis);
                if (isCrisis) return;

                // Doni memeriksa data toko; alarm hanya berbunyi kalau datanya memang menunjukkan krisis.
                if (typeof window !== 'undefined' && window.triggerStoreCrisis) {
                    window.triggerStoreCrisis()
                        .then((krisis) => console.log(`[Auto-Crisis] ⏰ Pemeriksaan 30 menit: ${krisis ? krisis.title : 'tidak ada krisis'}`))
                        .catch((err) => console.warn('[Auto-Crisis] Data toko tidak bisa dibaca:', err));
                }
            }
        });

        // ── Inisialisasi Adaptive Responsive Camera & Event Listener Resize ───
        this.scale.on('resize', (gameSize) => {
            if (gameSize) {
                this._updateResponsiveCamera(gameSize.width, gameSize.height);
            }
        });
        this._updateResponsiveCamera(this.scale.width, this.scale.height);

        // ── Listener Virtual Joystick & Smart Action (Directive v5.0 Mobile) ─
        this._joystickVector = { vx: 0, vy: 0, active: false };
        this._lastContextType = null;
        this._currentProxFlags = {};

        const onJoystickMove = (vec) => {
            this._joystickVector = vec || { vx: 0, vy: 0, active: false };
        };
        EventBus.on('virtual-joystick-move', onJoystickMove);
        window.addEventListener('virtual-joystick-move', (e) => onJoystickMove(e.detail));

        const onSmartAction = (data) => {
            if (this.isPlayerFrozen) return;
            const payload = data?.detail || data;
            this._handlePlayerInteraction(payload);
        };
        EventBus.on('action-button-pressed', onSmartAction);
        window.addEventListener('action-button-pressed', onSmartAction);
        EventBus.on('trigger-smart-action', onSmartAction);
        window.addEventListener('trigger-smart-action', onSmartAction);
        EventBus.on('mobile-action-pressed', onSmartAction);
        window.addEventListener('mobile-action-pressed', onSmartAction);

        // Binding tuts 'E' langsung di keyboard input phaser (Directive v5.4)
        if (this.input && this.input.keyboard) {
            this.input.keyboard.on('keydown-E', () => this._handlePlayerInteraction());
        }

        // Sinyal ke React bahwa scene siap
        EventBus.emit('current-scene-ready', this);
    }

    /**
     * Menghitung dan menyesuaikan zoom kamera secara adaptif (Directive v5.0 & v5.1):
     * - Mode Portrait (aspectRatio < 1.0): Memperlebar pandangan horizontal dan anti-void fill
     * - Mode Landscape (aspectRatio >= 1.0): Mengoptimalkan anti-void fill ratio
     */
    _updateResponsiveCamera(width, height) {
        if (!this.cameras || !this.cameras.main) return;
        const MAP_WIDTH  = MAP_COLS * TILE_SIZE; // 24 * 32 = 768 px
        const MAP_HEIGHT = MAP_ROWS * TILE_SIZE; // 16 * 32 = 512 px

        const currentW = width || this.scale.width || (typeof window !== 'undefined' ? window.innerWidth : 960);
        const currentH = height || this.scale.height || (typeof window !== 'undefined' ? window.innerHeight : 640);
        const aspectRatio = currentW / currentH;

        let targetZoom;

        // ── KONDISI 1: MOBILE PORTRAIT / VERTIKAL (aspectRatio < 1.0) ──────────
        if (aspectRatio < 1.0) {
            // Pada layar sempit memanjang, utamakan lebar horizontal (minimal 14-16 tile).
            const desiredWorldWidth = Math.min(MAP_WIDTH, 500);
            const horizontalZoom = currentW / desiredWorldWidth;
            const minVerticalZoom = currentH / MAP_HEIGHT;

            // Pastikan zoom cukup agar tidak menyisakan void hitam di bawah
            targetZoom = Math.max(horizontalZoom, minVerticalZoom * 0.82);
            targetZoom = Phaser.Math.Clamp(targetZoom, 0.95, 1.7);
        } 
        // ── KONDISI 2: DESKTOP / TABLET LANDSCAPE (aspectRatio >= 1.0) ─────────
        else {
            const zoomX = currentW / MAP_WIDTH;
            const zoomY = currentH / MAP_HEIGHT;
            const calculatedZoom = Math.max(zoomX, zoomY);
            targetZoom = Phaser.Math.Clamp(calculatedZoom * 1.05, 1.35, 2.25);
        }

        this.cameras.main.setZoom(targetZoom);

        // Hitung batas kamera agar peta terpusat dan tidak memotong kanvas (Cegah Canvas Void)
        const visibleW = currentW / targetZoom;
        const visibleH = currentH / targetZoom;
        const boundW = Math.max(MAP_WIDTH, visibleW);
        const boundH = Math.max(MAP_HEIGHT, visibleH);
        const boundX = (MAP_WIDTH - boundW) / 2;
        const boundY = (MAP_HEIGHT - boundH) / 2;
        this.cameras.main.setBounds(boundX, boundY, boundW, boundH);
    }

    update(time, delta) {
        if (!this.player || !this.player.body) return;
        const now = time || this.time.now;

        // ── Cek Kombinasi Tombol Rahasia Developer (U+R / U+R+1..4) ───────────
        this._updateCheatCodes();

        // ── Update Pintu Otomatis (Automatic Sliding Glass Doors) ─────────────
        if (this._doors) {
            for (const door of this._doors) {
                door.update(this.player.x, this.player.y);
            }
        }

        // ── Siarkan Posisi Layar Seluruh Karakter / NPC ────────────────────────
        const cam = this.cameras.main;
        if (this.rexaSprite) {
            const sx = (this.rexaSprite.x - cam.worldView.x) * cam.zoom;
            const sy = ((this.rexaSprite.y - 20) - cam.worldView.y) * cam.zoom;
            EventBus.emit('rexa-screen-pos', { x: Math.round(sx), y: Math.round(sy) });
        }
        if (this.managerSprite) {
            const mx = (this.managerSprite.x - cam.worldView.x) * cam.zoom;
            const my = ((this.managerSprite.y - 20) - cam.worldView.y) * cam.zoom;
            EventBus.emit('manager-screen-pos', { x: Math.round(mx), y: Math.round(my) });
        }
        if (this.mayaSprite) {
            const sx = (this.mayaSprite.x - cam.worldView.x) * cam.zoom;
            const sy = ((this.mayaSprite.y - 20) - cam.worldView.y) * cam.zoom;
            EventBus.emit('maya-screen-pos', { x: Math.round(sx), y: Math.round(sy) });
        }
        if (this.citraSprite) {
            const sx = (this.citraSprite.x - cam.worldView.x) * cam.zoom;
            const sy = ((this.citraSprite.y - 20) - cam.worldView.y) * cam.zoom;
            EventBus.emit('citra-screen-pos', { x: Math.round(sx), y: Math.round(sy) });
        }
        if (this.rianSprite) {
            const sx = (this.rianSprite.x - cam.worldView.x) * cam.zoom;
            const sy = ((this.rianSprite.y - 20) - cam.worldView.y) * cam.zoom;
            EventBus.emit('rian-screen-pos', { x: Math.round(sx), y: Math.round(sy) });
        }
        if (this.budiSprite) {
            const sx = (this.budiSprite.x - cam.worldView.x) * cam.zoom;
            const sy = ((this.budiSprite.y - 20) - cam.worldView.y) * cam.zoom;
            EventBus.emit('budi-screen-pos', { x: Math.round(sx), y: Math.round(sy) });
        }
        if (this.doniSprite) {
            const dx = (this.doniSprite.x - cam.worldView.x) * cam.zoom;
            const dy = ((this.doniSprite.y - 20) - cam.worldView.y) * cam.zoom;
            EventBus.emit('doni-screen-pos', { x: Math.round(dx), y: Math.round(dy) });
        }

        // ── UPDATE LOGIKA AI DONI (KOORDINATOR OPERASIONAL) ─────────────────
        if (this.doniSprite && this.doniSprite.body) {
            const isCrisis = Boolean(window.StoreCrisisState?.isCrisis);

            // Render drop shadow di bawah kaki Doni
            if (this._doniShadow) {
                this._doniShadow.clear();
                this._doniShadow.fillStyle(0x0f172a, 0.18);
                this._doniShadow.fillEllipse(this.doniSprite.x, this.doniSprite.y + 13, 18, 8);
            }

            // Posisi Floating Nametag
            if (this._doniNameTag) {
                this._doniNameTag.setPosition(this.doniSprite.x, this.doniSprite.y - 20);
            }

            // ── STATE 2: URGENT CHASE PLAYER ──────────────────────────────
            if (isCrisis) {
                // Pastikan Warning Beacon aktif di atas Doni
                if (!this._doniBeaconContainer) {
                    this._createDoniWarningBeacon();
                } else {
                    this._doniBeaconContainer.setPosition(this.doniSprite.x, this.doniSprite.y - 38);
                }

                const CHASE_SPEED = 85;
                const STOP_DIST = 46;
                const dx = this.player.x - this.doniSprite.x;
                const dy = this.player.y - this.doniSprite.y;
                const distToPlayer = Math.hypot(dx, dy);

                if (distToPlayer > STOP_DIST) {
                    const angle = Math.atan2(dy, dx);
                    this.doniSprite.setVelocity(Math.cos(angle) * CHASE_SPEED, Math.sin(angle) * CHASE_SPEED);
                    this._updateDoniWalkAnim(dx, dy);
                } else {
                    // Berhenti dan hadapkan Doni ke arah Player
                    this.doniSprite.setVelocity(0, 0);
                    this._faceDoniToward(dx, dy);
                }
            }
            // ── STATE 1: NORMAL WAYPOINT PATROL ───────────────────────────
            else {
                // Bersihkan warning beacon jika krisis selesai
                if (this._doniBeaconContainer) {
                    this._removeDoniWarningBeacon();
                }

                const PATROL_SPEED = 45;
                const targetWP = this._doniWaypoints[this._doniCurrentWP];
                const dx = targetWP.x - this.doniSprite.x;
                const dy = targetWP.y - this.doniSprite.y;
                const distToWP = Math.hypot(dx, dy);

                // Cek jika Doni tiba di waypoint
                if (distToWP < 12) {
                    if (!this._doniIsPaused) {
                        this._doniIsPaused = true;
                        this._doniPauseUntil = now + Phaser.Math.Between(1500, 2500);
                        this.doniSprite.setVelocity(0, 0);
                        this.doniSprite.anims.play(`doni-idle-${this._doniLastDir}`, true);
                    } else if (now >= this._doniPauseUntil) {
                        this._doniIsPaused = false;
                        this._doniCurrentWP = (this._doniCurrentWP + 1) % this._doniWaypoints.length;
                    }
                } else if (!this._doniIsPaused) {
                    const angle = Math.atan2(dy, dx);
                    this.doniSprite.setVelocity(Math.cos(angle) * PATROL_SPEED, Math.sin(angle) * PATROL_SPEED);
                    this._updateDoniWalkAnim(dx, dy);
                }
            }

            // ── PROXIMITY DONI KE PLAYER (< 50 pixels) ────────────────────
            const dxPlayer = this.player.x - this.doniSprite.x;
            const dyPlayer = this.player.y - (this.doniSprite.y + 16);
            const distPlayer = Math.hypot(dxPlayer, dyPlayer);
            const nearDoni = distPlayer < PROXIMITY_DIST;

            if (nearDoni !== this.isNearDoni) {
                this.isNearDoni = nearDoni;
                if (this._doniPrompt) {
                    if (isCrisis) {
                        this._doniPrompt.setText('🚨 [Tekan E: Tinjau Krisis Toko]').setStyle({ backgroundColor: '#dc2626', stroke: '#991b1b' });
                    } else {
                        this._doniPrompt.setText('🏃 [Tekan E: Koordinasi Doni]').setStyle({ backgroundColor: '#0284c7', stroke: '#075985' });
                    }
                    this._doniPrompt.setPosition(this.doniSprite.x, this.doniSprite.y + 36);
                    this._doniPrompt.setVisible(nearDoni && !this.isPlayerFrozen);
                }
                EventBus.emit('doni-proximity', { inRange: nearDoni, distance: Math.round(distPlayer) });
            } else if (nearDoni && this._doniPrompt) {
                this._doniPrompt.setPosition(this.doniSprite.x, this.doniSprite.y + 36);
            }
        }

        // ── Tugas D: Update Loop Rutinitas AI Living Office 4 NPC ─────────────
        this._updateLivingNPCs(now);

        // ── 1. Cek Proximity Avatar ke Rexa (< 50 pixels) ─────────────────────
        const dxRexa = this.player.x - this.rexaSprite.x;
        const dyRexa = this.player.y - (this.rexaSprite.y + 16);
        const distRexa = Math.hypot(dxRexa, dyRexa);
        const nearRexa = distRexa < PROXIMITY_DIST;

        if (nearRexa !== this.isNearRexa) {
            this.isNearRexa = nearRexa;
            this._rexaPrompt.setVisible(nearRexa && !this.isPlayerFrozen);
            EventBus.emit('rexa-proximity', { inRange: nearRexa, distance: Math.round(distRexa) });
        }

        // ── 2. Cek Proximity Avatar ke Meja Manajer (< 50 pixels) ──────────────
        const dxMgr = this.player.x - this.managerSprite.x;
        const dyMgr = this.player.y - (this.managerSprite.y + 16);
        const distMgr = Math.hypot(dxMgr, dyMgr);
        const nearMgr = distMgr < PROXIMITY_DIST;

        if (nearMgr !== this.isNearManager) {
            this.isNearManager = nearMgr;
            this._managerPrompt.setVisible(nearMgr && !this.isPlayerFrozen);
            EventBus.emit('manager-proximity', { inRange: nearMgr, distance: Math.round(distMgr) });
        }

        // ── 3. Cek Proximity Avatar ke Maya (Auditor Stok) (< 50 pixels) ──────
        const dxMaya = this.player.x - this.mayaSprite.x;
        const dyMaya = this.player.y - (this.mayaSprite.y + 16);
        const distMaya = Math.hypot(dxMaya, dyMaya);
        const nearMaya = distMaya < PROXIMITY_DIST;

        if (nearMaya !== this.isNearMaya) {
            this.isNearMaya = nearMaya;
            if (this._mayaIsCalling) {
                this._mayaPrompt.setText('📞 [Sedang Berbicara di Interkom]').setStyle({ backgroundColor: '#d97706', stroke: '#78350f' });
            }
            this._mayaPrompt.setVisible(nearMaya && !this.isPlayerFrozen);
            EventBus.emit('maya-proximity', { inRange: nearMaya, distance: Math.round(distMaya) });
        }

        // ── 4. Cek Proximity Avatar ke Citra (Finance) (< 50 pixels) ──────────
        const dxCitra = this.player.x - this.citraSprite.x;
        const dyCitra = this.player.y - (this.citraSprite.y + 16);
        const distCitra = Math.hypot(dxCitra, dyCitra);
        const nearCitra = distCitra < PROXIMITY_DIST;

        if (nearCitra !== this.isNearCitra) {
            this.isNearCitra = nearCitra;
            if (this._citraIsCalling) {
                this._citraPrompt.setText('📞 [Sedang Berbicara di Interkom]').setStyle({ backgroundColor: '#d97706', stroke: '#78350f' });
            }
            this._citraPrompt.setVisible(nearCitra && !this.isPlayerFrozen);
            EventBus.emit('citra-proximity', { inRange: nearCitra, distance: Math.round(distCitra) });
        }

        // ── 5. Cek Proximity Avatar ke Rian (Guardrail) (< 50 pixels) ─────────
        const dxRian = this.player.x - this.rianSprite.x;
        const dyRian = this.player.y - (this.rianSprite.y + 16);
        const distRian = Math.hypot(dxRian, dyRian);
        const nearRian = distRian < PROXIMITY_DIST;

        if (nearRian !== this.isNearRian) {
            this.isNearRian = nearRian;
            if (this._rianIsCalling) {
                this._rianPrompt.setText('📞 [Sedang Berbicara di Interkom]').setStyle({ backgroundColor: '#d97706', stroke: '#78350f' });
            }
            this._rianPrompt.setVisible(nearRian && !this.isPlayerFrozen);
            EventBus.emit('rian-proximity', { inRange: nearRian, distance: Math.round(distRian) });
        }

        // ── 6. Cek Proximity Avatar ke Pak Budi (Director) (< 50 pixels) ──────
        const dxBudi = this.player.x - this.budiSprite.x;
        const dyBudi = this.player.y - (this.budiSprite.y + 16);
        const distBudi = Math.hypot(dxBudi, dyBudi);
        const nearBudi = distBudi < PROXIMITY_DIST;

        if (nearBudi !== this.isNearBudi) {
            this.isNearBudi = nearBudi;
            if (this._budiIsCalling) {
                this._budiPrompt.setText('📞 [Sedang Berbicara di Interkom]').setStyle({ backgroundColor: '#d97706', stroke: '#78350f' });
            }
            this._budiPrompt.setVisible(nearBudi && !this.isPlayerFrozen);
            EventBus.emit('budi-proximity', { inRange: nearBudi, distance: Math.round(distBudi) });
        }

        // ── 7. Cek Proximity Avatar ke Smart TV (< 50 pixels) ─────────────────
        let nearTV = false;
        if (this.tvObject) {
            const dxTV = this.player.x - this.tvObject.x;
            const dyTV = this.player.y - this.tvObject.y;
            const distTV = Math.hypot(dxTV, dyTV);
            nearTV = distTV < PROXIMITY_DIST;

            if (nearTV !== this.isNearTV) {
                this.isNearTV = nearTV;
                if (this._tvPrompt) this._tvPrompt.setVisible(nearTV && !this.isPlayerFrozen);

                // Dispatch event global-tv-proximity untuk State Peek (1/8) React
                const proxPayload = { active: nearTV, showInspectHint: true, distance: Math.round(distTV) };
                EventBus.emit('global-tv-proximity', proxPayload);
                window.dispatchEvent(new CustomEvent('global-tv-proximity', { detail: proxPayload }));
                EventBus.emit('tv-proximity', { inRange: nearTV, distance: Math.round(distTV) });
            }
        }

        // ── 8. Cek Proximity Avatar ke Mesin Kopi (< 50 pixels) (Tugas A) ─────
        const dxCoffee = this.player.x - 482;
        const dyCoffee = this.player.y - 263;
        const distCoffee = Math.hypot(dxCoffee, dyCoffee);
        const nearCoffee = distCoffee < PROXIMITY_DIST && !this.player.isSitting;

        if (nearCoffee !== this.isNearCoffee) {
            this.isNearCoffee = nearCoffee;
            if (this._coffeePrompt) this._coffeePrompt.setVisible(nearCoffee && !this.isPlayerFrozen);
        }

        // ── 9. Cek Proximity Avatar ke Kursi / Sittable Zones (Tugas B) ───────
        if (!this.player.isSitting) {
            let nearest = null;
            let minDist = 34;
            if (this._sittableChairs) {
                for (const chair of this._sittableChairs) {
                    const d = Math.hypot(this.player.x - chair.x, this.player.y - chair.y);
                    if (d < minDist) {
                        minDist = d;
                        nearest = chair;
                    }
                }
            }
            this._nearestChair = nearest;
            if (this._chairPrompt) {
                const showChairPrompt = !!nearest && !nearCoffee && !nearRexa && !nearMgr && !nearMaya && !nearCitra && !nearRian && !nearBudi && !nearTV && !this.isNearDoni && !this.isPlayerFrozen;
                if (showChairPrompt) {
                    this._chairPrompt.setText('🪑 [Tekan E: Duduk]');
                    this._chairPrompt.setStyle({ backgroundColor: '#475569', stroke: '#1e293b' });
                    this._chairPrompt.setPosition(nearest.x, nearest.y + 20);
                    this._chairPrompt.setVisible(true);
                } else {
                    this._chairPrompt.setVisible(false);
                }
            }
        } else {
            // Player sedang dalam kondisi duduk (Sitting State)
            if (this._chairPrompt) {
                this._chairPrompt.setText('🪑 [Tekan E: Berdiri]');
                this._chairPrompt.setStyle({ backgroundColor: '#dc2626', stroke: '#991b1b' });
                this._chairPrompt.setPosition(this.player.x, this.player.y + 22);
                this._chairPrompt.setVisible(!this.isPlayerFrozen);
            }
        }

        // ── Simpan Status Proximity Terkini untuk Smart Action Button (Directive v5.0) ─
        this._currentProxFlags = { nearRexa, nearMgr, nearMaya, nearCitra, nearRian, nearBudi, nearTV };

        // ── Broadcast Context Dinamis ke Smart Action Button (Mobile) ────────
        let activeContextType = 'none';
        let activeContextLabel = 'STANDBY';
        let activeContextIcon = '⚡';

        if (this.player.isSitting) {
            activeContextType = 'chair-stand';
            activeContextLabel = 'BANGKIT';
            activeContextIcon = '🚶';
        } else if (nearRexa) {
            activeContextType = 'rexa';
            activeContextLabel = 'ANALISIS';
            activeContextIcon = '🦖';
        } else if (nearMgr) {
            activeContextType = 'manager';
            activeContextLabel = 'REVIEW PO';
            activeContextIcon = '📋';
        } else if (nearMaya) {
            activeContextType = 'maya';
            activeContextLabel = 'AUDIT MAYA';
            activeContextIcon = '💬';
        } else if (nearCitra) {
            activeContextType = 'citra';
            activeContextLabel = 'AUDIT CITRA';
            activeContextIcon = '💬';
        } else if (nearRian) {
            activeContextType = 'rian';
            activeContextLabel = 'GUARDRAIL';
            activeContextIcon = '💬';
        } else if (nearBudi) {
            activeContextType = 'budi';
            activeContextLabel = 'INTEL BUDI';
            activeContextIcon = '💬';
        } else if (nearTV) {
            activeContextType = 'tv';
            activeContextLabel = 'INSPEKSI TV';
            activeContextIcon = '📺';
        } else if (this.isNearDoni) {
            activeContextType = 'doni';
            activeContextLabel = 'DONI HUB';
            activeContextIcon = '🚨';
        } else if (this.isNearCoffee) {
            activeContextType = 'coffee';
            activeContextLabel = 'SEDUR KOPI';
            activeContextIcon = '☕';
        } else if (this._nearestChair) {
            activeContextType = 'chair-sit';
            activeContextLabel = 'DUDUK';
            activeContextIcon = '🪑';
        }

        if (this._lastContextType !== activeContextType) {
            this._lastContextType = activeContextType;
            EventBus.emit('smart-action-context-changed', {
                type: activeContextType,
                label: activeContextLabel,
                icon: activeContextIcon,
                isActive: activeContextType !== 'none',
            });
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('smart-action-context-changed', {
                    detail: {
                        type: activeContextType,
                        label: activeContextLabel,
                        icon: activeContextIcon,
                        isActive: activeContextType !== 'none',
                    }
                }));
            }
        }

        // ── Tangani Tombol 'E' untuk Interaksi (Desktop) ──────────────────────
        const keyE = this._keys.interact;
        const eJustPressed = keyE && (keyE.isDown && !this._eWasDown);
        this._eWasDown = keyE ? keyE.isDown : false;

        const isECooldown = (Date.now() - (this._lastModalCloseTime || 0)) < 250;

        if (eJustPressed && !this.isPlayerFrozen && !isECooldown) {
            this._handlePlayerInteraction();
        }

        // ── Jika Pemain Sedang Duduk di Kursi (Tugas B: Matikan Input WASD) ──
        if (this.player.isSitting) {
            this.player.setVelocity(0, 0);
            this.player.anims.play('player-idle-down', true);
            this._nameTag.setPosition(this.player.x, this.player.y - 18);
            if (this._playerShadow) {
                this._playerShadow.clear();
                this._playerShadow.fillStyle(0x0f172a, 0.15);
                this._playerShadow.fillEllipse(this.player.x, this.player.y + 13, 18, 8);
            }
            return;
        }

        // ── Jika Pemain Dibekukan atau sedang fokus mengetik chat di smartphone ──
        if (this.isPlayerFrozen || this._isChatInputFocused) {
            this.player.setVelocity(0, 0);
            this.player.anims.play(`player-idle-${this._lastDir}`, true);
            this._nameTag.setPosition(this.player.x, this.player.y - 18);
            return;
        }

        // ── Kontrol Pergerakan WASD / Arrow Keys & Virtual Joystick ───────────
        const keys = this._keys;
        let vx = 0;
        let vy = 0;
        let moving = false;

        if (keys.left.isDown  || keys.leftArr.isDown)  { vx = -PLAYER_SPEED; moving = true; }
        if (keys.right.isDown || keys.rightArr.isDown) { vx =  PLAYER_SPEED; moving = true; }
        if (keys.up.isDown    || keys.upArr.isDown)    { vy = -PLAYER_SPEED; moving = true; }
        if (keys.down.isDown  || keys.downArr.isDown)  { vy =  PLAYER_SPEED; moving = true; }

        // Normalisasi pergerakan diagonal keyboard
        if (vx !== 0 && vy !== 0) {
            vx *= 0.7071;
            vy *= 0.7071;
        }

        // Cek input Virtual Joystick (Mobile) jika keyboard tidak ditekan
        if (!moving && this._joystickVector && this._joystickVector.active) {
            vx = this._joystickVector.vx;
            vy = this._joystickVector.vy;
            moving = Math.abs(vx) > 5 || Math.abs(vy) > 5;
        }

        this.player.setVelocity(vx, vy);

        // ── Update Animasi Sesuai Arah ────────────────────────────────────────
        if (moving) {
            if (Math.abs(vx) > Math.abs(vy)) {
                // FIX: semua key animasi player kini pakai prefix 'player-'
                if (vx < 0) { this.player.anims.play('player-walk-left',  true); this._lastDir = 'left';  }
                else        { this.player.anims.play('player-walk-right', true); this._lastDir = 'right'; }
            } else {
                if (vy < 0) { this.player.anims.play('player-walk-up',   true); this._lastDir = 'up';   }
                else        { this.player.anims.play('player-walk-down',  true); this._lastDir = 'down'; }
            }
        } else {
            this.player.anims.play(`player-idle-${this._lastDir}`, true);
        }

        // ── Update Posisi Name Tag & Bayangan Player ─────────────────────────
        this._nameTag.setPosition(this.player.x, this.player.y - 18);
        if (this._playerShadow) {
            this._playerShadow.clear();
            this._playerShadow.fillStyle(0x0f172a, 0.15);
            this._playerShadow.fillEllipse(this.player.x, this.player.y + 13, 18, 8);
        }

        // ── Broadcast Posisi Player ke React ──────────────────────────────────
        EventBus.emit('player-moved', {
            x: Math.round(this.player.x),
            y: Math.round(this.player.y),
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PRIVATE METHODS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Universal Player Interaction Handler (Directive v5.4)
     * Mengatur interaksi kontekstual untuk:
     * - Tombol keyboard fisik 'E' (Desktop)
     * - Smart Action Button jempol kanan (Mobile)
     * - Direct EventBus & CustomEvent 'mobile-action-pressed'
     */
    _handlePlayerInteraction(payload = null) {
        if (this.isPlayerFrozen) return;

        const now = Date.now();
        if (this._lastInteractionTime && (now - this._lastInteractionTime < 200)) return;
        if (this._lastModalCloseTime && (now - this._lastModalCloseTime < 200)) return;
        this._lastInteractionTime = now;

        // 1. Berdiri jika sedang duduk di kursi
        if (this.player.isSitting) {
            this.player.isSitting = false;
            this.player.y += 8;
            if (this._chairPrompt) this._chairPrompt.setVisible(false);
            this._showCheatNotification('🚶 Berdiri dari kursi', 0x64748b);
            return;
        }

        // 2. Hitung jarak REALTIME ke SEMUA target (Zero Stale-State)
        const px = this.player.x;
        const py = this.player.y;

        const distRexa = this.rexaSprite ? Math.hypot(px - this.rexaSprite.x, py - (this.rexaSprite.y + 16)) : 999;
        const distMgr = this.managerSprite ? Math.hypot(px - this.managerSprite.x, py - (this.managerSprite.y + 16)) : 999;
        const distMaya = this.mayaSprite ? Math.hypot(px - this.mayaSprite.x, py - (this.mayaSprite.y + 16)) : 999;
        const distCitra = this.citraSprite ? Math.hypot(px - this.citraSprite.x, py - (this.citraSprite.y + 16)) : 999;
        const distRian = this.rianSprite ? Math.hypot(px - this.rianSprite.x, py - (this.rianSprite.y + 16)) : 999;
        const distBudi = this.budiSprite ? Math.hypot(px - this.budiSprite.x, py - (this.budiSprite.y + 16)) : 999;
        const distTV = this.tvObject ? Math.hypot(px - this.tvObject.x, py - this.tvObject.y) : 999;
        const distDoni = this.doniSprite ? Math.hypot(px - this.doniSprite.x, py - (this.doniSprite.y + 16)) : 999;
        const distCoffee = Math.hypot(px - 482, py - 263);

        // Cari kursi terdekat
        let nearestChair = null;
        let minChairDist = 34;
        if (this._sittableChairs) {
            for (const chair of this._sittableChairs) {
                const d = Math.hypot(px - chair.x, py - chair.y);
                if (d < minChairDist) {
                    minChairDist = d;
                    nearestChair = chair;
                }
            }
        }

        // Tentukan context spesifik jika dikirim oleh tombol mobile
        const forceContext = payload?.context || payload?.npcId;

        // 3. Evaluasi Target Interaksi Berdasarkan Jarak Realtime (< PROXIMITY_DIST = 50px)
        if (distMaya < PROXIMITY_DIST || forceContext === 'maya') {
            if (this._mayaIsCalling) return;
            if (this._mayaPrompt) this._mayaPrompt.setVisible(false);
            this._freezePlayer();
            const npcPayload = { npcId: 'maya' };
            EventBus.emit('open-npc-dialog-modal', npcPayload);
            if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('open-npc-dialog-modal', { detail: npcPayload }));
            EventBus.emit('open-stock-modal');
            const currentStoreId = window.CURRENT_STORE?.id ? String(window.CURRENT_STORE.id) : '74';
            EventBus.emit('trigger-stock-opname', { store: currentStoreId });
        } else if (distCitra < PROXIMITY_DIST || forceContext === 'citra') {
            if (this._citraIsCalling) return;
            if (this._citraPrompt) this._citraPrompt.setVisible(false);
            this._freezePlayer();
            const npcPayload = { npcId: 'citra' };
            EventBus.emit('open-npc-dialog-modal', npcPayload);
            if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('open-npc-dialog-modal', { detail: npcPayload }));
            EventBus.emit('open-reallocation-modal');
            const currentStoreId = window.CURRENT_STORE?.id ? String(window.CURRENT_STORE.id) : '74';
            EventBus.emit('trigger-reallocation', { store: currentStoreId });
        } else if (distRian < PROXIMITY_DIST || forceContext === 'rian') {
            if (this._rianIsCalling) return;
            if (this._rianPrompt) this._rianPrompt.setVisible(false);
            this._freezePlayer();
            const npcPayload = { npcId: 'rian' };
            EventBus.emit('open-npc-dialog-modal', npcPayload);
            if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('open-npc-dialog-modal', { detail: npcPayload }));
            EventBus.emit('open-guardrail-modal');
            EventBus.emit('trigger-guardrail-command');
        } else if (distBudi < PROXIMITY_DIST || forceContext === 'budi') {
            if (this._budiIsCalling) return;
            if (this._budiPrompt) this._budiPrompt.setVisible(false);
            this._freezePlayer();
            const npcPayload = { npcId: 'budi' };
            EventBus.emit('open-npc-dialog-modal', npcPayload);
            if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('open-npc-dialog-modal', { detail: npcPayload }));
            EventBus.emit('open-intelligence-modal');
            const currentStoreId = window.CURRENT_STORE?.id ? String(window.CURRENT_STORE.id) : '74';
            EventBus.emit('trigger-store-intelligence', { store: currentStoreId });
        } else if (distMgr < PROXIMITY_DIST || forceContext === 'manager') {
            if (this._managerPrompt) this._managerPrompt.setVisible(false);
            this._freezePlayer();
            EventBus.emit('open-approval-modal');
            if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('open-approval-modal'));
        } else if (distRexa < PROXIMITY_DIST || forceContext === 'rexa') {
            if (this._rexaPrompt) this._rexaPrompt.setVisible(false);
            const currentStoreId = window.CURRENT_STORE?.id ? String(window.CURRENT_STORE.id) : '74';
            EventBus.emit('trigger-agent-analysis', { store: currentStoreId });
        } else if (distTV < PROXIMITY_DIST || forceContext === 'tv') {
            if (this._tvPrompt) this._tvPrompt.setVisible(false);
            EventBus.emit('open-global-tv-modal');
            if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('open-global-tv-modal'));
        } else if (distDoni < PROXIMITY_DIST || forceContext === 'doni') {
            if (this._doniPrompt) this._doniPrompt.setVisible(false);
            this._freezePlayer();
            EventBus.emit('open-crisis-hub-modal');
            if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('open-crisis-hub-modal'));
        } else if (distCoffee < PROXIMITY_DIST || forceContext === 'coffee') {
            this._brewCoffeeForPlayer();
        } else if (nearestChair || forceContext === 'chair-sit') {
            const chairToSit = nearestChair || this._nearestChair;
            if (chairToSit) {
                this.player.isSitting = true;
                this.player.setVelocity(0, 0);
                this.player.x = chairToSit.x;
                this.player.y = chairToSit.y - 8;
                this.player.anims.play('player-idle-down', true);
                this._lastDir = 'down';
                this._showCheatNotification(`🪑 Duduk santai di ${chairToSit.label}`, 0x38bdf8);
            }
        }
    }

    /**
     * Alias backward compatibility untuk _triggerContextAction
     */
    _triggerContextAction(payload = null) {
        this._handlePlayerInteraction(payload);
    }

    /** Render seluruh peta secara efisien dengan Graphics + Static Physics Colliders (Tugas C: Visual Overhaul) */
    _buildMap() {
        if (!this.textures.exists('tile-collider')) {
            const tempG = this.make.graphics({ x: 0, y: 0, add: false });
            tempG.fillStyle(0xffffff, 1);
            tempG.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
            tempG.generateTexture('tile-collider', TILE_SIZE, TILE_SIZE);
            tempG.destroy();
        }

        const g = this.add.graphics();
        const W = MAP_COLS;
        const H = MAP_ROWS;

        // ── LAYER 1: Lantai & Zona Estetika ──────────────────────────────────
        for (let r = 0; r < H; r++) {
            for (let c = 0; c < W; c++) {
                const type = this._mapData[r][c];
                const x = c * TILE_SIZE;
                const y = r * TILE_SIZE;

                // Tentukan warna dasar lantai
                let floorColor = TILE_COLORS[0];
                if (type === 10) floorColor = TILE_COLORS[10];
                else if (type === 11) floorColor = TILE_COLORS[11];
                else if (type === 12) floorColor = TILE_COLORS[12];
                else if (type === 13) floorColor = TILE_COLORS[13];
                else if (r <= 6 && c >= 1 && c <= 6) floorColor = TILE_COLORS[10];
                else if (r <= 6 && c >= 17 && c <= 22) floorColor = TILE_COLORS[11];
                else if (r <= 6 && c >= 7 && c <= 16) floorColor = TILE_COLORS[12];
                else if (r >= 8 && c >= 1 && c <= 8) floorColor = TILE_COLORS[12];
                else if (r >= 8 && c >= 15 && c <= 22) floorColor = TILE_COLORS[10];

                g.fillStyle(floorColor, 1);
                g.fillRect(x, y, TILE_SIZE, TILE_SIZE);

                // Tekstur detail zona lantai (Modern Office / AI Town Styling)
                if (type === 10 || (r <= 6 && c >= 1 && c <= 6 && type !== 1 && type !== 7) || (r >= 8 && c >= 15 && c <= 22 && type !== 1)) {
                    // Zona 1 & 5: Kayu Parket Cerah (Papan Scandinavian birch)
                    g.lineStyle(1, 0xdfcaa8, 0.6);
                    g.lineBetween(x, y + 10, x + TILE_SIZE, y + 10);
                    g.lineBetween(x, y + 21, x + TILE_SIZE, y + 21);
                    g.lineStyle(1, 0xc8b08b, 0.4);
                    g.lineBetween(x + ((r % 2) * 16), y, x + ((r % 2) * 16), y + 10);
                } else if (type === 11 || (r <= 6 && c >= 17 && c <= 22 && type !== 1 && type !== 7)) {
                    // Zona 2: Marmer Putih Eksekutif (Porselen putih bersih & lis platinum)
                    g.lineStyle(1, 0xe2e8f0, 0.85);
                    g.strokeRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
                    g.lineStyle(1, 0xffffff, 0.9);
                    g.lineBetween(x + 2, y + 2, x + 10, y + 2);
                } else if (type === 12 || ((r <= 6 && c >= 7 && c <= 16 || r >= 8 && c >= 1 && c <= 8) && type !== 1 && type !== 2)) {
                    // Zona 3 & 4: Karpet Hangat Lounge / Meeting (Tekstur anyaman oat/beige)
                    g.lineStyle(1, 0xdcd5c9, 0.6);
                    g.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
                    g.fillStyle(0xe2dbce, 0.4);
                    g.fillRect(x + 8, y + 8, 16, 16);
                } else if (type === 13) {
                    // Karpet Aksen di Bawah Meja & Pintu Masuk
                    if (r >= 2 && r <= 5 && c >= 9 && c <= 14) {
                        // Karpet ruang meeting: Royal Navy Blue dengan border emas mewah
                        g.fillStyle(0x1e3a8a, 1);
                        g.fillRect(x, y, TILE_SIZE, TILE_SIZE);
                        g.lineStyle(1.5, 0xf59e0b, 0.85);
                        g.strokeRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
                    } else if (c <= 7) {
                        // Karpet bawah meja Rexa: Honey Amber Rug
                        g.fillStyle(0xfef3c7, 1);
                        g.fillRect(x, y, TILE_SIZE, TILE_SIZE);
                        g.lineStyle(1.5, 0xf59e0b, 0.85);
                        g.strokeRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
                    } else if (c >= 17) {
                        // Karpet bawah meja Manajer: Ice Blue Rug
                        g.fillStyle(0xe0f2fe, 1);
                        g.fillRect(x, y, TILE_SIZE, TILE_SIZE);
                        g.lineStyle(1.5, 0x0284c7, 0.85);
                        g.strokeRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
                    } else {
                        // Welcome mat pintu masuk (row 14, col 11-12)
                        g.fillStyle(0x1e293b, 1);
                        g.fillRect(x, y, TILE_SIZE, TILE_SIZE);
                        g.lineStyle(1.5, 0xf59e0b, 0.9);
                        g.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
                    }
                } else {
                    // Koridor umum: Terrazzo batu hangat bersih
                    g.lineStyle(1, 0xe5e0d5, 0.6);
                    g.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
                }
            }
        }

        // ── LAYER 2: Pencahayaan & Bayangan Lembut (Daylight Ambient Shadows) ─
        g.fillStyle(0x0f172a, 0.12);
        for (let r = 0; r < H; r++) {
            for (let c = 0; c < W; c++) {
                const type = this._mapData[r][c];
                const x = c * TILE_SIZE;
                const y = r * TILE_SIZE;

                if (type === 3 || type === 15 || type === 18) {
                    // Drop shadow meja
                    g.fillRect(x + 4, y + 6, TILE_SIZE - 2, TILE_SIZE - 4);
                } else if (type === 4) {
                    // Shadow kursi
                    g.fillEllipse(x + TILE_SIZE / 2 + 2, y + TILE_SIZE - 4, 16, 7);
                } else if (type === 5) {
                    // Shadow tanaman
                    g.fillEllipse(x + TILE_SIZE / 2 + 2, y + TILE_SIZE - 2, 18, 8);
                } else if (type === 6 || type === 8 || type === 16 || type === 17) {
                    // Shadow dispenser, rak buku, printer, server rack
                    g.fillRect(x + 3, y + TILE_SIZE - 2, TILE_SIZE - 6, 4);
                } else if (type === 14) {
                    // Shadow sofa
                    g.fillRect(x + 3, y + TILE_SIZE - 2, TILE_SIZE - 4, 5);
                } else if (type === 1 || type === 2 || type === 7) {
                    // Bayangan jatuh dari dinding / sekat ke arah lantai
                    g.fillRect(x, y + TILE_SIZE, TILE_SIZE, 4);
                }
            }
        }

        // ── LAYER 3: Dinding, Sekat & Objek Furnitur & Clutter Props ─────────
        for (let r = 0; r < H; r++) {
            for (let c = 0; c < W; c++) {
                const type = this._mapData[r][c];
                const x = c * TILE_SIZE;
                const y = r * TILE_SIZE;

                if (type === 1) {
                    // Dinding luar solid perimeter (2.5D Architectural Wall)
                    g.fillStyle(0x475569, 1);
                    g.fillRect(x, y, TILE_SIZE, TILE_SIZE);
                    g.fillStyle(0x94a3b8, 1);
                    g.fillRect(x, y, TILE_SIZE, 8);
                    g.fillStyle(0x334155, 1);
                    g.fillRect(x, y + TILE_SIZE - 3, TILE_SIZE, 3);
                    g.lineStyle(1, 0x64748b, 0.9);
                    g.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
                } else if (type === 2) {
                    // Dinding sekat kolom lorong (Acoustic Walnut Wood Slat Partitions)
                    g.fillStyle(0x78716c, 1);
                    g.fillRect(x, y, TILE_SIZE, TILE_SIZE);
                    g.lineStyle(2, 0xa8a29e, 0.85);
                    g.lineBetween(x + 8, y + 3, x + 8, y + TILE_SIZE - 3);
                    g.lineBetween(x + 16, y + 3, x + 16, y + TILE_SIZE - 3);
                    g.lineBetween(x + 24, y + 3, x + 24, y + TILE_SIZE - 3);
                    g.fillStyle(0x44403c, 1);
                    g.fillRect(x, y, TILE_SIZE, 3);
                    g.fillRect(x, y + TILE_SIZE - 3, TILE_SIZE, 3);
                } else if (type === 7) {
                    // Sekat Partisi Kaca Modern (Modern Framed Glass Walls)
                    g.fillStyle(0x94a3b8, 1);
                    g.fillRect(x + 13, y, 6, TILE_SIZE);
                    g.fillStyle(0x38bdf8, 0.45);
                    g.fillRect(x + 5, y, 22, TILE_SIZE);
                    g.lineStyle(1.5, 0xffffff, 0.85);
                    g.lineBetween(x + 8, y + 4, x + 24, y + 28);
                    g.fillStyle(0x64748b, 1);
                    g.fillRect(x + 5, y + TILE_SIZE - 2, 22, 2);
                } else if (type === 3) {
                    // Meja kerja kayu Scandinavian Natural Oak
                    g.fillStyle(0xd4a373, 1);
                    g.fillRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
                    g.lineStyle(1.5, 0xfaedcd, 1);
                    g.lineBetween(x + 2, y + 2, x + TILE_SIZE - 3, y + 2);
                    g.lineStyle(1.5, 0xbc6c25, 0.9);
                    g.lineBetween(x + 2, y + TILE_SIZE - 2, x + TILE_SIZE - 3, y + TILE_SIZE - 2);
                    g.lineStyle(1, 0xb58451, 0.5);
                    g.lineBetween(x + 4, y + 12, x + TILE_SIZE - 6, y + 12);
                    g.lineBetween(x + 4, y + 20, x + TILE_SIZE - 6, y + 20);
                } else if (type === 4) {
                    // Kursi kantor ergonomis modern (Mesh Charcoal & Silver Base)
                    g.fillStyle(0x334155, 1);
                    g.fillRect(x + 7, y + 7, TILE_SIZE - 14, TILE_SIZE - 14);
                    g.fillStyle(0x1e293b, 1);
                    g.fillRect(x + 8, y + 5, TILE_SIZE - 16, 6);
                    g.lineStyle(1, 0x94a3b8, 0.85);
                    g.strokeRect(x + 7, y + 7, TILE_SIZE - 14, TILE_SIZE - 14);
                } else if (type === 5) {
                    // Tanaman Hias Pot (Potted Plant Segar)
                    g.fillStyle(0xe07a5f, 1);
                    g.fillRect(x + 9, y + 17, 14, 11);
                    g.fillStyle(0xf4a261, 1);
                    g.fillRect(x + 8, y + 15, 16, 4);
                    g.fillStyle(0x15803d, 1);
                    g.fillCircle(x + TILE_SIZE / 2, y + 10, 10);
                    g.fillStyle(0x22c55e, 0.95);
                    g.fillCircle(x + TILE_SIZE / 2 - 2, y + 9, 7);
                    g.fillStyle(0x4ade80, 0.9);
                    g.fillCircle(x + TILE_SIZE / 2 + 2, y + 7, 5);
                } else if (type === 6) {
                    // Coffee & Water Dispenser Station
                    g.fillStyle(0xf8fafc, 1);
                    g.fillRect(x + 9, y + 13, 14, 15);
                    g.lineStyle(1, 0xe2e8f0, 1);
                    g.strokeRect(x + 9, y + 13, 14, 15);
                    g.fillStyle(0x0284c7, 0.85);
                    g.fillRoundedRect(x + 10, y + 3, 12, 11, 3);
                    g.lineStyle(1, 0x38bdf8, 0.9);
                    g.strokeRoundedRect(x + 10, y + 3, 12, 11, 3);
                    g.fillStyle(0xffffff, 0.6);
                    g.fillRect(x + 12, y + 5, 2, 6);
                    g.fillStyle(0xef4444, 1);
                    g.fillRect(x + 11, y + 17, 3, 3);
                    g.fillStyle(0x3b82f6, 1);
                    g.fillRect(x + 17, y + 17, 3, 3);
                    g.fillStyle(0x94a3b8, 1);
                    g.fillRect(x + 11, y + 23, 10, 2);
                } else if (type === 8) {
                    // Rak Buku & File Binder Kayu (Bookshelf)
                    g.fillStyle(0x8d5b28, 1);
                    g.fillRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
                    g.lineStyle(1, 0x5c3818, 0.9);
                    g.strokeRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
                    // Ambalan rak kayu
                    g.fillStyle(0xba8c59, 1);
                    g.fillRect(x + 2, y + 10, TILE_SIZE - 4, 2);
                    g.fillRect(x + 2, y + 20, TILE_SIZE - 4, 2);
                    // Binder dan buku berwarna
                    g.fillStyle(0xef4444, 1); g.fillRect(x + 3, y + 3, 3, 7);
                    g.fillStyle(0x3b82f6, 1); g.fillRect(x + 7, y + 4, 4, 6);
                    g.fillStyle(0x10b981, 1); g.fillRect(x + 12, y + 3, 3, 7);
                    g.fillStyle(0xf59e0b, 1); g.fillRect(x + 16, y + 5, 4, 5);
                    g.fillStyle(0x8b5cf6, 1); g.fillRect(x + 21, y + 3, 3, 7);
                    g.fillStyle(0xf8fafc, 1); g.fillRect(x + 25, y + 4, 3, 6);
                    g.fillStyle(0x38bdf8, 1); g.fillRect(x + 3, y + 13, 4, 7);
                    g.fillStyle(0xf97316, 1); g.fillRect(x + 8, y + 12, 3, 8);
                    g.fillStyle(0x4ade80, 1); g.fillRect(x + 12, y + 14, 4, 6);
                    g.fillStyle(0xec4899, 1); g.fillRect(x + 17, y + 13, 3, 7);
                    g.fillStyle(0x64748b, 1); g.fillRect(x + 21, y + 12, 4, 8);
                    g.fillStyle(0xfef08a, 1); g.fillRect(x + 26, y + 14, 2, 6);
                } else if (type === 9) {
                    // Papan Whiteboard / Smart Presentation Screen
                    g.fillStyle(0x94a3b8, 1);
                    g.fillRect(x + 1, y + 2, TILE_SIZE - 2, TILE_SIZE - 4);
                    g.fillStyle(0xf8fafc, 1);
                    g.fillRect(x + 3, y + 4, TILE_SIZE - 6, TILE_SIZE - 8);
                    // Diagram analitik / chart lines
                    g.lineStyle(1.5, 0x2563eb, 0.9);
                    g.lineBetween(x + 6, y + 18, x + 13, y + 11);
                    g.lineBetween(x + 13, y + 11, x + 20, y + 15);
                    g.lineBetween(x + 20, y + 15, x + 26, y + 7);
                    g.lineStyle(1, 0xef4444, 0.8);
                    g.lineBetween(x + 6, y + 12, x + 15, y + 12);
                    // Tray spidol
                    g.fillStyle(0x475569, 1);
                    g.fillRect(x + 8, y + TILE_SIZE - 3, 16, 2);
                    g.fillStyle(0xef4444, 1); g.fillRect(x + 10, y + TILE_SIZE - 4, 3, 2);
                    g.fillStyle(0x3b82f6, 1); g.fillRect(x + 14, y + TILE_SIZE - 4, 3, 2);
                } else if (type === 14) {
                    // Sofa Lounge Empuk Modern (Teal Scandinavian Sofa)
                    g.fillStyle(0x0f766e, 1);
                    g.fillRoundedRect(x + 2, y + 4, TILE_SIZE - 4, TILE_SIZE - 6, 4);
                    g.fillStyle(0x115e59, 1);
                    g.fillRoundedRect(x + 4, y + 3, TILE_SIZE - 8, 8, 3);
                    g.fillStyle(0x14b8a6, 0.95);
                    g.fillRect(x + 5, y + 12, TILE_SIZE - 10, 10);
                    g.lineStyle(1, 0x0d9488, 0.8);
                    g.lineBetween(x + TILE_SIZE / 2, y + 12, x + TILE_SIZE / 2, y + 22);
                    g.fillStyle(0xd4a373, 1);
                    g.fillRect(x + 3, y + TILE_SIZE - 3, 3, 3);
                    g.fillRect(x + TILE_SIZE - 6, y + TILE_SIZE - 3, 3, 3);
                } else if (type === 15) {
                    // Meja Kopi Kaca Lounge (Coffee Table)
                    g.fillStyle(0xd4a373, 1);
                    g.fillRect(x + 3, y + 5, TILE_SIZE - 6, TILE_SIZE - 10);
                    g.fillStyle(0x38bdf8, 0.45);
                    g.fillRect(x + 5, y + 7, TILE_SIZE - 10, TILE_SIZE - 14);
                    // Cangkir kopi keramik
                    g.fillStyle(0xf8fafc, 1);
                    g.fillCircle(x + 11, y + 14, 4);
                    g.fillStyle(0x78350f, 1);
                    g.fillCircle(x + 11, y + 14, 2.5);
                    // Majalah bisnis
                    g.fillStyle(0xf43f5e, 1);
                    g.fillRect(x + 18, y + 10, 7, 9);
                    g.fillStyle(0xffffff, 0.8);
                    g.fillRect(x + 19, y + 12, 5, 2);
                } else if (type === 16) {
                    // Printer Station & Lemari Arsip Logam 3 Laci
                    g.fillStyle(0x64748b, 1);
                    g.fillRect(x + 3, y + 2, TILE_SIZE - 6, TILE_SIZE - 4);
                    g.lineStyle(1, 0x475569, 1);
                    g.strokeRect(x + 3, y + 2, TILE_SIZE - 6, TILE_SIZE - 4);
                    for (let i = 0; i < 3; i++) {
                        const ly = y + 4 + i * 8;
                        g.fillStyle(0x475569, 1);
                        g.fillRect(x + 5, ly, TILE_SIZE - 10, 7);
                        g.fillStyle(0xe2e8f0, 1);
                        g.fillRect(x + 11, ly + 2, 8, 2);
                        g.fillStyle(0xffffff, 0.85);
                        g.fillRect(x + 13, ly + 5, 4, 1.5);
                    }
                } else if (type === 17) {
                    // Server Rack AI Mini Mainframe
                    g.fillStyle(0x0f172a, 1);
                    g.fillRect(x + 3, y + 1, TILE_SIZE - 6, TILE_SIZE - 2);
                    g.lineStyle(1, 0x334155, 1);
                    g.strokeRect(x + 3, y + 1, TILE_SIZE - 6, TILE_SIZE - 2);
                    for (let i = 0; i < 5; i++) {
                        const sy = y + 4 + i * 5;
                        g.fillStyle(0x1e293b, 1);
                        g.fillRect(x + 5, sy, TILE_SIZE - 10, 4);
                        g.fillStyle(i % 2 === 0 ? 0x22c55e : 0x38bdf8, 1);
                        g.fillRect(x + 7, sy + 1, 2, 2);
                        g.fillStyle(0x22c55e, 1);
                        g.fillRect(x + 11, sy + 1, 2, 2);
                        g.fillStyle(0xf59e0b, 1);
                        g.fillRect(x + 15, sy + 1, 2, 2);
                    }
                } else if (type === 18) {
                    // Counter Pantry & Snack Bar
                    g.fillStyle(0xb45309, 1);
                    g.fillRect(x + 1, y + 5, TILE_SIZE - 2, TILE_SIZE - 7);
                    g.fillStyle(0xf8fafc, 1);
                    g.fillRect(x + 1, y + 3, TILE_SIZE - 2, 5);
                    g.lineStyle(1, 0xe2e8f0, 1);
                    g.strokeRect(x + 1, y + 3, TILE_SIZE - 2, 5);
                    // Espresso machine
                    g.fillStyle(0x94a3b8, 1);
                    g.fillRect(x + 6, y + 8, 10, 12);
                    g.fillStyle(0xef4444, 1);
                    g.fillRect(x + 8, y + 10, 2, 2);
                    // Cangkir
                    g.fillStyle(0xf8fafc, 1);
                    g.fillRect(x + 19, y + 13, 5, 5);
                }

                // ── LAYER 4: Registrasi Penghalang Fisika ─────────────────────
                if (type === 1 || type === 2 || type === 7) {
                    // Tembok luar, pilar, dan sekat partisi kaca
                    const wall = this._wallGroup.create(x + TILE_SIZE / 2, y + TILE_SIZE / 2, 'tile-collider');
                    wall.setVisible(false);
                    wall.refreshBody();
                } else if (type === 3 || type === 6 || type === 8 || type === 9 || type === 14 || type === 15 || type === 16 || type === 17 || type === 18) {
                    // Perabot solid & dekorasi
                    const obj = this._objGroup.create(x + TILE_SIZE / 2, y + TILE_SIZE / 2, 'tile-collider');
                    obj.setVisible(false);
                    obj.refreshBody();
                } else if (type === 5) {
                    // Pot tanaman di sudut (collision pas di pot bawah)
                    const plant = this._objGroup.create(x + TILE_SIZE / 2, y + TILE_SIZE / 2 + 4, 'tile-collider');
                    plant.setVisible(false);
                    plant.body.setSize(18, 16);
                    plant.refreshBody();
                }
            }
        }
    }

    /**
     * Daftarkan animasi gerak 4 arah dari spritesheet untuk SEMUA karakter.
     *
     * Menggunakan fungsi charFrames(charIdx, dirIdx) yang menghitung frame
     * berdasarkan layout RPG Maker / LPC yang sebenarnya:
     *   charFrames(0, DIR_DOWN) → [0,1,2]   (Player, hadap bawah)
     *   charFrames(0, DIR_LEFT) → [12,13,14] (Player, hadap kiri)
     *   charFrames(1, DIR_DOWN) → [3,4,5]   (Rexa, hadap bawah)
     *   dsb.
     *
     * Prefix unik ('player-', 'rexa-', 'mgr-') memastikan Phaser AnimationManager
     * tidak pernah salah memutar animasi karakter lain ke sprite yang berbeda.
     */
    /**
     * Daftarkan animasi gerak 4 arah dari spritesheet untuk SEMUA 7 karakter.
     *
     * Menggunakan fungsi charFrames(charIdx, dirIdx) LPC 2-set anti-bleeding formula:
     *   Player: charIdx = 0
     *   Rexa:   charIdx = 1
     *   Mgr:    charIdx = 2
     *   Budi:   charIdx = 3
     *   Citra:  charIdx = 4
     *   Maya:   charIdx = 5
     *   Rian:   charIdx = 6
     *
     * Prefix unik memastikan AnimationManager Phaser tidak pernah salah mapping antar karakter.
     */
    _createAnimations() {
        const charDefs = [
            { prefix: 'player', charIdx: CHAR_IDX_PLAYER  },
            { prefix: 'rexa',   charIdx: CHAR_IDX_REXA    },
            { prefix: 'mgr',    charIdx: CHAR_IDX_MANAGER },
            { prefix: 'budi',   charIdx: CHAR_IDX_BUDI    },
            { prefix: 'citra',  charIdx: CHAR_IDX_CITRA   },
            { prefix: 'maya',   charIdx: CHAR_IDX_MAYA    },
            { prefix: 'rian',   charIdx: CHAR_IDX_RIAN    },
            { prefix: 'doni',   charIdx: CHAR_IDX_DONI    },
        ];

        charDefs.forEach(({ prefix, charIdx }) => {
            // 3 frame walk per arah + 1 frame idle (frame tengah = index 1)
            const animList = [
                { key: `${prefix}-walk-down`,  frames: charFrames(charIdx, DIR_DOWN),  rate: 8, repeat: -1 },
                { key: `${prefix}-walk-left`,  frames: charFrames(charIdx, DIR_LEFT),  rate: 8, repeat: -1 },
                { key: `${prefix}-walk-right`, frames: charFrames(charIdx, DIR_RIGHT), rate: 8, repeat: -1 },
                { key: `${prefix}-walk-up`,    frames: charFrames(charIdx, DIR_UP),    rate: 8, repeat: -1 },
                // Idle = frame tengah (index 1) dari tiap arah
                { key: `${prefix}-idle-down`,  frames: [charFrames(charIdx, DIR_DOWN)[1]],  rate: 1, repeat: 0 },
                { key: `${prefix}-idle-left`,  frames: [charFrames(charIdx, DIR_LEFT)[1]],  rate: 1, repeat: 0 },
                { key: `${prefix}-idle-right`, frames: [charFrames(charIdx, DIR_RIGHT)[1]], rate: 1, repeat: 0 },
                { key: `${prefix}-idle-up`,    frames: [charFrames(charIdx, DIR_UP)[1]],    rate: 1, repeat: 0 },
            ];

            animList.forEach(({ key, frames, rate, repeat }) => {
                if (this.anims.exists(key)) return; // guard restart scene
                this.anims.create({
                    key,
                    frames: frames.map(f => ({ key: 'characters', frame: f })),
                    frameRate: rate,
                    repeat,
                });
            });
        });
    }

    /** Bekukan pergerakan avatar pemain dan putar animasi idle */
    _freezePlayer() {
        this.isPlayerFrozen = true;
        if (this.player && this.player.body) {
            this.player.setVelocity(0, 0);
            this.player.anims.play(`player-idle-${this._lastDir}`, true);
        }
    }

    /** Lepaskan pembekuan pergerakan avatar pemain & pulihkan input keyboard */
    _unfreezePlayer() {
        this.isPlayerFrozen = false;
        if (this.player) {
            if (this.player.body) {
                this.player.body.moves = true;
                this.player.body.enable = true;
                this.player.setVelocity(0, 0);
            }
            this.player.isSitting = false;
        }
        if (this.input) {
            this.input.enabled = true;
            if (this.input.keyboard) {
                this.input.keyboard.enabled = true;
                this.input.keyboard.resetKeys();
            }
        }
        this._isChatInputFocused = false;
        this._lastModalCloseTime = Date.now();
        this._eWasDown = true;
        if (this.game && this.game.canvas) {
            this.game.canvas.focus();
        }
    }

    /**
     * Memainkan animasi reaksi interkom pada target NPC saat ditelepon Rexa:
     * 1. Hentikan animasi/posisi awal, paksa hadap depan (DIR_DOWN).
     * 2. Spawn Floating Calling Badge (📞 CALLING...) di atas kepala NPC.
     * 3. Mainkan Tween getaran telepon (-18° s/d 18°) & denyut skala.
     * 4. Kunci proximity [E] dan perbarui teks prompt.
     * 5. Setelah durasi selesai, fade out badge dan pulihkan aktivitas kerja awal NPC.
     */
    _playNPCIntercomAnimation(npcId, duration = 3000) {
        let sprite = null;
        let prompt = null;

        if (npcId === 'maya') {
            sprite = this.mayaSprite;
            prompt = this._mayaPrompt;
            this._mayaIsCalling = true;
        } else if (npcId === 'citra') {
            sprite = this.citraSprite;
            prompt = this._citraPrompt;
            this._citraIsCalling = true;
        } else if (npcId === 'rian') {
            sprite = this.rianSprite;
            prompt = this._rianPrompt;
            this._rianIsCalling = true;
        } else if (npcId === 'budi') {
            sprite = this.budiSprite;
            prompt = this._budiPrompt;
            this._budiIsCalling = true;
        }

        if (!sprite) return;

        // Bersihkan badge lama jika ada panggilan berturut-turut pada NPC yang sama
        if (this._activeCallingBadges && this._activeCallingBadges[npcId]) {
            const old = this._activeCallingBadges[npcId];
            if (old.ringTween) old.ringTween.stop();
            if (old.pulseTween) old.pulseTween.stop();
            if (old.container) old.container.destroy();
            delete this._activeCallingBadges[npcId];
        }

        // 1. Simpan animasi awal dan putar ke arah depan (DIR_DOWN)
        const prevAnim = sprite.anims.currentAnim?.key || `${npcId}-idle-down`;
        sprite.anims.play(`${npcId}-idle-down`, true);

        // Update teks prompt proximity jika pemain sedang berada di dekatnya
        if (prompt) {
            prompt.setText('📞 [Sedang Berbicara di Interkom]');
            prompt.setStyle({ backgroundColor: '#d97706', stroke: '#78350f' });
        }

        // 2. Buat Floating Calling Badge melayang di atas kepala NPC
        const badgeY = sprite.y - 38;
        const badgeContainer = this.add.container(sprite.x, badgeY).setDepth(100);

        // Latar belakang pill
        const bg = this.add.rectangle(0, 0, 86, 22, 0x0f172a, 0.95)
            .setStrokeStyle(1.5, 0xf59e0b, 1)
            .setOrigin(0.5, 0.5);

        // Ikon telepon emoji yang akan digetarkan
        const phoneIcon = this.add.text(-24, 0, '📞', {
            fontSize: '13px',
        }).setOrigin(0.5, 0.5);

        // Teks mini CALLING...
        const callText = this.add.text(10, 0, 'CALLING...', {
            fontSize: '9px',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            color: '#fef08a',
        }).setOrigin(0.5, 0.5);

        badgeContainer.add([bg, phoneIcon, callText]);

        // 3. Tween 1: Rotasi Getar Telepon Berdering (-18° ke 18°)
        const ringTween = this.tweens.add({
            targets: phoneIcon,
            angle: { from: -18, to: 18 },
            duration: 75,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        });

        // Tween 2: Denyut Skala & Pantulan Halus (Scale & Bounce Pulse)
        const pulseTween = this.tweens.add({
            targets: badgeContainer,
            scaleX: 1.1,
            scaleY: 1.1,
            y: badgeY - 3,
            duration: 350,
            yoyo: true,
            repeat: -1,
            ease: 'Quad.easeInOut',
        });

        if (!this._activeCallingBadges) this._activeCallingBadges = {};
        this._activeCallingBadges[npcId] = { container: badgeContainer, ringTween, pulseTween };

        // 4. Timer Pembersihan & Pemulihan Animasi Awal setelah durasi selesai
        this.time.delayedCall(duration, () => {
            // Fade-out badge
            this.tweens.add({
                targets: badgeContainer,
                alpha: 0,
                duration: 250,
                onComplete: () => {
                    ringTween.stop();
                    pulseTween.stop();
                    badgeContainer.destroy();
                    if (this._activeCallingBadges && this._activeCallingBadges[npcId]?.container === badgeContainer) {
                        delete this._activeCallingBadges[npcId];
                    }
                },
            });

            // Lepaskan status calling dan pulihkan animasi awal
            if (npcId === 'maya') this._mayaIsCalling = false;
            else if (npcId === 'citra') this._citraIsCalling = false;
            else if (npcId === 'rian') this._rianIsCalling = false;
            else if (npcId === 'budi') this._budiIsCalling = false;

            sprite.setAngle(0);
            sprite.anims.play(prevAnim, true);

            // Pulihkan teks prompt default
            this._restoreNPCPrompt(npcId);
        });
    }

    /** Pulihkan teks & gaya prompt proximity NPC ke kondisi default */
    _restoreNPCPrompt(npcId) {
        if (npcId === 'maya' && this._mayaPrompt) {
            this._mayaPrompt.setText('📦 [Tekan E untuk Audit Stok]').setStyle({ backgroundColor: '#db2777', stroke: '#9d174d' });
        } else if (npcId === 'citra' && this._citraPrompt) {
            this._citraPrompt.setText('💼 [Tekan E untuk Realokasi Kas]').setStyle({ backgroundColor: '#0284c7', stroke: '#075985' });
        } else if (npcId === 'rian' && this._rianPrompt) {
            this._rianPrompt.setText('🛡️ [Tekan E untuk Guardrail Status]').setStyle({ backgroundColor: '#dc2626', stroke: '#991b1b' });
        } else if (npcId === 'budi' && this._budiPrompt) {
            this._budiPrompt.setText('📊 [Tekan E untuk Store Intelligence]').setStyle({ backgroundColor: '#059669', stroke: '#065f46' });
        }
    }

    /** Tempatkan NPC Rexa di mejanya (Ruang Copilot) */
    _createRexaNPC() {
        // Posisi duduk di belakang meja kerja (tengah col 3-4, row 2.5)
        const nx = 4 * TILE_SIZE;       // 128 px
        const ny = 2 * TILE_SIZE + 20;  // 84 px

        // FIX: Spawn Rexa — frame idle-down karakter Rexa (charIdx=1, DIR_DOWN, frame tengah)
        // charFrames(1, DIR_DOWN) = [3,4,5] → idle = frame 4
        // Drop shadow di bawah Rexa (Daylight Ambient Shadow)
        const rexaShadow = this.add.graphics().setDepth(8);
        rexaShadow.fillStyle(0x0f172a, 0.15);
        rexaShadow.fillEllipse(nx, ny + 13, 18, 8);

        this.rexaSprite = this.add.sprite(nx, ny, 'characters', charFrames(CHAR_IDX_REXA, DIR_DOWN)[1]);
        this.rexaSprite.setDepth(9);
        this.rexaSprite.anims.play('rexa-idle-down', true);

        // Monitor komputer di atas meja Rexa (col 3, row 3)
        const comp = this.add.graphics();
        // Stand monitor silver
        comp.fillStyle(0x64748b, 1);
        comp.fillRect(nx - 2, 3 * TILE_SIZE + 17, 4, 3);
        comp.fillRect(nx - 5, 3 * TILE_SIZE + 20, 10, 2);
        // Layar monitor cyan
        comp.fillStyle(0x0284c7, 0.95);
        comp.fillRect(nx - 8, 3 * TILE_SIZE + 6, 16, 11);
        comp.lineStyle(1, 0x38bdf8, 1);
        comp.strokeRect(nx - 8, 3 * TILE_SIZE + 6, 16, 11);
        comp.setDepth(10);

        // Label nama di atas kepala (High-contrast floating pill badge)
        this.add.text(nx, ny - 20, '🤖 REXA (Copilot)', {
            fontSize: '11px',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            color: '#fbbf24',
            backgroundColor: '#0f172ae8',
            padding: { x: 7, y: 3 },
            stroke: '#000000',
            strokeThickness: 2,
        }).setOrigin(0.5, 1).setDepth(11);
    }

    /** Tempatkan Meja Kerja Manajer & Station Approval */
    _createManagerDesk() {
        // Posisi Manajer di belakang mejanya (tengah col 19-20, row 2.5)
        const mx = 20 * TILE_SIZE;      // 640 px
        const my = 2  * TILE_SIZE + 20; // 84 px

        // Drop shadow di bawah Manajer (Daylight Ambient Shadow)
        const mgrShadow = this.add.graphics().setDepth(8);
        mgrShadow.fillStyle(0x0f172a, 0.15);
        mgrShadow.fillEllipse(mx, my + 13, 18, 8);

        this.managerSprite = this.add.sprite(mx, my, 'characters', charFrames(CHAR_IDX_MANAGER, DIR_DOWN)[1]);
        this.managerSprite.setDepth(9);
        this.managerSprite.anims.play('mgr-idle-down', true);

        // Monitor kerja di meja Manajer (col 24, row 3)
        const comp = this.add.graphics();
        // Stand monitor silver
        comp.fillStyle(0x64748b, 1);
        comp.fillRect(mx - 2, 3 * TILE_SIZE + 17, 4, 3);
        comp.fillRect(mx - 5, 3 * TILE_SIZE + 20, 10, 2);
        // Layar monitor hijau keuangan
        comp.fillStyle(0x16a34a, 0.95);
        comp.fillRect(mx - 8, 3 * TILE_SIZE + 6, 16, 11);
        comp.lineStyle(1, 0x4ade80, 1);
        comp.strokeRect(mx - 8, 3 * TILE_SIZE + 6, 16, 11);
        comp.setDepth(10);

        // Label nama (High-contrast floating pill badge)
        this.add.text(mx, my - 20, '👔 MEJA APPROVAL', {
            fontSize: '11px',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            color: '#38bdf8',
            backgroundColor: '#0f172ae8',
            padding: { x: 7, y: 3 },
            stroke: '#000000',
            strokeThickness: 2,
        }).setOrigin(0.5, 1).setDepth(11);
    }

    /** Tempatkan NPC Maya (Auditor Stok & Gudang) di Area Hot-Desk */
    _createMayaNPC() {
        // Posisi Maya di hot-desk gudang & operasional (col 19, row 11.5)
        const mx = 19 * TILE_SIZE;      // 608 px
        const my = 11 * TILE_SIZE + 16; // 368 px

        // Drop shadow di bawah Maya (Daylight Ambient Shadow)
        this._mayaShadow = this.add.graphics().setDepth(8);
        this._mayaShadow.fillStyle(0x0f172a, 0.15);
        this._mayaShadow.fillEllipse(mx, my + 13, 18, 8);

        this.mayaSprite = this.physics.add.sprite(mx, my, 'characters', charFrames(CHAR_IDX_MAYA, DIR_DOWN)[1]);
        this.mayaSprite.setDepth(9);
        this.mayaSprite.anims.play('maya-idle-down', true); // Maya audit: hadap depan (idle-down)

        // Clipboard audit inventori di atas meja hot-desk
        const clip = this.add.graphics();
        clip.fillStyle(0x8d5b28, 1);
        clip.fillRect(mx - 5, 12 * TILE_SIZE + 6, 10, 14);
        clip.fillStyle(0xf8fafc, 1);
        clip.fillRect(mx - 4, 12 * TILE_SIZE + 8, 8, 11);
        clip.fillStyle(0x64748b, 1);
        clip.fillRect(mx - 3, 12 * TILE_SIZE + 5, 6, 2);
        clip.lineStyle(1, 0xef4444, 0.8);
        clip.lineBetween(mx - 2, 12 * TILE_SIZE + 11, mx + 2, 12 * TILE_SIZE + 11);
        clip.setDepth(10);

        // Label nama Maya (High-contrast floating pill badge)
        this._mayaNameTag = this.add.text(mx, my - 20, '📦 MAYA (Audit Stok)', {
            fontSize: '11px',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            color: '#f472b6',
            backgroundColor: '#0f172ae8',
            padding: { x: 7, y: 3 },
            stroke: '#000000',
            strokeThickness: 2,
        }).setOrigin(0.5, 1).setDepth(11);
    }

    /** Tempatkan NPC Citra (Financial Strategist) di Meja Rapat War Room */
    _createCitraNPC() {
        // Posisi Citra di kursi samping kiri meja meeting (col 9, row 3) menghadap ke meja (kanan)
        const cx = 9 * TILE_SIZE + 12;  // 300 px
        const cy = 3 * TILE_SIZE + 16;  // 112 px

        // Drop shadow di bawah Citra (Daylight Ambient Shadow)
        this._citraShadow = this.add.graphics().setDepth(8);
        this._citraShadow.fillStyle(0x0f172a, 0.15);
        this._citraShadow.fillEllipse(cx, cy + 13, 18, 8);

        this.citraSprite = this.physics.add.sprite(cx, cy, 'characters', charFrames(CHAR_IDX_CITRA, DIR_RIGHT)[1]);
        this.citraSprite.setDepth(9);
        this.citraSprite.anims.play('citra-idle-right', true); // Citra finance: hadap kanan (idle-right) ke meja rapat

        // Dokumen proposal finansial di atas meja rapat dekat Citra (col 10, row 3)
        const doc = this.add.graphics();
        doc.fillStyle(0x0284c7, 0.95);
        doc.fillRect(326, 108, 12, 9);
        doc.fillStyle(0xf8fafc, 1);
        doc.fillRect(327, 109, 10, 7);
        doc.lineStyle(1, 0x38bdf8, 1);
        doc.strokeRect(326, 108, 12, 9);
        doc.setDepth(10);

        // Label nama Citra (High-contrast floating pill badge)
        this._citraNameTag = this.add.text(cx, cy - 20, '💼 CITRA (Finance)', {
            fontSize: '11px',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            color: '#38bdf8',
            backgroundColor: '#0f172ae8',
            padding: { x: 7, y: 3 },
            stroke: '#000000',
            strokeThickness: 2,
        }).setOrigin(0.5, 1).setDepth(11);
    }

    /** Tempatkan NPC Rian (Security & Guardrail Admin) di Depan Pintu Masuk Rexa */
    _createRianNPC() {
        // Relokasi Rian ke luar pintu masuk Rexa (Row 8, Col 6) sebagai Gatekeeper / Security Sentinel
        const rx = 6 * TILE_SIZE + 6;   // 198 px (Tepat di samping kanan celah pintu Rexa)
        const ry = 8 * TILE_SIZE + 4;   // 260 px (Di area lorong depan pintu)

        // Drop shadow di bawah Rian (Daylight Ambient Shadow)
        this._rianShadow = this.add.graphics().setDepth(8);
        this._rianShadow.fillStyle(0x0f172a, 0.15);
        this._rianShadow.fillEllipse(rx, ry + 13, 18, 8);

        this.rianSprite = this.physics.add.sprite(rx, ry, 'characters', charFrames(CHAR_IDX_RIAN, DIR_DOWN)[1]);
        this.rianSprite.setDepth(9);
        this.rianSprite.anims.play('rian-idle-down', true); // Rian security: hadap depan (idle-down)

        // Terminal Konsol Keamanan / Biometric Gate Scanner di samping kanan Rian
        const terminal = this.add.graphics();
        terminal.fillStyle(0x1e293b, 1);
        terminal.fillRect(rx + 14, ry + 2, 12, 18);
        terminal.lineStyle(1, 0x475569, 1);
        terminal.strokeRect(rx + 14, ry + 2, 12, 18);
        // Layar scan mini
        terminal.fillStyle(0x0284c7, 1);
        terminal.fillRect(rx + 16, ry + 5, 8, 7);
        // Indikator lampu LED status
        terminal.fillStyle(0x22c55e, 1);
        terminal.fillCircle(rx + 20, ry + 15, 2);
        terminal.setDepth(10);

        // Label nama Rian (High-contrast floating pill badge)
        this._rianNameTag = this.add.text(rx, ry - 20, '🛡️ RIAN (Guardrail)', {
            fontSize: '11px',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            color: '#f87171',
            backgroundColor: '#0f172ae8',
            padding: { x: 7, y: 3 },
            stroke: '#000000',
            strokeThickness: 2,
        }).setOrigin(0.5, 1).setDepth(11);
    }

    /** Tempatkan NPC Pak Budi (Store Operations Director) di Depan Smart Screen */
    _createBudiNPC() {
        // Posisi Pak Budi di depan layar smart screen presentasi (col 12, row 2.5)
        const bx = 12 * TILE_SIZE;      // 384 px
        const by = 2  * TILE_SIZE + 20; // 84 px

        // Drop shadow di bawah Pak Budi (Daylight Ambient Shadow)
        this._budiShadow = this.add.graphics().setDepth(8);
        this._budiShadow.fillStyle(0x0f172a, 0.15);
        this._budiShadow.fillEllipse(bx, by + 13, 18, 8);

        this.budiSprite = this.physics.add.sprite(bx, by, 'characters', charFrames(CHAR_IDX_BUDI, DIR_DOWN)[1]);
        this.budiSprite.setDepth(9);
        this.budiSprite.anims.play('budi-idle-down', true); // Pak Budi: hadap depan (idle-down)

        // Tablet eksekutif / pointer presentasi
        const tablet = this.add.graphics();
        tablet.fillStyle(0x334155, 1);
        tablet.fillRect(bx + 8, by + 10, 8, 10);
        tablet.fillStyle(0x10b981, 0.9);
        tablet.fillRect(bx + 9, by + 11, 6, 8);
        tablet.setDepth(10);

        // Label nama Pak Budi (High-contrast floating pill badge)
        this._budiNameTag = this.add.text(bx, by - 20, '📊 PAK BUDI (Director)', {
            fontSize: '11px',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            color: '#34d399',
            backgroundColor: '#0f172ae8',
            padding: { x: 7, y: 3 },
            stroke: '#000000',
            strokeThickness: 2,
        }).setOrigin(0.5, 1).setDepth(11);
    }

    /** Tempatkan NPC Doni (Koordinator Operasional / AI Waypoint Patrol) */
    _createDoniNPC() {
        // Waypoints rute patroli koridor tertutup (6 titik bebas rintangan)
        this._doniWaypoints = [
            { x: 220, y: 260 }, // WP 1: Depan pintu Rexa & konsol Rian
            { x: 384, y: 260 }, // WP 2: Persimpangan tengah depan TV
            { x: 560, y: 260 }, // WP 3: Depan pintu Ruang Manajer
            { x: 560, y: 380 }, // WP 4: Depan meja hot-desk audit Maya
            { x: 384, y: 380 }, // WP 5: Koridor selatan dekat lobby
            { x: 220, y: 380 }, // WP 6: Area santai pantry & lounge
        ];

        const startX = this._doniWaypoints[0].x;
        const startY = this._doniWaypoints[0].y;

        // Drop shadow dinamis di bawah Doni
        this._doniShadow = this.add.graphics().setDepth(8);

        this.doniSprite = this.physics.add.sprite(startX, startY, 'characters', charFrames(CHAR_IDX_DONI, DIR_DOWN)[1]);
        this.doniSprite.setDepth(9);
        this.doniSprite.body.setSize(18, 16);
        this.doniSprite.body.setOffset(7, 14);
        this.doniSprite.setCollideWorldBounds(true);
        this.doniSprite.anims.play('doni-idle-down', true);

        // Label nama Doni (High-contrast floating badge)
        this._doniNameTag = this.add.text(startX, startY - 20, '🏃 DONI (Koordinator)', {
            fontSize: '11px',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            color: '#fb923c',
            backgroundColor: '#0f172ae8',
            padding: { x: 7, y: 3 },
            stroke: '#000000',
            strokeThickness: 2,
        }).setOrigin(0.5, 1).setDepth(11);

        // UI Prompt Interaksi Proximity Doni (Dunia Game)
        this._doniPrompt = this.add.text(
            startX,
            startY + 36,
            '🏃 [Tekan E: Koordinasi Doni]',
            {
                fontSize: '11px',
                fontFamily: 'monospace',
                fontWeight: 'bold',
                color: '#ffffff',
                backgroundColor: '#0284c7',
                padding: { x: 8, y: 4 },
                stroke: '#075985',
                strokeThickness: 2,
            }
        )
        .setOrigin(0.5, 0)
        .setDepth(20)
        .setVisible(false);

        this._doniCurrentWP = 0;
        this._doniIsPaused = false;
        this._doniPauseUntil = 0;
        this._doniLastDir = 'down';
        this.isNearDoni = false;
        this._doniBeaconContainer = null;
        this._doniBeaconTween = null;
        this._doniStrobeTimer = null;
    }

    /** Buat Floating Warning Beacon (❗️ URGENT ALERT) di atas kepala Doni */
    _createDoniWarningBeacon() {
        if (this._doniBeaconContainer) return;
        const bx = this.doniSprite.x;
        const by = this.doniSprite.y - 38;

        this._doniBeaconContainer = this.add.container(bx, by).setDepth(102);

        // Background pill merah neon
        const bg = this.add.rectangle(0, 0, 96, 22, 0xef4444, 0.95)
            .setStrokeStyle(1.5, 0xfef08a, 1)
            .setOrigin(0.5, 0.5);

        // Teks Tanda Seru Darurat
        const alertText = this.add.text(0, 0, '❗️ URGENT ALERT', {
            fontSize: '9px',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            color: '#ffffff',
        }).setOrigin(0.5, 0.5);

        this._doniBeaconContainer.add([bg, alertText]);

        // Tween denyut skala & float vertikal
        this._doniBeaconTween = this.tweens.add({
            targets: this._doniBeaconContainer,
            scaleX: 1.22,
            scaleY: 1.22,
            y: by - 4,
            duration: 280,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        });

        // Tween strobe flash warna
        this._doniStrobeTimer = this.time.addEvent({
            delay: 180,
            loop: true,
            callback: () => {
                if (bg && bg.active) {
                    const isRed = bg.fillColor === 0xef4444;
                    bg.setFillStyle(isRed ? 0xd97706 : 0xef4444, 0.95);
                }
            },
        });
    }

    /** Bersihkan Floating Warning Beacon saat krisis selesai & tampilkan ✔️ AMAN */
    _removeDoniWarningBeacon() {
        if (!this._doniBeaconContainer) return;

        if (this._doniBeaconTween) {
            this._doniBeaconTween.stop();
            this._doniBeaconTween = null;
        }
        if (this._doniStrobeTimer) {
            this._doniStrobeTimer.remove();
            this._doniStrobeTimer = null;
        }

        const oldContainer = this._doniBeaconContainer;
        this._doniBeaconContainer = null;

        // Fade-out badge lama
        this.tweens.add({
            targets: oldContainer,
            alpha: 0,
            duration: 200,
            onComplete: () => {
                oldContainer.destroy();
            },
        });

        // Munculkan badge resolusi hijau "✔️ TERKENDALI" selama 2 detik
        const okContainer = this.add.container(this.doniSprite.x, this.doniSprite.y - 38).setDepth(102);
        const okBg = this.add.rectangle(0, 0, 84, 20, 0x10b981, 0.95).setStrokeStyle(1.5, 0xa7f3d0, 1);
        const okText = this.add.text(0, 0, '✔️ TERKENDALI', {
            fontSize: '9px',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            color: '#ffffff',
        }).setOrigin(0.5, 0.5);
        okContainer.add([okBg, okText]);

        this.time.delayedCall(2000, () => {
            this.tweens.add({
                targets: okContainer,
                alpha: 0,
                duration: 250,
                onComplete: () => okContainer.destroy(),
            });
        });
    }

    _updateDoniWalkAnim(dx, dy) {
        if (!this.doniSprite || !this.doniSprite.anims) return;
        if (Math.abs(dx) > Math.abs(dy)) {
            if (dx > 0) {
                this.doniSprite.anims.play('doni-walk-right', true);
                this._doniLastDir = 'right';
            } else {
                this.doniSprite.anims.play('doni-walk-left', true);
                this._doniLastDir = 'left';
            }
        } else {
            if (dy > 0) {
                this.doniSprite.anims.play('doni-walk-down', true);
                this._doniLastDir = 'down';
            } else {
                this.doniSprite.anims.play('doni-walk-up', true);
                this._doniLastDir = 'up';
            }
        }
    }

    _faceDoniToward(dx, dy) {
        if (!this.doniSprite || !this.doniSprite.anims) return;
        if (Math.abs(dx) > Math.abs(dy)) {
            const dir = dx > 0 ? 'right' : 'left';
            this.doniSprite.anims.play(`doni-idle-${dir}`, true);
            this._doniLastDir = dir;
        } else {
            const dir = dy > 0 ? 'down' : 'up';
            this.doniSprite.anims.play(`doni-idle-${dir}`, true);
            this._doniLastDir = dir;
        }
    }

    /**
     * Objek Visual Smart TV Freestanding (Command Center Global Stats)
     * Ditempatkan di area tengah terbuka (row 10, col 12, x: 384, y: 320)
     * Desain: Freestanding digital display totem dengan stand penyangga & floor base
     */
    _createSmartTV() {
        const tvX = 384; // Col 12 (12 × 32 = 384 px)
        const tvY = 320; // Row 10 (10 × 32 = 320 px)
        const tvW = 68;  // Lebar layar TV
        const tvH = 38;  // Tinggi layar TV
        const screenCenterY = tvY - 12; // Posisi vertikal unit layar terangkat di atas tiang stand

        this.tvObject = { x: tvX, y: tvY };

        // ── 1. Bayangan Jatuh Stand di Lantai (Floor Drop Shadow) ────────────
        const shadowG = this.add.graphics().setDepth(4);
        shadowG.fillStyle(0x0f172a, 0.25);
        shadowG.fillEllipse(tvX, tvY + 16, 48, 12);

        // ── 2. Struktur Tiang & Base Stand Freestanding ───────────────────────
        const standG = this.add.graphics().setDepth(5);
        // Base plate logam berat di lantai
        standG.fillStyle(0x1e293b, 1);
        standG.fillRoundedRect(tvX - 22, tvY + 11, 44, 8, 3);
        standG.lineStyle(1.5, 0x475569, 1);
        standG.strokeRoundedRect(tvX - 22, tvY + 11, 44, 8, 3);
        standG.fillStyle(0x64748b, 0.9);
        standG.fillRect(tvX - 16, tvY + 13, 32, 2);

        // Tiang penyangga vertikal ganda (Dual Chrome Support Pillars)
        standG.fillStyle(0x334155, 1);
        standG.fillRect(tvX - 7, screenCenterY + tvH / 2, 14, 18);
        standG.fillStyle(0x64748b, 1);
        standG.fillRect(tvX - 5, screenCenterY + tvH / 2, 3, 18);
        standG.fillRect(tvX + 2, screenCenterY + tvH / 2, 3, 18);
        standG.lineStyle(1, 0x475569, 0.8);
        standG.strokeRect(tvX - 7, screenCenterY + tvH / 2, 14, 18);

        // ── 3. Unit Layar Smart TV ───────────────────────────────────────────
        const tvG = this.add.graphics().setDepth(6);

        // Efek Ambien Blue/Cyan Glow di belakang TV
        tvG.fillStyle(0x0284c7, 0.24);
        tvG.fillRoundedRect(tvX - tvW / 2 - 6, screenCenterY - tvH / 2 - 5, tvW + 12, tvH + 10, 8);
        tvG.fillStyle(0x38bdf8, 0.40);
        tvG.fillRoundedRect(tvX - tvW / 2 - 3, screenCenterY - tvH / 2 - 3, tvW + 6, tvH + 6, 6);

        // Bezel / Bingkai TV (Modern Ultra-Thin Charcoal & Chrome Border)
        tvG.fillStyle(0x0f172a, 1);
        tvG.fillRoundedRect(tvX - tvW / 2, screenCenterY - tvH / 2, tvW, tvH, 4);
        tvG.lineStyle(1.5, 0x475569, 1);
        tvG.strokeRoundedRect(tvX - tvW / 2, screenCenterY - tvH / 2, tvW, tvH, 4);

        // Layar TV (OLED Deep Navy 0x020617)
        tvG.fillStyle(0x020617, 1);
        tvG.fillRoundedRect(tvX - tvW / 2 + 2, screenCenterY - tvH / 2 + 2, tvW - 4, tvH - 4, 3);

        // ── 4. Grafis Miniatur Command Center di Layar TV ────────────────────
        // Header line
        tvG.lineStyle(1, 0x0284c7, 0.85);
        tvG.lineBetween(tvX - tvW / 2 + 5, screenCenterY - tvH / 2 + 8, tvX + tvW / 2 - 5, screenCenterY - tvH / 2 + 8);

        // LED Indicator Status "LIVE" (Hijau neon)
        tvG.fillStyle(0x22c55e, 1);
        tvG.fillCircle(tvX - tvW / 2 + 9, screenCenterY - tvH / 2 + 5, 2.2);

        // Mini bar chart di layar TV
        const barHeights = [6, 9, 13, 17, 12, 15, 19];
        const barStartX = tvX - 19;
        const barBaseY = screenCenterY + tvH / 2 - 4;
        barHeights.forEach((h, idx) => {
            const bx = barStartX + idx * 5.8;
            tvG.fillStyle(idx === 6 ? 0x38bdf8 : 0x10b981, 0.95);
            tvG.fillRect(bx, barBaseY - h, 4.2, h);
        });

        // Mini trend sparkline di sisi kiri
        tvG.lineStyle(1.2, 0x38bdf8, 0.9);
        tvG.lineBetween(tvX - tvW / 2 + 6, screenCenterY + 4, tvX - 9, screenCenterY - 3);
        tvG.lineBetween(tvX - 9, screenCenterY - 3, tvX - 4, screenCenterY + 7);

        // Mini label ticker di layar TV
        this.add.text(tvX - 17, screenCenterY - tvH / 2 + 2.5, 'GLOBAL STATS', {
            fontSize: '6.5px',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            color: '#38bdf8',
        }).setDepth(7);

        // ── 5. Label Floating Pill Badge di Atas TV ──────────────────────────
        this.add.text(tvX, screenCenterY - tvH / 2 - 8, '📺 SMART TV', {
            fontSize: '10px',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            color: '#38bdf8',
            backgroundColor: '#0f172ae8',
            padding: { x: 7, y: 2 },
            stroke: '#000000',
            strokeThickness: 2,
        }).setOrigin(0.5, 1).setDepth(11);

        // ── 6. UI Prompt Interaksi Proximity TV (Dunia Game) ─────────────────
        this._tvPrompt = this.add.text(
            tvX,
            tvY + 26,
            '🖥️ [Tekan E: Inspeksi Smart TV]',
            {
                fontSize: '11px',
                fontFamily: 'monospace',
                fontWeight: 'bold',
                color: '#ffffff',
                backgroundColor: '#0284c7',
                padding: { x: 8, y: 4 },
                stroke: '#075985',
                strokeThickness: 2,
            }
        )
        .setOrigin(0.5, 0)
        .setDepth(20)
        .setVisible(false);
    }

    /** Inisialisasi Sistem Pintu Kaca Geser Otomatis (Dual-Panel Sliding Doors) */
    _createDoors() {
        this._doors = [
            // ── PINTU HORIZONTAL (Lorong Bawah ⟷ Ruangan Atas) ────────────────
            // 1. Pintu Masuk Ruangan Rexa (Row 7, Cols 4-5) - Geser Kiri / Kanan
            new SlidingDoor(this, {
                id: 'rexa-south',
                type: 'horizontal',
                cx: 160,
                cy: 240,
                doorGroup: this._doorGroup,
                tiles: [
                    { x: 4 * TILE_SIZE + TILE_SIZE / 2, y: 7 * TILE_SIZE + TILE_SIZE / 2 },
                    { x: 5 * TILE_SIZE + TILE_SIZE / 2, y: 7 * TILE_SIZE + TILE_SIZE / 2 },
                ],
            }),

            // 2. Pintu Masuk Ruangan Meeting / War Room (Row 7, Cols 11-12) - Geser Kiri / Kanan
            new SlidingDoor(this, {
                id: 'warroom-south',
                type: 'horizontal',
                cx: 384,
                cy: 240,
                doorGroup: this._doorGroup,
                tiles: [
                    { x: 11 * TILE_SIZE + TILE_SIZE / 2, y: 7 * TILE_SIZE + TILE_SIZE / 2 },
                    { x: 12 * TILE_SIZE + TILE_SIZE / 2, y: 7 * TILE_SIZE + TILE_SIZE / 2 },
                ],
            }),

            // 3. Pintu Masuk Ruangan Manajer (Row 7, Cols 18-19) - Geser Kiri / Kanan
            new SlidingDoor(this, {
                id: 'manager-south',
                type: 'horizontal',
                cx: 608,
                cy: 240,
                doorGroup: this._doorGroup,
                tiles: [
                    { x: 18 * TILE_SIZE + TILE_SIZE / 2, y: 7 * TILE_SIZE + TILE_SIZE / 2 },
                    { x: 19 * TILE_SIZE + TILE_SIZE / 2, y: 7 * TILE_SIZE + TILE_SIZE / 2 },
                ],
            }),

            // ── PINTU VERTIKAL (Sekat Antar Ruangan Atas) ─────────────────────
            // 4. Pintu Sekat Ruang Rexa ⟷ War Room Citra (Col 7, Rows 4-5) - Geser Atas / Bawah
            new SlidingDoor(this, {
                id: 'rexa-east',
                type: 'vertical',
                cx: 240,
                cy: 160,
                doorGroup: this._doorGroup,
                tiles: [
                    { x: 7 * TILE_SIZE + TILE_SIZE / 2, y: 4 * TILE_SIZE + TILE_SIZE / 2 },
                    { x: 7 * TILE_SIZE + TILE_SIZE / 2, y: 5 * TILE_SIZE + TILE_SIZE / 2 },
                ],
            }),

            // 5. Pintu Sekat War Room Citra ⟷ Ruang Manajer (Col 16, Rows 4-5) - Geser Atas / Bawah
            new SlidingDoor(this, {
                id: 'manager-west',
                type: 'vertical',
                cx: 528,
                cy: 160,
                doorGroup: this._doorGroup,
                tiles: [
                    { x: 16 * TILE_SIZE + TILE_SIZE / 2, y: 4 * TILE_SIZE + TILE_SIZE / 2 },
                    { x: 16 * TILE_SIZE + TILE_SIZE / 2, y: 5 * TILE_SIZE + TILE_SIZE / 2 },
                ],
            }),
        ];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TUGAS A, B, C, D: LIVING OFFICE ECOSYSTEM & DYNAMIC ROUTINES
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * TUGAS A: Membangun Objek Mesin Kopi di koordinat statis (x: 482, y: 263)
     */
    _createCoffeeStation() {
        this._coffeeStation = this.add.container(482, 263).setDepth(8);

        // Meja Counter Espresso Bar (Kayu walnut & base charcoal)
        const counterBase = this.add.rectangle(0, 4, 34, 28, 0x1e293b, 1)
            .setStrokeStyle(1.5, 0x475569, 1);
        const woodTop = this.add.rectangle(0, -10, 36, 6, 0xb45309, 1);

        // Bodi Mesin Espresso Modern (Titanium silver & matte dark slate)
        const machineBody = this.add.rectangle(0, -16, 22, 18, 0x334155, 1)
            .setStrokeStyle(1, 0x94a3b8, 1);
        const machineTop = this.add.rectangle(0, -25, 20, 3, 0x64748b, 1);

        // Display digital & tombol brewing
        const screenMini = this.add.rectangle(-4, -18, 7, 5, 0x0284c7, 1);
        const btn1 = this.add.circle(4, -19, 1.5, 0xef4444, 1);
        const btn2 = this.add.circle(4, -15, 1.5, 0x22c55e, 1);

        // Drip tray & cangkir kopi keramik
        const dripTray = this.add.rectangle(0, -7, 16, 3, 0x0f172a, 1);
        const coffeeCup = this.add.rectangle(0, -10, 5, 5, 0xf8fafc, 1);

        this._coffeeStation.add([counterBase, woodTop, machineBody, machineTop, screenMini, btn1, btn2, dripTray, coffeeCup]);

        // Papan label nama floating di atas mesin kopi
        this.add.text(482, 226, '☕ ESPRESSO BAR', {
            fontSize: '9px',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            color: '#f59e0b',
            backgroundColor: '#0f172ae8',
            padding: { x: 5, y: 2 },
            stroke: '#000000',
            strokeThickness: 1.5,
        }).setOrigin(0.5, 1).setDepth(8);

        // Kursi santai / Cafe Bar Stool di samping mesin kopi (x: 440, y: 265)
        const cafeStoolShadow = this.add.graphics().setDepth(7);
        cafeStoolShadow.fillStyle(0x0f172a, 0.2);
        cafeStoolShadow.fillEllipse(440, 273, 16, 8);
        this.add.circle(440, 265, 8, 0xd97706, 1)
            .setStrokeStyle(1.5, 0x78350f, 1)
            .setDepth(8);
    }

    /**
     * TUGAS A: Eksekusi penyeduhan kopi untuk Avatar Player
     */
    _brewCoffeeForPlayer() {
        this._freezePlayer();
        this.player.anims.play('player-idle-up', true);
        if (this._coffeePrompt) this._coffeePrompt.setVisible(false);

        this._spawnCoffeeSteam(482, 263, 2600);
        this._showCheatNotification('☕ Menyeduh Kopi Espresso Segar...', 0xf59e0b);

        this.time.delayedCall(2600, () => {
            this._unfreezePlayer();
            this._showCheatNotification('✨ Kopi Siap! Stamina & Fokus Kerja +100%', 0x10b981);
        });
    }

    /**
     * TUGAS A & D: Partikel/Tween Uap Panas Mengambang (Floating Steam Puffs)
     */
    _spawnCoffeeSteam(x, y, durationMs = 3000) {
        this.time.addEvent({
            delay: 180,
            repeat: Math.floor(durationMs / 180) - 1,
            callback: () => {
                const sx = x + Phaser.Math.Between(-8, 8);
                const sy = y - 14;
                const puff = this.add.circle(sx, sy, Phaser.Math.Between(3, 5), 0xffffff, 0.75).setDepth(15);
                this.tweens.add({
                    targets: puff,
                    y: sy - Phaser.Math.Between(20, 32),
                    x: sx + Phaser.Math.Between(-6, 6),
                    scaleX: 2.2,
                    scaleY: 2.2,
                    alpha: 0,
                    duration: Phaser.Math.Between(700, 1000),
                    ease: 'Quad.easeOut',
                    onComplete: () => puff.destroy(),
                });
            },
        });
    }

    /**
     * TUGAS B: Inisialisasi Zona Kursi Duduk (Sittable Zones) di Berbagai Area Kantor
     */
    _initSittableChairs() {
        this._sittableChairs = [
            { id: 'coffee_bar_stool', x: 440, y: 265, label: 'Kursi Cafe Bar Espresso' },
            { id: 'meeting_citra',    x: 336, y: 176, label: 'Kursi Meeting Depan Citra' },
            { id: 'meeting_center',   x: 400, y: 176, label: 'Kursi Meeting Tengah' },
            { id: 'pantry_sofa_west', x: 80,  y: 395, label: 'Sofa Santai Pantry Barat' },
            { id: 'pantry_sofa_mid',  x: 112, y: 395, label: 'Sofa Santai Pantry Tengah' },
            { id: 'hotdesk_chair',    x: 592, y: 352, label: 'Kursi Kerja Hot-desk' },
        ];
    }

    /**
     * TUGAS B & C (Directive v3.2): Desk Clipping Surfaces & Mini Laptops
     * Render permukaan meja pada depth: 10 untuk menutupi bagian pinggang ke bawah NPC
     * yang duduk di depth: 9, serta menambahkan mini laptop dengan efek cyan screen glow.
     */
    _createDeskClipsAndLaptops() {
        const deskG = this.add.graphics().setDepth(10);

        // 1. Meja Kerja Rexa (Row 3, Col 3-4: x: 96, y: 96, w: 64, h: 32)
        this._drawDeskSurface(deskG, 96, 96, 64, 32);
        this._createLaptop(128, 104);

        // 2. Meja Kerja Manajer (Row 3, Col 19-20: x: 608, y: 96, w: 64, h: 32)
        this._drawDeskSurface(deskG, 608, 96, 64, 32);
        this._createLaptop(640, 104);

        // 3. Meja Meeting War Room (Row 3, Col 10-13: x: 320, y: 96, w: 128, h: 32)
        // Permukaan meja meeting menutupi laptop dan dokumen kerja
        this._drawDeskSurface(deskG, 320, 96, 128, 32);
        this._createLaptop(332, 112); // Laptop Citra di depan kursi kiri
        this._createLaptop(384, 104); // Laptop Pak Budi

        // 4. Meja Hot-desk Operasional Maya (Row 12, Col 18-20: x: 576, y: 384, w: 96, h: 32)
        this._drawDeskSurface(deskG, 576, 384, 96, 32);
        this._createLaptop(608, 394); // Laptop Maya

        // 5. Counter Security Guard Rian (Row 8, Col 6: x: 184, y: 268, w: 36, h: 18)
        this._drawSecurityDeskSurface(deskG, 184, 268, 36, 18);
        this._createLaptop(198, 274); // Konsol / Laptop Rian
    }

    /** Helper menggambar permukaan meja kayu Scandinavian Natural Oak (Depth 10) */
    _drawDeskSurface(g, x, y, width, height) {
        g.fillStyle(0xd4a373, 1);
        g.fillRect(x + 1, y + 1, width - 2, height - 2);
        g.lineStyle(1.5, 0xfaedcd, 1);
        g.lineBetween(x + 2, y + 2, x + width - 3, y + 2);
        g.lineStyle(1.5, 0xbc6c25, 0.9);
        g.lineBetween(x + 2, y + height - 2, x + width - 3, y + height - 2);
        g.lineStyle(1, 0xb58451, 0.45);
        g.lineBetween(x + 4, y + 12, x + width - 6, y + 12);
        g.lineBetween(x + 4, y + 20, x + width - 6, y + 20);
    }

    /** Helper menggambar permukaan meja security modern titanium & dark slate (Depth 10) */
    _drawSecurityDeskSurface(g, x, y, width, height) {
        g.fillStyle(0x1e293b, 1);
        g.fillRect(x + 1, y + 1, width - 2, height - 2);
        g.lineStyle(1.5, 0x475569, 1);
        g.lineBetween(x + 2, y + 2, x + width - 3, y + 2);
        g.lineStyle(1, 0x38bdf8, 0.7);
        g.lineBetween(x + 4, y + 5, x + width - 4, y + 5);
    }

    /**
     * TUGAS C (Directive v3.2): Helper Mini Laptop dengan Layar Bercahaya Biru (Pulsing Glow)
     */
    _createLaptop(x, y) {
        const laptopContainer = this.add.container(x, y).setDepth(10);

        const g = this.add.graphics();
        // 1. Keyboard Base (Aluminium / Dark Titanium)
        g.fillStyle(0x334155, 1);
        g.fillRect(-8, 1, 16, 6);
        // Trackpad
        g.fillStyle(0x1e293b, 1);
        g.fillRect(-2, 4, 4, 2);
        // Garis batas keyboard
        g.lineStyle(1, 0x64748b, 0.6);
        g.lineBetween(-6, 2, 6, 2);

        // 2. Bezel Layar (Tilted open display)
        g.fillStyle(0x0f172a, 1);
        g.fillRect(-7, -7, 14, 8);
        // Layar monitor (Deep Cyber Navy)
        g.fillStyle(0x0369a1, 1);
        g.fillRect(-6, -6, 12, 6);
        // Syntax lines
        g.lineStyle(1, 0x38bdf8, 0.85);
        g.lineBetween(-4, -4, 3, -4);
        g.lineBetween(-4, -2, 1, -2);

        laptopContainer.add(g);

        // 3. Screen Soft Glow Pulse (alpha 0.25 -> 0.65)
        const glow = this.add.graphics();
        glow.fillStyle(0x38bdf8, 0.35);
        glow.fillRect(-6, -6, 12, 6);
        laptopContainer.add(glow);

        this.tweens.add({
            targets: glow,
            alpha: { from: 0.25, to: 0.65 },
            duration: Phaser.Math.Between(1400, 2000),
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        });

        return laptopContainer;
    }

    /**
     * TUGAS C (Directive v3.2): Spawn Balon Chat Mini "Sedang Mengetik" (Typing Bubble)
     */
    _spawnTypingBubble(x, y) {
        const bubble = this.add.container(x, y).setDepth(25);

        const bg = this.add.graphics();
        // Pill container background
        bg.fillStyle(0x0f172a, 0.9);
        bg.fillRoundedRect(-14, -10, 28, 14, 5);
        bg.lineStyle(1, 0x38bdf8, 0.85);
        bg.strokeRoundedRect(-14, -10, 28, 14, 5);

        // Speech bubble triangle tail
        bg.fillStyle(0x0f172a, 0.9);
        bg.fillTriangle(-3, 4, 3, 4, 0, 7);
        bg.lineStyle(1, 0x38bdf8, 0.85);
        bg.lineBetween(-3, 4, 0, 7);
        bg.lineBetween(3, 4, 0, 7);

        // Text dots "•••"
        const txt = this.add.text(0, -3, '•••', {
            fontSize: '10px',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            color: '#38bdf8',
        }).setOrigin(0.5, 0.5);

        bubble.add([bg, txt]);

        // Animasi float up 12px dan fade out dalam 1500ms
        this.tweens.add({
            targets: bubble,
            y: y - 12,
            alpha: { from: 1, to: 0 },
            duration: 1500,
            ease: 'Quad.easeOut',
            onComplete: () => {
                bubble.destroy();
            },
        });
    }

    /**
     * TUGAS C (Directive v3.2): Timer Loop Indikator Mengetik Organik untuk Semua Pekerja Meja
     */
    _initTypingBubbleLoop() {
        const workers = [
            {
                id: 'rexa',
                getPos: () => this.rexaSprite ? { x: this.rexaSprite.x, y: this.rexaSprite.y } : null,
                isWorking: () => true,
            },
            {
                id: 'mgr',
                getPos: () => this.managerSprite ? { x: this.managerSprite.x, y: this.managerSprite.y } : null,
                isWorking: () => true,
            },
            {
                id: 'citra',
                getPos: () => this.citraSprite ? { x: this.citraSprite.x, y: this.citraSprite.y } : null,
                isWorking: () => !this._livingNPCs || this._livingNPCs.citra?.state === 'WORKING',
            },
            {
                id: 'maya',
                getPos: () => this.mayaSprite ? { x: this.mayaSprite.x, y: this.mayaSprite.y } : null,
                isWorking: () => !this._livingNPCs || this._livingNPCs.maya?.state === 'WORKING',
            },
            {
                id: 'rian',
                getPos: () => this.rianSprite ? { x: this.rianSprite.x, y: this.rianSprite.y } : null,
                isWorking: () => !this._livingNPCs || this._livingNPCs.rian?.state === 'WORKING',
            },
            {
                id: 'budi',
                getPos: () => this.budiSprite ? { x: this.budiSprite.x, y: this.budiSprite.y } : null,
                isWorking: () => !this._livingNPCs || this._livingNPCs.budi?.state === 'WORKING',
            },
        ];

        workers.forEach((worker, index) => {
            const scheduleBubble = (initialDelay = null) => {
                const delay = initialDelay !== null ? initialDelay : Phaser.Math.Between(4000, 7000);
                this.time.delayedCall(delay, () => {
                    if (this.sys && this.sys.isActive()) {
                        const pos = worker.getPos();
                        const isCalling = this[`_${worker.id}IsCalling`];
                        if (pos && worker.isWorking() && !isCalling) {
                            this._spawnTypingBubble(pos.x, pos.y - 24);
                        }
                        scheduleBubble();
                    }
                });
            };
            // Initial stagger antara 1-5 detik agar gelembung muncul bergantian secara alami
            scheduleBubble(Phaser.Math.Between(1000, 4500) + index * 600);
        });
    }

    /**
     * Efek Visual Telemetry Sync saat Cabang Toko Berganti (Directive v4.1 - Pilar 4)
     * Mengorkestrasi Cyan Camera Flash, Subtle Shake, Hologram Banner, dan Emote Sync NPC.
     */
    _playTelemetrySyncAnimation(store) {
        if (!this.cameras || !this.cameras.main) return;
        const storeId = store?.id || store?.store || 74;
        const storeCity = store?.city || store?.kota || 'PAENTMARWY';
        const storeName = store?.name || `Toko ${storeId} - ${storeCity}`;

        // 1. Cyan Camera Flash (400ms, Cyan: r=0, g=255, b=255)
        this.cameras.main.flash(400, 0, 255, 255);

        // 2. Subtle Camera Shake (300ms, intensitas 0.005)
        this.cameras.main.shake(300, 0.005);

        // 3. Teks Hologram Mengambang di tengah layar kamera ("MENGHUBUNGKAN: ${storeName}...")
        const cam = this.cameras.main;
        const cx = cam.worldView?.centerX ?? (cam.scrollX + cam.width / 2);
        const cy = cam.worldView?.centerY ?? (cam.scrollY + cam.height / 2);
        this._spawnHologramSyncBanner(cx, cy - 10, storeName);

        // 4. Tween memunculkan ikon 🔄 di atas semua kepala NPC (Maya, Citra, Budi, Rian, Rexa) selama 1.5 detik
        const staffSprites = [
            this.rexaSprite,
            this.managerSprite,
            this.mayaSprite,
            this.citraSprite,
            this.rianSprite,
            this.budiSprite,
        ].filter(Boolean);

        staffSprites.forEach((sprite, idx) => {
            this.time.delayedCall(idx * 70, () => {
                if (sprite && sprite.active) {
                    this._spawnSyncIconAboveHead(sprite.x, sprite.y - 28);
                }
            });
        });

        console.log(`%c[TELEMETRY SYNC] 📡 Sinkronisasi data real-time dengan ${storeName} berhasil!`, 'color: #38bdf8; font-weight: bold;');
    }

    /**
     * Spawn Banner Teks Hologram "MENGHUBUNGKAN: ${storeName}..." di tengah layar dengan fade out 2000ms
     */
    _spawnHologramSyncBanner(x, y, storeName) {
        const bannerContainer = this.add.container(x, y).setDepth(100);

        const textStr = `📡 MENGHUBUNGKAN: ${storeName}...`;
        const bannerWidth = Math.max(260, textStr.length * 8 + 36);

        const bg = this.add.graphics();
        // Background kapsul futuristik slate gelap
        bg.fillStyle(0x0f172a, 0.94);
        bg.fillRoundedRect(-bannerWidth / 2, -16, bannerWidth, 32, 8);
        // Border cyan neon berpendar
        bg.lineStyle(1.5, 0x38bdf8, 0.95);
        bg.strokeRoundedRect(-bannerWidth / 2, -16, bannerWidth, 32, 8);

        const txt = this.add.text(0, 0, textStr, {
            fontSize: '12px',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            color: '#38bdf8',
            stroke: '#000000',
            strokeThickness: 2,
        }).setOrigin(0.5, 0.5);

        bannerContainer.add([bg, txt]);

        // Efek Melayang naik perlahan dan memudar (fade out) selama 2000ms
        this.tweens.add({
            targets: bannerContainer,
            y: y - 18,
            alpha: { from: 1, to: 0 },
            duration: 2000,
            ease: 'Quad.easeOut',
            onComplete: () => {
                bannerContainer.destroy();
            },
        });
    }

    /**
     * Spawn Ikon Emote 🔄 di atas kepala NPC selama 1.5 detik (1500ms)
     */
    _spawnSyncIconAboveHead(x, y) {
        const iconContainer = this.add.container(x, y).setDepth(26);

        const bg = this.add.graphics();
        bg.fillStyle(0x0f172a, 0.9);
        bg.fillCircle(0, 0, 11);
        bg.lineStyle(1, 0x38bdf8, 0.85);
        bg.strokeCircle(0, 0, 11);

        const icon = this.add.text(0, 0, '🔄', {
            fontSize: '11px',
        }).setOrigin(0.5, 0.5);

        iconContainer.add([bg, icon]);

        // Efek pop naik perlahan dan memudar dalam 1500ms
        this.tweens.add({
            targets: iconContainer,
            y: y - 14,
            alpha: { from: 1, to: 0 },
            duration: 1500,
            ease: 'Sine.easeOut',
            onComplete: () => {
                iconContainer.destroy();
            },
        });
    }

    /**
     * Efek Visual Timeline Shift saat Simulasi Waktu Melompat (Directive v4.3 - Tahap 3 & 4)
     * Mengorkestrasi Amber Camera Flash, Camera Shake, Partikel Horizontal Streaks (Kanan -> Kiri),
     * Teks Hologram Banner, Emote ⏳ di atas kepala semua NPC, dan Soft Cyan Settle Flash.
     */
    _playTimelineShiftAnimation(payload) {
        if (!this.cameras || !this.cameras.main) return;

        const daysAdded = payload?.daysAdded ?? 1;
        const targetDateFormatted = payload?.targetDateFormatted || '01 Jan 2017';
        const isReset = Boolean(payload?.isReset);

        // 1. Bekukan pergerakan pemain selama distorsi waktu
        this._freezePlayer();

        // 2. Kamera Flash Spektrum Amber (350ms, Amber: r=245, g=158, b=11)
        this.cameras.main.flash(350, 245, 158, 11);

        // 3. Kamera Shake Frekuensi Tinggi (1600ms, intensitas 0.007)
        this.cameras.main.shake(1600, 0.007);

        // 4. Inisialisasi tekstur programatik 1x1 / 4x2 piksel jika belum ada di TextureManager
        if (!this.textures.exists('warp_streak_pixel')) {
            const canvas = document.createElement('canvas');
            canvas.width = 4;
            canvas.height = 2;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, 4, 2);
            this.textures.addCanvas('warp_streak_pixel', canvas);
        }

        // 5. Spawn Partikel Garis Kecepatan Tinggi (Streaks) dari Kanan ke Kiri
        const cam = this.cameras.main;
        const camW = cam.width || 960;
        const camH = cam.height || 540;

        let emitter = null;
        try {
            emitter = this.add.particles(camW + 20, 0, 'warp_streak_pixel', {
                y: { min: 0, max: camH },
                speedX: { min: -1200, max: -1900 },
                speedY: { min: -15, max: 15 },
                scaleX: { min: 18, max: 45 },
                scaleY: { min: 0.8, max: 1.5 },
                alpha: { start: 0.95, end: 0 },
                tint: [0xfbbf24, 0xf59e0b, 0x38bdf8, 0xffffff],
                blendMode: 'ADD',
                lifespan: { min: 550, max: 800 },
                frequency: 18,
                maxParticles: 85,
            });
            emitter.setDepth(999);
        } catch (err) {
            console.warn('[MainScene] Fallback particle creation error:', err);
        }

        // 6. Spawn Hologram HUD Banner di tengah layar kamera
        const cx = cam.worldView?.centerX ?? (cam.scrollX + cam.width / 2);
        const cy = cam.worldView?.centerY ?? (cam.scrollY + cam.height / 2);
        const bannerTitle = isReset
            ? '🔄 RESET BASELINE WAKTU (31 DES 2016)'
            : `⚡ DISTORSI TEMPORAL: ${daysAdded > 0 ? '+' : ''}${daysAdded} HARI (${targetDateFormatted})`;
        this._spawnHologramTimeBanner(cx, cy - 10, bannerTitle);

        // 7. Spawn Ikon Emote ⏳ di atas kepala seluruh staf/NPC (Tahap 4)
        const staffSprites = [
            this.rexaSprite,
            this.managerSprite,
            this.mayaSprite,
            this.citraSprite,
            this.rianSprite,
            this.budiSprite,
            this.player,
        ].filter(Boolean);

        staffSprites.forEach((sprite, idx) => {
            this.time.delayedCall(idx * 60, () => {
                if (sprite && sprite.active) {
                    this._spawnTimeEmoteAboveHead(sprite.x, sprite.y - 28);
                }
            });
        });

        // 8. Fase Rekonvergensi pada 1600ms (Hentikan emisi baru)
        this.time.delayedCall(1600, () => {
            if (emitter && emitter.active) {
                emitter.stop();
            }
        });

        // 9. Soft Cyan Settle Flash pada 1750ms (300ms)
        this.time.delayedCall(1750, () => {
            if (this.cameras && this.cameras.main) {
                this.cameras.main.flash(300, 56, 189, 248);
            }
        });

        // 10. Penyelesaian & Cleanup Total pada 2000ms (Directive v4.5 Hotfix)
        this.time.delayedCall(2000, () => {
            // ── URUTAN KRITIS #1: PELEPASAN KUNCI DI BARIS PALING ATAS ─────────
            this.isPlayerFrozen = false;
            if (this.player) {
                if (this.player.body) {
                    this.player.body.moves = true;
                    this.player.body.enable = true;
                    this.player.setVelocity(0, 0);
                }
                this.player.isSitting = false;
            }
            if (this.input) {
                this.input.enabled = true;
                if (this.input.keyboard) {
                    this.input.keyboard.enabled = true;
                    this.input.keyboard.resetKeys();
                }
            }
            this._isChatInputFocused = false;
            if (this.game && this.game.canvas) {
                this.game.canvas.focus();
            }

            // ── URUTAN KRITIS #2: PEMBERSIHAN PARTIKEL ────────────────────────
            try {
                if (emitter) {
                    emitter.stop();
                    emitter.destroy();
                }
            } catch (e) {
                console.warn('[TIME WARP] Emitter cleanup warning:', e);
            }

            // ── URUTAN KRITIS #3: SINYAL SELESAI KE REACT (ASYNC LOCK RELEASE) ─
            try {
                EventBus.emit('timeline-shift-completed', payload);
                window.dispatchEvent(new CustomEvent('timeline-shift-completed', { detail: payload }));
                EventBus.emit('unfreeze-player');
                window.dispatchEvent(new CustomEvent('unfreeze-player'));
            } catch (e) {
                console.warn('[TIME WARP] Event emit warning:', e);
            }

            // ── URUTAN KRITIS #4: NOTIFIKASI TOAST ────────────────────────────
            const toastMsg = isReset
                ? '🔄 Waktu dikembalikan ke 31 Des 2016'
                : `📅 Waktu ${daysAdded < 0 ? 'dimundurkan' : 'dipercepat'} ke ${targetDateFormatted}`;
            if (typeof this._showCheatNotification === 'function') {
                this._showCheatNotification(toastMsg, 0xf59e0b);
            }
            console.log(`%c[TIME WARP] ⏳ Selesai! ${toastMsg}`, 'color: #fbbf24; font-weight: bold;');
        });
    }

    /**
     * Spawn Banner Teks Hologram Distorsi Temporal di tengah layar dengan fade out 2000ms
     */
    _spawnHologramTimeBanner(x, y, textStr) {
        const bannerContainer = this.add.container(x, y).setDepth(100);
        const bannerWidth = Math.max(280, textStr.length * 8 + 36);

        const bg = this.add.graphics();
        bg.fillStyle(0x0f172a, 0.94);
        bg.fillRoundedRect(-bannerWidth / 2, -16, bannerWidth, 32, 8);
        bg.lineStyle(1.5, 0xf59e0b, 0.95);
        bg.strokeRoundedRect(-bannerWidth / 2, -16, bannerWidth, 32, 8);

        const txt = this.add.text(0, 0, textStr, {
            fontSize: '12px',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            color: '#fbbf24',
            stroke: '#000000',
            strokeThickness: 2,
        }).setOrigin(0.5, 0.5);

        bannerContainer.add([bg, txt]);

        this.tweens.add({
            targets: bannerContainer,
            y: y - 18,
            alpha: { from: 1, to: 0 },
            duration: 2000,
            ease: 'Quad.easeOut',
            onComplete: () => {
                bannerContainer.destroy();
            },
        });
    }

    /**
     * Spawn Ikon Emote ⏳ di atas kepala NPC selama 1.6 detik (1600ms)
     */
    _spawnTimeEmoteAboveHead(x, y) {
        const iconContainer = this.add.container(x, y).setDepth(26);

        const bg = this.add.graphics();
        bg.fillStyle(0x0f172a, 0.92);
        bg.fillCircle(0, 0, 11);
        bg.lineStyle(1.5, 0xf59e0b, 0.95);
        bg.strokeCircle(0, 0, 11);

        const iconText = this.add.text(0, 0, '⏳', {
            fontSize: '12px',
        }).setOrigin(0.5, 0.5);

        iconContainer.add([bg, iconText]);

        this.tweens.add({
            targets: iconContainer,
            y: y - 16,
            alpha: { from: 1, to: 0 },
            duration: 1600,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                iconContainer.destroy();
            },
        });
    }

    /**
     * TUGAS D & Directive v3.1: Inisialisasi Registry AI Living Office 4 NPC (Maya, Citra, Rian, Pak Budi)
     */
    _initLivingOfficeRoutines() {
        this._livingNPCs = {
            citra: {
                id: 'citra',
                name: 'Citra',
                sprite: this.citraSprite,
                shadow: this._citraShadow,
                nameTag: this._citraNameTag,
                deskPos: { x: 300, y: 112 },
                workAnim: 'citra-idle-right', // Duduk menyamping hadap kanan ke arah meja rapat
                state: 'WORKING',
                stateTimer: 0,
                lastDir: 'right',
                currentWPIndex: 0,
                relaxChair: { x: 440, y: 265 },
                waypointsToCoffee: [
                    { x: 275, y: 112 }, // Keluar dari kursi ke lorong barat (bebas meja)
                    { x: 275, y: 195 }, // Menyusuri lorong barat ke arah selatan
                    { x: 384, y: 195 }, // Menuju depan pintu sekat War Room
                    { x: 384, y: 263 }, // Melewati pintu sekat ke lorong tengah
                    { x: 482, y: 263 }, // Tiba di Mesin Kopi Espresso Bar
                ],
                waypointsToDesk: [
                    { x: 482, y: 263 }, // Dari mesin kopi
                    { x: 384, y: 263 }, // Menuju lorong depan pintu War Room
                    { x: 384, y: 195 }, // Masuk kembali ke dalam War Room
                    { x: 275, y: 195 }, // Belok barat ke lorong samping kiri
                    { x: 275, y: 112 }, // Naik ke utara menyusuri lorong samping kiri
                    { x: 300, y: 112 }, // Duduk kembali di kursi kiri menghadap kanan
                ],
            },
            budi: {
                id: 'budi',
                name: 'Pak Budi',
                sprite: this.budiSprite,
                shadow: this._budiShadow,
                nameTag: this._budiNameTag,
                deskPos: { x: 384, y: 84 },
                workAnim: 'budi-idle-down', // Directive v3.1: Hadap depan
                state: 'WORKING',
                stateTimer: 0,
                lastDir: 'down',
                currentWPIndex: 0,
                relaxChair: { x: 440, y: 265 },
                waypointsToCoffee: [
                    { x: 295, y: 84 },
                    { x: 295, y: 195 },
                    { x: 384, y: 195 },
                    { x: 384, y: 263 },
                    { x: 482, y: 263 },
                ],
                waypointsToDesk: [
                    { x: 482, y: 263 },
                    { x: 384, y: 263 },
                    { x: 384, y: 195 },
                    { x: 295, y: 195 },
                    { x: 295, y: 84 },
                    { x: 384, y: 84 },
                ],
            },
            rian: {
                id: 'rian',
                name: 'Rian',
                sprite: this.rianSprite,
                shadow: this._rianShadow,
                nameTag: this._rianNameTag,
                deskPos: { x: 198, y: 260 },
                workAnim: 'rian-idle-down', // Directive v3.1: Hadap depan
                state: 'WORKING',
                stateTimer: 0,
                lastDir: 'down',
                currentWPIndex: 0,
                relaxChair: { x: 440, y: 265 },
                waypointsToCoffee: [
                    { x: 220, y: 263 },
                    { x: 384, y: 263 },
                    { x: 482, y: 263 },
                ],
                waypointsToDesk: [
                    { x: 384, y: 263 },
                    { x: 220, y: 260 },
                    { x: 198, y: 260 },
                ],
            },
            maya: {
                id: 'maya',
                name: 'Maya',
                sprite: this.mayaSprite,
                shadow: this._mayaShadow,
                nameTag: this._mayaNameTag,
                deskPos: { x: 608, y: 368 },
                workAnim: 'maya-idle-down', // Directive v3.1: Hadap depan
                state: 'WORKING',
                stateTimer: 0,
                lastDir: 'down',
                currentWPIndex: 0,
                relaxChair: { x: 440, y: 265 },
                waypointsToCoffee: [
                    { x: 560, y: 368 },
                    { x: 560, y: 263 },
                    { x: 482, y: 263 },
                ],
                waypointsToDesk: [
                    { x: 560, y: 263 },
                    { x: 560, y: 368 },
                    { x: 608, y: 368 },
                ],
            },
        };

        // Pasang fungsi cheat / manual trigger ke window untuk kemudahan developer
        if (typeof window !== 'undefined') {
            window.triggerNPCCoffee = (npcId = 'maya') => {
                const npc = this._livingNPCs[npcId];
                if (npc) {
                    this._startNPCCoffeeRoutine(npc);
                    console.log(`%c[LIVING OFFICE] ☕ Manual trigger kopi untuk ${npc.name}!`, 'color: #f59e0b; font-weight: bold;');
                }
            };
        }
    }

    /** Memulai siklus perjalanan menuju mesin kopi untuk NPC */
    _startNPCCoffeeRoutine(npc) {
        if (!npc || npc.state !== 'WORKING') return;
        npc.state = 'WALK_TO_COFFEE';
        npc.currentWPIndex = 0;
        npc.sprite.setDepth(12); // Directive v3.2: NPC berdiri dan berjalan bebas di depan meja/furnitur (depth 12 > desk 10)
        console.log(`%c[LIVING OFFICE] ☕ ${npc.name} merasa haus dan berjalan menuju Mesin Kopi...`, 'color: #38bdf8; font-weight: bold;');
    }

    /** Update loop rutinitas AI Living Office 4 NPC (Tugas D & Directive v3.1) */
    _updateLivingNPCs(now = (this.time ? this.time.now : Date.now())) {
        if (!this._livingNPCs) return;

        // Validasi dan normalisasi timestamp
        const currentTime = typeof now === 'number' ? now : (this.time ? this.time.now : Date.now());

        // 1. Timer Keputusan: Interval setiap 15 detik dengan probabilitas 30% (Directive v3.1)
        if (!this._lastCoffeeRoutineCheck) {
            this._lastCoffeeRoutineCheck = currentTime;
        } else if (currentTime - this._lastCoffeeRoutineCheck >= 15000) {
            this._lastCoffeeRoutineCheck = currentTime;
            const isCoffeeBusy = Object.values(this._livingNPCs).some(n => n.state !== 'WORKING');
            if (!isCoffeeBusy) {
                const eligibleNPCs = Object.values(this._livingNPCs).filter(n => {
                    const isCalling = this[`_${n.id}IsCalling`];
                    return n.state === 'WORKING' && !isCalling;
                });

                if (eligibleNPCs.length > 0 && Math.random() < 0.30) {
                    const pickedNPC = Phaser.Math.RND.pick(eligibleNPCs);
                    this._startNPCCoffeeRoutine(pickedNPC);
                }
            }
        }

        // 2. State Machine untuk masing-masing NPC
        for (const npc of Object.values(this._livingNPCs)) {
            const isCalling = this[`_${npc.id}IsCalling`];

            // Update posisi bayangan & label nama agar mengikuti sprite
            if (npc.shadow) {
                npc.shadow.clear();
                npc.shadow.fillStyle(0x0f172a, 0.15);
                npc.shadow.fillEllipse(npc.sprite.x, npc.sprite.y + 13, 18, 8);
            }
            if (npc.nameTag) {
                npc.nameTag.setPosition(npc.sprite.x, npc.sprite.y - 20);
            }

            // Jika sedang menerima telepon interkom, tahan pergerakan
            if (isCalling) {
                npc.sprite.setVelocity(0, 0);
                continue;
            }

            // ── State 1: WORKING ──────────────────────────────────────────────
            if (npc.state === 'WORKING') {
                npc.sprite.setVelocity(0, 0);
                if (npc.sprite.anims.currentAnim?.key !== npc.workAnim) {
                    npc.sprite.anims.play(npc.workAnim, true);
                }
            }
            // ── State 2: WALK_TO_COFFEE ───────────────────────────────────────
            else if (npc.state === 'WALK_TO_COFFEE') {
                const target = npc.waypointsToCoffee[npc.currentWPIndex];
                if (!target) {
                    npc.state = 'MAKING_COFFEE';
                    continue;
                }
                const dx = target.x - npc.sprite.x;
                const dy = target.y - npc.sprite.y;
                const dist = Math.hypot(dx, dy);

                if (dist < 8) {
                    npc.currentWPIndex++;
                    if (npc.currentWPIndex >= npc.waypointsToCoffee.length) {
                        // Tiba di Mesin Kopi (482, 263)!
                        npc.state = 'MAKING_COFFEE';
                        npc.stateTimer = now + 3000; // 3 detik durasi menyeduh
                        npc.sprite.setVelocity(0, 0);
                        npc.sprite.anims.play(`${npc.id}-idle-up`, true); // Hadap mesin kopi
                        this._spawnCoffeeSteam(482, 263, 3000);
                        console.log(`%c[LIVING OFFICE] ☕ ${npc.name} sedang menyeduh kopi di Espresso Bar...`, 'color: #f59e0b;');
                    }
                } else {
                    const speed = 40;
                    const angle = Math.atan2(dy, dx);
                    npc.sprite.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
                    this._updateNPCWalkAnim(npc, dx, dy);
                }
            }
            // ── State 3: MAKING_COFFEE ────────────────────────────────────────
            else if (npc.state === 'MAKING_COFFEE') {
                npc.sprite.setVelocity(0, 0);
                if (now >= npc.stateTimer) {
                    // Selesai menyeduh -> Berjalan ke kursi santai cafe bar
                    npc.state = 'WALK_TO_CHAIR';
                    console.log(`%c[LIVING OFFICE] ☕ Kopi ${npc.name} selesai, berjalan ke kursi santai...`, 'color: #10b981;');
                }
            }
            // ── State 3.5: WALK_TO_CHAIR ──────────────────────────────────────
            else if (npc.state === 'WALK_TO_CHAIR') {
                const chair = npc.relaxChair;
                const dx = chair.x - npc.sprite.x;
                const dy = chair.y - npc.sprite.y;
                const dist = Math.hypot(dx, dy);

                if (dist < 6) {
                    // Tiba di kursi santai -> Ilusi duduk (Y-offset -8px) selama 15 detik!
                    npc.state = 'SITTING_RELAX';
                    npc.stateTimer = now + 15000;
                    npc.sprite.setVelocity(0, 0);
                    npc.sprite.y = chair.y - 8;
                    npc.sprite.anims.play(`${npc.id}-idle-down`, true);
                    console.log(`%c[LIVING OFFICE] ☕ ${npc.name} duduk santai menikmati kopi (15 detik)...`, 'color: #38bdf8;');
                } else {
                    const speed = 40;
                    const angle = Math.atan2(dy, dx);
                    npc.sprite.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
                    this._updateNPCWalkAnim(npc, dx, dy);
                }
            }
            // ── State 4: SITTING_RELAX ────────────────────────────────────────
            else if (npc.state === 'SITTING_RELAX') {
                npc.sprite.setVelocity(0, 0);
                if (now >= npc.stateTimer) {
                    // Selesai duduk santai -> Berdiri dan kembali ke meja kerja
                    npc.sprite.y = npc.relaxChair.y; // Pulihkan koordinat Y
                    npc.state = 'WALK_TO_DESK';
                    npc.currentWPIndex = 0;
                    console.log(`%c[LIVING OFFICE] 💼 ${npc.name} selesai ngopi dan berjalan kembali ke meja kerja...`, 'color: #a78bfa;');
                }
            }
            // ── State 5: WALK_TO_DESK ─────────────────────────────────────────
            else if (npc.state === 'WALK_TO_DESK') {
                const target = npc.waypointsToDesk[npc.currentWPIndex];
                if (!target) {
                    npc.state = 'WORKING';
                    continue;
                }
                const dx = target.x - npc.sprite.x;
                const dy = target.y - npc.sprite.y;
                const dist = Math.hypot(dx, dy);

                if (dist < 8) {
                    npc.currentWPIndex++;
                    if (npc.currentWPIndex >= npc.waypointsToDesk.length) {
                        // Tiba kembali di meja asal!
                        npc.state = 'WORKING';
                        npc.sprite.setPosition(npc.deskPos.x, npc.deskPos.y);
                        npc.sprite.setDepth(9); // Directive v3.2: Duduk kembali di balik meja kerja (depth 9 di balik meja depth 10)
                        npc.sprite.setVelocity(0, 0);
                        npc.sprite.anims.play(npc.workAnim, true);
                        console.log(`%c[LIVING OFFICE] ✅ ${npc.name} kembali bekerja di meja (${npc.workAnim})!`, 'color: #10b981;');
                    }
                } else {
                    const speed = 40;
                    const angle = Math.atan2(dy, dx);
                    npc.sprite.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
                    this._updateNPCWalkAnim(npc, dx, dy);
                }
            }
        }
    }

    /** Menyesuaikan animasi jalan 4-arah untuk NPC Living Office */
    _updateNPCWalkAnim(npc, dx, dy) {
        let dir = npc.lastDir || 'down';
        if (Math.abs(dx) > Math.abs(dy)) {
            dir = dx > 0 ? 'right' : 'left';
        } else {
            dir = dy > 0 ? 'down' : 'up';
        }
        if (dir !== npc.lastDir || !npc.sprite.anims.isPlaying || npc.sprite.anims.currentAnim?.key !== `${npc.id}-walk-${dir}`) {
            npc.lastDir = dir;
            npc.sprite.anims.play(`${npc.id}-walk-${dir}`, true);
        }
    }

    // ─── DEVELOPER CHEAT CODES (U+R TOGGLE & U+R+1..4 MANUAL TRIGGERS) ───────

    /**
     * Memeriksa kombinasi tombol rahasia setiap frame di update():
     * - U + R: Toggle auto-crisis 30-menit (ON/OFF)
     * - U + R + 1: Periksa krisis Maya (SKU berisiko tinggi kehabisan stok)
     * - U + R + 2: Periksa krisis Citra (modal tertahan)
     * - U + R + 3: Trigger Krisis Rian (Circuit Breaker Tripped)
     * - U + R + 4: Trigger Krisis Pak Budi (Store Health Crash)
     */
    _updateCheatCodes() {
        if (this._isChatInputFocused) return;
        if (!this._keyU || !this._keyR) return;

        const uDown = this._keyU.isDown;
        const rDown = this._keyR.isDown;

        if (uDown && rDown) {
            // Player sedang MENAHAN tombol U dan R bersamaan
            if (!this._cheatHoldingUR) {
                this._cheatHoldingUR = true;
                this._cheatUsedNumber = false;
            }

            // Deteksi penekanan tombol angka 1, 2, 3, atau 4 (Keyboard utama & Numpad)
            const just1 = Phaser.Input.Keyboard.JustDown(this._key1) || Phaser.Input.Keyboard.JustDown(this._num1);
            const just2 = Phaser.Input.Keyboard.JustDown(this._key2) || Phaser.Input.Keyboard.JustDown(this._num2);
            const just3 = Phaser.Input.Keyboard.JustDown(this._key3) || Phaser.Input.Keyboard.JustDown(this._num3);
            const just4 = Phaser.Input.Keyboard.JustDown(this._key4) || Phaser.Input.Keyboard.JustDown(this._num4);

            if (just1) {
                this._cheatUsedNumber = true;
                this._triggerCheatCrisis('CRISIS_STOCKOUT_FAST_MOVING', 'Maya (stok kritis)');
            } else if (just2) {
                this._cheatUsedNumber = true;
                this._triggerCheatCrisis('CRISIS_DEADSTOCK_CASH_LOCK', 'Citra (modal tertahan)');
            } else if (just3) {
                this._cheatUsedNumber = true;
                this._triggerCheatCrisis('CRISIS_CIRCUIT_BREAKER_TRIPPED', 'Rian (Circuit Breaker)');
            } else if (just4) {
                this._cheatUsedNumber = true;
                this._triggerCheatCrisis('CRISIS_STORE_HEALTH_CRASH', 'Pak Budi (Store Health Crash)');
            }
        } else {
            // Ketika salah satu tombol U atau R dilepaskan
            if (this._cheatHoldingUR) {
                // Jika selama menahan U+R tidak ada tombol angka yang ditekan, toggle Auto-Crisis
                if (!this._cheatUsedNumber) {
                    this._toggleAutoCrisisCheat();
                }
                this._cheatHoldingUR = false;
                this._cheatUsedNumber = false;
            }
        }
    }

    /**
     * Toggle status aktif fitur Auto-Crisis 30-Menit (Cheat: U + R)
     */
    _toggleAutoCrisisCheat() {
        this.autoCrisisEnabled = !this.autoCrisisEnabled;
        const stateStr = this.autoCrisisEnabled ? 'ON' : 'OFF';
        console.log(`%c[CHEAT CODE] ⚙️ Auto-Crisis 30-Menit: ${stateStr}`, 'color: #38bdf8; font-weight: bold; font-size: 12px;');

        const badgeColor = this.autoCrisisEnabled ? 0x10b981 : 0xef4444;
        const icon = this.autoCrisisEnabled ? '🟢' : '🔴';
        this._showCheatNotification(`${icon} CHEAT: Auto-Crisis 30-Menit [${stateStr}]`, badgeColor);
    }

    /**
     * Memicu krisis toko secara manual lewat kombinasi tombol cheat (U + R + 1..4)
     */
    _triggerCheatCrisis(crisisId, label) {
        console.log(`%c[CHEAT CODE] 🚨 Manual Trigger: ${crisisId} (${label})`, 'color: #ef4444; font-weight: bold; font-size: 12px;');
        if (typeof window === 'undefined' || !window.triggerStoreCrisis) return;
        // Krisis diambil dari data toko yang diawasi; kalau datanya normal, cheat hanya memberi tahu.
        this._showCheatNotification(`🔎 Doni memeriksa data: ${label}...`, 0x38bdf8);
        window.triggerStoreCrisis(crisisId)
            .then((krisis) => this._showCheatNotification(
                krisis ? `🚨 Krisis ${label}: ${krisis.title}` : `✅ Data toko normal: tidak ada krisis ${label}`,
                krisis ? 0xef4444 : 0x10b981))
            .catch((err) => this._showCheatNotification(`⚠️ Data toko tidak bisa dibaca: ${err.message}`, 0xf59e0b));
    }

    /**
     * Alias notifikasi HUD toast mengambang di layar (Fail-Safe Directive v4.5)
     */
    _showActionToast(message, strokeColor = 0xf59e0b) {
        return this._showCheatNotification(message, strokeColor);
    }

    /**
     * Menampilkan notifikasi HUD toast mengambang di layar saat cheat aktif
     */
    _showCheatNotification(message, strokeColor = 0x38bdf8) {
        if (this._activeCheatToast) {
            this._activeCheatToast.destroy();
            this._activeCheatToast = null;
        }

        const cam = this.cameras.main;
        if (!cam) return;

        const toastX = cam.width * 0.5;
        const toastY = (cam.height * 0.5) + (44 - cam.height * 0.5) / cam.zoom;

        const container = this.add.container(toastX, toastY)
            .setScrollFactor(0)
            .setDepth(99999)
            .setScale(1 / cam.zoom);

        const textLen = message.length;
        const boxW = Math.max(260, textLen * 9.5 + 36);
        const boxH = 32;

        const bg = this.add.rectangle(0, 0, boxW, boxH, 0x090d16, 0.95)
            .setStrokeStyle(1.8, strokeColor, 1)
            .setOrigin(0.5, 0.5);

        const text = this.add.text(0, 0, message, {
            fontSize: '12px',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            color: '#f8fafc',
        }).setOrigin(0.5, 0.5);

        container.add([bg, text]);
        container.setAlpha(0);
        container.y = toastY - 8;
        this._activeCheatToast = container;

        this.tweens.add({
            targets: container,
            alpha: 1,
            y: toastY,
            duration: 160,
            ease: 'Power2',
        });

        this.time.delayedCall(2200, () => {
            if (this._activeCheatToast === container) {
                this.tweens.add({
                    targets: container,
                    alpha: 0,
                    y: toastY - 12,
                    duration: 200,
                    ease: 'Power2',
                    onComplete: () => {
                        container.destroy();
                        if (this._activeCheatToast === container) {
                            this._activeCheatToast = null;
                        }
                    }
                });
            }
        });
    }
}
