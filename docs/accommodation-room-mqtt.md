# Accommodation Room — Cara Kerja MQTT

File: `src/app/stations/accommodation-room.tsx`

---

## Gambaran Umum

Accommodation Room adalah layar dashboard yang berfungsi ganda:

1. **Subscribe** — menerima data real-time dari Carlo Gavazzi UWP gateway via MQTT dan menampilkan status smoke, suhu, alarm, dan siren.
2. **Publish** — mengirim perintah kontrol ke gateway untuk mengubah nilai sensor (mode demo/inject) dan mengeksekusi aksi alarm.

---

## Topic MQTT

### Topic Root

Semua topic menggunakan root path yang sama:

```
epbox/imox/demo/site/batam/edge/cg-uwp40-01
```

---

### 1. SUBSCRIBE — `gatewayMetrics`

**Topic lengkap:**
```
epbox/imox/demo/site/batam/edge/cg-uwp40-01/metrics
```

**Arah:** Broker → App (Subscribe)
**QoS:** 0
**Retain:** false

Ini adalah satu-satunya topic subscribe yang digunakan layar ini. Payload berisi snapshot semua device dan signal dari gateway.

**Contoh payload:**
```json
{
  "ip": "192.168.16.20",
  "sn": "BZ2730006001L",
  "mac": "00:19:EE:12:AD:C6",
  "time": "Asia/Jakarta",
  "devices": [
    {
      "id": 3667,
      "name": "Alarm",
      "pn": "FxAlarm",
      "signals": [
        { "id": 3669, "name": "Alarm status", "time": 1782128615496, "value": 2.0, "unit": "", "type": 0 },
        { "id": 3672, "name": "Siren status", "time": 1782128615496, "value": 1.0, "unit": "", "type": 2 }
      ]
    }
  ]
}
```

**Aturan merge payload:**
Payload `gatewayMetrics` tidak langsung di-replace. App menggabungkan (merge) payload lama dengan payload baru secara incremental:
- Device yang sudah ada → signal-nya di-update per ID+nama signal.
- Device baru yang belum ada → ditambahkan ke daftar.
- Tujuan: payload tidak hilang jika gateway hanya mengirim sebagian device per message.

**Data yang diekstrak dari `gatewayMetrics`:**

| Data | Device ID | Signal Name | Keterangan |
|---|---|---|---|
| Smoke Status | 3549 | `Total value` / `Input value` | Boolean — `>= 0.5` = terdeteksi asap |
| Temperature | 3585 | `Total value` / `Input value` | Angka dalam Celsius |
| Alarm Status | 3667 | `Alarm status` | Kode 1–6 (lihat tabel kode di bawah) |
| Siren Status | 3667 | `Siren status` | `>= 0.5` = siren ON |
| Zone Heating | 4147 | 6 signal nama khusus | Data zona pemanas (lihat bagian Zone Heating) |

---

### 2. PUBLISH — `gatewayOtCommand`

**Topic lengkap:**
```
epbox/imox/demo/site/batam/edge/cg-uwp40-01/cmd/ot
```

**Arah:** App → Broker (Publish)
**QoS:** 0
**Retain:** false

Topic ini digunakan untuk **semua perintah keluar** dari layar Accommodation Room. Ada dua jenis perintah:

---

#### 2a. Perintah SetValue (Inject Data Sensor)

Digunakan untuk mengubah nilai sensor di gateway (mode demo/simulasi data).

**Format payload:**
```json
{ "id": <counter_id>, "cmd": "SetValue", "value": <angka> }
```

**Perintah Smoke Detected:**

| Aksi User | Payload yang dikirim |
|---|---|
| Toggle Smoke → ON | `{ "id": 3549, "cmd": "SetValue", "value": 1 }` |
| Toggle Smoke → OFF | `{ "id": 3549, "cmd": "SetValue", "value": 0 }` |

**Aturan Smoke:**
- Dikirim langsung saat user toggle (tidak ada debounce).
- State UI langsung berubah (draft), tapi status "confirmed" baru berubah saat gateway membalas via `gatewayMetrics` dengan nilai yang cocok.

**Perintah Temperature:**

| Aksi User | Payload yang dikirim |
|---|---|
| Geser slider ke nilai N | `{ "id": 3585, "cmd": "SetValue", "value": N }` |

