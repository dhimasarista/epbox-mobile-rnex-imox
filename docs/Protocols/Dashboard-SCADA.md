# Custom SCADA Dashboard — CG-UWP40 Integration Reference

Single reference for the mobile app's custom SCADA station screens: which values
are **injected**, how the **DI/DO word is bit-packed**, the **MQTT** topics /
payloads, the **encoding rules**, and how to **probe** the live gateway.

- Gateway: **Carlo Gavazzi UWP4.0**, edge id `cg-uwp40-01`, site
  `demo/site/batam`, namespace `epbox/imox`.
- Single source of truth in code: `CARLO_GAVAZZI_GATEWAY_CONFIG` in
  `src/lib/mqtt-topics.ts`. Screens never hard-code ids — they read this config.
- Related docs: [`MQTT.md`](./MQTT.md) (full command catalog per function).

---

## 1. Architecture

```
 App station screen (draft)                 CG-UWP40 gateway
 ─────────────────────────                  ────────────────
   slider / toggle / button
        │  publish SetValue / cmd
        ▼
   epbox/…/cg-uwp40-01/cmd/ot  ───────────▶  UWP function (Counter / Alarm / Zone)
                                                     │  applies value
   epbox/…/cg-uwp40-01/metrics ◀───────────  device signal snapshot (echo)
        │  parse + reconcile
        ▼
   confirmed value  →  chip / tone / bar
```

The app is **optimistic + reconciled**: it shows a local *draft* immediately,
publishes a command, then holds the draft until the gateway **echoes** the value
back on `metrics`. The *confirmed* value (color, chip, bar) always follows the
gateway echo, never the raw draft.

---

## 2. MQTT topics

Defined in `MQTT_TOPICS` (`src/lib/mqtt-topics.ts`). Transport is WebSocket in
dev (`ws://…/mqtt`) and TCP in standalone builds (`mqtt://` / `mqtts://`), chosen
by `getMqttRuntimeTransport()`.

| Key | Topic | Direction | QoS / retain |
|---|---|---|---|
| `gatewayMetrics` | `epbox/imox/demo/site/batam/edge/cg-uwp40-01/metrics` | subscribe | 0 / false |
| `gatewayOtCommand` | `epbox/imox/demo/site/batam/edge/cg-uwp40-01/cmd/ot` | publish | 0 / false |

### metrics payload

```jsonc
{
  "ip": "…", "sn": "…", "mac": "…", "time": "…",
  "devices": [
    {
      "id": 6983, "name": "Pressure Transmitter - Pump 1", "pn": "…",
      "signals": [
        { "id": 6983, "name": "Total value", "value": 114, "unit": "mA", "type": 0, "time": 0 }
      ]
    }
  ]
}
```

Consecutive metrics snapshots are **merged** per `device.id` + `signal.name`
(`mergeCarloGavazziMetricsPayload`) so partial updates don't drop known signals.
Counter reads prefer signal names `Total value` → `Adjustable value` →
`Input value`, else the first numeric signal.

### cmd/ot payload

```jsonc
{ "id": <functionId>, "cmd": "<Command>", "value": <number> }  // value only for value-commands
```

Builders: `buildCarloGavazziOtCommand` (counter), `buildCarloGavazziAlarmCommand`
(alarm), `buildCarloGavazziForceCommand` (force). Full command list per function
type in [`MQTT.md`](./MQTT.md).

---

## 3. Function / id map

| Function | Type | id | Config path | Screen |
|---|---|---|---|---|
| Smoke Status | Counter | 3549 | `accommodationRoom.counterIds.smokeStatus` | `accommodation-room.tsx` |
| Temperature | Counter | 3585 | `accommodationRoom.counterIds.temperature` | `accommodation-room.tsx` |
| Alarm | Alarm | 3667 | `accommodationRoom.alarm.deviceId` | `accommodation-room.tsx` |
| Zone temperature | Zone temp | 4147 | `accommodationRoom.zoneTemperature.deviceId` | `accommodation-room.tsx` |
| PLC - SIEMENS (DI/DO word) | Counter | 6563 | `fireFightingRoom.doWord.deviceId` | `pump-room.tsx` (PLC tab) |
| Pressure Transmitter - Pump 1 | Counter | 6983 | `pumpRoom.counterIds.pressurePump1` | `pump-room.tsx` (Inject tab) |
| Pressure Transmitter - Pump 2 | Counter | 7019 | `pumpRoom.counterIds.pressurePump2` | `pump-room.tsx` (Inject tab) |

