// Laporan Agent Jaringan terakhir. Kuncinya sama dengan halaman Semua Toko di dashboard (JaringanToko.jsx); di Amplify
// keduanya satu domain, jadi laporan yang dijalankan di dashboard muncul di Virtual HQ dan sebaliknya.
const KUNCI = 'rexa.laporanJaringan.v1';

export function bacaLaporanJaringan() {
    try {
        return JSON.parse(localStorage.getItem(KUNCI)) || null;
    } catch {
        return null;
    }
}

export function simpanLaporanJaringan(laporan) {
    try {
        localStorage.setItem(KUNCI, JSON.stringify(laporan));
    } catch {
        // Penyimpanan browser tidak tersedia (mode privat); laporan tetap tampil sampai halaman ditutup.
    }
}
