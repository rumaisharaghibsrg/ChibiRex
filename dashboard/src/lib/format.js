const RUPIAH = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const ANGKA = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });

export const rupiah = (nilai) => (nilai === null || nilai === undefined ? '-' : RUPIAH.format(nilai));
export const angka = (nilai) => (nilai === null || nilai === undefined ? '-' : ANGKA.format(nilai));
