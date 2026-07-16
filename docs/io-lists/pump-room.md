# IO List — Pump Room

**Route:** `/stations/pump-room`  
**Device (PLC tab):** ID **6563** — Siemens S7-1200 via Carlo Gavazzi UWP-4.0  
**Konektivitas (PLC tab):** ✅ MQTT — `gatewayMetrics` (subscribe) + `gatewayOtCommand` (publish)  
**Konektivitas (Inject Value tab):** ❌ Local only — semua nilai diinput manual (demo)

Legend: ✅ Sudah ada device MQTT | ⬜ Belum ada device MQTT

---

## Tab PLC

Semua channel berasal dari satu signal: device **6563**, `Adjustable value`.  
Command write: `SetValue(6563, word[1] * 65536 + word[0])`

### Digital Input — 12 Channel (Read Only)

Sumber: `word[0]` bit 0–11

| Status | No | Global Bit | Word | Bit | Tag | Label | Contact | Kondisi TRUE |
|--------|----|-----------|------|-----|-----|-------|---------|--------------|
| ✅ | DI-01 | 0 | 0 | 0 | ES-001 | Emergency Stop | NC | E-Stop tidak aktif (circuit terbuka) |
| ✅ | DI-02 | 1 | 0 | 1 | PB-001 | Button — Start Pump A | NO | Tombol ditekan |
| ✅ | DI-03 | 2 | 0 | 2 | PB-002 | Button — Stop Pump A | NC | Tombol ditekan (circuit terbuka) |
| ✅ | DI-04 | 3 | 0 | 3 | PB-003 | Button — Start Pump B | NO | Tombol ditekan |
| ✅ | DI-05 | 4 | 0 | 4 | PB-004 | Button — Stop Pump B | NC | Tombol ditekan (circuit terbuka) |
| ✅ | DI-06 | 5 | 0 | 5 | PB-005 | Button — Zone Release | NO | Tombol ditekan |
| ✅ | DI-07 | 6 | 0 | 6 | SS-001 | Selector Local / Remote | NO | Posisi Remote |
| ✅ | DI-08 | 7 | 0 | 7 | R3-STS | R3 — Pump A Running Status | NO | Pump A sedang jalan |
| ✅ | DI-09 | 8 | 0 | 8 | R4-STS | R4 — Pump B Running Status | NO | Pump B sedang jalan |
| ✅ | DI-10 | 9 | 0 | 9 | R5-STS | R5 — Pump C Running Status | NO | Pump C sedang jalan |
| ✅ | DI-11 | 10 | 0 | 10 | LS-001 | Level Switch — Low Tank | NO | Level tangki rendah |
| ✅ | DI-12 | 11 | 0 | 11 | FS-001 | Flow Switch | NO | Ada aliran |

### Digital Output — 12 Channel (Read + Write)

Sumber: `word[0]` bit 12–15 dan `word[1]` bit 0–7

| Status | No | Global Bit | Word | Bit | Tag | Label | Kategori |
|--------|----|-----------|------|-----|-----|-------|----------|
| ✅ | DO-01 | 12 | 0 | 12 | R1-SV1 | R1 — Solenoid Valve 1 Open | Valve |
| ✅ | DO-02 | 13 | 0 | 13 | R2-SV2 | R2 — Solenoid Valve 2 Open | Valve |
| ✅ | DO-03 | 14 | 0 | 14 | R3-PA | R3 — Pump A Start | Pump |
| ✅ | DO-04 | 15 | 0 | 15 | R4-PB | R4 — Pump B Start | Pump |
| ✅ | DO-05 | 16 | 1 | 0 | R5-PC | R5 — Pump C Start | Pump |
| ✅ | DO-06 | 17 | 1 | 1 | BZR-001 | Buzzer | Buzzer |
| ✅ | DO-07 | 18 | 1 | 2 | LMP-ZR | Lamp — Zone Release | Lamp |
| ✅ | DO-08 | 19 | 1 | 3 | LMP-PAR | Lamp — Pump A Running | Lamp |
| ✅ | DO-09 | 20 | 1 | 4 | LMP-PAS | Lamp — Pump A Stopped | Lamp |
| ✅ | DO-10 | 21 | 1 | 5 | LMP-PBR | Lamp — Pump B Running | Lamp |
| ✅ | DO-11 | 22 | 1 | 6 | LMP-PBS | Lamp — Pump B Stopped | Lamp |
| ✅ | DO-12 | 23 | 1 | 7 | LMP-LR | Lamp — Local / Remote | Lamp |

### IO Potensial (Belum Dipetakan)

| Status | No | Tag | Label | Keterangan |
|--------|----|-----|-------|------------|
| ⬜ | 1 | — | Pump C Button Start/Stop | DI-13/14 belum ada di PLC layout saat ini |
| ⬜ | 2 | — | Pressure Switch / Jockey Pump | Umumnya ada di sistem fire-fighting, belum dipetakan ke bit |
| ⬜ | 3 | — | Alarm Output ke Panel | Relay output alarm belum ada di bit map |

