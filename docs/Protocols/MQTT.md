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
| PLC - SIEMENS | Counter | 6563 | `.../metrics` |
| Pressure Transmitter - Pump 1 | Counter | 6983 | `.../pressure-transmitter` |
| Pressure Transmitter - Pump 2 | Counter | 7019 | `.../pressure-transmitter` |

### Counter commands

Applies to: Smoke Status (3549), Temperature (3585), PLC - SIEMENS (6563),
Pressure Transmitter - Pump 1 (6983), Pressure Transmitter - Pump 2 (7019).

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
    - PLC - SIEMENS (6563)
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
| PLC - SIEMENS (6563) | `fireFightingRoom.doWord.deviceId` | `stations/pump-room.tsx` (PLC tab) |
| Pressure Transmitter - Pump 1 (6983) | `pumpRoom.counterIds.pressurePump1` | `stations/pump-room.tsx` (Inject tab) |
| Pressure Transmitter - Pump 2 (7019) | `pumpRoom.counterIds.pressurePump2` | `stations/pump-room.tsx` (Inject tab) |

**Reconciliation rule (Counter functions).** A control publishes `SetValue` on
`cmd/ot`, marks the field *pending*, and holds the local draft until a matching
value is echoed back on `metrics`. The confirmed value (chip / tone / bar)
always tracks the gateway echo.

**PLC DO word encoding.** The Pump Room PLC tab shows **Digital Output only**
(Digital Input is not surfaced). The DO state is a single 16-bit word, re-based to
**bit 0** (channel 1 → bit 0 … up to bit 13; bits 14–15 spare). A toggle sets its
bit and publishes `SetValue` with that word verbatim (no DI area packed in). The
bit-to-signal map lives in `DO_BIT_MAP` (`stations/pump-room.tsx`), sourced from
`docs/DO.md`; full layout in `docs/Protocols/Dashboard-SCADA.md` §5.

**Pressure transmitter encoding.** The pressure counter register is a Modbus
**unsigned integer**, so a fractional mA cannot be written directly. The app
encodes it as **`mA × 10`** on write (`SetValue` = `114` for `11.4 mA`) and
divides by 10 on read, preserving the 0.1 mA slider step; an echo within
±0.05 mA counts as the ack. Encoding lives in `pressureMaToCounter` /
`pressureCounterToMa` (`src/lib/mqtt-topics.ts`). Confirm the real echo scale
with `scripts/mqtt-probe.mjs` before trusting this against a live gateway.

## Reference

- Source: UWP IDE — MQTT function export (`docs/CG-UWP-40/image.png`,
  `docs/CG-UWP-40/mqtt_report (7).md`).
- Manuals: `docs/CG-UWP-40/UWPIDE_Eng.pdf`, `docs/CG-UWP-40/UWPWebApp_ENG.pdf`,
  `docs/CG-UWP-40/UWP4_Resources.pdf`.
