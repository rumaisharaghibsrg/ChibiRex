// Format angka untuk teks game. Nominal ringkas ditulis dengan kata ("juta", "miliar"), karena "M" rancu.
const RUPIAH = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const ANGKA = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });
const ANGKA_2 = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });

const kosong = (nilai) => nilai === null || nilai === undefined;

export const rupiah = (nilai) => (kosong(nilai) ? '-' : RUPIAH.format(nilai));
export const angka = (nilai) => (kosong(nilai) ? '-' : ANGKA.format(nilai));
export const angka2 = (nilai) => (kosong(nilai) ? '-' : ANGKA_2.format(nilai));

export const rupiahRingkas = (nilai) => {
    if (kosong(nilai)) return '-';
    const mutlak = Math.abs(nilai);
    if (mutlak >= 1e12) return `Rp ${ANGKA.format(nilai / 1e12)} triliun`;
    if (mutlak >= 1e9) return `Rp ${ANGKA.format(nilai / 1e9)} miliar`;
    if (mutlak >= 1e6) return `Rp ${ANGKA.format(nilai / 1e6)} juta`;
    return RUPIAH.format(nilai);
};

// Ambang warna Health Score sama dengan dashboard: hijau >= 80, kuning 65-79, merah < 65.
export const statusHealth = (skor) => {
    if (kosong(skor)) return { label: 'Belum ada data', warna: '#94a3b8' };
    if (skor >= 80) return { label: 'Sehat', warna: '#34d399' };
    if (skor >= 65) return { label: 'Perlu perhatian', warna: '#fbbf24' };
    return { label: 'Kritis', warna: '#f87171' };
};
