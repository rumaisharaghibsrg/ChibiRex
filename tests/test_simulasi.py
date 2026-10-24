"""Uji jam simulasi: waktu maju dari 31 Des 2016, stok berkurang sesuai permintaan harian, dan barang dari PO yang
disetujui (atau stok uji Hold Reorder) tiba setelah lead time vendor."""

from datetime import timedelta

import pytest

from tests.api_data import SEKARANG, buat_client, sku_id

TOKEN = {"X-Worker-Token": "rahasia-uji"}


@pytest.fixture
def jam():
    return [SEKARANG]


@pytest.fixture
def client(analytics_db, tmp_path, jam):
    with buat_client(analytics_db, tmp_path, clock=lambda: jam[0], worker_token="rahasia-uji") as c:
        yield c


def maju(client, hari):
    return client.post("/simulasi/maju", json={"hari": hari, "oleh": "manajer uji"}).json()


def stok(client, brand):
    return client.get(f"/sku/{sku_id(brand)}").json()


def setujui_draf(client, brand, kunci):
    po = client.post("/purchase-orders", json={"inventory_id": sku_id(brand), "alasan": "Penjualan naik, stok menipis"},
                     headers={"Idempotency-Key": kunci}).json()
    return client.post(f"/purchase-orders/{po['po_id']}/approve", json={"oleh": "manajer"}).json()


def test_hari_nol_memakai_data_asli(client):
    assert client.get("/simulasi").json() == {"hari_ke": 0, "tanggal": "2016-12-31", "otomatis": False,
                                              "detik_per_hari": 60.0, "hari_maks": 90}
    sku = stok(client, 10)
    assert (sku["stok_akhir"], sku["stok_dalam_pengiriman"], sku["status_stok"]) == (50, 0, "REORDER")


def test_maju_mengurangi_stok_secara_konsisten(client):
    assert maju(client, 7)["tanggal"] == "2017-01-07"
    sku = stok(client, 10)
    assert 0 <= sku["stok_akhir"] < 50  # permintaan rata-rata 5 unit/hari selama 7 hari
    assert sku["tgl_perkiraan_habis"] >= "2017-01-07"
    assert stok(client, 10)["stok_akhir"] == sku["stok_akhir"]  # acak tetapi sama untuk hari yang sama
    ringkasan = client.get("/stores/1/ringkasan").json()
    assert ringkasan["per_tanggal"] == "2017-01-07"
    # Smirnoff (stok 200, AMAN) ikut terjual; nilai stok toko turun dibanding hari 0.
    assert stok(client, 50)["stok_akhir"] < 200


def test_po_disetujui_tiba_setelah_lead_time(client):
    po = setujui_draf(client, 10, "tiba-po-0001")
    assert (po["status"], po["tgl_tiba"]) == ("APPROVED", "2017-01-08")  # lead time 8 hari
    maju(client, 7)
    sebelum = stok(client, 10)
    assert sebelum["stok_dalam_pengiriman"] == po["qty"] and sebelum["perlu_reorder"] is False
    maju(client, 1)
    sesudah = stok(client, 10)
    assert sesudah["stok_dalam_pengiriman"] == 0
    assert sesudah["stok_akhir"] > sebelum["stok_akhir"]  # 70 unit tiba, jauh di atas permintaan satu hari
    assert client.get(f"/purchase-orders/{po['po_id']}").json()["tgl_tiba"] == "2017-01-08"


def test_stok_uji_hold_ikut_tiba(client):
    hold = client.post("/holds", json={"inventory_id": sku_id(20), "alasan": "Vs turun dan tidak komplementer"},
                       headers={"Idempotency-Key": "tiba-hold-0001"}).json()
    assert hold["review_pada"] == "2017-03-31"
    assert stok(client, 20)["stok_dalam_pengiriman"] == hold["qty_uji"]
    maju(client, 8)
    assert stok(client, 20)["stok_dalam_pengiriman"] == 0


def test_otomatis_berjalan_lalu_dijeda(client, jam):
    r = client.post("/simulasi/otomatis", json={"aktif": True, "detik_per_hari": 10}).json()
    assert (r["otomatis"], r["hari_ke"], r["detik_per_hari"]) == (True, 0, 10.0)
    jam[0] = SEKARANG + timedelta(seconds=35)
    assert client.get("/simulasi").json()["hari_ke"] == 3
    assert maju(client, 2)["hari_ke"] == 5  # tombol tetap bisa dipakai saat otomatis
    jam[0] += timedelta(seconds=10)
    assert client.post("/simulasi/otomatis", json={"aktif": False}).json()["hari_ke"] == 6
    jam[0] += timedelta(seconds=100)
    assert client.get("/simulasi").json() == {"hari_ke": 6, "tanggal": "2017-01-06", "otomatis": False,
                                              "detik_per_hari": 10.0, "hari_maks": 90}


def test_batas_hari_maks_dan_validasi(analytics_db, tmp_path):
    with buat_client(analytics_db, tmp_path, simulasi_hari_maks=10) as client:
        assert maju(client, 30)["hari_ke"] == 10
        assert client.post("/simulasi/maju", json={"hari": 0}).status_code == 422
        assert client.post("/simulasi/otomatis", json={"aktif": True, "detik_per_hari": 1}).status_code == 422


def test_kembali_ke_awal_tanpa_menghapus_data(client):
    tiba = setujui_draf(client, 10, "kembali-po-0001")  # disetujui hari 0, tiba hari 8
    maju(client, 10)
    jalan = setujui_draf(client, 30, "kembali-po-0002")  # disetujui hari 10, tiba hari 18
    hold = client.post("/holds", json={"inventory_id": sku_id(20), "alasan": "Vs turun dan tidak komplementer"},
                       headers={"Idempotency-Key": "kembali-hold-0001"}).json()
    assert hold["review_pada"] == "2017-04-10"
    client.post("/simulasi/otomatis", json={"aktif": True})

    r = client.post("/simulasi/kembali", json={"oleh": "manajer uji"}).json()
    assert (r["hari_ke"], r["tanggal"], r["otomatis"]) == (0, "2016-12-31", False)
    # Barang yang sudah tiba menjadi riwayat: stok kembali ke data awal.
    sku = stok(client, 10)
    assert (sku["stok_akhir"], sku["stok_dalam_pengiriman"]) == (50, 0)
    assert client.get(f"/purchase-orders/{tiba['po_id']}").json()["tgl_tiba"] is None
    # Barang yang masih di jalan tetap tiba dengan sisa lead time 8 hari.
    assert client.get(f"/purchase-orders/{jalan['po_id']}").json()["tgl_tiba"] == "2017-01-08"
    assert stok(client, 30)["stok_dalam_pengiriman"] == jalan["qty"]
    assert client.get("/holds").json()[0]["review_pada"] == "2017-03-31"
    # PO, hold, dan audit log tidak dihapus.
    assert len(client.get("/purchase-orders").json()) == 2
    assert client.get("/audit-log").json()[0]["aksi"] == "simulasi_kembali"


def test_reset_demo_mengembalikan_jam(client):
    maju(client, 5)
    client.post("/simulasi/otomatis", json={"aktif": True})
    assert client.post("/demo/reset", headers=TOKEN).status_code == 204
    r = client.get("/simulasi").json()
    assert (r["hari_ke"], r["otomatis"]) == (0, False)
