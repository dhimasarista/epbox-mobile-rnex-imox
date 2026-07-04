# Fire Fighting Room — Bit-Packed DI/DO & Force Control

File: `src/app/stations/fire-fighting-room.tsx`
(sebelumnya bernama `imox-event.tsx` — direname karena layar ini sebenarnya
memantau ruangan berisi tanki dan pompa dengan konteks fire fighting, bukan
"event" generik.)

---

## Gambaran Umum

Layar ini menampilkan 12 Digital Input (DI) dan 12 Digital Output (DO) dari
PLC Siemens S7-1200, yang terhubung ke gateway Carlo Gavazzi UWP-4.0.

Karena tiap channel DI/DO cuma bernilai boolean (0/1), PLC **tidak** mengirim
24 register Modbus terpisah. Sebagai gantinya, nilai-nilai itu di-**bitpack**
menjadi satu atau lebih **word 16-bit (uint16)** — tiap bit mewakili satu
channel — dan gateway meneruskan hasilnya sebagai **satu angka desimal** ke
MQTT. Mobile app harus **unpack** angka desimal itu kembali menjadi bit-bit
individual untuk ditampilkan.

Ini beda dari layar Accommodation Room, yang menerima tiap signal sebagai
entri terpisah dalam JSON metrics (lihat `docs/accommodation-room-mqtt.md`).
Di sini, satu angka mentah = banyak channel sekaligus.

---

## Kenapa Bitpacking?

- 1 word (16 bit) bisa membawa sampai 16 nilai boolean sekaligus.
- 12 DI + 12 DO = **24 titik, lebih dari kapasitas 1 word (16 bit)** — jadi
  **wajib pakai minimal 2 word**, bukan pilihan opsional. Skema saat ini
  pakai representasi `words: number[]` yang extensible: 2 word untuk
  kebutuhan sekarang, atau bertambah jadi lebih banyak word tanpa mengubah
  struktur kode (Carlo Gavazzi UWP-4.0 di lapangan bisa memakai sampai 4
  word untuk kombinasi DI/DO/status/alarm — desain ini disiapkan untuk itu).
- Tujuannya efisiensi bandwidth Modbus/MQTT: beberapa angka desimal jauh
  lebih hemat daripada 24 topic/field terpisah.

### Bitmask Bukan Daftar Skenario

Poin penting yang sering disalahpahami: bitmask **tidak** menghasilkan
"puluhan/ratusan skenario yang harus didaftar satu-satu". Tiap bit adalah
flag independen, dan kombinasi apa pun otomatis terwakili oleh satu angka
lewat penjumlahan bit yang aktif — tidak perlu lookup table per kombinasi.

Contoh dengan 1 word (perhatikan: ini bukan berarti 1 word cukup untuk 24
channel — hanya ilustrasi cara baca bitmask):

| Kondisi | Bit aktif | Nilai desimal |
|---|---|---|
| Sensor 1 aktif sendiri | bit0 = 1 | `1` |
| Sensor 1 mati | bit0 = 0 | `0` |
| Sensor 2 aktif sendiri | bit1 = 1 | `2` |
| Sensor 1 **dan** Sensor 2 aktif bersamaan | bit0=1, bit1=1 | `1 + 2 = 3` |
| Sensor 5 aktif sendiri | bit4 = 1 | `16` |
| Semua 12 channel dalam 1 word aktif | bit0-11 = 1 | `4095` |

Unpack-nya murni operasi bitwise (`(word >> bitIndex) & 1`), bukan
percabangan `if/else` per kombinasi — lihat `getChannelBit` di
`src/lib/bit-packed-word.ts`.

---

## uint16, Bukan int16

Satu word = **16 bit**. Dua word = 32 bit. Empat word = 64 bit — ini soal
jumlah bit total dan sudah benar. Tapi ada satu detail yang sering
terlewat: bagaimana 16 bit itu **diinterpretasikan sebagai angka**.

- **uint16 (unsigned)** — rentang `0` s.d. `65535`. Semua 16 bit murni jadi
  magnitude/bitmask. Ini yang seharusnya dipakai di sini, karena tiap bit
  cuma flag ON/OFF, bukan angka bertanda.
