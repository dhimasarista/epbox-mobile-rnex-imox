# Custom SCADA Dashboard — CG-UWP40 Integration Reference

Single reference for the mobile app's custom SCADA station screens: which values
are **injected**, how the **DO word is packed / unpacked**, the **MQTT** topics /
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
| FROM PLC - SIEMENS (DO status, read) | Counter | 6563 | `fireFightingRoom.fromPlc.deviceId` | `pump-room.tsx` (FROM PLC tab) |
| TO PLC - SIEMENS (packed write) | Counter | 7193 | `fireFightingRoom.toPlc.deviceId` | `pump-room.tsx` (TO PLC tab) |
| Pressure Transmitter - Pump 1 | Counter | 6983 | — (inject-only, packed into 7193 `W[0]`) | `pump-room.tsx` (TO PLC tab) |
| Pressure Transmitter - Pump 2 | Counter | 7019 | — (inject-only, packed into 7193 `W[1]`) | `pump-room.tsx` (TO PLC tab) |

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

### Pump Room — FROM PLC tab (`src/app/stations/pump-room.tsx`)

**Read-only.** The 14 DO channels are **received** from FROM PLC (6563) and
bit-unpacked for display — the app never writes DO. When MQTT is offline the tab
becomes a **simulation**: the user types a raw uint16 decimal and the same
unpacking runs live, to verify the bit calculation.

### Pump Room — TO PLC tab

| Control | Function (id) | Command | Value |
|---|---|---|---|
| PT-001 slider | TO PLC (7193), word `W[0]` | `SetValue` | packed; PT1 = mA × 10 (see §6) |
| PT-002 slider | TO PLC (7193), word `W[1]` | `SetValue` | packed; PT2 = mA × 10 (see §6) |
| Pump Activation button | TO PLC (7193), word `W[2]` | `SetValue` | packed; momentary `1` (one-shot) |

Pressure is **inject-only** — set-points packed into TO PLC `W[0]`/`W[1]`, no
read-back (persisted locally; tone / bar / derived-alarm read from the slider).
**Pump Activation** is a momentary command: the button fires one `SetValue` with
`W[2] = 1`; it is never held or reset to 0 by the app (normal pressure writes send
`W[2] = 0`). Offline, both just compute the packed value locally (no publish).

---

## 5. PLC registers — FROM PLC read (6563) + TO PLC packed write (7193)

The PLC is split across two registers (`docs/DO.md`) with **opposite directions** —
DO is only received, everything the app sends goes to TO PLC:

```
FROM PLC (6563)  read-only   1×uint16   W[0] = DO output status  → bit-unpacked
TO PLC   (7193)  write only  4×uint16   W[0] = PT1 counter (mA×10)  (uint64 packed)
                                        W[1] = PT2 counter (mA×10)
                                        W[2] = Pump Activation (momentary 1)
                                        W[3] = spare (kept 0)
```

The DO word is re-based to **bit 0** — channel 1 → bit 0, up to bit 13; bits
14..15 spare. Every TO PLC write publishes a single packed value:

```
SetValue(7193) = W0 + W1·2^16 + W2·2^32     // W3 = 0, so value < 2^48 (JS-safe)
```

Decoding is a two-layer job — **by words**, then **by bit**:

- **By words** (`splitWords` / `joinWords`, `src/lib/bit-packed-word.ts`): split a
  register decimal into its `W[0..n]` uint16 words, or join them back. JS bitwise
  ops are 32-bit, so words at offset ≥32 are placed by division/multiplication
  (`2**32`), never `<<`/`>>`. `packToPlcCommand` / `unpackToPlcCommand`
  (`mqtt-topics.ts`) wrap this for the 4-word TO PLC value.
- **By bit** (`unpackChannels` / `getChannelBit`): unpack a single word into named
  DO channels. Each word is forced to **uint16** first — bit15 is a flag, not a
  sign bit. The bit map is caller-supplied (`DO_BIT_MAP` in `pump-room.tsx`, mask
  `DO_WORD_MASK = 0xffff`).

FROM PLC (6563) is 1 word → by-bit only (receive). TO PLC (7193) is 4 words →
by-words (send). Source of the mapping: [`docs/DO.md`](../DO.md).

### Digital Outputs — bits 0–13 (received status)

| Bit | Key | Label |
|---|---|---|
| 0 | pumpARunning | Pump A Running |
| 1 | pumpBRunning | Pump B Running |
| 2 | sv1Opened | SV1 Opened |
| 3 | sv1Closed | SV1 Closed |
| 4 | sv2Opened | SV2 Opened |
| 5 | sv2Closed | SV2 Closed |
| 6 | localZoneActivation | Local Zone Activation |
| 7 | remoteZoneActivation | Remote Zone Activation |
| 8 | fgsConfFire | FGS Confirmed Fire |
| 9 | levelTankHigh | Level Tank High |
| 10 | levelTankLow | Level Tank Low |
| 11 | pumpCRunning | Pump C Running |
| 12 | localMode | Local Mode |
| 13 | remoteMode | Remote Mode |
| 14–15 | — | *spare* |

