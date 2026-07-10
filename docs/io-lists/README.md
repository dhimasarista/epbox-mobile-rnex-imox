# IO Lists — EPBOX IMOX

IO list per room/screen. Tiap file mencantumkan status koneksi MQTT untuk setiap IO point.

Legend: ✅ Sudah ada device MQTT | ⬜ Belum ada device MQTT

---

## Status Keseluruhan

| Room | Route | IO Sudah Ada | IO Belum Ada | Total | MQTT |
|------|-------|:------------:|:------------:|:-----:|------|
| [Home](./home.md) | `/` | 2 | 3* | 5 | ✅ Terhubung |
| [Pump Room](./pump-room.md) | `/stations/pump-room` | 0 | 9 | 9 | ❌ Local only |
| [Accommodation Room](./accommodation-room.md) | `/stations/accommodation-room` | 20 | 3* | 23 | ✅ Terhubung |
| [Fire-Fighting Room](./fire-fighting-room.md) | `/stations/fire-fighting-room` | 24 | 3* | 27 | ✅ Terhubung |

*IO "belum ada" di Home dan Accommodation Room adalah stat/flag lokal, bukan field instrument.  
*IO "belum ada" di Fire-Fighting Room adalah channel potensial yang belum dipetakan ke bit.

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
