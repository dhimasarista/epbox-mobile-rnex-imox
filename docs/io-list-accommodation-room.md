# IO List — Accommodation Room

**Route:** `/stations/accommodation-room`  
**Room ID:** AR-001  
**Konektivitas:** **MQTT** via gateway Carlo Gavazzi UWP-4.0  
**Topic Subscribe:** `epbox/imox/demo/site/batam/edge/cg-uwp40-01/metrics`  
**Topic Publish:** `epbox/imox/demo/site/batam/edge/cg-uwp40-01/cmd/ot`

---

## Device Map

| Device ID | Fungsi | Jenis Command | Arah |
|-----------|--------|---------------|------|
| 3549 | Smoke Status Counter | Counter (SetValue) | Read + Write |
| 3585 | Temperature Counter | Counter (SetValue) | Read + Write |
| 3667 | Alarm Unit | Alarm Command | Read + Write |
| 4147 | Zone Temperature / Heating Control | — | Read only |

---

## 1. Device 3549 — Smoke Status Counter

**Fungsi:** Mendeteksi status asap/kebakaran di ruangan. Nilai integer dari counter diinterpretasikan sebagai boolean.

### Signals (Subscribe — `gatewayMetrics`)

| Signal Name | Tipe | Nilai | Deskripsi |
|-------------|------|-------|-----------|
| `Adjustable value` | number | 0 / 1 | 0 = Clear, 1 = Smoke Detected |

### Commands (Publish — `gatewayOtCommand`)

| Command | Payload | Kondisi |
|---------|---------|---------|
| `SetValue` | `{ id: 3549, cmd: "SetValue", value: 0 }` | Set Clear |
| `SetValue` | `{ id: 3549, cmd: "SetValue", value: 1 }` | Set Smoke Detected |

### UI State

| State | Label | Warna |
|-------|-------|-------|
| value = 0 | Clear | Default |
| value = 1 | Detected | Merah |

### Write Window

- Pending selama 5 detik atau sampai `metricsReceivedAt > baselineReceivedAt`
- ACK condition: nilai dari metrics cocok dengan nilai yang dikirim

---

## 2. Device 3585 — Temperature Counter

**Fungsi:** Menampilkan dan mengatur nilai suhu ruangan dalam derajat Celsius.

### Signals (Subscribe — `gatewayMetrics`)

| Signal Name | Tipe | Range | Unit | Deskripsi |
|-------------|------|-------|------|-----------|
| `Adjustable value` | number | 0 – 120 | °C | Suhu aktual dari counter |

### Commands (Publish — `gatewayOtCommand`)

| Command | Payload | Keterangan |
|---------|---------|------------|
| `SetValue` | `{ id: 3585, cmd: "SetValue", value: N }` | Set suhu ke N (integer °C) |

**Debounce:** 250 ms setelah slider berhenti digeser sebelum publish.

### Signal Tone (Threshold Suhu)

| Tone | Warna | Kondisi |
|------|-------|---------|
| `normal` | Hijau | < 40 °C |
| `warning` | Kuning | 40 – 54 °C |
| `danger` | Merah | ≥ 55 °C |

### Write Window

- Pending selama 5 detik atau sampai `metricsReceivedAt > baselineReceivedAt`
- ACK condition: `Math.round(metricsValue) === sentValue`

---

## 3. Device 3667 — Alarm Unit

**Fungsi:** Sistem alarm kebakaran. Membaca status alarm dan siren; menerima perintah penanganan alarm.

### Signals (Subscribe — `gatewayMetrics`)

| Signal Name | Tipe | Nilai | Deskripsi |
|-------------|------|-------|-----------|
| `Alarm status` | number | 1 – 6 | Kode status alarm |
| `Siren status` | boolean | true / false | Status aktif siren |
| `Output 1` – `Output 6` | boolean | true / false | Status relay output 1-6 |

### Alarm Status Codes

| Kode | Label | Tone |
|------|-------|------|
| 1 | Alarm OFF | `normal` (hijau) |
| 2 | Alarm ON | `danger` (merah) |
| 3 | Alarm was ON | `warning` (kuning) |
| 4 | Acknowledged, alarm ON | `danger` (merah) |
| 5 | Acknowledged, alarm was ON | `warning` (kuning) |
| 6 | Reset alarm | `warning` (kuning) |