**Aturan Temperature:**
- Menggunakan **debounce 250ms** — perintah hanya dikirim 250ms setelah user berhenti menggeser slider.
- Nilai di-clamp antara 0–120°C.
- State "confirmed" baru berubah saat gateway membalas nilai yang cocok via `gatewayMetrics`.

---

#### 2b. Perintah Alarm Command

Digunakan untuk mengontrol device alarm (ID: 3667) di gateway.

**Format payload:**
```json
{ "id": 3667, "cmd": "<nama_perintah>" }
```

**Daftar perintah alarm:**

| Tombol UI | Payload | Kapan digunakan |
|---|---|---|
| Acknowledge Alarm | `{ "id": 3667, "cmd": "Acknowledgement" }` | Konfirmasi alarm yang sedang aktif |
| Reset Alarm | `{ "id": 3667, "cmd": "Reset" }` | Reset alarm sepenuhnya setelah bahaya selesai |
| Reset ON | `{ "id": 3667, "cmd": "ResetOn" }` | Reset dan set kondisi ON |
| Reset OFF | `{ "id": 3667, "cmd": "ResetOff" }` | Reset dan set kondisi OFF |
| Test Alarm ON *(tersembunyi)* | `{ "id": 3667, "cmd": "TestAlarmOn" }` | Simulasi alarm ON (di-comment di UI) |
| Test Alarm OFF *(tersembunyi)* | `{ "id": 3667, "cmd": "TestAlarmOff" }` | Hentikan simulasi alarm (di-comment di UI) |

---

## Aturan dan Guard Alarm

### Write Guard (5 Detik)

Setelah alarm command berhasil dikirim, semua tombol alarm dikunci selama **5 detik** (`ALARM_WRITE_GUARD_MS = 5000`).

**Alasan:** Gateway UWP membutuhkan waktu untuk memproses dan merespons perintah. Mengirim perintah berulang terlalu cepat bisa diabaikan oleh controller.

**Alur write guard:**

```
User tekan tombol alarm
        │
        ▼
Kirim publish ke gatewayOtCommand
        │
        ▼
Set pendingAlarmCommand (catat waktu sentAt)
        │
        ▼
Semua tombol alarm terkunci (5 detik)
        │
        ├── Jika gatewayMetrics datang dengan timestamp lebih baru
        │   → Alarm command dianggap selesai → kunci dibuka
        │
        └── Jika 5 detik berlalu tanpa respons
            → Kunci tetap aktif hingga ada respons metrics baru
```

**Indikator countdown** ditampilkan di UI selama write guard aktif (update setiap 250ms).

### Kapan Tombol Alarm Disabled

Tombol alarm tidak bisa ditekan (`isActionLocked = true`) jika **salah satu** kondisi ini terpenuhi:

| Kondisi | Penjelasan |
|---|---|
| MQTT tidak terhubung (`status !== 'connected'`) | Tidak ada koneksi ke broker |
| Write guard aktif (`isAlarmWriteWindowActive`) | 5 detik setelah perintah terakhir belum habis |

---

## Kode Status Alarm

Nilai `Alarm status` dari gateway memiliki 6 kode:

| Kode | Label | Tone UI |
|---|---|---|
| 1 | Alarm OFF | Normal (hijau/default) |
| 2 | Alarm ON | Danger (merah) |
| 3 | Alarm was ON | Warning (kuning) |
| 4 | Acknowledged, alarm ON | Danger (merah) |
| 5 | Acknowledged, alarm was ON | Warning (kuning) |
| 6 | Reset alarm | Warning (kuning) |

**Siren status:**
- `>= 0.5` → Siren ON → Tone Danger (merah)
- `< 0.5` → Siren OFF

**Prioritas tone alarm:**

```
sirenOn=true OR alarmStatusCode=2 OR alarmStatusCode=4  →  danger
alarmStatusCode=3 OR alarmStatusCode=5 OR alarmStatusCode=6  →  warning
selain itu  →  normal
```

---

## Ambang Batas Suhu

| Nilai | Label | Tone UI |
|---|---|---|
| 0 – 39°C | Normal Range | Normal (hijau) |
| 40 – 54°C | Watch >= 40°C | Warning (kuning) |
| >= 55°C | Alarm >= 55°C | Danger (merah) |
| Antifreeze (kode 12) | Antifreeze Active | Info (biru) |

---

## State Management

Layar ini memiliki dua lapis state untuk setiap nilai sensor:

