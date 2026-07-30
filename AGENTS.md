# AGENTS.md

Panduan untuk OpenCode di repo `epbox-mobile-rnex-imox`.
Setiap baris adalah sesuatu yang agent kemungkinan akan lewatkan tanpa bantuan.

---

## Commands

| Perintah | Kegunaan |
|---|---|
| `npm start` | Expo dev server |
| `npm run android` / `ios` / `web` | Build + run per platform |
| `npm run lint` | ESLint (`expo lint`) |
| `npx tsc --noEmit` | **Wajib setelah setiap perubahan kode** — harus exit 0 |
| `npx expo install <pkg>` | Install package versi SDK 56 |

## TypeCheck Wajib

Setelah edit APAPUN, jalankan `npx tsc --noEmit`. Perubahan belum selesai sampai exit 0.

## Path Alias

`@/*` → `src/*`, `@/assets/*` → `assets/*`. Selalu pakai `@/` di import.

## React Compiler

`experiments.reactCompiler: true` di app.json — React optimasi memoization otomatis. Tetap pakai `useCallback`/`useMemo` eksplisit untuk referensi yang jadi dep array atau di-pass sebagai props.

## Provider Chain

```
AuthProvider
  └── loading → SplashScreen
  └── unauthenticated → LoginScreen
  └── authenticated →
        MqttProvider
          └── AppTabs (Expo Router <Tabs>)
                ├── Home (index.tsx)
                ├── Explore (explore.tsx)
                ├── Status (status.tsx)
                ├── Settings (settings.tsx)
                └── Stations (pump-room, accommodation-room)
```

## Layout Root

`src/app/_layout.tsx` adalah satu-satunya layout. Auth → MQTT → Tabs. Tidak ada sub-layout.

## MQTT Safety (JANGAN DISENTUH)

- Jangan baca/tampilkan/ubah broker credentials (host, port, username, password, clientId, protocol, TLS, reconnect).
- Jangan hardcode topic baru jika mapping sudah ada di `src/lib/mqtt-topics.ts`.
- Jangan buat retry publish otomatis.
- Jangan ubah settings koneksi di `src/providers/mqtt-provider.tsx` tanpa request eksplisit.

## MQTT Architecture

- 3 subscribe topic di-merge ke satu store `gatewayMetrics`:
  - `.../metrics` (FROM PLC 6563, TO PLC 7193)
  - `.../pressure-transmitter` (PT1 6983, PT2 7019)
  - `.../acc-room/metrics` (smoke 3549, temp 3585, alarm 3667, zone 4147)
- Merge via `mergeCarloGavazziMetricsPayload()` — union by device id, incremental.
- Latency measurement via `appLatencyPing` loopback topic (self-publish + subscribe).
- Gateway stale: jika `gatewayMetrics` tidak terima >60s saat connected → `isGatewayStale = true`.
- Cold start: `mqtt-cache.ts` persist last metrics ke file system / localStorage.
- `CarloGavazziForceCommandPayload` (ForceOn/ForceOff) ada untuk override output automation.

## TO PLC (Device 7193) — Packed uint64

4 words, W[0] = least significant:

| Word | Isi |
|---|---|
| W[0] | PT-001 pressure set-point counter |
| W[1] | PT-002 pressure set-point counter |
| W[2] | Pump Activation (1 = fire) |
| W[3] | Spare (always 0) |

`packToPlcCommand()` / `unpackToPlcCommand()` di `mqtt-topics.ts`.

## Pressure Units

1 bar = 1 counter word. UI value `3` → word `3`. Bukan `10` atau `0.1`.

## Pending Command Pattern (WAJIB)

Untuk SEMUA user-triggered command:
1. User press → snapshot state sebelum send
2. UI masuk pending, control terkunci
3. `usePendingCommand<TSnapshot>()` dari `src/hooks/use-pending-command.ts`
4. Timeout 5 detik → silent rollback ke snapshot
5. Success → clear pending saat metrics berikutnya confirm
6. Timeout & success saling membatalkan
7. Setiap control independen

Jangan buat pending timeout ad-hoc.