**Siren aktif (true)** selalu override ke `danger` terlepas dari kode alarm.

### Commands (Publish — `gatewayOtCommand`)

| Command | Payload | Keterangan |
|---------|---------|------------|
| `Acknowledgement` | `{ id: 3667, cmd: "Acknowledgement" }` | Akui alarm yang aktif |
| `Reset` | `{ id: 3667, cmd: "Reset" }` | Reset kondisi alarm |
| `ResetOn` | `{ id: 3667, cmd: "ResetOn" }` | Reset ON state |
| `ResetOff` | `{ id: 3667, cmd: "ResetOff" }` | Reset OFF state |
| `TestAlarmOn` | `{ id: 3667, cmd: "TestAlarmOn" }` | *(disabled di UI, tersedia di kode)* |
| `TestAlarmOff` | `{ id: 3667, cmd: "TestAlarmOff" }` | *(disabled di UI, tersedia di kode)* |

### Write Window (per command)

- Setiap command memiliki pending state independen
- Pending maksimal 5 detik (`ALARM_WRITE_GUARD_MS = 5000`)
- ACK condition: `metricsReceivedAt > baselineReceivedAt` (tidak perlu cocok nilai spesifik)
- Jika command sudah pending, kirim ulang command yang sama akan ditolak dengan pesan error

---

## 4. Device 4147 — Zone Temperature / Heating Control

**Fungsi:** Sistem kontrol pemanas zona. Read-only dari app — tidak ada command yang dikirim ke device ini.

### Signals (Subscribe — `gatewayMetrics`)

| Signal Name | Tipe | Range / Values | Unit | Deskripsi |
|-------------|------|----------------|------|-----------|
| `Heating control analogue signal` | number | 0 – 100 | % | Output kontrol pemanas (PWM/analog) |
| `Heating set point signal` | number | — | °C | Target suhu yang diset |
| `Heating control status signal` | number | — | — | Kode status kontrol (lihat bawah) |
| `Heating set point selected signal` | number | 1 / 2 / 3 / 4 | — | Set point aktif yang dipilih |
| `Heating status signal` | number | 1 – 17 | — | Status operasi pemanas (lihat bawah) |
| `Status signal` | number | — | — | Status keseluruhan sistem |

### Heating Set Point Selected

| Nilai | Label |
|-------|-------|
| 1 | OFF |
| 2 | SP1 |
| 3 | SP2 |
| 4 | SP3 |

### Heating Status

| Nilai | Label |
|-------|-------|
| 1 | Control OFF |
| 2, 3 | Set Point 1 |
| 4, 5 | Set Point 2 |
| 6, 7 | Set Point 3 |
| 8, 9 | Manual Set Point |
| 10, 11 | Safe Mode |
| 12 | Antifreeze ← *Antifreeze badge aktif* |
| 13 | Auxiliary |
| 14 | Forced ON |
| 15 | Antifreeze |
| 16 | Forced OFF |
| 17 | System Function |

**Catatan:** Heating status = 12 (Antifreeze) menampilkan badge biru "Antifreeze Active" di samping slider suhu.

---

## Summary IO Count

| Kategori | Jumlah | Keterangan |
|----------|--------|------------|
| Analog Input (read) | 3 | Suhu (3585), Heating analogue (4147), Heating set point (4147) |
| Digital Input (read) | 8 | Smoke (3549), Siren (3667), Alarm status (3667), 6× relay output (3667) |
| Heating Status (read) | 4 | 4 heating state signals dari 4147 |
| Counter Write (command) | 2 | SetValue → 3549, 3585 |
| Alarm Command (command) | 4 | Acknowledgement, Reset, ResetOn, ResetOff ke 3667 |

---

## Storage

| Key | Format | Konten |
|-----|--------|--------|
| `epbox.accommodation-room.demo.values` | JSON string | `{ smokeDetected, temperatureValue, ... }` |

**Default values:**

```json
{
  "triggerEnable": true,
  "smokeDetected": false,
  "temperatureValue": "34 C",
  "temperatureHighLimit": false,
  "manualOverride": false
}
```

Nilai ini dipakai sebagai initial state saat metrics pertama kali diterima atau storage belum terisi.
