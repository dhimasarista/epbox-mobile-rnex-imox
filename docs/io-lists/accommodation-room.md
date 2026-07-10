# IO List — Accommodation Room

**Route:** `/stations/accommodation-room`  
**Konektivitas:** MQTT — `gatewayMetrics` (subscribe) + `gatewayOtCommand` (publish)

Legend: ✅ Sudah ada device MQTT | ⬜ Belum ada device MQTT

---

## Device 3549 — Smoke Status Counter

| Status | No | Tag | Label | Tipe | Nilai | Device ID | Signal | Command |
|--------|----|-----|-------|------|-------|-----------|--------|---------|
| ✅ | 1 | SD-001 | Smoke Detected | DI (read) | 0=Clear / 1=Detected | **3549** | `Adjustable value` | — |
| ✅ | 2 | SD-001 | Set Smoke Status | DO (write) | 0 / 1 | **3549** | — | `SetValue` |

---

## Device 3585 — Temperature Counter

| Status | No | Tag | Label | Tipe | Range | Unit | Device ID | Signal | Command |
|--------|----|-----|-------|------|-------|------|-----------|--------|---------|
| ✅ | 1 | TT-001 | Room Temperature (read) | AI | 0–120 | °C | **3585** | `Adjustable value` | — |
| ✅ | 2 | TT-001 | Set Room Temperature | AO (write) | 0–120 | °C | **3585** | — | `SetValue` |

Threshold: normal < 40 °C · warning 40–54 °C · danger ≥ 55 °C  
Debounce: 250 ms setelah slider berhenti.

---

## Device 3667 — Alarm Unit

### Status & Sinyal (Read)

| Status | No | Tag | Label | Tipe | Nilai | Device ID | Signal |
|--------|----|-----|-------|------|-------|-----------|--------|
| ✅ | 1 | ALM-001 | Alarm Status | DI | code 1–6 | **3667** | `Alarm status` |
| ✅ | 2 | SRN-001 | Siren Status | DI | true/false | **3667** | `Siren status` |
| ✅ | 3 | RLY-001 | Relay Output 1 | DI | true/false | **3667** | `Output 1` |
| ✅ | 4 | RLY-002 | Relay Output 2 | DI | true/false | **3667** | `Output 2` |
| ✅ | 5 | RLY-003 | Relay Output 3 | DI | true/false | **3667** | `Output 3` |
| ✅ | 6 | RLY-004 | Relay Output 4 | DI | true/false | **3667** | `Output 4` |
| ✅ | 7 | RLY-005 | Relay Output 5 | DI | true/false | **3667** | `Output 5` |
| ✅ | 8 | RLY-006 | Relay Output 6 | DI | true/false | **3667** | `Output 6` |

### Commands (Write)

| Status | No | Tag | Label | Device ID | Command | Aktif di UI |
|--------|----|-----|-------|-----------|---------|-------------|
| ✅ | 1 | ALM-ACK | Acknowledge Alarm | **3667** | `Acknowledgement` | ✅ Ya |
| ✅ | 2 | ALM-RST | Reset Alarm | **3667** | `Reset` | ✅ Ya |
| ✅ | 3 | ALM-RON | Reset ON | **3667** | `ResetOn` | ✅ Ya |
| ✅ | 4 | ALM-ROF | Reset OFF | **3667** | `ResetOff` | ✅ Ya |
| ✅ | 5 | ALM-TON | Test Alarm ON | **3667** | `TestAlarmOn` | ⬜ Dinonaktifkan |
| ✅ | 6 | ALM-TOF | Test Alarm OFF | **3667** | `TestAlarmOff` | ⬜ Dinonaktifkan |

---

## Device 4147 — Zone Temperature / Heating Control

| Status | No | Tag | Label | Tipe | Unit | Device ID | Signal |
|--------|----|-----|-------|------|------|-----------|--------|
| ✅ | 1 | HC-ANA | Heating Control Analogue | AI | % | **4147** | `Heating control analogue signal` |
| ✅ | 2 | HC-SP | Heating Set Point | AI | °C | **4147** | `Heating set point signal` |
| ✅ | 3 | HC-STS | Heating Control Status | DI | code | **4147** | `Heating control status signal` |
| ✅ | 4 | HC-SEL | Heating Set Point Selected | DI | 1–4 | **4147** | `Heating set point selected signal` |
| ✅ | 5 | HS-STS | Heating Status | DI | code 1–17 | **4147** | `Heating status signal` |
| ✅ | 6 | HS-OVR | Overall Status | DI | code | **4147** | `Status signal` |

Semua read-only — tidak ada command yang dikirim ke device 4147 dari app.

---

## IO yang Belum Ada

| Status | No | Tag | Label | Keterangan |
|--------|----|-----|-------|------------|
| ⬜ | 1 | — | Manual Override Flag | Ada di storage (`manualOverride`) tapi tidak dipublish ke device manapun |
| ⬜ | 2 | — | Trigger Enable Flag | Ada di storage (`triggerEnable`) tapi tidak dipublish ke device manapun |
| ⬜ | 3 | — | Temperature High Limit Flag | Ada di storage (`temperatureHighLimit`) tapi tidak dipublish ke device manapun |

---

**Ringkasan:** 20 dari 20 IO field points sudah terhubung ke MQTT device.  
3 field storage-only (manual override, trigger enable, high limit) belum punya device ID.
