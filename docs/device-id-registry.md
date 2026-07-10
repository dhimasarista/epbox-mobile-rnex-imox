# Device ID Registry

Registry terpusat semua device ID yang terdaftar di gateway Carlo Gavazzi UWP-4.0.  
Source of truth: `src/lib/mqtt-topics.ts` → `CARLO_GAVAZZI_GATEWAY_CONFIG`

**Gateway:** `epbox/imox/demo/site/batam/edge/cg-uwp40-01`  
**Konfirmasi ID:** lihat `docs/mqtt_report (6).pdf`

---

## Master Table

| Device ID | Config Key | Room / Scope | Fungsi | Arah | Command Type | Signal Name |
|-----------|------------|-------------|--------|------|--------------|-------------|
| **3549** | `accommodationRoom.counterIds.smokeStatus` | Accommodation Room | Smoke Status Counter | R/W | Counter (SetValue) | `Adjustable value` |
| **3585** | `accommodationRoom.counterIds.temperature` | Accommodation Room | Temperature Counter | R/W | Counter (SetValue) | `Adjustable value` |
| **3667** | `accommodationRoom.alarm.deviceId` | Accommodation Room | Alarm Unit | R/W | Alarm Command | `Alarm status`, `Siren status`, `Output 1`–`Output 6` |
| **3794** | `remoteZoneActivated.deviceId` | Home Screen | Remote Zone Activated Switch | R | — | `Switch value` |
| **3819** | `localZoneActivated.deviceId` | Home Screen | Local Zone Activated Switch | R/W | Switch (OnOffToggle) | `Switch value` |
| **4147** | `accommodationRoom.zoneTemperature.deviceId` | Accommodation Room | Zone Temperature / Heating Control | R | — | lihat detail bawah |
| **6563** | `fireFightingRoom.doWord.deviceId` | Fire-Fighting Room | PLC S7-1200 DI + DO (24-bit) | R/W | Counter (SetValue) | `Adjustable value` |

---

## Detail per Device

### Device 3549 — Smoke Status Counter
| Field | Value |
|-------|-------|
| ID | 3549 |
| Room | Accommodation Room |
| Fungsi | Counter yang merepresentasikan deteksi asap |
| Signal dibaca | `Adjustable value` (integer → boolean: 0=Clear, 1=Detected) |
| Command | `SetValue(3549, 0\|1)` |
| Debounce | Tidak ada (publish langsung saat toggle) |
| Write window | 5 detik atau ACK dari metrics |

---

### Device 3585 — Temperature Counter
| Field | Value |
|-------|-------|
| ID | 3585 |
| Room | Accommodation Room |
| Fungsi | Counter suhu ruangan dalam °C |
| Signal dibaca | `Adjustable value` (integer, 0–120 °C) |
| Command | `SetValue(3585, N)` |
| Debounce | 250 ms setelah slider berhenti |
| Write window | 5 detik atau ACK dari metrics (nilai cocok) |
| Threshold | normal < 40 °C · warning 40–54 °C · danger ≥ 55 °C |

---

### Device 3667 — Alarm Unit
| Field | Value |
|-------|-------|
| ID | 3667 |
| Room | Accommodation Room |
| Fungsi | Sistem alarm kebakaran |
| Signals dibaca | `Alarm status` (code 1–6), `Siren status` (boolean), `Output 1`–`Output 6` (boolean) |
| Commands | `Acknowledgement`, `Reset`, `ResetOn`, `ResetOff`, `TestAlarmOn`*, `TestAlarmOff`* |
| Write window | 5 detik per command (independent per command name) |

*TestAlarmOn / TestAlarmOff tersedia di kode tapi dinonaktifkan di UI.

**Alarm Status Codes:**

| Kode | Label | Tone |
|------|-------|------|
| 1 | Alarm OFF | normal |
| 2 | Alarm ON | danger |
| 3 | Alarm was ON | warning |
| 4 | Acknowledged, alarm ON | danger |
| 5 | Acknowledged, alarm was ON | warning |
| 6 | Reset alarm | warning |

---

### Device 3794 — Remote Zone Activated
| Field | Value |
|-------|-------|
| ID | 3794 |
| Room | Home Screen |
| Fungsi | Indikator apakah zona remote sudah diaktifkan |
| Signal dibaca | `Switch value` (boolean) |
| Command | Tidak ada (read only dari app) |

---

### Device 3819 — Local Zone Activated
| Field | Value |
|-------|-------|
| ID | 3819 |
| Room | Home Screen |
| Fungsi | Toggle zona local (on/off) |
| Signal dibaca | `Switch value` (boolean) |
| Command | `OnOffToggle(3819)` |
| Write window | 8 detik atau ACK dari metrics |

---

### Device 4147 — Zone Temperature / Heating Control
| Field | Value |
|-------|-------|
| ID | 4147 |
| Room | Accommodation Room |
| Fungsi | Kontrol sistem pemanas zona (read only dari app) |
| Command | Tidak ada |

**Signals:**

| Signal Name | Tipe | Unit | Keterangan |
|-------------|------|------|------------|
| `Heating control analogue signal` | number | % | Output kontrol pemanas |
| `Heating set point signal` | number | °C | Target suhu |
| `Heating control status signal` | number | — | Kode status kontrol |
| `Heating set point selected signal` | number | — | 1=OFF, 2=SP1, 3=SP2, 4=SP3 |
| `Heating status signal` | number | — | Status operasi (1–17), lihat io-list-accommodation-room.md |
| `Status signal` | number | — | Status keseluruhan sistem |

**Special:** Heating status = 12 → badge "Antifreeze Active" ditampilkan di UI.

---

### Device 6563 — PLC S7-1200 DI/DO Word
| Field | Value |
|-------|-------|
| ID | 6563 |
| Room | Fire-Fighting Room |
| Fungsi | 12 DI + 12 DO dari PLC, dikemas dalam combined 24-bit value |
| Signal dibaca | `Adjustable value` (integer gabungan word[0] + word[1]) |
| Command | `SetValue(6563, word[1] * 65536 + word[0])` |
| Write window | 5 detik atau ACK dari metrics |

**Bit Layout:**

```
word[0] bit  0–11  →  DI channel 1–12   (read only)
word[0] bit 12–15  →  DO channel 1–4    (read + write)
word[1] bit  0–7   →  DO channel 5–12   (read + write)
word[1] bit  8–15  →  unused
```

Lihat `docs/io-list-fire-fighting-room.md` untuk tabel bit lengkap.

---

## Ringkasan per Room

### Home Screen
| Device ID | Fungsi |
|-----------|--------|
| 3794 | Remote Zone Activated (baca) |
| 3819 | Local Zone Activated (toggle) |

### Accommodation Room
| Device ID | Fungsi |
|-----------|--------|
| 3549 | Smoke Status Counter |
| 3585 | Temperature Counter |
| 3667 | Alarm Unit |
| 4147 | Zone Temperature / Heating Control |

### Fire-Fighting Room
| Device ID | Fungsi |
|-----------|--------|
| 6563 | PLC S7-1200 DI + DO |

### Pump Room
*Tidak ada device ID — layar ini local only, tanpa MQTT.*

---

## Cara Menambah Device Baru

1. Tambahkan entry di `CARLO_GAVAZZI_GATEWAY_CONFIG` dalam `src/lib/mqtt-topics.ts`
2. Tambahkan helper extractor di file yang sama (ikuti pola `getAccommodationRoomMetricsState`)
3. Tambahkan entry di file ini
4. Update IO list yang relevan di `docs/io-list-*.md`
