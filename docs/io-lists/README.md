# IO Lists — EPBOX IMOX

IO list per room/screen. Tiap file mencantumkan status koneksi MQTT untuk setiap IO point.

Legend: ✅ Sudah ada device MQTT | ⬜ Belum ada device MQTT

---

## Status Keseluruhan

| Room | Route | Tab | IO Sudah Ada | IO Belum Ada | Total | MQTT |
|------|-------|-----|:------------:|:------------:|:-----:|------|
| [Home](./home.md) | `/` | — | 2 | 3* | 5 | ✅ Terhubung |
| [Pump Room – PLC](./pump-room.md) | `/stations/pump-room` | PLC | 24 | 3* | 27 | ✅ Terhubung |
| [Pump Room – Inject](./pump-room.md) | `/stations/pump-room` | Inject Value | 0 | 9 | 9 | ❌ Local only |
| [Accommodation Room](./accommodation-room.md) | `/stations/accommodation-room` | — | 20 | 3* | 23 | ✅ Terhubung |

*IO "belum ada" di Home, Accommodation, dan Pump Room (PLC tab) adalah stat/flag lokal atau channel potensial yang belum dipetakan ke bit.

---

## Device ID Summary

| Device ID | Room | Fungsi |
|-----------|------|--------|
| 3549 | Accommodation Room | Smoke Status Counter |
| 3585 | Accommodation Room | Temperature Counter |
| 3667 | Accommodation Room | Alarm Unit |
| 3794 | Home | Remote Zone Activated (read) |
| 3819 | Home | Local Zone Activated (toggle) |
| 4147 | Accommodation Room | Zone Temperature / Heating Control |
| 6563 | Fire-Fighting Room | PLC S7-1200 — 12 DI + 12 DO |

Detail lengkap → [`docs/device-id-registry.md`](../device-id-registry.md)