- **int16 (signed)** — rentang `-32768` s.d. `32767`. Bit ke-15 (MSB)
  dipakai sebagai **sign bit**. Kalau register yang sama dibaca sebagai
  int16, begitu bit15 (channel ke-16 dalam word tsb) aktif, nilainya akan
  terbaca **negatif** (mis. `-32768`, bukan `32768`) — padahal pola bit
  mentahnya identik.

Modbus register / gateway biasanya memang unsigned secara alami untuk
bitmask I/O, jadi asumsi kerja di sini adalah **word = uint16**. Tapi kalau
ternyata payload MQTT dari gateway sampai ke app sebagai angka negatif
(artinya diperlakukan sebagai int16 di suatu titik sebelum sampai ke sini),
helper unpack tetap harus menghasilkan bit yang benar.

`src/lib/bit-packed-word.ts` menangani ini lewat `toUint16(word)`
(`word & 0xFFFF`) yang dijalankan **sebelum** operasi bit apa pun
(`getChannelBit`, `setChannelBit`). Ini perlu karena operator bitwise di
JavaScript (`>>`, `&`, `|`, `~`) bekerja pada integer 32-bit signed secara
internal — kalau word negatif langsung di-`>>` tanpa dinormalisasi dulu,
JS akan sign-extend dari bit31 (bukan bit15), dan bit-bit tinggi bisa
terbaca salah. `toUint16` membuang ambiguitas itu dengan memaksa word
kembali ke rentang 0–65535 berdasarkan pola bit mentahnya, apa pun cara ia
awalnya diinterpretasikan.

---

## Status Mapping Bit — BELUM FINAL

**Peringatan penting:** posisi bit per channel (`wordIndex` + `bitIndex`)
**belum dikonfirmasi oleh tim engineering PLC**. Implementasi saat ini
memakai mapping **placeholder**: channel dipaketkan **berurutan lintas
word** dalam urutan deklarasi — DI 1-12 dulu, baru DO 1-12 — bukan satu
word khusus DI dan satu word khusus DO. Dengan 24 channel dan word 16-bit:

| Global bit index | Channel | Posisi di word |
|---|---|---|
| 0–11 | DI channel 1–12 | word0, bit 0–11 |
| 12–15 | DO channel 1–4 | word0, bit 12–15 |
| 16–23 | DO channel 5–12 | word1, bit 0–7 |

Fungsi `getSequentialWordPosition(globalIndex)` di `fire-fighting-room.tsx`
yang menghitung pembagian ini secara otomatis (`wordIndex = floor(i / 16)`,
`bitIndex = i % 16`), jadi tidak di-hardcode manual per channel.

Placeholder ini **hanya untuk memastikan struktur UI dan kode siap pakai**.
Begitu mapping final tersedia dari engineer (kemungkinan besar tidak
berurutan seperti ini — bisa jadi DI dan DO justru dipisah per word, atau
urutan channel berbeda), cukup ubah isi `DI_BIT_MAP` dan `DO_BIT_MAP` di
`fire-fighting-room.tsx` — tidak perlu mengubah komponen UI, logic unpack,
atau struktur MQTT lainnya.

```ts
// PLACEHOLDER — ganti saat mapping final tersedia
const DI_BIT_MAP: BitChannelMap<DiKey> = {
  emergencyStop:       { wordIndex: 0, bitIndex: 0 },
  btnStartPumpA:       { wordIndex: 0, bitIndex: 1 },
  // ...dst
};
```

---

## Helper Bitpack/Unpack

Modul generik: `src/lib/bit-packed-word.ts`

| Fungsi | Kegunaan |
|---|---|
| `getChannelBit(words, map, key)` | Baca 1 bit channel tertentu dari array word |
| `setChannelBit(words, map, key, value)` | Set/clear 1 bit, kembalikan array word baru (immutable) |
| `unpackChannels(words, map)` | Unpack semua channel dalam map jadi `Record<key, boolean>` sekaligus |

Modul ini **tidak tahu apa-apa** soal urutan channel PLC — semua mapping bit
diberikan lewat parameter `map` (`BitChannelMap`). Ini supaya perubahan bit
layout di masa depan tidak butuh mengubah logic bitwise-nya, cukup ubah
konfigurasi mapping.

```ts
export type BitChannelMap<TKey extends string> = Record<
  TKey,
  { wordIndex: number; bitIndex: number }
>;
```

---

## Force Control (Card "Force Control")

### Kenapa Bukan Toggle Biasa?