| State | Sumber | Penjelasan |
|---|---|---|
| `draftForm` | Aksi user (lokal) | Langsung berubah saat user interaksi |
| `confirmedForm` | Respons `gatewayMetrics` | Berubah hanya saat gateway mengonfirmasi nilai |

**Alur state smoke/temperature:**

```
User interaksi
      │
      ▼
draftForm berubah (UI langsung responsif)
      │
      ▼
Publish perintah ke MQTT
      │
      ▼
Tandai sebagai pending (isSmokePending / isTemperaturePending)
      │
      ▼
Tunggu respons gatewayMetrics
      │
      ├── Nilai cocok dengan yang dikirim
      │   → confirmedForm dan draftForm diperbarui
      │   → pending dihapus
      │   → Latency sample dicatat
      │
      └── MQTT disconnect sementara pending aktif
          → Pending dihapus, draftForm tidak diperbarui
```

**Sinkronisasi dari metrics (override draft):**
Jika tidak ada pending command untuk field tertentu, setiap metrics baru dari broker akan langsung mengupdate `draftForm` dan `confirmedForm` secara bersamaan.

---

## Pengukuran Latency

Setiap perintah yang berhasil dikonfirmasi akan menghasilkan satu latency sample:

```
requestTopicKey  → gatewayOtCommand  (waktu publish)
responseTopicKey → gatewayMetrics    (waktu metrics diterima)
durationMs       → selisih keduanya
```

Sample ini ditampilkan di layar Status sebagai indikator performa round-trip komunikasi App → Broker → Gateway → Broker → App.

---

## Zone Heating (Data Read-Only)

Device ID `4147` berisi data zona pemanas yang hanya dibaca (tidak ada perintah publish untuk ini dari layar Accommodation Room).

| Signal Name | Keterangan |
|---|---|
| `Heating control analogue signal` | Nilai analog kontrol pemanas |
| `Heating set point signal` | Set point suhu target |
| `Heating control status signal` | ON/OFF status kontrol |
| `Heating set point selected signal` | SP yang aktif: OFF / SP1 / SP2 / SP3 |
| `Heating status signal` | Status detail (17 kode: Control OFF, Set Point 1–3, Manual, Safe Mode, Antifreeze, dll.) |
| `Status signal` | Status binary keseluruhan zona |

Data ini ditampilkan di modal "Heating Detail" yang muncul saat user menekan ikon api (🔥) pada card Zone Temperature — hanya muncul jika `heatingControlOn = true`.

---

## Persistensi Lokal

Nilai `draftForm` dan `confirmedForm` disimpan ke storage lokal device menggunakan:
- **Native (Android/iOS):** `expo-secure-store`
- **Web:** `localStorage`

Key penyimpanan: `epbox.accommodation-room.demo.values`

Data yang disimpan:
```json
{
  "triggerEnable": true,
  "smokeDetected": false,
  "temperatureValue": "34 C",
  "temperatureHighLimit": false,
  "manualOverride": false
}
```

Saat layar dibuka, nilai terakhir dimuat dari storage sebagai nilai awal `draftForm` dan `confirmedForm`.

---

## Diagram Alur Lengkap

```
┌─────────────────────────────────────────────────────────────────┐
│                    ACCOMMODATION ROOM                           │
│                                                                 │
│  SUBSCRIBE (menerima data)                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Topic: .../metrics                                       │   │
│  │                                                          │   │
│  │ Device 3549 → Smoke Status (boolean)                    │   │
│  │ Device 3585 → Temperature (°C)                          │   │
│  │ Device 3667 → Alarm Status (kode 1-6) + Siren (ON/OFF)  │   │
│  │ Device 4147 → Zone Heating (6 signal, read-only)        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  PUBLISH (mengirim perintah)                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Topic: .../cmd/ot                                        │   │
│  │                                                          │   │
│  │ Inject Smoke  → { id: 3549, cmd: "SetValue", value: 0/1 }│   │
│  │ Inject Temp   → { id: 3585, cmd: "SetValue", value: N } │   │
│  │ Alarm Ack     → { id: 3667, cmd: "Acknowledgement" }    │   │
│  │ Alarm Reset   → { id: 3667, cmd: "Reset" }              │   │
│  │ Reset ON      → { id: 3667, cmd: "ResetOn" }            │   │
│  │ Reset OFF     → { id: 3667, cmd: "ResetOff" }           │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```
