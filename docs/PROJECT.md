# EPBOX Mobile — RNEX IMOX

Aplikasi mobile monitoring & kontrol sistem mekanikal-elektrikal kapal berbasis MQTT. Terhubung ke gateway Carlo Gavazzi UWP-4.0 yang mem-bridge PLC Siemens S7-1200 dan sensor-sensor lapangan ke protokol MQTT over WebSocket.

---

## Daftar Isi

1. [Gambaran Umum](#1-gambaran-umum)
2. [Stack Teknologi](#2-stack-teknologi)
3. [Struktur Direktori](#3-struktur-direktori)
4. [Arsitektur](#4-arsitektur)
5. [MQTT — Protokol & Topik](#5-mqtt--protokol--topik)
6. [Peta Device & Sinyal Gateway](#6-peta-device--sinyal-gateway)
7. [Provider & State Global](#7-provider--state-global)
8. [Layar & Logika Bisnis](#8-layar--logika-bisnis)
   - [Home](#81-home-indextsx)
   - [Explore](#82-explore-exploretsx)
   - [Status](#83-status-statustsx)
   - [Accommodation Room](#84-accommodation-room)
   - [Fire-Fighting Room](#85-fire-fighting-room)
   - [Pump Room](#86-pump-room)
9. [Sistem Bit-Pack IO](#9-sistem-bit-pack-io)
10. [Pola State Management](#10-pola-state-management)
11. [Sistem Desain](#11-sistem-desain)
12. [Konvensi Kode](#12-konvensi-kode)
13. [Konfigurasi & Deployment](#13-konfigurasi--deployment)
14. [Catatan Analisis & Area Perhatian](#14-catatan-analisis--area-perhatian)

---

## 1. Gambaran Umum

EPBOX Mobile adalah operator interface untuk sistem monitoring kapal IMOX (Integrated Monitoring and Operations Center). Aplikasi ini:

- **Membaca** data sensor real-time dari PLC dan perangkat lapangan via MQTT
- **Mengirim** perintah kendali (Set Value, alarm command, switch) ke gateway
- **Menampilkan** status Digital Input/Output, suhu, asap, alarm, dan zona pemanasan
- **Menyimpan** konfigurasi MQTT dan data demo secara lokal di perangkat

### Ruangan yang Dimonitor

| Room | Route | Fungsi |
|---|---|---|
| Pump Room | `/stations/pump-room` | Kalibrasi sensor tekanan & flow |
| Accommodation Room | `/stations/accommodation-room` | Kontrol alarm kebakaran, suhu, zona pemanas |
| Fire-Fighting Room | `/stations/fire-fighting-room` | Kontrol DO (pompa, valve, buzzer) dan baca DI dari PLC |

---

## 2. Stack Teknologi

| Kategori | Library | Versi |
|---|---|---|
| Framework | Expo | ~56.0.14 |
| Runtime | React Native | 0.85.3 |
| UI Library | React | 19.2.3 |
| Routing | expo-router | ~56.2.13 |
| MQTT Client | mqtt (MQTT.js) | ^5.15.1 |
| Storage | expo-secure-store | — |
| Icons | @expo/vector-icons, lucide-react-native | — |
| Animation | lottie-react-native | ~7.3.4 |
| Network | @react-native-community/netinfo | — |
| Language | TypeScript | strict mode |

**Kompilasi:** React Compiler aktif (`experiments.reactCompiler: true` di app.json).  
**Path alias:** `@/*` → `src/*`

---

## 3. Struktur Direktori

```
epbox-mobile-rnex-imox/
├── app.json                    # Expo config (splash, plugins, experiments)
├── package.json
├── tsconfig.json               # Strict TS + path aliases
├── assets/                     # Icons, Lottie animations
├── docs/                       # Dokumentasi proyek
│   ├── PROJECT.md              # Dokumen ini
│   ├── accommodation-room-mqtt.md
│   └── fire-fighting-room-mqtt.md
└── src/
    ├── app/                    # Layar (Expo Router file-based routing)
    │   ├── _layout.tsx         # Root shell: Auth → MQTT → Tabs
    │   ├── index.tsx           # Home screen
    │   ├── explore.tsx         # Daftar ruangan
    │   ├── status.tsx          # Diagnostik MQTT
    │   ├── settings.tsx        # Pengaturan broker
    │   └── stations/
    │       ├── accommodation-room.tsx
    │       ├── fire-fighting-room.tsx
    │       └── pump-room.tsx
    ├── components/             # Komponen UI reusable
    │   ├── app-tabs.tsx        # Custom bottom tab navigator
    │   ├── login-screen.tsx
    │   ├── lucide-tab-icons.tsx
    │   └── ui/
    │       └── collapsible.tsx
    ├── providers/
    │   ├── mqtt-provider.tsx   # MQTT client + context
    │   └── auth-provider.tsx   # Session auth
    ├── hooks/
    │   ├── use-theme.ts
    │   ├── use-color-scheme.ts (.web variant)
    │   └── use-network-signal.ts
    ├── lib/                    # Pure logic, tanpa UI
    │   ├── mqtt-topics.ts      # Definisi topik, tipe payload, helper parsing
    │   ├── mqtt-settings.ts    # URL builder, storage settings
    │   ├── bit-packed-word.ts  # Operasi bit DI/DO
    │   ├── accommodation-room-demo.ts
    │   ├── pump-room-demo.ts
    │   ├── room-directory.ts   # Metadata ruangan
    │   └── cross-platform-storage.ts
    ├── styles/
    │   ├── index.ts            # Re-export semua token
    │   ├── tokens.ts           # Warna, spacing, radii, font
    │   ├── primitives.ts       # Layout & text base styles
    │   └── screens/            # Stylesheet per layar
    ├── constants/
    │   └── theme.ts
    └── types/
        └── netinfo-module.d.ts
```

---

## 4. Arsitektur

### Hierarki Provider

```
AuthProvider
  └── (loading) → SplashScreen
  └── (unauthenticated) → LoginScreen
  └── (authenticated) →
        MqttProvider
          └── AppTabs (Expo Router <Tabs>)
                ├── Home
                ├── Explore
                ├── Status
                ├── Settings
                └── [hidden] Stations (accommodation, fire-fighting, pump)
```

### Alur Data Utama

```
[Gateway Carlo Gavazzi UWP-4.0]
        │
        │  WebSocket MQTT
        ▼
[MQTT Broker]
        │
        │  topic: .../metrics (subscribe)
        ▼
[MqttProvider]
  ├── mergeCarloGavazziMetricsPayload()   ← merge incremental updates
  ├── topicMessages.gatewayMetrics        ← state terbaru
  └── receivedAt = Date.now()             ← timestamp penerimaan
        │
        ▼
[useMqttTopic('gatewayMetrics')]          ← hook per layar
        │
        ▼
[Station Screen]
  ├── getCarloGavazziMetricsSignalByName() ← ekstrak sinyal spesifik
  ├── unpackChannels()                     ← decode bit DI/DO
  └── render UI

[User Action]
        │
        ▼
[buildCarloGavazziOtCommand() / buildCarloGavazziAlarmCommand()]
        │
        ▼
[publishTopic('gatewayOtCommand')]         ← kirim ke broker
        │
        │  topic: .../cmd/ot (publish)
        ▼
[Gateway] → eksekusi perintah → memperbarui sinyal → metrics berikutnya
```

---

## 5. MQTT — Protokol & Topik

### Dua Topik Aktif

| Kunci | Arah | Topik MQTT |
|---|:---:|---|
| `gatewayMetrics` | Subscribe | `epbox/imox/demo/site/batam/edge/cg-uwp40-01/metrics` |
| `gatewayOtCommand` | Publish | `epbox/imox/demo/site/batam/edge/cg-uwp40-01/cmd/ot` |

**QoS publish:** 0 (fire-and-forget)  
**Retain publish:** false

### Format Payload — gatewayMetrics (Subscribe)

```json
{
  "devices": [
    {
      "id": 3549,
      "signals": [
        { "name": "Status", "value": 0, "unit": "" }
      ]
    },
    {
      "id": 6563,
      "signals": [
        { "name": "Adjustable value", "value": 4096, "unit": "" },
        { "name": "Input value",      "value": 2048, "unit": "" }
      ]
    }
  ]
}
```

**Merge behavior:** Ketika payload baru datang, `mergeCarloGavazziMetricsPayload()` menggabungkan device/sinyal yang baru dengan yang sudah ada. Sinyal lama tetap dipertahankan jika tidak ada dalam payload baru.

### Format Payload — gatewayOtCommand (Publish)

**Counter command (SetValue, Increase, Decrease, Reset, Freeze, Unfreeze):**
```json
{ "id": 6563, "cmd": "SetValue", "value": 1234 }
```

**Alarm command (Acknowledgement, Reset, TestAlarmOn, dll):**
```json
{ "id": 3667, "cmd": "Acknowledgement" }
```

**Switch command (On, Off, OnTimeout):**
```json
{ "id": 4147, "cmd": "On" }
```

### Pengaturan Koneksi

Konfigurasi disimpan di secure storage (`epbox.connection.settings`):

| Field | Default | Keterangan |
|---|---|---|
| `serverAddress` | — | IP/hostname broker |
| `port` | — | Port WebSocket (biasanya 8083 atau 443) |
| `clientId` | — | MQTT client ID |
| `username` | — | Opsional |
| `password` | — | Opsional |

**Protokol otomatis:** Port 443/8443/8884 → `wss://`, lainnya → `ws://`.

**Koneksi options (hardcoded):**

```typescript
{
  protocolVersion: 4,   // MQTT 3.1.1
  connectTimeout: 20_000,
  keepalive: 30,
  reconnectPeriod: 5_000,  // auto-reconnect setiap 5 detik
  clean: true,
}
```

### Error Handling MQTT

| Jenis Error | Penanganan |
|---|---|
| `connack timeout` | Transient — biarkan auto-reconnect, status `connecting` |
| `ETIMEDOUT`, `ECONNREFUSED` | Transient — auto-reconnect |
| Auth gagal, protocol mismatch | Permanent — `client.end(true)`, status `error` |

**Gateway stale:** Jika `gatewayMetrics` tidak diterima selama 60 detik saat status `connected`, tampilkan peringatan "Gateway Stale".

---

## 6. Peta Device & Sinyal Gateway

### Accommodation Room

| Device ID | Nama | Tipe | Signal yang Digunakan |
|:---:|---|---|---|
| 3549 | Smoke Status | Counter | `Status` (0=clear, 1=detected) |
| 3585 | Temperature | Counter | `Total value` (°C float) |
| 3667 | Alarm | Alarm element | `Alarm status` (code 1-6), `Siren output` |
| 4147 | Zone Temperature | Zone Temperature | `Heating control analogue`, `Heating set point value`, dll |

**Alarm Status Code (device 3667):**

| Kode | Label | Tone |
|:---:|---|---|
| 1 | Standby | normal |
| 2 | Alarm | danger |
| 3 | Acknowledged | warning |
| 4 | Alarm + Siren | danger |
| 5 | Acknowledged + Siren | warning |
| 6 | Test Mode | warning |
| null | OFF | normal |

### Fire-Fighting Room

| Device ID | Nama | Tipe | Signal yang Digunakan |
|:---:|---|---|---|
| 6563 | PLC - SIEMENS | Counter | `Adjustable value` (combined DI+DO 24-bit) |

**Signal "Adjustable value"** = combined value dari 2 uint16 word:

```
combined = word[1] * 65536 + word[0]

word[0]:
  bit  0–11 → DI channel 1–12  (read dari gateway, read-only)
  bit 12–15 → DO channel 1–4   (writable via SetValue)

word[1]:
  bit  0–7  → DO channel 5–12  (writable via SetValue)
  bit  8–15 → unused (selalu 0)
```

**SetValue command:** `SetValue(6563, word[1] * 65536 + word[0])` — kirim seluruh 24-bit combined value.

---

## 7. Provider & State Global

### MqttProvider (`src/providers/mqtt-provider.tsx`)

Satu-satunya sumber kebenaran untuk semua data MQTT.

**State yang dikelola:**

| State | Tipe | Keterangan |
|---|---|---|
| `status` | `'idle' \| 'connecting' \| 'connected' \| 'disconnected' \| 'error'` | Status koneksi broker |
| `topicMessages` | `MqttTopicMessages` | Pesan terakhir per topic key |
| `logs` | `MqttLogEntry[]` | Maks 20 entri event log |
| `settings` | `MqttConnectionSettings` | Konfigurasi koneksi |
| `latestLatencySample` | `MqttLatencySample \| null` | RTT terakhir |
| `connectedAt` | `number \| null` | Timestamp saat koneksi berhasil |
| `isGatewayStale` | `boolean` | True jika metrics > 60s |

**Hooks yang disediakan:**

```typescript
// Akses seluruh context
const { publishTopic, status, topicMessages, ... } = useMqtt();

// Akses satu topik + fungsi publish lokal
const metricsTopic = useMqttTopic('gatewayMetrics');
// → { definition, message, payload, publish }
```

**Latency measurement:**

```typescript
recordLatencySample({
  label: 'Set Temperature',
  requestTopicKey: 'gatewayOtCommand',
  responseTopicKey: 'gatewayMetrics',
  startedAt: sentAt,
  completedAt: metricsReceivedAt,
});
// → setLatestLatencySample({ durationMs: completedAt - startedAt, ... })
```

### AuthProvider (`src/providers/auth-provider.tsx`)

Minimal authentication state. Session disimpan di `epbox.auth.session`.

```typescript
const { isAuthenticated, isLoading, signIn, signOut } = useAuth();
```

---

## 8. Layar & Logika Bisnis

### 8.1 Home (`index.tsx`)

**Fitur:**
- Live signal strength (polling setiap 2 detik saat focused)
- Stats: koneksi lokal/remote, protokol broker, response time, jarak
- Toggle **Zone Activation** (Local Zone On/Off) — kirim switch command ke device 4147

**Zone Toggle State Machine:**

```
idle
  └── user press → publish On/Off command
        └── pending (8s timeout)
              ├── metrics confirm → clear pending, update UI
              └── timeout (8s) → clear pending, silent (no error)
```

### 8.2 Explore (`explore.tsx`)

Daftar ruangan dari `MONITORED_ROOMS` di `room-directory.ts`. Setiap card menampilkan:
- Metadata ruangan (nama, deck, status)
- Nilai metrik real-time (suhu, tekanan, jumlah DO aktif)
- Tap → navigate ke `/stations/{roomId}`

### 8.3 Status (`status.tsx`)

Halaman diagnostik MQTT:
- **Session Duration:** Timer hitung mundur sejak `connectedAt` (interval 1 detik)
- **Topic Catalog:** Semua topik dengan preview payload JSON terakhir + timestamp
- **Connection Log:** Filterable (all/info/success/warning/error), maks 20 entri
- **Gateway Stale Alert:** Peringatan merah jika metrics tidak datang > 60 detik

### 8.4 Accommodation Room

**File:** `src/app/stations/accommodation-room.tsx`  
**Referensi:** `docs/accommodation-room-mqtt.md`

#### Bagian 1 — Source/Input (Counter Commands)

Kontrol sinyal yang dikirim sebagai **Counter SetValue** ke gateway:

| Field UI | Device ID | Signal Name | Command |
|---|:---:|---|---|
| Smoke Toggle | 3549 | `Status` | `SetValue(0 atau 1)` |
| Temperature Slider | 3585 | `Total value` | `SetValue(nilai_suhu)` |

**Alur pengiriman:**

```
1. User geser slider / toggle smoke
2. [Temperature] → debounce 250ms → publish SetValue
   [Smoke] → langsung publish SetValue
3. setPendingCommands → { field: { expectedMetricValue, sentAt } }
4. Tunggu gatewayMetrics berikutnya
5. Jika metrik baru = expectedMetricValue → acked → clear pending
6. recordLatencySample → catat RTT
```

**Draft vs Confirmed:**
- `draftForm`: nilai yang sedang di-edit user (UI responsif)
- `confirmedForm`: nilai yang sudah dikonfirmasi oleh gateway metrics

#### Bagian 2 — Alarm (Alarm Commands)

Kirim perintah alarm ke device 3667:

| Tombol | Command | Keterangan |
|---|---|---|
| Acknowledge | `Acknowledgement` | Acknowledge alarm aktif |
| Reset | `Reset` | Reset alarm |
| Test Alarm ON | `TestAlarmOn` | Aktifkan test mode |
| Test Alarm OFF | `TestAlarmOff` | Nonaktifkan test mode |
| Reset ON | `ResetOn` | — |
| Reset OFF | `ResetOff` | — |

**Write Window (Anti-Double-Send):**

```
User tekan tombol → publish command
  → set pendingAlarmCommands[command] = { sentAt, baselineReceivedAt }
  → start 5s setTimeout (silent expiry)

Kondisi clear (mana yang lebih dulu):
  a. metricsReceivedAt > baselineReceivedAt → clear immediately
  b. 5s timeout → clear silently (no error)

Saat pending: tombol terkunci (isAlarmCommandLocked = true)
UI: writeWindowLabel = "Sending…" | "Ready"
```

**Alarm state dari metrics:**

```typescript
getAccommodationRoomAlarmState(payload) → {
  alarmStatusCode: 1-6 | null,
  alarmStatusLabel: string,
  sirenOn: boolean | null,
  lastSignalAt: number | null,
  outputs: { label, active }[]
}
```

#### Bagian 3 — Zone Heating (Detail Modal)

Informasi dari device 4147 (Zone Temperature element):

| Signal | Keterangan |
|---|---|
| `Heating control analogue` | Nilai analogis kontrol pemanasan (%) |
| `Heating set point value` | Set poin suhu (°C) |
| `Heating control status` | Status kontrol (label + kode) |
| `Heating set point selected` | Set poin yang dipilih |
| `Heating status` | Status umum pemanasan |

**Threshold suhu:**

| Range | Tone | Label |
|---|---|---|
| 0–39°C | normal (hijau) | Normal Range |
| 40–54°C | warning (kuning) | Watch >= 40°C |
| 55–120°C | danger (merah) | Alarm >= 55°C |
| Status code 12 | — | Antifreeze Active |

### 8.5 Fire-Fighting Room

**File:** `src/app/stations/fire-fighting-room.tsx`  
**Referensi:** `docs/fire-fighting-room-mqtt.md`

#### Digital Input (DI) — Read Only

12 channel dari sinyal "Adjustable value" device 6563, bit 0–11:

| Bit | Ch | Label | Kontak |
|:---:|:---:|---|:---:|
| 0 | 1 | Emergency Stop | NC |
| 1 | 2 | Button – Start Pump A | NO |
| 2 | 3 | Button – Stop Pump A | NC |
| 3 | 4 | Button – Start Pump B | NO |
| 4 | 5 | Button – Stop Pump B | NC |
| 5 | 6 | Button – Zone Release | NO |
| 6 | 7 | Selector Local / Remote | NO |
| 7 | 8 | R3 – Pump A Status | NO |
| 8 | 9 | R4 – Pump B Status | NO |
| 9 | 10 | R5 – Pump C Status | NO |
| 10 | 11 | Level Switch – Low Tank | NO |
| 11 | 12 | Flow Switch | NO |

#### Digital Output (DO) — Writable

12 channel, bit 12–23 (word[0] bit 12-15, word[1] bit 0-7):

| Global Bit | Ch | Label |
|:---:|:---:|---|
| 12 | 1 | R1 – Solenoid Valve 1 Open |
| 13 | 2 | R2 – Solenoid Valve 2 Open |
| 14 | 3 | R3 – Pump A Start |
| 15 | 4 | R4 – Pump B Start |
| 16 | 5 | R5 – Pump C Start |
| 17 | 6 | Buzzer |
| 18 | 7 | Lamp – Zone Release |
| 19 | 8 | Lamp – Pump A Running |
| 20 | 9 | Lamp – Pump A Stopped |
| 21 | 10 | Lamp – Pump B Running |
| 22 | 11 | Lamp – Pump B Stopped |
| 23 | 12 | Lamp – Local / Remote |

**Alur toggle DO:**

```
1. User toggle switch
2. setChannelBit(draftWords, DO_BIT_MAP, key, !current) → newWords
3. setDraftWords(newWords)   ← UI update optimistic
4. combinedValue = newWords[1] * 65536 + newWords[0]
5. publishTopic('gatewayOtCommand', SetValue(6563, combinedValue))
6. isPendingDo = true, baselineReceivedAt = metricsReceivedAt
7. Start 5s timeout

Clear pending:
  a. metricsReceivedAt berubah (> baseline) → clear immediately
  b. 5s timeout → clear silently
```

**Sync dari metrics:**

```typescript
// Setiap metrics tiba:
word0 = rounded & 0xffff
word1 = (rounded >>> 16) & 0xffff

setConfirmedWords([word0, word1])
setDraftWords(cur => [
  (cur[0] & 0xf000) | (word0 & 0x0fff),  // DO Ch1-4 dari draft, DI dari gateway
  cur[1],                                  // DO Ch5-12 dari draft (preserved)
])
```

DI bits selalu di-sync dari gateway. DO bits di `draftWords` dipertahankan untuk mencegah flicker saat menunggu konfirmasi.

### 8.6 Pump Room

**File:** `src/app/stations/pump-room.tsx`

Layar kalibrasi sensor lokal (tidak ada integrasi MQTT):

- **Pressure Sensor 1 & 2:** Slider 0–16 bar (warn ≥7.5, alert ≥10.2)
- **Discharge Flow Rate:** Stepper input
- **Dashboard sim:** Toggle alarm suhu, status arus, ampere stepper

Data disimpan ke `epbox.pump-room.demo.values` via secure storage.

---

## 9. Sistem Bit-Pack IO

**File:** `src/lib/bit-packed-word.ts`

### Tipe

```typescript
type BitChannelMap<TKey extends string> = Record<
  TKey,
  { wordIndex: number; bitIndex: number }
>;
```

### Fungsi

```typescript
// Baca satu bit
getChannelBit(words: number[], map: BitChannelMap, key: TKey): boolean

// Tulis satu bit, kembalikan words baru (immutable)
setChannelBit(words: number[], map: BitChannelMap, key: TKey, value: boolean): number[]

// Decode semua channel sekaligus
unpackChannels(words: number[], map: BitChannelMap): Record<TKey, boolean>
```

### Contoh Penggunaan (Fire-Fighting Room)

```typescript
const DI_BIT_MAP: BitChannelMap<DiKey> = {
  emergencyStop:  { wordIndex: 0, bitIndex: 0 },
  btnStartPumpA:  { wordIndex: 0, bitIndex: 1 },
  // ...
};

const DO_BIT_MAP: BitChannelMap<DoKey> = {
  solenoidValve1: { wordIndex: 0, bitIndex: 12 },
  // ...
  r5PumpCStart:   { wordIndex: 1, bitIndex: 0 },
  // ...
};

const diState = unpackChannels(confirmedWords, DI_BIT_MAP);
// → { emergencyStop: true, btnStartPumpA: false, ... }

const newWords = setChannelBit(draftWords, DO_BIT_MAP, 'buzzer', true);
// → words baru dengan bit 17 = 1
```

---

## 10. Pola State Management

### Pola Umum per Layar

Semua station screen mengikuti pola yang sama:

#### 1. Ref untuk Menghindari Re-run Loop

```typescript
// Ref untuk baca state terbaru dalam effect tanpa menjadi dep
const pendingCommandsRef = useRef(pendingCommands);
pendingCommandsRef.current = pendingCommands;
```

Digunakan dalam `useEffect` yang juga memanggil `setPending*`. Tanpa ini, effect yang memiliki pending state sebagai dep DAN memanggil `setState(pending)` akan membuat infinite loop.

#### 2. Ref untuk Callback yang Stabil

```typescript
const recordLatencySampleRef = useRef(recordLatencySample);
recordLatencySampleRef.current = recordLatencySample;
```

Digunakan untuk menghindari `recordLatencySample` masuk ke dep array effect. Memanggil `recordLatencySample` langsung dari dalam effect menyebabkan `setLatestLatencySample` → provider re-render → `recordLatencySample` referensi baru → infinite loop.

#### 3. Ref untuk Timer

```typescript
const alarmExpireTimeoutsRef = useRef<Map<CommandKey, ReturnType<typeof setTimeout>>>(new Map());
const doExpireTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

Timer disimpan di ref (bukan state) karena update timer tidak perlu memicu re-render.

#### 4. Pending + Baseline Pattern

```typescript
// Saat mengirim command:
baselineReceivedAt = metricsReceivedAt  // timestamp metrics SEBELUM command

// Clear condition (dalam effect [metricsReceivedAt]):
metricsReceivedAt > pending.baselineReceivedAt
// → true = metrics BARU tiba setelah command dikirim → acked
```

#### 5. Silent 5s Expiry

Jika gateway tidak merespons dalam 5 detik, state pending dibersihkan tanpa menampilkan error:

```typescript
const expireId = setTimeout(() => {
  setPending(current => { delete next[key]; return next; });
  setLastCommandError(null);  // silent — no error shown
}, 5_000);
```

#### 6. Optimistic UI

```typescript
// Fire-fighting room: toggle DO langsung update draftWords sebelum publish
setDraftWords(newWords);  // ← UI langsung berubah
void publishTopic(...).then(() => { setLastCombinedWord(combinedValue); });
```

### Rules: Kapan Menggunakan Ref vs State

| Kondisi | Gunakan |
|---|---|
| Nilai perlu memicu re-render | `useState` |
| Nilai dibaca dalam effect tapi bukan trigger | `useRef` |
| Timer/interval ID | `useRef` |
| Callback stabil (dipanggil dalam effect) | `useRef` |
| Data yang ditampilkan di UI | `useState` |

---

## 11. Sistem Desain

**File:** `src/styles/tokens.ts`, `src/styles/primitives.ts`

### Warna (AppColors)

```typescript
canvas         // Background utama layar
surface        // Card/panel background
surfaceError   // Background card error
muted          // Border, divider
primary        // Aksen utama (biru)
text           // Teks utama
textSubtle     // Teks sekunder
success        // Hijau
info           // Biru info
warning        // Kuning
error          // Merah
```

### Spacing (AppSpacing)

```
xxs = 4    xs = 8    sm = 12    md = 16
lg = 20    xl = 24   xxl = 32   hero = 22
screen = 20    bottom = 36
```

### Radii (AppRadii)

```
sm = 12    md = 16    lg = 20    xl = 24    full = 999
icon = 8   iconLg = 10
```

### Signal Tone

Digunakan di semua layar station untuk konsistensi visual:

```typescript
type SignalTone = 'normal' | 'warning' | 'danger';

getSignalPalette(tone) → {
  surface: string,   // background warna
  border: string,    // border warna
  accent: string,    // aksen/icon warna
  text: string,      // teks warna
  track: string,     // slider track warna
}
```

---

## 12. Konvensi Kode

### Struktur File Komponen

```typescript
// 1. Imports (ordered: React, RN, Expo, local)
// 2. Konstanta lokal (threshold, guard ms)
// 3. Tipe lokal (Props, State shapes)
// 4. Helper functions (pure, no hooks)
// 5. Sub-components kecil (render functions)
// 6. Main exported component
//    a. Hook calls (context, state, ref, memo)
//    b. useEffect (dalam urutan: hydrate, metrics, clear, side-effects)
//    c. Callbacks (useCallback)
//    d. Derived values (useMemo, inline)
//    e. return JSX
// 7. StyleSheet.create({...})
```

### Aturan Effect

1. **Dep array tidak boleh self-referential:** Jika effect memanggil `setState(X)`, `X` tidak boleh ada di dep array. Gunakan ref.
2. **recordLatencySample selalu via ref:** Menghindari provider re-render loop.
3. **Timer selalu di ref:** Bukan state.
4. **Effect hanya bergantung pada triggers eksternal:** `metricsReceivedAt`, `metricsTopic.payload`, `status`.

### Penamaan

| Jenis | Konvensi | Contoh |
|---|---|---|
| Komponen | PascalCase | `AccommodationRoomHero` |
| Hook | camelCase, prefix `use` | `useMqttTopic` |
| State setter | `set` + PascalCase | `setPendingAlarmCommands` |
| Ref | suffix `Ref` | `alarmExpireTimeoutsRef` |
| Konstanta | UPPER_SNAKE | `ALARM_WRITE_GUARD_MS` |
| Tipe | PascalCase | `PendingAlarmCommand` |
| Map/Record tipe | suffix `Map` | `PendingAlarmCommandMap` |

### Import

Selalu gunakan path alias `@/`:

```typescript
import { useMqtt, useMqttTopic } from '@/providers/mqtt-provider';
import { unpackChannels } from '@/lib/bit-packed-word';
import { AppColors } from '@/styles';
```

### Komentar

Komentar ditulis **hanya untuk:**
- Constraint tersembunyi atau invariant non-obvious
- Workaround untuk bug spesifik
- Layout bit-pack yang kompleks

Contoh komentar yang tepat:

```typescript
// Ref sehingga effect dapat membaca state terbaru tanpa memicunya ulang.
// Jika pendingAlarmCommandsRef dimasukkan ke dep array, setPendingAlarmCommands
// di dalam effect akan menyebabkan loop karena referensi objek selalu baru.
const pendingAlarmCommandsRef = useRef(pendingAlarmCommands);
```

---

## 13. Konfigurasi & Deployment

### Setup Dev

```bash
npm install
npm start          # Expo dev server
npm run android    # Build & run Android
npm run ios        # Build & run iOS
npm run web        # Jalankan di browser
npm run lint       # ESLint check
npx tsc --noEmit   # Type check
```

### Path Alias (tsconfig.json)

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@/assets/*": ["./assets/*"]
    }
  }
}
```

### Storage Keys

| Key | Konten |
|---|---|
| `epbox.connection.settings` | MQTT broker config |
| `epbox.auth.session` | User session |
| `epbox.accommodation-room.demo.values` | Accommodation room input state |
| `epbox.pump-room.demo.values` | Pump room sensor values |

### Tidak Ada Environment Variables

Semua konfigurasi (URL broker, credentials) dimasukkan oleh operator melalui Settings screen saat runtime. Tidak ada file `.env`.

### React Compiler

`experiments.reactCompiler: true` di `app.json` — React mengoptimalkan memoization secara otomatis. Tetap gunakan `useCallback`/`useMemo` secara eksplisit untuk referensi yang digunakan sebagai dep array atau dipass sebagai props.

---

## 14. Catatan Analisis & Area Perhatian

### Risiko yang Perlu Ditangani Sebelum Production

| Prioritas | Area | Isu | Rekomendasi |
|-----------|------|-----|-------------|
| Tinggi | Auth | `DEMO_CREDENTIALS = { id: '', password: '' }` — login tanpa isi apapun | Ganti dengan credentials nyata atau mekanisme auth yang aman |
| Sedang | Config | Device ID hardcoded (3549, 3585, 3667, dll.) di `mqtt-topics.ts` | Pindahkan ke config file terpisah jika hardware bisa berubah |
| Sedang | UX | Command gagal (5s expiry) tidak menampilkan error ke user | Tambahkan feedback visual untuk silent expiry |
| Rendah | Validasi | Payload MQTT tidak divalidasi dengan schema (Zod/ArkType) | Tambahkan runtime validation di entry point `mergeCarloGavazziMetricsPayload` |
| Rendah | Offline | Command yang dikirim saat disconnect langsung hilang | Pertimbangkan command queue untuk pengiriman ulang |
| Rendah | Layout | `BottomTabInset` hardcoded (50 iOS, 80 Android) | Gunakan `useSafeAreaInsets()` dinamis |

### Kekuatan Arsitektur

- **Type safety penuh** — strict TypeScript, semua payload ter-typed
- **MQTT robust** — auto-reconnect, transient/permanent error distinction, connack timeout tidak kill client
- **Anti-loop patterns** — ref-as-callback + ref-for-state sudah diterapkan di semua effect yang berisiko
- **Optimistic UI** — draft/confirmed dual form mencegah jank saat operator mengirim perintah
- **Payload merge incremental** — gateway bisa kirim partial update tanpa kehilangan sinyal lain
- **Cross-platform storage** — secure store (native) / localStorage (web) diabstraksi dengan interface yang sama

### Test Coverage

Saat ini **tidak ada unit test atau integration test**. Logic kompleks yang sebaiknya di-cover:
- `mergeCarloGavazziMetricsPayload()` — edge case partial update
- `unpackChannels()` + `setChannelBit()` — bit packing/unpacking
- Write window ACK logic (baseline pattern) di accommodation room dan fire-fighting room
- `isMqttTransientError()` — klasifikasi error MQTT

---

## Referensi Dokumen Terkait

- [`docs/device-id-registry.md`](./device-id-registry.md) — Registry terpusat semua device ID gateway (3549, 3585, 3667, 3794, 3819, 4147, 6563)
- [`docs/io-lists/`](./io-lists/README.md) — IO list per room dengan status koneksi MQTT (✅/⬜)
  - [`home.md`](./io-lists/home.md) — Home screen (device 3819, 3794)
  - [`pump-room.md`](./io-lists/pump-room.md) — Pump Room (local only, 0/9 terhubung)
  - [`accommodation-room.md`](./io-lists/accommodation-room.md) — Accommodation Room (20/20 terhubung)
  - [`fire-fighting-room.md`](./io-lists/fire-fighting-room.md) — Fire-Fighting Room (24/24 terhubung)
- [`docs/accommodation-room-mqtt.md`](./accommodation-room-mqtt.md) — Alur MQTT accommodation room
- [`docs/fire-fighting-room-mqtt.md`](./fire-fighting-room-mqtt.md) — Alur MQTT fire-fighting room, layout bit lengkap
- [`docs/Modbus.pdf`](./Modbus.pdf) — Modbus slave map Carlo Gavazzi UWP-4.0 (F29 PLC SIEMENS)
- [`docs/mqtt_report (6).pdf`](./mqtt_report%20(6).pdf) — Device ID konfirmasi dari gateway