## Auto Hooks (BUKAN pending-command-based)

- `useAutoPumpActivation`: watch temperature + smoke density → publish Pump Activation (W2=1/0) via TO PLC. Gate: FROM PLC bit 13 (Remote Mode) harus aktif.
- `useAutoCooldown`: selama pump running (FROM PLC bit 0 atau 1), publish SetValue decrement ke counter temperature/smoke tiap 0.5–1s.
- Keduanya langsung publish, TIDAK pakai pending command.

## FROM PLC DO Bit Map (Pump Room, Device 6563)

| Bit | Key | Dipakai auto-hooks? |
|---|---|---|
| 0 | pumpARunning | Ya (cooldown) |
| 1 | pumpBRunning | Ya (cooldown) |
| 2 | sv1Opened | |
| 3 | sv2Opened | |
| 4 | flowSwitch | |
| 5 | dischargeActive | |
| 6 | localZoneActivation | |
| 7 | remoteZoneActivation | |
| 8 | fgsConfFire | |
| 9 | levelTankHigh | |
| 10 | levelTankLow | |
| 11 | pumpCRunning | |
| 12 | localMode | |
| 13 | remoteMode | Ya (auto-pump gate) |
| 14 | pumpATripped | |
| 15 | pumpBTripped | |

Jangan hidupkan kembali key `sv1Closed` / `sv2Closed`.

## Fire-Fighting Room

**Screen belum ada** — hanya ada docs di `docs/` dan bit map di `docs/fire-fighting-room-mqtt.md`.
Yang sudah di kode:
- FROM PLC (6563) "Adjustable value": 12 DI (bit 0–11) + 12 DO (bit 12–23)
- TO PLC (7193) dipakai oleh pump room dan auto hooks (shared device)
- `buildCarloGavazziForceCommand()` ada untuk DO force override

## Accommodation Room

File: `src/app/stations/accommodation-room.tsx`.

- Device ID: smoke 3549, temp 3585, alarm 3667, zone temp 4147, smoke density 7280 (nullable).
- Alarm command: `Acknowledgement`, `Reset`, `TestAlarmOn`, `TestAlarmOff`, `ResetOn`, `ResetOff`.
- Counter command: `SetValue` (temperature slider debounce 250ms, smoke toggle langsung).
- Value controls rollback ke snapshot saat timeout, sync dari MQTT ketika connected.
- Zone temperature via modal: heating control, set point, status.
- Threshold suhu: normal <40°C, warning 40–54°C, danger ≥55°C.

## Storage Keys

| Key | Isi |
|---|---|
| `epbox.connection.settings` | MQTT broker config |
| `epbox.auth.session` | User session |
| `epbox.accommodation-room.demo.values` | Accommodation room input state |
| `epbox.pump-room.demo.values` | Pump room sensor values |
| `epbox.mqtt.metrics-cache` | Web localStorage cache metrics |
| `epbox-mqtt-metrics-cache.json` | Native file cache metrics |

## No Environment Variables

Semua konfigurasi via Settings screen runtime. Tidak ada `.env`.

## Style System

- `src/styles/tokens.ts`: `AppColors`, `AppSpacing`, `AppRadii`
- `src/styles/primitives.ts`: base layout & text styles
- `src/styles/screens/`: stylesheet per layar
- `getSignalPalette(tone)` → `{ surface, border, accent, text, track }`
- Icon: `@expo/vector-icons` dan `lucide-react-native`

## TypeScript Rules

- Strict mode. Jangan pakai `any`.
- Pertahankan `as const` inference untuk mapping data.
- Bit map union type harus sinkron dengan source mapping.
- Ref pattern untuk menghindari infinite loop effect: `const fooRef = useRef(foo); fooRef.current = foo;`

## Git Safety

- Worktree bisa dirty. Jangan `git reset --hard`.
- Jangan checkout/revert file tanpa instruksi eksplisit.
- Jangan hapus file yang tidak terkait.

## Final Response

Setelah selesai, jawab ringkas dalam bahasa user:
- file yang diubah
- inti perubahan
- hasil `npx tsc --noEmit`