Di Carlo Gavazzi UWP-4.0, fungsi/output yang berstatus **Running**
menjalankan logika otomatisasi terus-menerus (baca sensor, timer, dsb).
Perubahan nilai manual biasa (`On`/`Off`) akan **langsung ditimpa balik**
oleh logika otomatisasi yang sedang berjalan.

Untuk benar-benar mengambil alih kontrol, perintah yang dipakai adalah
**Force ON / Force OFF** — ini punya prioritas tertinggi di atas otomatisasi
normal maupun perintah manual biasa, dan akan memaksa output berubah tanpa
peduli status logika fungsi tersebut.

> Alternatif lain dari dokumentasi UWP: `Disable ON` untuk menghentikan
> sementara otomatisasi (baru bisa kontrol manual bebas), lalu `Disable OFF`
> untuk mengaktifkan lagi otomatisasi. Tidak dipakai di layar ini — hanya
> dicatat sebagai referensi jika suatu saat dibutuhkan.

### Command Payload

Tipe command di `src/lib/mqtt-topics.ts`:

```ts
export type CarloGavazziForceCommandName = 'ForceOn' | 'ForceOff';
export type CarloGavazziForceCommandPayload = {
  id: number;
  cmd: CarloGavazziForceCommandName;
  value: number; // word DO yang mau di-force-write
};
```

Builder: `buildCarloGavazziForceCommand(id, cmd, value)`. Berbeda dari
command alarm (`{ id, cmd }` tanpa value), Force di sini **membawa nilai
word** langsung dalam satu command — bukan dua command terpisah
(SetValue lalu Force). Alasannya: word DO adalah satu kesatuan bitmask,
jadi "set nilai" dan "force override" logisnya adalah satu tindakan yang
sama: menimpa word gateway dengan word hasil kombinasi switch DO di app.

**Catatan:** nama command `ForceOn`/`ForceOff` dan device ID
(`CARLO_GAVAZZI_GATEWAY_CONFIG.fireFightingRoom.doWord.deviceId`, saat ini
`-1` sebagai placeholder) adalah asumsi kerja — pastikan cocok dengan
command dan device ID aktual dari gateway saat dikonfirmasi engineering.

### Alur UI (Draft/Confirmed, Sama Seperti Accommodation Room)

Layar ini mengikuti pola dua-lapis state yang sama dengan Accommodation
Room (`draftForm` vs `confirmedForm` — lihat bagian "State Management" di
`docs/accommodation-room-mqtt.md`):

| State | Sumber | Kapan berubah |
|---|---|---|
| `draftWords` | Aksi user (toggle switch DO) | Langsung, responsif, murni lokal |
| `confirmedWords` | Respons `gatewayMetrics` | Hanya saat gateway mengonfirmasi word yang cocok |

```
User toggle switch DO channel tertentu
        │
        ▼
draftWords berubah (1 bit di-set/clear via setChannelBit) — lokal saja,
belum publish apa pun
        │
        ▼
User tekan "Force ON" / "Force OFF"
        │
        ├── MQTT tidak connect
        │   → error "MQTT disconnected", TIDAK publish,
        │     draftWords tetap bebas dimainkan user secara lokal
        │
        └── MQTT connect
            → publish buildCarloGavazziForceCommand(deviceId, cmd, draftWords[0])
              ke topic gatewayOtCommand
            → masuk status pending (pendingForceCommand, sentAt dicatat)
            │
            ├── gatewayMetrics balas dengan word yang cocok
            │   → confirmedWords diperbarui, pending dihapus
            │
            └── 5 detik berlalu TANPA respons (FORCE_WRITE_TIMEOUT_MS)
                → dianggap LOST: draftWords di-revert ke confirmedWords
                  terakhir, pending dihapus, muncul error
                  "No response from gateway. Force command timed out
                  and was reverted."
```

Durasi timeout **5 detik** dipilih agar konsisten dengan
`ALARM_WRITE_GUARD_MS` di Accommodation Room.

**Kalau koneksi MQTT putus saat command sedang pending** (bukan sejak
awal disconnect), pending langsung dibatalkan begitu status berubah jadi
tidak connect — sama seperti efek connection-loss di Accommodation Room
yang meng-clear `pendingCommands`/`pendingAlarmCommands` saat
`status !== 'connected'`.

---

## DI vs DO — Arah Akses

