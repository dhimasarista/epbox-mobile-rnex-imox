# AGENTS.md

Panduan ini berlaku untuk seluruh repo `epbox-mobile-rnex-imox`.
Ikuti instruksi ini sebelum membuat perubahan apa pun.

## Ringkasan Proyek

- Aplikasi mobile Expo SDK 56, React Native, TypeScript, Expo Router.
- Entry app menggunakan `expo-router/entry`.
- Source utama ada di `src/`.
- Screen station utama ada di `src/app/stations/`.
- MQTT gateway, topic, payload, dan packing word berada di:
  - `src/providers/mqtt-provider.tsx`
  - `src/lib/mqtt-topics.ts`
  - `src/lib/mqtt-settings.ts`
  - `src/lib/mqtt-cache.ts`

## Aturan Wajib Sebelum Edit

1. Baca dokumentasi versi Expo yang tepat sebelum menulis kode:
   - https://docs.expo.dev/versions/v56.0.0/
2. Pahami file yang akan disentuh sebelum patch.
3. Gunakan `rg` untuk mencari file atau referensi.
4. Edit hanya file yang relevan dengan request.
5. Jangan revert perubahan user atau perubahan lain yang tidak terkait.
6. Jangan menyentuh kredensial broker, secret, password, token, atau pengaturan koneksi kecuali user eksplisit meminta dan scope-nya jelas.

## Validasi Wajib

Setelah setiap perubahan kode, jalankan:

```bash
npx tsc --noEmit
```

Perubahan belum selesai sampai command tersebut exit `0`.

Jika mengubah lint-sensitive code, boleh tambahkan:

```bash
npx expo lint
```

Tetapi `npx tsc --noEmit` tetap wajib.

## Cara Kerja Saat Mengerjakan Task

1. Baca request terbaru user dan jadikan itu sumber kebenaran.
2. Baca file terkait sebelum menyimpulkan solusi.
3. Cari referensi lama dengan `rg` sebelum mengganti nama key, label, topic, atau mapping bit.
4. Buat patch kecil dan terarah.
5. Setelah patch, cari ulang referensi yang seharusnya hilang.
6. Jalankan `npx tsc --noEmit`.
7. Laporkan ringkas:
   - file yang diubah,
   - perilaku yang berubah,
   - hasil verifikasi.

## Struktur Source Penting

- `src/app/`
  - Route dan screen Expo Router.
- `src/app/stations/accommodation-room.tsx`
  - UI dan command station accommodation room.
- `src/app/stations/pump-room.tsx`
  - UI FROM PLC dan TO PLC pump room.
- `src/hooks/`
  - Hook reusable, termasuk pending command dan auto behavior.
- `src/lib/`
  - Helper domain, MQTT topic, bit packing, storage, demo defaults.
- `src/providers/`
  - Provider app, termasuk MQTT dan auth.
- `src/styles/`
  - Token, primitive, dan style screen.

## MQTT dan Gateway Rules

- Jangan baca, tampilkan, atau ubah broker credentials.
- Jangan ubah host, port, username, password, client id, protocol, reconnect setting, atau TLS setting tanpa request eksplisit.
- Jangan hardcode topic baru jika topic/payload map sudah ada di `src/lib/mqtt-topics.ts`.
- Gunakan helper packing/unpacking yang sudah ada.
- Jangan membuat retry publish otomatis kecuali user eksplisit meminta.
- Untuk publish user-triggered, pakai pola pending command yang konsisten:
  1. user press,
  2. UI masuk pending dan control terkait disabled,
  3. snapshot state sebelum send,
  4. tunggu response gateway,
  5. success commit jika response cocok,
  6. timeout 5000 ms rollback jika tidak ada response,
  7. timeout/success harus saling membatalkan.
- Gunakan `src/hooks/use-pending-command.ts` untuk flow pending, jangan membuat pending timeout ad-hoc baru.
- Setiap control harus independen; timeout satu control tidak boleh membersihkan pending control lain.

## Pump Room Notes

File utama: `src/app/stations/pump-room.tsx`.

### FROM PLC / DO

DO adalah 1 word uint16 dari PLC, bit 0 adalah LSB. App hanya menerima dan
menampilkan DO ketika MQTT connected. Saat simulation/offline, channel boleh
di-toggle lokal untuk validasi packing bit.

Mapping DO resmi:

