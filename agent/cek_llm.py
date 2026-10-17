"""Cek kesiapan LLM untuk Tahap 5: `python -m agent.cek_llm`.

Untuk Ollama: memastikan server berjalan dan model sudah diunduh, lalu menguji pemanggilan tool lewat
Strands, persis seperti yang nanti dilakukan agent. Untuk Bedrock: menjalankan agent.cek_bedrock.
"""

import re
import sys
import time

from agent import config
from agent.llm import buat_model, nama_model

# Kesimpulan yang benar untuk data uji di bawah (stok 43, reorder point 83,3) adalah "perlu reorder".
KESIMPULAN_BENAR = re.compile(r"di bawah|perlu (di)?reorder|perlu restok|perlu dipesan|harus (di)?reorder", re.I)
KESIMPULAN_SALAH = re.compile(r"di atas|belum (mencapai|di bawah|perlu)|tidak perlu|masih aman", re.I)


def gagal(pesan: str) -> None:
    print(f"\n[GAGAL] {pesan}")
    sys.exit(1)


def cek_ollama() -> None:
    import ollama

    try:
        tersedia = [m.model for m in ollama.Client(config.OLLAMA_HOST).list().models]
    except Exception as e:  # server belum berjalan / belum terpasang
        gagal(f"Server Ollama tidak bisa dihubungi di {config.OLLAMA_HOST} ({e}).\n"
              "Pastikan Ollama sudah terpasang dan berjalan (ikon Ollama di system tray, atau jalankan `ollama serve`).")
    print(f"[ok] Server Ollama berjalan. Model terpasang: {', '.join(tersedia) or 'belum ada'}")
    if config.OLLAMA_MODEL not in tersedia:
        gagal(f"Model {config.OLLAMA_MODEL} belum diunduh. Jalankan: ollama pull {config.OLLAMA_MODEL}")


def uji_tool() -> None:
    from strands import Agent, tool

    dipanggil = []

    # Bentuk data meniru API Tahap 4: angka mentah + keputusan jadi dari mesin hitung.
    @tool
    def get_sku_metrics(inventory_id: str) -> dict:
        """Ambil metrik stok sebuah SKU.

        Args:
            inventory_id: ID SKU per toko, misalnya 74_PAENTMARWY_4222.
        """
        dipanggil.append(inventory_id)
        return {"inventory_id": inventory_id, "stok_akhir": 43, "reorder_point": 83.3,
                "perlu_reorder": True, "status_stok": "REORDER"}

    agent = Agent(
        model=buat_model(),
        tools=[get_sku_metrics],
        system_prompt=(
            "Kamu asisten stok. Selalu ambil data lewat tool. Jangan menghitung atau membandingkan angka sendiri: "
            "kesimpulan perlu reorder atau tidak WAJIB diambil dari field perlu_reorder dan status_stok hasil tool. "
            "Jawab singkat dalam Bahasa Indonesia."),
        callback_handler=None,
    )
    print(f"\nMenguji pemanggilan tool dengan {nama_model()} ...")
    mulai = time.perf_counter()
    jawaban = str(agent("Berapa stok SKU 74_PAENTMARWY_4222, dan apakah perlu reorder?")).strip()
    durasi = time.perf_counter() - mulai

    if not dipanggil:
        gagal(f"Model menjawab tanpa memanggil tool ({durasi:.1f} dtk):\n{jawaban}\n"
              "Model ini kurang andal untuk agent; coba model lain di CHIBIREX_OLLAMA_MODEL.")
    print(f"[ok] Tool dipanggil dengan argumen {dipanggil[0]!r} ({durasi:.1f} dtk)")
    print(f"     Jawaban model: {jawaban}")
    if KESIMPULAN_SALAH.search(jawaban) or not KESIMPULAN_BENAR.search(jawaban):
        gagal("Kesimpulan model bertentangan dengan field perlu_reorder dari tool (seharusnya: perlu reorder).")
    print("[ok] Kesimpulan model sesuai field perlu_reorder dari tool")
    print("\nSemua cek lulus. LLM siap untuk Tahap 5.")


def main() -> None:
    if config.LLM_PROVIDER == "bedrock":
        from agent import cek_bedrock

        cek_bedrock.main()
        return
    cek_ollama()
    uji_tool()


if __name__ == "__main__":
    main()
