# IO List — Pump Room

**Route:** `/stations/pump-room`  
**Konektivitas:** ❌ Local only — tidak ada MQTT. Semua nilai diinput manual (demo).

Legend: ✅ Sudah ada device MQTT | ⬜ Belum ada device MQTT

---

## Sensor Inputs (Kalibrasi PLC)

| Status | No | Tag | Label | Tipe | Range | Unit | Threshold W | Threshold D | Device ID |
|--------|----|-----|-------|------|-------|------|-------------|-------------|-----------|
| ⬜ | 1 | PT-001 | Pressure Transmitter — Pump 1 | AI | 0–16 | bar | ≥ 7.5 | ≥ 10.2 | — |
| ⬜ | 2 | PT-002 | Pressure Transmitter — Pump 2 | AI | 0–16 | bar | ≥ 7.5 | ≥ 10.2 | — |
| ⬜ | 3 | FT-001 | Flow Rate Discharge | AI | ≥ 0 | m³/h | — | — | — |

## Dashboard Outputs (Display Simulasi)

| Status | No | Tag | Label | Tipe | Range | Unit | Threshold W | Threshold D | Device ID |
|--------|----|-----|-------|------|-------|------|-------------|-------------|-----------|
| ⬜ | 1 | TA-001 | Temperature Zone Alarm | DI | ON/OFF | — | — | ON=Danger | — |
| ⬜ | 2 | SS-001 | Current Status (Off/Running/Tripped) | DI | 0/1/2 | — | — | 2=Tripped | — |
| ⬜ | 3 | AI-001 | Ampere Status | AI | 0–160 | A | ≥ 100 | ≥ 140 | — |
| ⬜ | 4 | PT-001 | Pressure Pump 1 (repeat) | AI | 0–16 | bar | ≥ 7.5 | ≥ 10.2 | — |
| ⬜ | 5 | PT-002 | Pressure Pump 2 (repeat) | AI | 0–16 | bar | ≥ 7.5 | ≥ 10.2 | — |
| ⬜ | 6 | FT-001 | Flow Rate Discharge (repeat) | AI | ≥ 0 | m³/h | — | — | — |

---

**Ringkasan:** 0 dari 9 IO points sudah terhubung ke MQTT device.  
Seluruh layar ini masih demo — belum ada device ID yang ditetapkan di gateway.