**Read path (FROM PLC 6563):** the DO channels are **display-only**. The counter
value is rounded, masked to uint16, and bit-unpacked into the 14 indicators — the
app never writes DO. Offline, the value comes from the simulation input instead of
metrics (`parseWordInput`).

**Write path (TO PLC 7193):** a pressure slider publishes
`publishToPlc({ pressurePumpNMa })`; the Pump Activation button publishes
`publishToPlc({ pumpActivation: 1 })` once (momentary). Unchanged words are always
pulled from the latest draft (`injectDraftRef`) so no word is clobbered, and
`pumpActivation` defaults to `0` on ordinary writes so the one-shot never sticks
on. Offline, writes are computed locally (no publish).

### 5.1 Sending a value — the 4-word packing, worked through

Only **TO PLC (7193)** is ever written; FROM PLC (6563) is read-only. The problem
to solve: an MQTT command carries exactly **one number**…

```json
{ "id": 7193, "cmd": "SetValue", "value": <one number> }
```

…but the register is **4 words**. So the four 16-bit words must be folded into one
integer (the gateway unfolds them back into 4 modbus registers). Think of it as a
number in "base 65536", with `W[0]` as the least-significant word:

```
value = W0 + W1·2^16 + W2·2^32 + W3·2^48
```

**Worked example** — set PT1 = 11.4 mA, PT2 = 8.0 mA, and fire Pump Activation:

| Word | Raw | Meaning | Contribution |
|---|---|---|---|
| `W0` | `114` | PT1 11.4 mA × 10 | `114` |
| `W1` | `80` | PT2 8.0 mA × 10 | `80 × 65536 = 5,242,880` |
| `W2` | `1` | Pump Activation (momentary) | `1 × 2^32 = 4,294,967,296` |
| `W3` | `0` | spare | `0` |

→ `value = 4,300,210,290`, published as
`{"id":7193,"cmd":"SetValue","value":4300210290}`. The gateway splits it back to
`[114, 80, 1, 0]`. An ordinary pressure write sends `W2 = 0` → `[114, 80, 0, 0]`.

**Two rules that make this safe:**

1. **Multiply, don't shift.** JS bitwise ops (`<<`, `&`, `|`) are 32-bit only, so
   `W2 << 32` wraps to `W2`. Words at offset ≥32 must be placed with `× 2**32`.
   That's why `joinWords` / `splitWords` use `Math.floor` + `/` + `*`, not shifts.
2. **Never clobber the other words.** One `SetValue` overwrites the *whole*
   register, so every write must carry all 4 words. A control changing one field
   pulls the rest from the latest draft (`injectDraftRef.current` in
   `publishToPlc`), and `pumpActivation` defaults to `0`. Otherwise a pressure
   write would fire Pump Activation, or leave it latched on.

**By words, combined per write** — e.g. a pressure change:

```
slider → packToPlcCommand (by words → W0 + W1 + W2)
       → SetValue(7193, packed)
```

**JS-safe without BigInt.** `4,300,210,290` ≪ `Number.MAX_SAFE_INTEGER`
(`2^53 ≈ 9.0e15`). As long as `W3` (spare) stays 0, the value is < `2^48`, so a
plain `number` is exact. If W3 ever carries high bits, switch to `BigInt`.

---

## 6. Pressure transmitter mA encoding

Each pressure word (`W[0]` / `W[1]` of the TO PLC value) is an **unsigned integer**
— it cannot store a fractional mA. To keep the 0.1 mA slider resolution the app
encodes the set-point before packing (inject-only, so write direction only):

```
write:  counter = round(mA × 10)      // 11.4 mA → 114 in W[0]/W[1]
```

- Scale constant: `PRESSURE_MA_COUNTER_SCALE = 10` (one knob).
- Helper: `pressureMaToCounter` (`src/lib/mqtt-topics.ts`).

> ⚠️ Confirm the PLC interprets `W[0]/W[1]` as mA × 10 with the probe (§8) before
> trusting this on a live gateway — if it expects raw mA, drop the scale to 1.

---

## 7. Reconciliation rules

| Concern | Rule |
|---|---|
| DO status (FROM PLC) | Receive-only — bit-unpacked from 6563 metrics for display; the app never writes DO, so nothing to reconcile. |
| Pressure (inject-only) | No echo/reconcile — the slider value is authoritative and persisted locally. |
| Pump Activation | Momentary one-shot — publishes `W[2]=1` once; no ack, next write sends `W[2]=0`. |
| Counter ack (accommodation) | Pending clears when metrics echo matches expected (temperature: exact int). |
| Alarm ack | Pending clears when metrics arrive after the send, or after a 5 s silent guard. |
| Offline → simulation | With MQTT down the pump room computes pack/unpack locally (FROM PLC from a typed value, TO PLC shown but not published). |

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
| `src/app/stations/pump-room.tsx` | DO read (6563) + packed TO PLC write (7193) for DO & pressure, bit maps. |
| `src/lib/accommodation-room-demo.ts`, `pump-room-demo.ts` | Draft defaults + local persistence. |
| `scripts/mqtt-probe.mjs` | Live gateway probe / echo dump. |