| bitIndex | key                  | label                    |
| ---: | --- | --- |
| 0  | `pumpARunning`         | `Pump A Running`         |
| 1  | `pumpBRunning`         | `Pump B Running`         |
| 2  | `sv1Opened`            | `SV1 Opened`             |
| 3  | `sv2Opened`            | `SV2 Opened`             |
| 4  | `flowSwitch`           | `Flow Switch`            |
| 5  | `dischargeActive`      | `Discharge Active`       |
| 6  | `localZoneActivation`  | `Local Zone Activation`  |
| 7  | `remoteZoneActivation` | `Remote Zone Activation` |
| 8  | `fgsConfFire`          | `FGS Confirmed Fire`     |
| 9  | `levelTankHigh`        | `Tank Level High`        |
| 10 | `levelTankLow`         | `Tank Level Low`         |
| 11 | `pumpCRunning`         | `Pump C Running`         |
| 12 | `localMode`            | `Mode Local`             |
| 13 | `remoteMode`           | `Mode Remote`            |
| 14 | `pumpATripped`         | `Pump A Tripped`         |
| 15 | `pumpBTripped`         | `Pump B Tripped`         |

Jangan hidupkan kembali key lama `sv1Closed` atau `sv2Closed`.

Bit 0, 1, dan 13 dipakai oleh hook auto-pump/cooldown. Jangan ubah mapping bit
tersebut tanpa instruksi eksplisit.

### TO PLC

- Pressure transmitter memakai input bar 0 sampai 16.
- Nilai UI pressure adalah 1:1 ke word/counter gateway: `1 bar` dikirim sebagai `1`, bukan `10` atau `0.1`.
- Default pressure pump adalah `3 bar` jika tidak ada data tersimpan/gateway.
- Pressure pump harus mengikuti realtime MQTT/gateway ketika connected, kecuali field sedang pending command.
- Remote control memakai W2:
  - `Remote Activation` mengirim `1/true`.
  - Setelah feedback sukses dan W2 menjadi `1`, UI menahan value `1` dan button berikutnya menjadi `Remote Reset`.
  - `Remote Reset` mengirim `0/false`.
- Jangan mengirim reset otomatis untuk W2 kecuali user meminta.

## Accommodation Room Notes

File utama: `src/app/stations/accommodation-room.tsx`.

- Alarm command button harus tetap mengikuti pola pending command reusable.
- Jangan membuat countdown atau ack logic baru berbasis sinyal yang tidak cocok.
- Alarm ON/OFF UI harus mengikuti flow visual yang diminta user:
  - row OFF tetap horizontal,
  - alarm ON merah,
  - siren OFF gray dan ON kuning.
- Value controls seperti temperature/smoke harus rollback ke snapshot ketika timeout,
  dan sync lagi dari current MQTT/gateway ketika connected.

## UI dan Style Rules

- Ikuti style system yang sudah ada di `src/styles/`.
- Gunakan token `AppColors`, `AppSpacing`, `AppRadii`, dan style screen yang sudah tersedia.
- Jangan membuat style besar baru jika primitive/style existing cukup.
- Untuk icon, gunakan library yang sudah ada seperti `@expo/vector-icons`.
- UI control harus stabil ukurannya saat pending, disabled, atau label berubah.
- Jangan membuat button melebar karena text status/pending.
- Jangan ubah flow awal user kecuali request terbaru eksplisit meminta.

## TypeScript dan Kode

- Pertahankan type inference dari data `as const` jika sudah dipakai.
- Untuk mapping bit, pastikan union type berasal dari source mapping yang sama atau selalu sinkron.
- Jangan pakai `any` jika tipe domain bisa dibuat jelas.
- Gunakan helper domain untuk parsing/formatting/packing.
- Bersihkan timer di cleanup effect.
- Hindari state duplikat kecuali memang diperlukan untuk optimistic UI dan rollback.

## Git dan File Safety

- Worktree bisa dirty. Jangan pakai `git reset --hard`.
- Jangan checkout/revert file tanpa instruksi eksplisit.
- Jangan hapus file yang tidak terkait.
- Sebelum mengubah file yang sedang banyak berubah, baca bagian terkait dan patch minimum.

## Dependency Rules

- Jika perlu package Expo, gunakan versi SDK 56 dan prefer:

```bash
npx expo install <package>
```

- Jangan upgrade Expo, React, React Native, atau dependency besar tanpa request eksplisit.
- Jangan ubah `package.json`, lockfile, native config, atau build config jika task tidak memerlukannya.

## Final Response

Jawab ringkas dalam bahasa user. Sertakan:

- file yang diubah,
- inti perubahan,
- hasil `npx tsc --noEmit`.

Jika tidak bisa menjalankan validasi, jelaskan alasannya secara eksplisit.
