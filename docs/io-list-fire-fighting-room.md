# IO List — Fire-Fighting Room

**Route:** `/stations/fire-fighting-room`  
**Konektivitas:** **MQTT** via gateway Carlo Gavazzi UWP-4.0  
**Topic Subscribe:** `epbox/imox/demo/site/batam/edge/cg-uwp40-01/metrics`  
**Topic Publish:** `epbox/imox/demo/site/batam/edge/cg-uwp40-01/cmd/ot`

---

## Device Map

| Device ID | Signal Name | Fungsi | Arah |
|-----------|-------------|--------|------|
| 6563 | `Adjustable value` | Kata 24-bit DI + DO dari PLC S7-1200 | Read + Write |

---

## Bit Layout — 24-bit Combined Word

Sinyal `Adjustable value` dari device 6563 membawa satu nilai integer yang mewakili 24 channel I/O secara berurutan dalam dua register uint16 (`word[0]` dan `word[1]`).

```
word[0] bit  0–11  →  DI channel 1–12   (global bit  0–11)
word[0] bit 12–15  →  DO channel 1–4    (global bit 12–15)
word[1] bit  0–7   →  DO channel 5–12   (global bit 16–23)
word[1] bit  8–15  →  unused (selalu 0)
```

**Rumus nilai gabungan (untuk SetValue):**

```
combinedValue = word[1] * 65536 + word[0]
```

---

## Digital Input — 12 Channel (Read Only)

Source: `word[0]` bit 0–11  
Mode: **Read only** — tidak ada perintah yang dikirim untuk mengubah DI.

| No | Global Bit | Word | Bit | Key | Label | Contact | Kondisi Aktif |
|----|-----------|------|-----|-----|-------|---------|---------------|
| DI 1 | 0 | 0 | 0 | `emergencyStop` | Emergency Stop | NC | FALSE = E-Stop aktif |
| DI 2 | 1 | 0 | 1 | `btnStartPumpA` | Button — Start Pump A | NO | TRUE = Tombol ditekan |
| DI 3 | 2 | 0 | 2 | `btnStopPumpA` | Button — Stop Pump A | NC | FALSE = Tombol ditekan |
| DI 4 | 3 | 0 | 3 | `btnStartPumpB` | Button — Start Pump B | NO | TRUE = Tombol ditekan |
| DI 5 | 4 | 0 | 4 | `btnStopPumpB` | Button — Stop Pump B | NC | FALSE = Tombol ditekan |
| DI 6 | 5 | 0 | 5 | `btnZoneRelease` | Button — Zone Release | NO | TRUE = Tombol ditekan |
| DI 7 | 6 | 0 | 6 | `selectorLocalRemote` | Selector Local / Remote | NO | TRUE = Remote |
| DI 8 | 7 | 0 | 7 | `r3PumpARunning` | R3 — Pump A Running Status | NO | TRUE = Pump A running |
| DI 9 | 8 | 0 | 8 | `r4PumpBRunning` | R4 — Pump B Running Status | NO | TRUE = Pump B running |
| DI 10 | 9 | 0 | 9 | `r5PumpCRunning` | R5 — Pump C Running Status | NO | TRUE = Pump C running |
| DI 11 | 10 | 0 | 10 | `levelSwitchLow` | Level Switch — Low Tank | NO | TRUE = Level rendah |
| DI 12 | 11 | 0 | 11 | `flowSwitch` | Flow Switch | NO | TRUE = Ada aliran |

**Tampilan UI:**
- `TRUE` → titik hijau
- `FALSE` → titik abu-abu
- `emergencyStop = TRUE` → titik merah (kondisi bahaya, E-Stop tidak aktif = circuit terbuka)

---

## Digital Output — 12 Channel (Read + Write)

Source: `word[0]` bit 12–15 dan `word[1]` bit 0–7  
Mode: **Optimistic write** — UI update langsung (`draftWords`), gateway echo mengupdate `confirmedWords`.

