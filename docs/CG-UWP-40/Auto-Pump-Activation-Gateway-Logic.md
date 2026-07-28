# Auto Pump Activation — Logika di Gateway (UWP4.0) — versi sederhana

Tujuan: **UWP4.0 sendiri** yang menyalakan Pump Activation begitu **smoke ATAU
temperature** aktif, dengan menulis **bit word[2] register TO_PLC**, sehingga PLC
langsung menyalakan pompa. Pompa **tetap ON** sampai suhu turun **< 30 °C**
(dan smoke hilang). Tidak bergantung app mobile.

Sumber: `UWPIDE_Eng.pdf` (Analogue comparator, Multigate, Modbus outputs) +
`mqtt_report (7).md` (id fungsi) di folder ini.

---

## Bisa dilakukan di UWP4.0? — Ya

| Kebutuhan | Blok UWP yang dipakai | Ada di manual? |
|---|---|---|
| Suhu tinggi picu ON, baru OFF kalau turun < 30 | **Analogue comparator** (High/Low threshold = hysteresis) | ✅ |
| Smoke ATAU suhu (logika OR) | **Multigate** (formula `OR`) | ✅ |
| Tulis bit ke PLC (word[2]) | **Modbus Digital/Analogue output** | ✅ |

**Satu-satunya yang belum pasti** bukan kemampuan UWP, melainkan apakah register
word[2] di PLC SIEMENS **terdaftar sebagai variabel Modbus yang bisa ditulis** dari
driver UWP (alamat & hak tulis). Itu urusan mapping fisik → **konfirmasi ke
engineering PLC**.

> **Soal "word ketiga / index 2":** di sisi Modbus fisik, keempat word TO_PLC =
> **4 register berurutan**. Di UWP cukup buat **satu variabel Modbus menunjuk
> register word[2] (alamat basis + 2)** lalu tulis 1/0 independen — **tidak perlu
> repack uint64**, PT1/PT2 tidak tersentuh.

---

## Rantai logika (3 blok saja)

```
 [Counter 3585 Temperature] ─▶ (A) Analogue Comparator "TEMP_HOT"
                                    ON  saat temp ≥ 60°C   (High threshold)
                                    OFF saat temp < 30°C   (Low threshold = hysteresis)
                                         │ digital
 [Counter 3549 Smoke]        ─▶ (B) sinyal smoke (≥1)
                                         │ digital
                                         ▼
                              (C) Multigate "FIRE_ON"
                                   Formula: SMOKE OR TEMP_HOT
                                         │ digital (1 = nyalakan pompa)
                                         ▼
                              (D) Modbus Output "PLC_PUMP_ACT"
                                   tulis word[2] TO_PLC = nilai FIRE_ON (1/0)
```

### (A) Analogue comparator — `TEMP_HOT`  ← ini yang mewujudkan aturan suhu
- **Input**: Temperature (Counter 3585).
- **Comparator type**: high threshold **dengan hysteresis**:
  - **High threshold (ON) = 60 °C** ← ambang aktif (silakan sesuaikan).
  - **Low threshold (OFF) = 30 °C** ← pompa baru mati kalau suhu turun di bawah 30.
- **Output value**: ON = 1, OFF = 0.
- Efeknya: sekali suhu ≥ 60°C pompa ON, dan **tetap ON walau suhu turun ke 45/35**,
  baru OFF setelah benar-benar **< 30 °C**. Persis yang kamu minta.

### (B) Smoke
- Pakai langsung *status signal* Counter 3549 (ON saat ada asap), atau comparator
  sederhana `≥ 1`. Output 1/0.

### (C) Multigate — `FIRE_ON`
- **Formula**: `SMOKE OR TEMP_HOT`.
- Kalau nanti mau syarat gabungan, ganti ke `AND`.
- **Output**: digital `FIRE_ON`.

### (D) Modbus output — `PLC_PUMP_ACT`  (menulis ke PLC)
- Prasyarat: di **Modbus driver** UWP (ke PLC SIEMENS), buat **variabel output**
  yang mapping ke **register word[2]** (alamat basis TO_PLC + 2).
  - Function code: **6/16** (register 16-bit) atau **5/1** (bila coil/bit).
  - Format: uint16/bit — **hanya word ini**.
- **Fungsi**: Digital output (jika 1 bit) atau Analogue output (tulis 1/0).
- **Input signal**: `FIRE_ON`.
- Centang **"write output when the function value changes"** → tulis hanya saat
  status berubah (1 saat picu, 0 saat kondisi hilang).
- Centang **Exclude CRC check** bila register ini juga ditulis app/BMS lain.

---

## Perilaku hasil

| Kondisi | TEMP_HOT | SMOKE | FIRE_ON → word[2] |
|---|---|---|---|
| Normal (suhu < 60, tak ada asap) | 0 | 0 | **0** (pompa off) |
| Suhu naik ke ≥ 60°C | 0→1 | 0 | **1** (pompa ON) |
| Suhu turun ke 45°C (masih ≥ 30) | tetap 1 | 0 | **1** (tetap ON) |
| Suhu turun < 30°C | 1→0 | 0 | **0** (pompa OFF) |
| Asap terdeteksi (suhu berapa pun) | – | 1 | **1** (pompa ON) |

Karena OFF hanya saat suhu **< 30 °C**, tidak ada kedip-kedip di sekitar ambang
(hysteresis 60→30). Pompa "latch" ON secara natural tanpa timer tambahan.

---

## Yang perlu dikonfirmasi engineering

1. **Alamat Modbus** word[2] Pump Activation (base + 2), dan apakah register 16-bit
   atau coil/bit.
2. Angka **ambang ON** (dokumen contoh 60 °C) — OFF sudah fix **30 °C** per permintaan.
3. Smoke cukup `≥ 1`? atau perlu di-AND dengan suhu?
4. Perlukah **manual override** dari app tetap jalan? (Modbus output punya Force ON/OFF.)

> Catatan keselamatan: logika fire-fighting sebaiknya di UWP/PLC (seperti ini),
> app mobile cukup monitor + override manual.

---

## Peta ke kode app

| Konsep | Di app |
|---|---|
| word[2] = Pump Activation | `TO_PLC_WORD_INDEX.pumpActivation = 2` — `src/lib/mqtt-topics.ts` |
| Smoke/Temp decode | `getAccommodationRoomMetricsState` (3549/3585) |

Setelah aktif di gateway, app **tidak perlu** kirim aktivasi otomatis; aktivasi
manual dari app tetap bisa sebagai override.
