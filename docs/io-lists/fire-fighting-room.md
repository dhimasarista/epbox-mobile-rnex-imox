# IO List — Fire-Fighting Room

**Route:** `/stations/fire-fighting-room`  
**Konektivitas:** MQTT — `gatewayMetrics` (subscribe) + `gatewayOtCommand` (publish)  
**Device:** Semua channel berasal dari satu device — ID **6563**, signal `Adjustable value`

Legend: ✅ Sudah ada device MQTT | ⬜ Belum ada device MQTT

---

## Digital Input — 12 Channel (Read Only)

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

---

## Digital Output — 12 Channel (Read + Write)

Sumber: `word[0]` bit 12–15 dan `word[1]` bit 0–7  
Command: `SetValue(6563, word[1] * 65536 + word[0])`

| Status | No | Global Bit | Word | Bit | Tag | Label | Kategori | Device ID |
|--------|----|-----------|------|-----|-----|-------|----------|-----------|
| ✅ | DO-01 | 12 | 0 | 12 | R1-SV1 | R1 — Solenoid Valve 1 Open | Valve | **6563** |
| ✅ | DO-02 | 13 | 0 | 13 | R2-SV2 | R2 — Solenoid Valve 2 Open | Valve | **6563** |
| ✅ | DO-03 | 14 | 0 | 14 | R3-PA | R3 — Pump A Start | Pump | **6563** |
| ✅ | DO-04 | 15 | 0 | 15 | R4-PB | R4 — Pump B Start | Pump | **6563** |
| ✅ | DO-05 | 16 | 1 | 0 | R5-PC | R5 — Pump C Start | Pump | **6563** |
| ✅ | DO-06 | 17 | 1 | 1 | BZR-001 | Buzzer | Buzzer | **6563** |
| ✅ | DO-07 | 18 | 1 | 2 | LMP-ZR | Lamp — Zone Release | Lamp | **6563** |
| ✅ | DO-08 | 19 | 1 | 3 | LMP-PAR | Lamp — Pump A Running | Lamp | **6563** |
| ✅ | DO-09 | 20 | 1 | 4 | LMP-PAS | Lamp — Pump A Stopped | Lamp | **6563** |
| ✅ | DO-10 | 21 | 1 | 5 | LMP-PBR | Lamp — Pump B Running | Lamp | **6563** |
| ✅ | DO-11 | 22 | 1 | 6 | LMP-PBS | Lamp — Pump B Stopped | Lamp | **6563** |
| ✅ | DO-12 | 23 | 1 | 7 | LMP-LR | Lamp — Local / Remote | Lamp | **6563** |

---

## IO yang Belum Ada

| Status | No | Tag | Label | Keterangan |
|--------|----|-----|-------|------------|
| ⬜ | 1 | — | Pump C Button Start/Stop | DI-13/14 belum ada di PLC layout saat ini |
| ⬜ | 2 | — | Pressure Switch / Jockey Pump | Umumnya ada di sistem fire-fighting, belum dipetakan ke bit |
| ⬜ | 3 | — | Alarm Output ke Panel | Relay output alarm belum ada di bit map |

---

## Bit Layout Ringkas

```
word[0]: [ DO4 | DO3 | DO2 | DO1 | DI12 | DI11 | DI10 | DI9 | DI8 | DI7 | DI6 | DI5 | DI4 | DI3 | DI2 | DI1 ]
           b15   b14   b13   b12   b11    b10    b9     b8    b7    b6    b5    b4    b3    b2    b1    b0

word[1]: [ 0  |  0  |  0  |  0  |  0  |  0  |  0  |  0  | DO12 | DO11 | DO10 | DO9 | DO8 | DO7 | DO6 | DO5 ]
           b15  b14   b13   b12   b11   b10   b9    b8    b7     b6     b5     b4    b3    b2    b1    b0
```

---

**Ringkasan:** 24 dari 24 IO channel sudah terhubung ke MQTT device (semua via device 6563).  
3 IO potensial (Pump C buttons, pressure switch, alarm relay) belum dipetakan ke bit.
