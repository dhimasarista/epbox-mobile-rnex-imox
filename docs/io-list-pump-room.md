# IO List — Pump Room

**Route:** `/stations/pump-room`  
**Room ID:** PR-001 | **Deck:** Lower Deck  
**Konektivitas:** **Local only** — tidak ada MQTT. Semua nilai diinput manual oleh operator (demo/kalibrasi) dan disimpan ke device storage.

---

## Sensor Inputs (Kalibrasi PLC)

Nilai-nilai ini mewakili bacaan sensor dari PLC S7-1200. Operator memasukkan nilai aktual di lapangan melalui UI, yang kemudian disimpan ke `epbox.pump-room.demo.values`.

| No | Tag | Label | Tipe | Range | Unit | Threshold Warning | Threshold Danger | Storage Key |
|----|-----|-------|------|-------|------|-------------------|------------------|-------------|
| 1  | PT-001 | Pressure Transmitter — Pump 1 | Analog Input | 0 – 16 | bar | ≥ 7.5 bar | ≥ 10.2 bar | `pressurePump1` |
| 2  | PT-002 | Pressure Transmitter — Pump 2 | Analog Input | 0 – 16 | bar | ≥ 7.5 bar | ≥ 10.2 bar | `pressurePump2` |
| 3  | FT-001 | Flow Rate Discharge | Analog Input | ≥ 0 | m³/h | — | — | `dischargeFlowRate` |

### Signal Tone

| Tone | Warna | Kondisi (Pressure) |
|------|-------|--------------------|
| `normal` | Hijau | < 7.5 bar |
| `warning` | Kuning | 7.5 – 10.1 bar |
| `danger` | Merah | ≥ 10.2 bar |

---

## Dashboard Outputs (Simulasi Display)

Nilai-nilai ini ditampilkan sebagai output dashboard pompa. Sebagian berasal dari input PLC di atas, sebagian lagi adalah state independen yang dapat dikonfigurasi di UI.

| No | Tag | Label | Tipe | Range | Unit | Threshold Warning | Threshold Danger | Catatan |
|----|-----|-------|------|-------|------|-------------------|------------------|---------|
| 1  | TA-001 | Temperature Zone Alarm | Digital Output (indicator) | ON / OFF | — | — | ON = Danger | Toggle manual |
| 2  | SS-001 | Current Status | Digital (3-state) | 0 / 1 / 2 | — | — | 2 = Tripped | Off / Running / Tripped |
| 3  | AI-001 | Ampere Status | Analog Input | 0 – 160 | A | ≥ 100 A | ≥ 140 A | Stepper UI |
| 4  | PT-001 | Pressure Pump 1 | Repeat dari input | 0 – 16 | bar | ≥ 7.5 bar | ≥ 10.2 bar | Mirror dari sensor input |
| 5  | PT-002 | Pressure Pump 2 | Repeat dari input | 0 – 16 | bar | ≥ 7.5 bar | ≥ 10.2 bar | Mirror dari sensor input |
| 6  | FT-001 | Flow Rate Discharge | Repeat dari input | ≥ 0 | m³/h | — | — | Mirror dari sensor input |

### Status Code — Current Status (SS-001)

| Kode | Label | Indikator |
|------|-------|-----------|
| 0 | Off | Lamp OFF |
| 1 | Running | Lamp Hijau |
| 2 | Tripped | Lamp Merah |

### Signal Tone — Ampere Status

| Tone | Warna | Kondisi |
|------|-------|---------|
| `normal` | Default | < 100 A |
| `warning` | Kuning | 100 – 139 A |
| `danger` | Merah | ≥ 140 A |

---

## Storage

| Key | Format | Konten |
|-----|--------|--------|
| `epbox.pump-room.demo.values` | JSON string | `{ pressurePump1, pressurePump2, dischargeFlowRate }` |

**Default values:**

```json
{
  "pressurePump1": "7.4 bar",
  "pressurePump2": "7.1 bar",
  "dischargeFlowRate": "168 m3/h"
}
```

---

## Catatan

- Pump Room **tidak terhubung ke MQTT**. Tidak ada `publishTopic` atau `useMqttTopic` di layar ini.
- Nilai dashboard seperti `temperatureZone`, `currentStatus`, dan `ampereStatus` bersifat ephemeral — reset ke default saat app dijalankan ulang.
- Nilai PLC inputs (`pressurePump1`, `pressurePump2`, `dischargeFlowRate`) **persisten** di secure storage.
- Layar ini berfungsi sebagai simulasi kalibrasi input sebelum terhubung ke MQTT gateway yang sesungguhnya.
