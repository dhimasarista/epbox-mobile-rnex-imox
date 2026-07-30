# MQTT — CG-UWP40 (Carlo Gavazzi)

Edge gateway: **cg-uwp40-01** — Site: `demo/site/batam`, namespace `epbox/imox`.

## Send Command

Topic:

- `epbox/imox/demo/site/batam/edge/cg-uwp40-01/cmd/ot`

Commands are addressed to a **function** by its numeric `id` (see the Functions list below).
Each command is a JSON payload:

```json
{ "id": <id>, "cmd": "<Command>", "value": <value> }
```

`value` is only required for commands that carry a set-point / amount.

### Functions list (id map)

| Function | Type | id | Metric topic |
|---|---|---|---|
| Smoke Status | Counter | 3549 | `.../acc-room/metrics` |
| Temperature | Counter | 3585 | `.../acc-room/metrics` |
| Zone temperature | Zone temperature | 4147 | `.../acc-room/metrics` |
| Alarm | Alarm | 3667 | `.../acc-room/metrics` |
| FROM PLC - SIEMENS | Counter | 6563 | `.../metrics` |
| TO PLC - SIEMENS | Counter | 7193 | `.../metrics` |
| Pressure Transmitter - Pump 1 | Counter | 6983 | `.../pressure-transmitter` |
| Pressure Transmitter - Pump 2 | Counter | 7019 | `.../pressure-transmitter` |

### Counter commands

Applies to: Smoke Status (3549), Temperature (3585), FROM PLC - SIEMENS (6563),
TO PLC - SIEMENS (7193), Pressure Transmitter - Pump 1 (6983),
Pressure Transmitter - Pump 2 (7019).

| Command | Payload |
|---|---|
| Increase | `{"id": <id>, "cmd": "Increase", "value": <value>}` |
| Decrease | `{"id": <id>, "cmd": "Decrease", "value": <value>}` |
| SetValue | `{"id": <id>, "cmd": "SetValue", "value": <value>}` |
| ResetValue | `{"id": <id>, "cmd": "ResetValue"}` |
| Freeze | `{"id": <id>, "cmd": "Freeze"}` |
| Unfreeze | `{"id": <id>, "cmd": "Unfreeze"}` |
| FreezeUnfreezeToggle | `{"id": <id>, "cmd": "FreezeUnfreezeToggle"}` |
| ResetRollover | `{"id": <id>, "cmd": "ResetRollover"}` |

### Alarm commands

Applies to: Alarm (3667).

| Command | Payload |
|---|---|
| Acknowledgement | `{"id": <id>, "cmd": "Acknowledgement"}` |
| Reset | `{"id": <id>, "cmd": "Reset"}` |
| ResetOn | `{"id": <id>, "cmd": "ResetOn"}` |
| ResetOnTimeout | `{"id": <id>, "cmd": "ResetOnTimeout"}` |
| ResetOff | `{"id": <id>, "cmd": "ResetOff"}` |
| ResetToggle | `{"id": <id>, "cmd": "ResetToggle"}` |
| ResetToggleTimeout | `{"id": <id>, "cmd": "ResetToggleTimeout"}` |
| TestAlarmOn | `{"id": <id>, "cmd": "TestAlarmOn"}` |
| RemoveTestAlarmOn | `{"id": <id>, "cmd": "RemoveTestAlarmOn"}` |
| TestAlarmOnToggle | `{"id": <id>, "cmd": "TestAlarmOnToggle"}` |
| TestAlarmOff | `{"id": <id>, "cmd": "TestAlarmOff"}` |
| RemoveTestAlarmOff | `{"id": <id>, "cmd": "RemoveTestAlarmOff"}` |

### Zone temperature commands

Applies to: Zone temperature (4147).