### Bit Layout

```
word[0]: [ DO4 | DO3 | DO2 | DO1 | DI12 | DI11 | DI10 | DI9 | DI8 | DI7 | DI6 | DI5 | DI4 | DI3 | DI2 | DI1 ]
           b15   b14   b13   b12   b11    b10    b9     b8    b7    b6    b5    b4    b3    b2    b1    b0

word[1]: [  0  |  0  |  0  |  0  |  0  |  0  |  0  |  0  | DO12 | DO11 | DO10 | DO9 | DO8 | DO7 | DO6 | DO5 ]
           b15   b14   b13   b12   b11   b10   b9    b8    b7     b6     b5     b4    b3    b2    b1    b0
```

---

## Tab Inject Value

Semua field diinput manual — tidak ada koneksi MQTT. Digunakan untuk simulasi/demo.

### Sensor Calibration

| Status | No | Tag | Label | Tipe | Signal | Range mA | EU Max | Unit EU |
|--------|----|-----|-------|------|--------|----------|--------|---------|
| ⬜ | 1 | PT-001 | Pressure Transmitter — Pump 1 | AI | 4–20 mA | 4–20 | 16 | bar |
| ⬜ | 2 | PT-002 | Pressure Transmitter — Pump 2 | AI | 4–20 mA | 4–20 | 16 | bar |
| ⬜ | 3 | FT-001 | Flow Rate Discharge | AI | 4–20 mA | 4–20 | 300 | m³/h |

**Konversi formula:**
- Pressure: `bar = mA − 4` (4 mA = 0 bar, 20 mA = 16 bar)
- Flow: `m³/h = (mA − 4) / 16 × 300` (4 mA = 0 m³/h, 20 mA = 300 m³/h)

### Unit Convention per Konteks

Setiap sensor memiliki dua representasi satuan tergantung konteks tampilan.

| Tag | Raw Signal | Mobile App — Inject Tab (input chip) | Mobile App — Inject Tab (badge bawah slider) | SCADA / HMI Eksternal |
|-----|------------|--------------------------------------|----------------------------------------------|-----------------------|
| PT-001 | 4–20 mA | **mA** | Label status mA: "Normal" / "≥ 11.5 mA" / "≥ 14.2 mA" | **bar** (mA − 4) |
| PT-002 | 4–20 mA | **mA** | Label status mA: "Normal" / "≥ 11.5 mA" / "≥ 14.2 mA" | **bar** (mA − 4) |
| FT-001 | 4–20 mA | **mA** | **m³/h** live konversi dari mA | **m³/h** ((mA−4)/16×300) |

> **Aturan sederhana:** Mobile app selalu input dalam mA (raw signal). Satuan engineering (bar / m³/h) ditampilkan sebagai informasi tambahan di badge, dan menjadi satuan utama di SCADA/HMI eksternal.

### Alarm Thresholds

Semua threshold alarm dievaluasi dalam **mA** di mobile app — tidak ada konversi ke EU untuk logika alarm.

| Tag | Threshold | mA | EU Referensi |
|-----|-----------|-----|--------------|
| PT-001 / PT-002 | Low Pressure | < 6 mA | < 2 bar |
| PT-001 / PT-002 | Pressure Warning | ≥ 11.5 mA | ≥ 7.5 bar |
| PT-001 / PT-002 | High Pressure (Danger) | ≥ 14.2 mA | ≥ 10.2 bar |
| FT-001 | No Flow | ≤ 4 mA | 0 m³/h (live zero) |
| FT-001 | Possible Blockage | < 6.67 mA AND PT ≥ 11.5 mA | < 50 m³/h AND pressure warning |

### Derived Alarm

Alarm dikalkulasi otomatis dari nilai sensor — tidak ada toggle manual.

| Kondisi | Trigger | Level |
|---------|---------|-------|
| High Pressure | PT-001 atau PT-002 ≥ 14.2 mA | Danger |
| Pressure Warning | PT-001 atau PT-002 ≥ 11.5 mA | Warning |
| Low Pressure | PT-001 atau PT-002 < 6 mA | Danger |
| No Flow | FT-001 ≤ 4 mA | Danger |
| Possible Blockage | FT-001 < 6.67 mA AND (PT-001 atau PT-002 ≥ 11.5 mA) | Warning |

---

**Ringkasan PLC tab:** 24 dari 24 IO channel terhubung ke MQTT (device 6563). 3 IO potensial belum dipetakan.  
**Ringkasan Inject Value tab:** 3 sensor AI (input dalam mA) + Derived Alarm card — seluruhnya lokal demo. Tidak ada Pump Running toggle.