| | DI (Digital Input) | DO (Digital Output) |
|---|---|---|
| Sumber data | Word terakhir dari gateway (via MQTT, setelah unpack) | `draftWords` (lokal, sebelum publish) untuk switch; `confirmedWords` untuk "Last Word Values" |
| Bisa diubah dari app? | **Tidak.** Read-only, murni menampilkan status sensor/tombol fisik dari PLC. | **Ya, per-channel.** Tiap channel DO punya switch sendiri yang mengubah 1 bit di `draftWords` secara lokal. Publish ke gateway baru terjadi saat tombol **Force ON/OFF** ditekan, yang mengirim **seluruh word** hasil kombinasi switch — bukan command per-channel. |

Force ON/OFF di sini bukan pengganti switch per-channel — switch tetap ada
dan bebas dimainkan user kapan saja (termasuk saat offline). Force ON/OFF
adalah **aksi publish**: mengambil snapshot `draftWords` saat ini dan
menuliskannya ke gateway sebagai satu word, sekaligus meng-override status
Running UWP untuk word tersebut.

---

## Card Ringkasan (pengganti "IoCountRow")

Dua card di bagian atas layar (di bawah hero) sudah tidak lagi menghitung
jumlah channel DI/DO. Sekarang:

| Card | Isi | Sumber |
|---|---|---|
| Force Control | Tombol toggle Force ON / Force OFF, disabled saat ada command pending | Aksi user → command ke gateway, membawa `draftWords[0]` |
| Last Word Values | Dua angka desimal mentah terakhir yang **terkonfirmasi** gateway (word0 / word1) | `confirmedWords`, bukan draft |

Kartu "Last Word Values" sengaja menampilkan `confirmedWords` (bukan
draft) — ini angka yang benar-benar sudah dikonfirmasi gateway, berguna
untuk debugging lapangan: engineer bisa cocokkan dengan hasil bitpack yang
diharapkan dari PLC tanpa perlu menghitung manual dari 24 baris status
DI/DO di bawahnya.

---

## Yang Masih Perlu Dikonfirmasi Engineering

1. **Bit mapping final** untuk `DI_BIT_MAP` dan `DO_BIT_MAP` — urutan
   sequential lintas word yang dipakai sekarang adalah asumsi kerja, bukan
   hasil konfirmasi PLC. Kemungkinan pemetaan sebenarnya berbeda (misalnya
   DI dan DO dipisah per word, bukan berurutan).
2. **Jumlah word aktual** yang dipakai gateway (minimal 2 untuk 24 channel
   saat ini, tapi Carlo Gavazzi UWP-4.0 di lapangan bisa sampai 4 word) dan
   device ID/counter ID Modbus untuk tiap word tersebut.
3. **Nama command Force** yang sebenarnya diterima gateway (`ForceOn`/
   `ForceOff` di implementasi ini adalah asumsi kerja, belum diverifikasi
   ke dokumentasi command CG UWP).
4. **Device ID untuk word DO** —
   `CARLO_GAVAZZI_GATEWAY_CONFIG.fireFightingRoom.doWord.deviceId` saat ini
   `-1` sebagai placeholder yang jelas tidak valid (lihat komentar
   `TODO(engineering)` di `src/lib/mqtt-topics.ts`). Ganti dengan device
   ID/counter ID Modbus asli begitu tersedia dari gateway.
5. **Ack/konfirmasi dari `gatewayMetrics` belum diimplementasikan** —
   publish command sudah wired sungguhan ke `useMqtt().publishTopic()`, tapi
   belum ada listener yang membaca balik word DO dari `gatewayMetrics` untuk
   memanggil `setConfirmedWords(...)` (lihat komentar placeholder di
   `handleForcePress`/setelahnya di `fire-fighting-room.tsx`). Sampai ini
   diimplementasikan, setiap command yang dikirim akan **selalu timeout
   setelah 5 detik** dan ter-revert, karena tidak ada yang pernah
   mengonfirmasinya — ini perilaku yang benar secara desain (fail-safe),
   bukan bug, sampai path konfirmasi metrics-nya disambungkan.

Bit mapping (poin 1) dan device ID (poin 2, 4) adalah asumsi kerja demi
membuat UI dan alur command/response siap pakai — publish ke MQTT sudah
sungguhan (bukan simulasi), tapi tanpa listener konfirmasi metrics (poin 5)
dan device ID asli, command yang dikirim tidak akan pernah benar-benar
mengubah state gateway sungguhan.