| Command | Payload |
|---|---|
| HeatingActivation | `{"id": <id>, "cmd": "HeatingActivation"}` |
| HeatingDeactivation | `{"id": <id>, "cmd": "HeatingDeactivation"}` |
| HeatingToggleActivation | `{"id": <id>, "cmd": "HeatingToggleActivation"}` |
| HeatingSetPointSelection | `{"id": <id>, "cmd": "HeatingSetPointSelection", "value": <value>}` |
| HeatingSetS1 | `{"id": <id>, "cmd": "HeatingSetS1", "value": <value>}` |
| HeatingSetS2 | `{"id": <id>, "cmd": "HeatingSetS2", "value": <value>}` |
| HeatingSetS3 | `{"id": <id>, "cmd": "HeatingSetS3", "value": <value>}` |
| HeatingOffset | `{"id": <id>, "cmd": "HeatingOffset", "value": <value>}` |
| HeatingFanSpeedMode | `{"id": <id>, "cmd": "HeatingFanSpeedMode", "value": <value>}` |
| HeatingActivateForceOn | `{"id": <id>, "cmd": "HeatingActivateForceOn"}` |
| HeatingDeactivateForceOn | `{"id": <id>, "cmd": "HeatingDeactivateForceOn"}` |
| HeatingToggleForceOn | `{"id": <id>, "cmd": "HeatingToggleForceOn"}` |
| HeatingActivateForceOff | `{"id": <id>, "cmd": "HeatingActivateForceOff"}` |
| HeatingDeactivateForceOff | `{"id": <id>, "cmd": "HeatingDeactivateForceOff"}` |
| HeatingToggleForceOff | `{"id": <id>, "cmd": "HeatingToggleForceOff"}` |
| CoolingActivation | `{"id": <id>, "cmd": "CoolingActivation"}` |
| CoolingDeactivation | `{"id": <id>, "cmd": "CoolingDeactivation"}` |
| CoolingToggleActivation | `{"id": <id>, "cmd": "CoolingToggleActivation"}` |
| CoolingSetPointSelection | `{"id": <id>, "cmd": "CoolingSetPointSelection", "value": <value>}` |
| CoolingSetS1 | `{"id": <id>, "cmd": "CoolingSetS1", "value": <value>}` |
| CoolingSetS2 | `{"id": <id>, "cmd": "CoolingSetS2", "value": <value>}` |
| CoolingSetS3 | `{"id": <id>, "cmd": "CoolingSetS3", "value": <value>}` |
| CoolingOffset | `{"id": <id>, "cmd": "CoolingOffset", "value": <value>}` |
| CoolingFanSpeedMode | `{"id": <id>, "cmd": "CoolingFanSpeedMode", "value": <value>}` |
| CoolingActivateForceOn | `{"id": <id>, "cmd": "CoolingActivateForceOn"}` |
| CoolingDeactivateForceOn | `{"id": <id>, "cmd": "CoolingDeactivateForceOn"}` |
| CoolingToggleForceOn | `{"id": <id>, "cmd": "CoolingToggleForceOn"}` |
| CoolingActivateForceOff | `{"id": <id>, "cmd": "CoolingActivateForceOff"}` |
| CoolingDeactivateForceOff | `{"id": <id>, "cmd": "CoolingDeactivateForceOff"}` |
| CoolingToggleForceOff | `{"id": <id>, "cmd": "CoolingToggleForceOff"}` |
| DisableOn | `{"id": <id>, "cmd": "DisableOn"}` |
| DisableOnTimeout | `{"id": <id>, "cmd": "DisableOnTimeout"}` |
| DisableOff | `{"id": <id>, "cmd": "DisableOff"}` |
| DisableToggle | `{"id": <id>, "cmd": "DisableToggle"}` |
| DisableToggleTimeout | `{"id": <id>, "cmd": "DisableToggleTimeout"}` |

## Receive Signals

- `epbox/imox/demo/site/batam/edge/cg-uwp40-01/metrics`
    - FROM PLC - SIEMENS (6563) — DO output status (read-only, 14 channels)
    - TO PLC - SIEMENS (7193) — write target (packed PT1/PT2/Pump Activation). The
      mobile app doesn't consume it on read; the **dashboard reads it back** to
      verify the commanded set-points (unpack 4 words — see Dashboard-SCADA.md §8)
- `epbox/imox/demo/site/batam/edge/cg-uwp40-01/pressure-transmitter`
    - Pressure Transmitter - Pump 1 (6983)
    - Pressure Transmitter - Pump 2 (7019)
- `epbox/imox/demo/site/batam/edge/cg-uwp40-01/acc-room/metrics`
    - Smoke Status (3549)
    - Alarm (3667)
    - Temperature (3585)
    - Zone temperature (4147)

