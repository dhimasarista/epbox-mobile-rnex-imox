# IO List — Home Screen

**Route:** `/` (index)  
**Konektivitas:** MQTT — `gatewayMetrics` (subscribe) + `gatewayOtCommand` (publish)

Legend: ✅ Sudah ada device MQTT | ⬜ Belum ada device MQTT

---

## Digital Input / Status Read

| Status | Tag | Label | Device ID | Signal Name | Tipe Nilai | Keterangan |
|--------|-----|-------|-----------|-------------|------------|------------|
| ✅ | SW-LOCAL | Local Zone Activated | **3819** | `Switch value` | boolean | Zona lokal ON/OFF |
| ✅ | SW-REMOTE | Remote Zone Activated | **3794** | `Switch value` | boolean | Zona remote ON/OFF (read only) |

## Digital Output / Command

| Status | Tag | Label | Device ID | Command | Payload | Keterangan |
|--------|-----|-------|-----------|---------|---------|------------|
| ✅ | SW-LOCAL | Toggle Local Zone | **3819** | `OnOffToggle` | `{ id: 3819, cmd: "OnOffToggle" }` | Write window 8 detik |

## Analog / Stats Display

| Status | Tag | Label | Device ID | Keterangan |
|--------|-----|-------|-----------|------------|
| ⬜ | STAT-LATENCY | Response Time (ms) | — | Dihitung lokal dari `latestLatencySample`, bukan dari device |
| ⬜ | STAT-DISTANCE | Distance to Device | — | Hardcoded 108 Km (demo value) |
| ⬜ | STAT-SIGNAL | Network Signal Strength | — | Dari NetInfo OS, bukan MQTT |

---

**Ringkasan:** 2 dari 2 IO field points sudah terhubung ke MQTT device.
