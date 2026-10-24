const RUPIAH = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const ANGKA = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });
const ANGKA_2 = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });
const TANGGAL = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
const WAKTU = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const kosong = (nilai) => nilai === null || nilai === undefined;

export const rupiah = (nilai) => (kosong(nilai) ? '-' : RUPIAH.format(nilai));
export const angka = (nilai) => (kosong(nilai) ? '-' : ANGKA.format(nilai));
export const angka2 = (nilai) => (kosong(nilai) ? '-' : ANGKA_2.format(nilai));

// Rupiah ringkas untuk badge dan kartu: "Rp 28,6 Jt", "Rp 13,7 M".
export const rupiahRingkas = (nilai) => {
  if (kosong(nilai)) return '-';
  const mutlak = Math.abs(nilai);
  if (mutlak >= 1e12) return `Rp ${ANGKA.format(nilai / 1e12)} T`;
  if (mutlak >= 1e9) return `Rp ${ANGKA.format(nilai / 1e9)} M`;
  if (mutlak >= 1e6) return `Rp ${ANGKA.format(nilai / 1e6)} Jt`;
  return RUPIAH.format(nilai);
};

// Tanggal "2017-01-16" dari API (tanggal simulasi Bibitor) menjadi "16 Jan 2017".
export const tanggal = (iso) => (iso ? TANGGAL.format(new Date(`${iso.slice(0, 10)}T00:00:00`)) : '-');

// Waktu kejadian dari API (ISO tanpa zona, jam server) menjadi "24 Okt 10.38".
export const waktu = (iso) => (iso ? WAKTU.format(new Date(iso)) : '-');