## App Sync Mapping

Every function id above is wired into the mobile app through a single source of
truth — `CARLO_GAVAZZI_GATEWAY_CONFIG` in `src/lib/mqtt-topics.ts`. Station
screens never hard-code ids; they read them from this config and follow the same
publish/echo reconciliation rules.

| Function (id) | Config path | Screen |
|---|---|---|
| Smoke Status (3549) | `accommodationRoom.counterIds.smokeStatus` | `stations/accommodation-room.tsx` |
| Temperature (3585) | `accommodationRoom.counterIds.temperature` | `stations/accommodation-room.tsx` |
| Alarm (3667) | `accommodationRoom.alarm.deviceId` | `stations/accommodation-room.tsx` |
| Zone temperature (4147) | `accommodationRoom.zoneTemperature.deviceId` | `stations/accommodation-room.tsx` |
| FROM PLC - SIEMENS (6563) | `fireFightingRoom.fromPlc.deviceId` | `stations/pump-room.tsx` (FROM PLC tab, read) |
| TO PLC - SIEMENS (7193) | `fireFightingRoom.toPlc.deviceId` | `stations/pump-room.tsx` (TO PLC tab, write) |
| Pressure Transmitter - Pump 1 (6983) | inject-only → TO PLC `W[0]` | `stations/pump-room.tsx` (TO PLC tab) |
| Pressure Transmitter - Pump 2 (7019) | inject-only → TO PLC `W[1]` | `stations/pump-room.tsx` (TO PLC tab) |

**Reconciliation rule (echoed Counter functions).** An echoed control (smoke,
temperature) publishes `SetValue` on `cmd/ot`, marks the field *pending*, and
holds the local draft until a matching value is echoed back on `metrics`; the
confirmed value tracks the echo. The pump room does **not** use this — DO is
receive-only, and its TO PLC writes are fire-and-forget.

**PLC encoding (FROM / TO split).** The PLC uses two registers (`docs/DO.md`),
opposite directions: **FROM PLC (6563)** is read-only — one uint16 word carrying
the 14-channel DO output status, bit-unpacked on read (the app never writes DO).
**TO PLC (7193)** is the sole write target: a packed **uint64** (4×uint16) where
`W[0]` = PT1 counter, `W[1]` = PT2 counter, `W[2]` = Pump Activation (`1` =
active), and `W[3]` = FGS Confirmed. Accommodation alarm status code 2/4 sends
`W[3]=1`; status code 1/3/5/6 sends `W[3]=0`. Unchanged words are re-sent from
the latest metrics/draft so another TO PLC function is not clobbered. When MQTT is
offline the tab runs a **local simulation** to verify the pack/unpack maths.
`DO_BIT_MAP` / `packToPlcCommand` live in `pump-room.tsx` / `mqtt-topics.ts`; full
layout in `docs/Protocols/Dashboard-SCADA.md` §5.

**Pressure transmitter encoding (inject-only, bar).** PT-001 / PT-002 are written,
not read back — their set-points are packed into TO PLC `W[0]` / `W[1]`. The PLC
expects the value in **bar** (engineering unit), not the raw 4–20 mA loop current:
`bar = mA − 4` (4 mA → 0 bar, 20 mA → 16 bar). The UI still shows the mA slider —
only the packed value changed. Each word is a Modbus **unsigned integer**, so the
app encodes **`(mA − 4) × 10`** before packing (`74` for `11.4 mA` = `7.4 bar`),
preserving the 0.1-bar step. Encoding lives in `pressureMaToBar` →
`pressureBarToCounter` (`src/lib/mqtt-topics.ts`). Confirm the PLC's expected scale
with `scripts/mqtt-probe.mjs` before trusting a live gateway.

## Reference

- Source: UWP IDE — MQTT function export (`docs/CG-UWP-40/image.png`,
  `docs/CG-UWP-40/mqtt_report (7).md`).
- Manuals: `docs/CG-UWP-40/UWPIDE_Eng.pdf`, `docs/CG-UWP-40/UWPWebApp_ENG.pdf`,
  `docs/CG-UWP-40/UWP4_Resources.pdf`.
