/**
 * perangkat.js — Apakah game memakai kontrol sentuh (joystick dan tombol TAP).
 *
 * Aturannya sama dengan useDeviceDetect().shouldShowMobileControls: layar sentuh atau layar sempit. Dipakai juga oleh
 * Phaser dan komponen yang tidak memakai hook, supaya petunjuk tombol keyboard ("Tekan E", "Esc") tidak muncul di
 * HP/tablet, tempat aksinya lewat tombol TAP dan ✕.
 */
export function pakaiKontrolSentuh() {
    if (typeof window === 'undefined') return false;
    const sentuh = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;
    return Boolean(sentuh) || window.innerWidth <= 768;
}

/** Label interaksi di peta: "[Tekan E: Duduk]" atau "[E: Analisis Toko]" di keyboard, "[Duduk]" / "[Analisis Toko]" di kontrol sentuh. */
export function labelInteraksi(teks) {
    return pakaiKontrolSentuh() ? teks.replace(/\[(?:Tekan )?[EC](?::| untuk) /g, '[') : teks;
}