---

## 4. Injected values (what each screen writes)

### Accommodation Room (`src/app/stations/accommodation-room.tsx`)

| Control | Function (id) | Command | Value |
|---|---|---|---|
| Smoke Detected toggle | Smoke Status (3549) | `SetValue` | `0` / `1` |
| Zone Temperature slider | Temperature (3585) | `SetValue` | `0…120` °C (integer, debounced 250 ms) |
| Alarm buttons | Alarm (3667) | `Acknowledgement` / `Reset` / `ResetOn` / `ResetOff` | — |

- Alarm read-back: `Alarm status` (codes 1–6, see `ACCOMMODATION_ROOM_ALARM_STATUS_OPTIONS`) + `Siren status`.
- Zone temperature is **read-only** on this screen (heating/cooling detail),
  parsed by `getAccommodationRoomZoneHeatingState` (status/setpoint/mode labels).
- Alarm commands use a **5 s silent write-guard** per command; counter commands
  clear only on a matching echo.

### Pump Room — PLC tab (`src/app/stations/pump-room.tsx`)

Injects the **combined DI/DO word** into the PLC-SIEMENS counter (6563) via
`SetValue`. DI is read-only (from metrics); DO is controllable (toggles). See
§5 for the bit layout. 5 s silent expiry if the echo never confirms.

### Pump Room — Inject Value tab

| Control | Function (id) | Command | Value |
|---|---|---|---|
| PT-001 slider | Pressure Pump 1 (6983) | `SetValue` | mA × 10 (see §6) |
| PT-002 slider | Pressure Pump 2 (7019) | `SetValue` | mA × 10 (see §6) |

Range 4–20 mA, step 0.1, debounced 250 ms. A derived alarm card (low / warning /
danger) is computed locally from the draft mA thresholds.

---

## 5. DI/DO bit unpacking (PLC - SIEMENS, id 6563)

The PLC exposes its digital I/O bit-packed into 16-bit Modbus words (uint16).
The app treats them as a **single 32-bit combined value** stored in the counter:

```
combined = word1 * 65536 + word0          // little-word-first
DI = combined bits  0..11   (12 inputs, read-only)
DO = combined bits 12..23   (12 outputs, controllable)
```

Helpers live in `src/lib/bit-packed-word.ts` (`unpackChannels`, `getChannelBit`,
`setChannelBit`). Each word is forced to **uint16** via `toUint16` before any
shift — bit15 is a flag, not a sign bit, so signed int16 payloads decode
correctly. The bit map is supplied by the caller (`DI_BIT_MAP` / `DO_BIT_MAP` in
`pump-room.tsx`) so the layout can change without touching the helpers.

### Digital Inputs — bits 0–11 (read-only)

| Bit | Key | Label | Ch / Slot | Contact |
|---|---|---|---|---|
| 0 | emergencyStop | Emergency Stop | 1 / 1 | NC |
| 1 | btnStartPumpA | Button – Start Pump A | 2 / 1 | NO |
| 2 | btnStopPumpA | Button – Stop Pump A | 3 / 1 | NC |
| 3 | btnStartPumpB | Button – Start Pump B | 4 / 1 | NO |
| 4 | btnStopPumpB | Button – Stop Pump B | 5 / 1 | NC |
| 5 | btnZoneRelease | Button – Zone Release | 6 / 1 | NO |
| 6 | selectorLocalRemote | Selector Local / Remote | 7 / 1 | NO |
| 7 | r3PumpARunning | R3 – Pump A Status | 8 / 1 | NO |
| 8 | r4PumpBRunning | R4 – Pump B Status | 9 / 1 | NO |
| 9 | r5PumpCRunning | R5 – Pump C Status | 10 / 1 | NO |
| 10 | levelSwitchLow | Level Switch – Low Tank | 11 / 1 | NO |
| 11 | flowSwitch | Flow Switch | 12 / 1 | NO |

### Digital Outputs — bits 12–23 (controllable)