| No | Global Bit | Word | Bit | Key | Label | Kategori UI |
|----|-----------|------|-----|-----|-------|-------------|
| DO 1 | 12 | 0 | 12 | `solenoidValve1` | R1 — Solenoid Valve 1 Open | Valve |
| DO 2 | 13 | 0 | 13 | `solenoidValve2` | R2 — Solenoid Valve 2 Open | Valve |
| DO 3 | 14 | 0 | 14 | `r3PumpAStart` | R3 — Pump A Start | Pump (hijau) |
| DO 4 | 15 | 0 | 15 | `r4PumpBStart` | R4 — Pump B Start | Pump (hijau) |
| DO 5 | 16 | 1 | 0 | `r5PumpCStart` | R5 — Pump C Start | Pump (hijau) |
| DO 6 | 17 | 1 | 1 | `buzzer` | Buzzer | Buzzer (kuning) |
| DO 7 | 18 | 1 | 2 | `lampZoneRelease` | Lamp — Zone Release | Lamp (oranye) |
| DO 8 | 19 | 1 | 3 | `lampPumpARunning` | Lamp — Pump A Running | Lamp (oranye) |
| DO 9 | 20 | 1 | 4 | `lampPumpAStoped` | Lamp — Pump A Stopped | Lamp (oranye) |
| DO 10 | 21 | 1 | 5 | `lampPumpBRunning` | Lamp — Pump B Running | Lamp (oranye) |
| DO 11 | 22 | 1 | 6 | `lampPumpBStoped` | Lamp — Pump B Stopped | Lamp (oranye) |
| DO 12 | 23 | 1 | 7 | `lampLocalRemote` | Lamp — Local / Remote | Lamp (oranye) |

### Warna UI per Kategori DO

| Kategori | Warna Aktif |
|----------|-------------|
| Pump (r3PumpAStart, r4PumpBStart, r5PumpCStart) | Hijau (`AppColors.success`) |
| Buzzer | Kuning (`AppColors.warning`) |
| Lamp & Solenoid Valve | Oranye (`AppColors.primary`) |

---

## Command — SetValue

Setiap toggle DO mengubah bit di `draftWords` lalu mempublish:

```json
{
  "id": 6563,
  "cmd": "SetValue",
  "value": <combinedValue>
}
```

**combinedValue** = `word[1] * 65536 + word[0]`  
dengan hanya bit DO yang diubah; bit DI dipertahankan dari nilai terakhir yang diterima.

---

## Write Window (DO Toggle)

| State | Kondisi |
|-------|---------|
| `isPendingDo = true` | Tepat setelah publish |
| Clear (immediate) | `metricsReceivedAt > doBaselineReceivedAtRef.current` |
| Clear (timeout) | 5 detik tanpa respons metrics |

**Hint UI saat pending:**  
`"SetValue sent — waiting for gateway metrics to confirm. Clears in 5s if no response."`

---

## Sync Logic (DI vs DO bits)

Saat metrics baru tiba:
1. `confirmedWords` diupdate sepenuhnya dari gateway
2. `draftWords` diupdate **selektif**:
   - Bit DI (global bit 0–11): selalu diambil dari metrics
   - Bit DO (global bit 12–23): dipertahankan dari `draftWords` (preservasi edit user)
3. `lastCombinedWord` di-set untuk display hex/binary di UI

---

## Summary IO Count

| Kategori | Jumlah | Keterangan |
|----------|--------|------------|
| Digital Input (read only) | 12 | Bit 0–11 dari device 6563 |
| Digital Output (read + write) | 12 | Bit 12–23 dari device 6563 |
| **Total channel** | **24** | 1 device, 1 signal, 2 uint16 words |

---

## Catatan Teknis

- Semua 24 channel dikemas dalam **satu sinyal** `Adjustable value` dari device 6563.
- PLC S7-1200 mengekspos nilai ini sebagai dua register Modbus 16-bit; gateway Carlo Gavazzi mempresentasikannya sebagai satu nilai JSON.
- Tidak ada batasan hardware pada DO — semua 12 channel dapat diset bersamaan dalam satu `SetValue`.
- Jika kapasitas perlu ditambah di masa depan, tambah `word[2]` tanpa mengubah interface `setChannelBit`/`unpackChannels`.
