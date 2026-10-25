# 📺 Virtual HQ — Spesifikasi Fitur Smart TV (Command Center)
**Status Dokumen:** Menunggu Implementasi  
**Konteks Proyek:** ChibiRex Virtual HQ (Phaser 3 + React)  
**Tujuan:** Mengisi kekosongan di area 'Lorong Tengah' dengan objek layar interaktif yang menampilkan metrik analitik bisnis secara visual tanpa mengganggu sistem dashboard utama.

---

## 1. ⚠️ ATURAN MUTLAK (STRICT ISOLATION)
* **DILARANG KERAS** mengubah, menambah, atau menyentuh file apa pun di dalam direktori `dashboard` utama.
* Seluruh implementasi (baik objek visual di Phaser maupun Modal antarmuka) **harus 100% terisolasi** di dalam lingkungan `virtual_hq`.
* Data yang ditampilkan di dalam TV bersifat *read-only* (hanya baca) atau menggunakan data statis/dummy yang merepresentasikan performa toko jika API belum siap.

---

## 2. Spesifikasi Visual & Penempatan (MainScene.js)

### A. Wujud Visual
* **Objek Layar:** Menggunakan kombinasi `Phaser.GameObjects.Rectangle` berwarna hitam kebiruan (seperti layar monitor menyala) dengan bingkai abu-abu gelap, ATAU menggunakan aset layar monitor dari `tileset` yang sudah ada.
* **Efek Ambien:** Tambahkan sedikit efek *glow* (bayangan tipis) berwarna biru di sekitar layar agar terlihat modern dan hidup.

### B. Lokasi Koordinat (Lorong Tengah)
* **Area:** Ditempatkan di dinding pembatas antara ruang rapat utama dan lorong tengah agar menjadi titik pusat perhatian pemain saat berjalan dari kiri ke kanan.
* **Estimasi Posisi:** Berada di sekitar baris (row) 7-8 dan kolom 10-12 (misalnya `x: 352, y: 240`), pastikan posisinya proporsional dan tidak menghalangi jalur jalan karakter utama.

---

## 3. Logika Interaksi UI (Proximity & Event)

* **Deteksi Jarak (Proximity):** 
  Dalam fungsi `update()`, hitung jarak antara Player dan objek Smart TV. Jika `< 50px`, maka interaksi aktif.
* **Hint Teks HUD:** 
  Saat Player mendekat, tampilkan teks instruksi di atas layar TV: `📺 [Tekan E untuk Lihat Statistik Global]`.
* **Event Dispatcher:** 
  Jika Player menekan tombol `[E]` saat berada dalam radius, game harus membekukan gerakan pemain dan mengirimkan *custom event* ke antarmuka React:
  `window.dispatchEvent(new CustomEvent('open-global-tv-modal'))`

---

## 4. Spesifikasi Modal React (`GlobalStatsTVModal.jsx`)

Komponen baru ini akan bertindak sebagai *overlay* antarmuka pengguna saat TV diakses.

### A. Lokasi File
* `virtual_hq/src/ui/components/GlobalStatsTVModal.jsx` (atau sesuaikan dengan struktur folder UI yang ada).

### B. Desain & Tema (Command Center)
* **Gaya Visual:** Futuristik, latar belakang semi-transparan gelap (kaca buram/blur), dengan aksen teks berwarna neon (biru cyan atau hijau matriks).
* **Tata Letak:** Menggunakan sistem Grid/Flexbox yang membagi layar menjadi beberapa panel informasi.

### C. Konten Metrik yang Ditampilkan
1. **Total Omset Harian:** Angka nominal besar (Contoh: `Rp 124.500.000`).
2. **Total Transaksi:** Jumlah struk/pesanan hari ini (Contoh: `842 Transaksi`).
3. **Grafik Visual (Visual Chart):**
   * Sebuah representasi grafik sederhana. 
   * **Catatan:** Jika *library* grafik tidak tersedia di `virtual_hq`, gunakan elemen div HTML/CSS Flexbox dengan tinggi yang bervariasi dan warna gradasi untuk mensimulasikan *Bar Chart* (Grafik Batang) tren penjualan mingguan.
4. **Tombol Tutup:** Tombol "Tutup (ESC)" yang jelas di sudut kanan atas untuk kembali ke game.