| Bit | Key | Label | Ch / Slot |
|---|---|---|---|
| 12 | solenoidValve1 | R1 – Solenoid Valve 1 Open | 1 / 1 |
| 13 | solenoidValve2 | R2 – Solenoid Valve 2 Open | 2 / 1 |
| 14 | r3PumpAStart | R3 – Pump A Start | 3 / 1 |
| 15 | r4PumpBStart | R4 – Pump B Start | 4 / 1 |
| 16 | r5PumpCStart | R5 – Pump C Start | 5 / 1 |
| 17 | buzzer | Buzzer | 6 / 1 |
| 18 | lampZoneRelease | Lamp – Zone Release | 7 / 1 |
| 19 | lampPumpARunning | Lamp – Pump A Running | 8 / 1 |
| 20 | lampPumpAStoped | Lamp – Pump A Stopped | 9 / 1 |
| 21 | lampPumpBRunning | Lamp – Pump B Running | 10 / 1 |
| 22 | lampPumpBStoped | Lamp – Pump B Stopped | 1 / 2 |
| 23 | lampLocalRemote | Lamp – Local / Remote | 2 / 2 |

**Write path:** toggling a DO sets its bit in the draft words, recombines to the
32-bit value, and publishes `SetValue(6563, combined)`. **Read path:** metrics
`Adjustable value` on 6563 is rounded, split into `word0`/`word1`, then DI is
unpacked from the confirmed words and DO reflected from the draft words.

---

## 6. Pressure transmitter mA encoding

The pressure counter register is a Modbus **unsigned integer** — it cannot store
a fractional mA. To keep the 0.1 mA slider resolution the app encodes:

```
write:  counter = round(mA × 10)      // 11.4 mA → SetValue 114
read:   mA = counter / 10             // echo 114 → 11.4 mA
```

- Scale constant: `PRESSURE_MA_COUNTER_SCALE = 10` (one knob).
- Helpers: `pressureMaToCounter` / `pressureCounterToMa` (`src/lib/mqtt-topics.ts`).
- Ack tolerance ±0.05 mA absorbs rounding.

> ⚠️ The gateway register type has flip-flopped (uint / double). Always confirm
> the real echo scale with the probe (§8) before trusting this on a live gateway.
> If echo returns `1140` → scale should be `100`; if `11` → resolution is 1.

---

## 7. Reconciliation rules

| Concern | Rule |
|---|---|
| Draft vs confirmed | Slider/toggle follows local draft; chip/tone/bar follow the gateway echo. |
| Counter ack | Pending clears when metrics echo matches expected (temperature: exact int; pressure: ±0.05 mA). |
| Alarm ack | Pending clears when metrics arrive after the send, or after a 5 s silent guard. |
| DO word ack | Pending clears on the next metrics after the send, or after 5 s. |
| Disconnect | Pending commands are dropped; controls disable until reconnect. |
| Latency | On ack, a sample (`gatewayOtCommand` → `gatewayMetrics`) is recorded. |

---

## 8. Probing the live gateway

`scripts/mqtt-probe.mjs` sends a command to each function and dumps the raw
echo (value + JS type + signal `type`/`unit`) so you can confirm scale/format:

```bash
# credentials come from the app Settings (device storage is not readable here)
MQTT_URL=mqtt://<host>:<port> MQTT_USERNAME=<user> MQTT_PASSWORD=<pass> \
  node scripts/mqtt-probe.mjs pressurePump1 pressurePump2

node scripts/mqtt-probe.mjs observe 20   # subscribe only, no writes
node scripts/mqtt-probe.mjs all          # every write-enabled probe
```

Example echo line that settles the encoding question:

```
• id=6983 type=0 unit="mA" name="Total value" value=114 (number, int)   → uint ×10 (current)
• id=6983 type=0 unit="mA" name="Total value" value=11.4 (number, float) → float, send raw
```

---

## 9. Source map

| File | Responsibility |
|---|---|
| `src/lib/mqtt-topics.ts` | Config, topics, payload types, command builders, metrics parsers, pressure encoding. |
| `src/lib/bit-packed-word.ts` | Generic uint16 bit pack/unpack helpers. |
| `src/providers/mqtt-provider.tsx` | Broker connection, subscribe, publish, metrics merge/cache, latency. |
| `src/app/stations/accommodation-room.tsx` | Smoke / temperature / alarm inject + zone heating read-out. |
| `src/app/stations/pump-room.tsx` | DI/DO word (PLC tab) + pressure inject (Inject tab), bit maps. |
| `src/lib/accommodation-room-demo.ts`, `pump-room-demo.ts` | Draft defaults + local persistence. |
| `scripts/mqtt-probe.mjs` | Live gateway probe / echo dump. |
