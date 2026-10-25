# 📘 VIRTUALWORK AI: DIRECTIVE v2.0 - VISUAL OVERHAUL & ANIMATION FIX (STRICT ENFORCEMENT)

**STATUS DOKUMEN:** CRITICAL / STRICT ENFORCEMENT
**TARGET PEMBACA:** AI Coding Assistant (Claude 3.5 Sonnet / Cline / Aider)
**KONTEKS:** Proyek "Virtual HQ" (Phaser 3 + React) sudah selesai hingga Tahap 6 dan terintegrasi sempurna dengan backend REST API di `http://localhost:8000`. 
**MISI UTAMA ANDA SAAT INI BUKAN MEMBANGUN FITUR BARU**, melainkan:
1. Memperbaiki Bug Animasi Karakter (Spritesheet Bleeding).
2. Merombak total estetika ruang kantor agar terlihat modern, detail, dan profesional.
3. Menetapkan sumber aset (resources) yang berkualitas tinggi.

---

## 🚫 1. ATURAN MUTLAK (ANTI-HALLUCINATION PROTOCOL)
1. **JANGAN SENTUH BACKEND:** Anda dilarang keras mengubah file di luar direktori `virtual_hq/`.
2. **JANGAN UBAH LOGIKA API:** Jangan mengubah payload, endpoint, atau logika polling pada `App.jsx`, `ThoughtBubble.jsx`, atau fungsi fetch di `MainScene.js`.
3. **FOKUS PADA ESTETIKA & RENDERING:** Tugas Anda murni pada `MainScene.js` (Phaser) dan penataan aset statis.

---

## 🐛 2. TUGAS A: PERBAIKAN BUG ANIMASI KARAKTER (SPRITESHEET FIX)
**Gejala:** Saat karakter pemain berjalan, sprite-nya berubah menjadi karakter lain.
**Akar Masalah:** Konfigurasi `frameWidth` / `frameHeight` saat me-load spritesheet salah, ATAU konfigurasi `start` dan `end` frame pada `this.anims.create` mengambil indeks dari baris karakter lain di dalam gambar spritesheet yang sama.

**INSTRUKSI PERBAIKAN UNTUK `MainScene.js`:**
1. Periksa fungsi `preload()`. Pastikan dimensi potong `this.load.spritesheet('player', '...', { frameWidth: 32, frameHeight: 32 })` benar-benar presisi sesuai file gambar.
2. Periksa fungsi `create()`. Konfigurasikan ulang `anims.create` untuk arah jalan (atas, bawah, kiri, kanan).
3. Pastikan indeks frame (misal: `frames: this.anims.generateFrameNumbers('player', { start: 0, end: 2 })`) **TIDAK** tumpang tindih dengan baris karakter NPC. Jika pemain ada di baris pertama, batasi indeks hanya untuk baris tersebut.
4. Terapkan perbaikan yang sama untuk NPC Rexa agar tidak mengalami *glitch* visual.

---

## 🏢 3. TUGAS B: SUMBER ASET (ASSET SOURCING) & RESOLUSI
Karena aset dari AI Town terlalu sederhana/jelek, kita akan meng-upgrade visualnya.
**INSTRUKSI SOURCING UNTUK AI:**
1. Anda (AI) harus menginstruksikan pengguna (Manager) untuk mengunduh aset **"Modern Office Top-Down 32x32 Tileset"** (seperti aset populer dari LimeZou atau aset kantor modern gratis di Itch.io) dan menyimpannya di `virtual_hq/public/assets/office-modern.png`.
2. Hapus referensi ke tileset lama yang kaku.
3. Ubah logika map generator di Phaser. Jika sebelumnya menggunakan *hardcoded grid*, buat fungsi *procedural room generation* di dalam `MainScene.js` yang lebih kompleks, atau arahkan pengguna untuk merakit ulang via `Tiled` dan berikan struktur `JSON` barunya.

---

## ✨ 4. TUGAS C: PENINGKATAN DETAIL VISUAL (OFFICE POLISH)
Buat agar ruangan tidak terlihat seperti "kotak kosong dengan meja". 
**Instruksikan Phaser untuk menambahkan detail berikut melalui kode (Graphics/Images) di `MainScene.js`:**
1. **Pencahayaan & Bayangan (Lighting & Shadows):** Tambahkan `tint` atau layer semi-transparan hitam dengan `alpha: 0.2` di bawah meja dan karakter untuk memberikan ilusi bayangan (*drop shadow*).
2. **Zona Lantai (Floor Zones):** Berikan warna atau ubin lantai yang berbeda untuk 3 area:
   - *Area Resepsionis/Lounge:* Lantai karpet (warna hangat/cokelat).
   - *Ruang Kerja Rexa:* Lantai kayu/parket modern.
   - *Ruang Manajer:* Lantai marmer/keramik eksklusif.
3. **Prop Tambahan (Wajib Disediakan Koordinatnya di Phaser):**
   - Tanaman hias (Potted Plants) di setiap sudut ruangan.
   - Dispenser air / Area *Coffee Break*.
   - Sekat partisi (*Cubicle walls*) kaca semi-transparan.
   - Karpet di bawah meja kerja.
4. **Kamera & Polish:** Tambahkan sedikit efek *easing* (lerp) pada kamera agar pergerakan mengikuti karakter terasa lebih sinematik dan tidak kaku.

---
**PESAN UNTUK AI (SONNET):**
Baca instruksi ini dengan teliti. Mulailah dengan mengeksekusi TUGAS A (Memperbaiki logika frame animasi di `MainScene.js`), kemudian berikan saya (Pengguna) panduan spesifik untuk TUGAS B, dan lanjutkan menulis ulang struktur visual `MainScene.js` untuk TUGAS C. Tulis kode dengan rapi dan berikan komentar pada bagian yang diubah!