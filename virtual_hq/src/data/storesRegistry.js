/**
 * storesRegistry.js — Multi-Tenant Regional Master Registry (80 Cabang)
 * Data otentik diekstraksi dari engine DuckDB ChibiRex (tabel sku_metrics).
 * Menyediakan metadata lengkap: ID, Nama Kota, Jumlah SKU, Region, dan Baseline Health Score.
 */

export const STORES_MASTER_REGISTRY = [
    { id: 1,  city: 'HARDERSFIELD',   skuCount: 4287, region: 'North',            healthScore: 94.2 },
    { id: 2,  city: 'ASHBORNE',       skuCount: 3256, region: 'Midlands',         healthScore: 88.5 },
    { id: 3,  city: 'HORNSEY',        skuCount: 544,  region: 'London',           healthScore: 91.0 },
    { id: 4,  city: 'EANVERNESS',     skuCount: 3400, region: 'Scotland',         healthScore: 89.2 },
    { id: 5,  city: 'SUTTON',         skuCount: 1721, region: 'London',           healthScore: 93.4 },
    { id: 6,  city: 'GOULCREST',      skuCount: 4148, region: 'East',             healthScore: 87.1 },
    { id: 7,  city: 'STANMORE',       skuCount: 4092, region: 'London',           healthScore: 95.0 },
    { id: 8,  city: 'ALNERWICK',      skuCount: 2957, region: 'North',            healthScore: 90.2 },
    { id: 9,  city: 'BLACKPOOL',      skuCount: 3013, region: 'West',             healthScore: 86.4 },
    { id: 10, city: 'HORNSEY',        skuCount: 4676, region: 'London',           healthScore: 92.1 },
    { id: 11, city: 'CARDEND',        skuCount: 3342, region: 'Scotland',         healthScore: 91.5 },
    { id: 12, city: 'LEESIDE',        skuCount: 2320, region: 'South',            healthScore: 94.0 },
    { id: 13, city: 'TARMSWORTH',     skuCount: 1659, region: 'Midlands',         healthScore: 89.9 },
    { id: 14, city: 'BROMWICH',       skuCount: 3158, region: 'Midlands',         healthScore: 92.3 },
    { id: 15, city: 'WANBORNE',       skuCount: 5252, region: 'South',            healthScore: 85.8 },
    { id: 16, city: 'LUNDY',          skuCount: 1532, region: 'West',             healthScore: 90.7 },
    { id: 17, city: 'OLDHAM',         skuCount: 1968, region: 'North',            healthScore: 93.1 },
    { id: 18, city: 'FURNESS',        skuCount: 1740, region: 'North',            healthScore: 89.4 },
    { id: 19, city: 'WINTERVALE',     skuCount: 3153, region: 'East',             healthScore: 91.2 },
    { id: 20, city: 'BREDWARDINE',    skuCount: 2668, region: 'Wales',            healthScore: 87.8 },
    { id: 21, city: 'BALERNO',        skuCount: 4035, region: 'Scotland',         healthScore: 93.6 },
    { id: 22, city: 'SHARNWICK',      skuCount: 2873, region: 'East',             healthScore: 90.0 },
    { id: 23, city: 'ARBINGTON',      skuCount: 5200, region: 'Midlands',         healthScore: 94.5 },
    { id: 24, city: 'PALPERROTH',     skuCount: 1992, region: 'South',            healthScore: 88.9 },
    { id: 25, city: 'CAERSHIRE',      skuCount: 3489, region: 'Wales',            healthScore: 91.7 },
    { id: 26, city: "KNIFE'S EDGE",   skuCount: 1530, region: 'North',            healthScore: 86.5 },
    { id: 27, city: 'MOUNTMEND',      skuCount: 2472, region: 'West',             healthScore: 92.8 },
    { id: 28, city: 'LARNWICK',       skuCount: 1234, region: 'East',             healthScore: 89.0 },
    { id: 29, city: 'AYLESBURY',      skuCount: 1525, region: 'South',            healthScore: 94.1 },
    { id: 30, city: 'CULCHETH',       skuCount: 3502, region: 'North',            healthScore: 90.5 },
    { id: 31, city: 'HORNSEY',        skuCount: 2296, region: 'London',           healthScore: 91.9 },
    { id: 32, city: 'MOUNTMEND',      skuCount: 3794, region: 'West',             healthScore: 87.3 },
    { id: 33, city: 'HORNSEY',        skuCount: 4997, region: 'London',           healthScore: 93.2 },
    { id: 34, city: 'PITMERDEN',      skuCount: 7999, region: 'Scotland',         healthScore: 85.0 },
    { id: 35, city: 'HALIVAARA',      skuCount: 2118, region: 'North',            healthScore: 92.4 },
    { id: 36, city: 'LEWES',          skuCount: 1717, region: 'South',            healthScore: 94.8 },
    { id: 37, city: 'PAETHSMOUTH',    skuCount: 2053, region: 'South',            healthScore: 89.6 },
    { id: 38, city: 'GOULCREST',      skuCount: 6529, region: 'East',             healthScore: 88.2 },
    { id: 39, city: 'EASTHALLOW',     skuCount: 2672, region: 'Midlands',         healthScore: 91.4 },
    { id: 40, city: 'BULLMAR',        skuCount: 2124, region: 'North',            healthScore: 90.7 },
    { id: 41, city: 'LARNWICK',       skuCount: 5198, region: 'East',             healthScore: 86.9 },
    { id: 42, city: 'BLACK HOLLOW',   skuCount: 3409, region: 'West',             healthScore: 93.5 },
    { id: 43, city: 'WOLFORD',        skuCount: 1822, region: 'Midlands',         healthScore: 88.4 },
    { id: 44, city: 'PORTHCRAWL',     skuCount: 3997, region: 'Wales',            healthScore: 92.6 },
    { id: 45, city: 'VERITAS',        skuCount: 1508, region: 'South',            healthScore: 95.2 },
    { id: 46, city: 'CENTRAL HUB',    skuCount: 3766, region: 'Midlands',         healthScore: 91.0 },
    { id: 47, city: "PELLA'S WISH",   skuCount: 2662, region: 'West',             healthScore: 89.1 },
    { id: 48, city: 'NORFOLK',        skuCount: 2709, region: 'East',             healthScore: 93.0 },
    { id: 49, city: 'GARIGILL',       skuCount: 4881, region: 'North',            healthScore: 87.7 },
    { id: 50, city: 'MOUNTMEND',      skuCount: 7893, region: 'West',             healthScore: 84.9 },
    { id: 51, city: 'ABERDEEN',       skuCount: 2359, region: 'Scotland',         healthScore: 94.4 },
    { id: 52, city: 'GRAYCOTT',       skuCount: 2073, region: 'Midlands',         healthScore: 90.3 },
    { id: 53, city: 'HILLFAR',        skuCount: 2259, region: 'North',            healthScore: 92.1 },
    { id: 54, city: 'GUTHRAM',        skuCount: 3833, region: 'East',             healthScore: 88.8 },
    { id: 55, city: 'DRY GULCH',      skuCount: 6075, region: 'West',             healthScore: 86.1 },
    { id: 56, city: "BEGGAR'S HOLE",  skuCount: 3532, region: 'North',            healthScore: 89.7 },
    { id: 57, city: 'LANTEGLOS',      skuCount: 1982, region: 'South',            healthScore: 93.8 },
    { id: 58, city: 'HARTLEPOOL',     skuCount: 2096, region: 'North',            healthScore: 91.6 },
    { id: 59, city: 'CLAETHORPES',    skuCount: 3283, region: 'East',             healthScore: 90.4 },
    { id: 60, city: 'IRRAGIN',        skuCount: 5246, region: 'Scotland',         healthScore: 87.5 },
    { id: 61, city: 'AETHELNEY',      skuCount: 3506, region: 'West',             healthScore: 92.9 },
    { id: 62, city: 'KILMARNOCK',     skuCount: 2296, region: 'Scotland',         healthScore: 93.3 },
    { id: 63, city: 'SWORDBREAK',     skuCount: 2026, region: 'North',            healthScore: 89.8 },
    { id: 64, city: 'CESTERFIELD',    skuCount: 4074, region: 'Midlands',         healthScore: 91.1 },
    { id: 65, city: 'LUTON',          skuCount: 1712, region: 'London',           healthScore: 94.0 },
    { id: 66, city: 'EANVERNESS',     skuCount: 6778, region: 'Scotland',         healthScore: 85.6 },
    { id: 67, city: 'EANVERNESS',     skuCount: 6880, region: 'Scotland',         healthScore: 86.2 },
    { id: 68, city: 'SOLARIS',        skuCount: 4685, region: 'South',            healthScore: 90.8 },
    { id: 69, city: 'MOUNTMEND',      skuCount: 7225, region: 'West',             healthScore: 84.5 },
    { id: 70, city: 'KELD',           skuCount: 2391, region: 'North',            healthScore: 92.5 },
    { id: 71, city: 'CLARCTON',       skuCount: 3546, region: 'East',             healthScore: 89.3 },
    { id: 72, city: 'HARDERSFIELD',   skuCount: 2548, region: 'North',            healthScore: 93.7 },
    { id: 73, city: 'DONCASTER',      skuCount: 7012, region: 'North',            healthScore: 83.9 },
    { id: 74, city: 'PAENTMARWY',     skuCount: 5606, region: 'Flagship Hub',     healthScore: 92.4 }, // Default Flagship
    { id: 75, city: 'BARNCOMBE',      skuCount: 2503, region: 'West',             healthScore: 91.7 },
    { id: 76, city: 'DONCASTER',      skuCount: 6871, region: 'North',            healthScore: 84.1 },
    { id: 77, city: 'TAMWORTH',       skuCount: 2977, region: 'Midlands',         healthScore: 93.2 },
    { id: 78, city: 'EASTHAVEN',      skuCount: 2005, region: 'East',             healthScore: 92.0 },
    { id: 79, city: 'BALLYMENA',      skuCount: 4407, region: 'Northern Ireland', healthScore: 88.6 },
    { id: 81, city: 'PEMBROKE',       skuCount: 3721, region: 'Wales',            healthScore: 92.3 },
];

/** Toko default saat aplikasi pertama kali dimuat */
export const DEFAULT_STORE = STORES_MASTER_REGISTRY.find((s) => s.id === 74) || STORES_MASTER_REGISTRY[0];

/** Helper untuk format nama tampilan lengkap */
export function formatStoreName(store) {
    if (!store) return 'Toko 74 - PAENTMARWY';
    const id = store.id || store.store;
    const city = store.city || store.kota || 'UNKNOWN';
    return `Toko ${id} - ${city}`;
}
