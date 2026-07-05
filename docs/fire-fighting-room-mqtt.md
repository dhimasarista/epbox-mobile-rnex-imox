# Fire Fighting Room — Aturan Bit Packing DI & DO

File layar: `src/app/stations/fire-fighting-room.tsx`  
Helper bitpack: `src/lib/bit-packed-word.ts`  
Gateway config: `src/lib/mqtt-topics.ts` → `CARLO_GAVAZZI_GATEWAY_CONFIG.fireFightingRoom`  
Referensi: `docs/Modbus.pdf` [F29] PLC - SIEMENS, `docs/mqtt_report (6).pdf`

---

## Gambaran Umum

PLC Siemens S7-1200 di Fire Fighting Room punya 12 Digital Input (DI) dan
12 Digital Output (DO). Gateway Carlo Gavazzi UWP-4.0 memaparkan keduanya
sebagai **device id 6563** ("PLC - SIEMENS", satu payung) di MQTT topic
`epbox/imox/demo/site/batam/edge/cg-uwp40-01/metrics`.

### Dua MQTT Topic yang Digunakan

| Topic | Arah | Keterangan |
|---|:---:|---|
| `.../metrics` | Subscribe | Terima semua sinyal dari gateway (DI, DO, suhu, asap, dll.) |
| `.../cmd/ot` | Publish | Kirim perintah ke gateway (SetValue untuk DO, dll.) |

---

## Register DI dan DO — Terpisah dalam Device 6563

Berdasarkan **Modbus slave map [F29] PLC - SIEMENS** (Modbus.pdf halaman 10),
device 6563 memiliki tiga sinyal Uint16 terpisah:

| Signal Name | Modbus Format | Fungsi |
|---|:---:|---|
| `Total value` | Uint16 | Nilai akumulatif counter |
| **`Adjustable value`** | Uint16 | **DO word** — ditulis via SetValue |
| **`Input value`** | Uint16 | **DI word** — read-only, dari PLC hardware |

DI dan DO **tidak digabung dalam satu register** — masing-masing Uint16 terpisah
dalam device yang sama (6563).

---

## Layout Bit DI — sinyal "Input value" (Uint16, read-only)

| Bit | Nilai Desimal | Channel | Label | Kontak |
|:---:|---:|---|---|:---:|
| 0 | 1 | Ch 1 | Emergency Stop | NC |
| 1 | 2 | Ch 2 | Button – Start Pump A | NO |
| 2 | 4 | Ch 3 | Button – Stop Pump A | NC |
| 3 | 8 | Ch 4 | Button – Start Pump B | NO |
| 4 | 16 | Ch 5 | Button – Stop Pump B | NC |
| 5 | 32 | Ch 6 | Button – Zone Release | NO |
| 6 | 64 | Ch 7 | Selector Local / Remote | NO |
| 7 | 128 | Ch 8 | R3 – Pump A Status | NO |
| 8 | 256 | Ch 9 | R4 – Pump B Status | NO |
| 9 | 512 | Ch 10 | R5 – Pump C Status | NO |
| 10 | 1024 | Ch 11 | Level Switch – Low Tank | NO |
| 11 | 2048 | Ch 12 | Flow Switch | NO |
| **ALL** | **4095** | Semua aktif | `0b111111111111` | — |

---

## Layout Bit DO — sinyal "Adjustable value" (Uint16, writable)

Perintah tulis: `SetValue` ke id `6563`, value = 0–4095 (12-bit DO word).  
Tiap toggle channel di app langsung kirim `SetValue` (QoS 0).

| Bit | Nilai Desimal | Channel | Label |
|:---:|---:|---|---|
| 0 | 1 | Ch 1 | R1 – Solenoid Valve 1 Open |
| 1 | 2 | Ch 2 | R2 – Solenoid Valve 2 Open |
| 2 | 4 | Ch 3 | R3 – Pump A Start |
| 3 | 8 | Ch 4 | R4 – Pump B Start |
| 4 | 16 | Ch 5 | R5 – Pump C Start |
| 5 | 32 | Ch 6 | Buzzer |
| 6 | 64 | Ch 7 | Lamp – Zone Release |
| 7 | 128 | Ch 8 | Lamp – Pump A Running |
| 8 | 256 | Ch 9 | Lamp – Pump A Stopped |
| 9 | 512 | Ch 10 | Lamp – Pump B Running |
| 10 | 1024 | Ch 11 | Lamp – Pump B Stopped |
| 11 | 2048 | Ch 12 | Lamp – Local / Remote |
| **ALL** | **4095** | Semua aktif | `0b111111111111` |

### Contoh DO

| Kondisi | Bit aktif | Desimal dikirim |
|---|---|---:|
| Hanya Buzzer ON | bit 5 | `32` |
| Pump A Start + Pump B Start | bit 2, bit 3 | `4 + 8 = 12` |
| Solenoid 1 + Solenoid 2 + Buzzer | bit 0, 1, 5 | `1 + 2 + 32 = 35` |
| Semua DO ON | bit 0–11 | `4095` |
| Semua DO OFF | — | `0` |

---

## ID Semua Device (Dikonfirmasi dari mqtt_report (6).pdf)

| Device | ID | Tipe |
|---|:---:|---|
| Temperature | 3585 | Counter |
| Smoke Status | 3549 | Counter |
| **PLC - SIEMENS (DI + DO)** | **6563** | Counter |
| Alarm | 3667 | Alarm |
| Zone Temperature | 4147 | Zone Temperature |

---

## Alur MQTT

### Menerima (gatewayMetrics → device 6563)

```
Topic: .../metrics
  │
  └── getCarloGavazziMetricsSignalByName(payload, 6563, 'Input value')
        → nextDiWord (Uint16, DI state)
        → setDiWord(nextDiWord)
        → unpackChannels([diWord], DI_BIT_MAP) → tiap DI channel true/false

      getCarloGavazziMetricsSignalByName(payload, 6563, 'Adjustable value')
        → nextDoWord (Uint16, DO state terakhir dikonfirmasi gateway)
        → setLastDoWord(nextDoWord)
        → setDraftDoWord(nextDoWord)  ← sync draft ke confirmed
```

### Mengirim (user toggle DO → .../cmd/ot)

```
User toggle channel DO (misal: Buzzer)
  │
  ├── setChannelBit([draftDoWord], DO_BIT_MAP, 'buzzer', !current)
  │   → newDoWord (Uint16, 0–4095)
  │
  ├── setDraftDoWord(newDoWord)  ← UI update langsung (optimistic)
  │
  └── publishTopic('gatewayOtCommand', {
        id: 6563,
        cmd: 'SetValue',
        value: newDoWord     ← 0–4095 saja, bukan combined
      }, { qos: 0, retain: false })
      → setLastDoWord(newDoWord) jika berhasil
```

---

## Counter vs. Modbus Digital Output — Kenapa Tidak Ada ForceOn/ForceOff

Device 6563 adalah **Counter element**, bukan Modbus Digital Output:

| | Counter (device 6563) | Modbus Digital Output |
|---|---|---|
| Command tersedia | `SetValue`, `Increase`, `Decrease`, `Reset`, `Freeze`, `Unfreeze` | `ForceOn`, `ForceOff`, `On`, `Off` |
| Bisa di-force? | **Tidak** | **Ya** |

Satu-satunya cara menulis DO = `SetValue` dengan nilai 0–4095 (12-bit DO word).
