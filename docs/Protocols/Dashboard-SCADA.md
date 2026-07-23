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

The app is **optimistic + reconciled + time-boxed**: it shows a local *draft*
immediately, publishes a command, then holds the draft until the gateway **echoes**
the value back on `metrics`. The *confirmed* value (color, chip, bar) always
follows the gateway echo, never the raw draft. Every write is tracked by the shared
**`usePendingCommand`** hook (`src/hooks/use-pending-command.ts`): if no matching
echo arrives within **5 s** (`DEFAULT_PENDING_COMMAND_TIMEOUT_MS`) the command is
declared lost and the affected state **rolls back** to the snapshot taken at send —
so a control never gets stuck disabled. Both station screens now use this, and the
pump-room TO PLC tab is no longer fire-and-forget: it **reads 7193 back** and
reconciles PT1 / PT2 / Remote Activation against the gateway echo (see §5.2, §7).

---

## 2. MQTT topics

Defined in `MQTT_TOPICS` (`src/lib/mqtt-topics.ts`). Transport is WebSocket in
dev (`ws://…/mqtt`) and TCP in standalone builds (`mqtt://` / `mqtts://`), chosen
by `getMqttRuntimeTransport()`.

| Key | Topic | Direction | QoS / retain |
|---|---|---|---|
| `gatewayMetrics` | `…/cg-uwp40-01/metrics` **+** `…/pressure-transmitter` **+** `…/acc-room/metrics` | subscribe | 0 / false |
| `gatewayOtCommand` | `epbox/imox/demo/site/batam/edge/cg-uwp40-01/cmd/ot` | publish | 0 / false |
| `appLatencyPing` | `…/cg-uwp40-01/app/latency-ping` | duplex (loopback) | 0 / false |

The gateway now **splits its metrics across three sibling topics** (same payload
shape, disjoint devices by id): `…/metrics` carries **FROM PLC 6563 + TO PLC 7193**,
`…/pressure-transmitter` carries 6983 / 7019, `…/acc-room/metrics` carries smoke /
temperature / alarm / zone. The client subscribes to all three
(`GATEWAY_METRICS_SUBSCRIBE_TOPICS`) and merges them by device id into the single
`gatewayMetrics` store — so consumers still read one snapshot. `appLatencyPing` is
an app-owned loopback probe (publish + subscribe) used to measure broker
round-trip latency in ms; it never reaches the gateway/PLC.

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
| TO PLC - SIEMENS (packed write **+ read-back**) | Counter | 7193 | `fireFightingRoom.toPlc.deviceId` | `pump-room.tsx` (TO PLC tab) |
| Pressure Transmitter - Pump 1 | Counter | 6983 | — (set-point packed into 7193 `W[0]`, read back from 7193) | `pump-room.tsx` (TO PLC tab) |
| Pressure Transmitter - Pump 2 | Counter | 7019 | — (set-point packed into 7193 `W[1]`, read back from 7193) | `pump-room.tsx` (TO PLC tab) |

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
- All accommodation controls (smoke / temperature `SetValue`, alarm
  `Acknowledgement` / `Reset` / `ResetOn` / `ResetOff`) run through the shared
  `usePendingCommand` hook: optimistic on press, resolved on a matching echo, and
  **rolled back after the 5 s timeout** if nothing comes back.

### Pump Room — FROM PLC tab (`src/app/stations/pump-room.tsx`)

**Read-only when connected.** All **16 DO channels (bits 0–15)** are **received**
from FROM PLC (6563) and bit-unpacked for display — the app never writes DO. When
MQTT is offline the tab becomes a **simulation**: each channel is **tap-to-toggle**
(ON/OFF), and the packed uint16 decimal + its bit string recompute live — so the
calculation can be cross-checked with the PLC engineer without any typing.

> Bits 14 / 15 (`pumpATripped` / `pumpBTripped`) are **display-only trip
> feedbacks** — they are shown in the DO list but do **not** disable the PT-001 /
> PT-002 controls (pressure can still be injected while a pump is tripped).

### Pump Room — TO PLC tab

| Control | Function (id) | Command | Value |
|---|---|---|---|
| PT-001 bar grid (0–16) | TO PLC (7193), word `W[0]` | `SetValue` | packed; PT1 counter = bar (1:1, see §6) |
| PT-002 bar grid (0–16) | TO PLC (7193), word `W[1]` | `SetValue` | packed; PT2 counter = bar (1:1, see §6) |
| Remote Activation / Reset button | TO PLC (7193), word `W[2]` | `SetValue` | packed; latched `1` (activate) / `0` (reset) |

Pressure is a **bar button grid (0–16 bar, integer steps)** — no mA slider. The
selected bar goes 1:1 into `W[0]` / `W[1]` (§6). PT-001 / PT-002 and Remote
Activation are all **read back** from 7193 and reconciled (§5.2): the confirmed
value follows the gateway echo, and each control is disabled while its own command
is pending.

**Remote Activation is a latched toggle, not a pulse.** The button alternates
between **Remote Activation** (writes `W[2] = 1`) and **Remote Reset** (writes
`W[2] = 0`); the held value updates only after the gateway echoes it back. The next
press's target is tracked by `nextPumpActivationValue`. Offline, pressure writes
save locally and the toggle flips locally (no publish); PT-001/PT-002 tone, bar and
the derived-alarm card read from the current draft. Derived-alarm thresholds (bar):
low `< 2`, warning `≥ 7.5`, danger `≥ 10.2`.

---

## 5. PLC registers — FROM PLC read (6563) + TO PLC packed write (7193)

The PLC is split across two registers (`docs/DO.md`) with **opposite directions** —
DO is only received, everything the app sends goes to TO PLC:

```
FROM PLC (6563)  read-only        1×uint16   W[0] = DO output status  → bit-unpacked
TO PLC   (7193)  write + read-back 4×uint16   W[0] = PT1 counter (bar, 1:1)  (uint64 packed)
                                              W[1] = PT2 counter (bar, 1:1)
                                              W[2] = Remote Activation (latched 1/0)
                                              W[3] = spare (kept 0)
```

The DO word is re-based to **bit 0** — channel 1 → bit 0, through **bit 15**; all
16 bits are functional now (bits 14/15 are the pump-trip feedbacks, no longer
spare). Every TO PLC write publishes a single packed value:

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

### Digital Outputs — bits 0–15 (received status)

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
| 14 | pumpATripped | Pump A Tripped *(display-only)* |
| 15 | pumpBTripped | Pump B Tripped *(display-only)* |

**Read path (FROM PLC 6563):** the DO channels are **display-only**. The counter
value is rounded, masked to uint16, and bit-unpacked into the 16 indicators — the
app never writes DO. Offline, the word is built by tapping channels on/off
(`toggleDoChannel` → `setChannelBit`) instead of coming from metrics.

**Write path (TO PLC 7193):** each control sends one packed `SetValue(7193)` via
`sendToPlcCommand`. A pressure change packs the new bar into its word; the Remote
Activation / Reset button packs `W[2] = 1` or `0`. Every write carries all 4 words —
unchanged words are pulled from the latest draft (`injectDraftRef`) and the current
latched `remoteActivationValue`, so no word is clobbered. The command then waits for
the 7193 read-back to confirm it (§5.2). Offline, writes are computed/held locally
(no publish).

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

**Worked example** — set PT1 = 7 bar, PT2 = 4 bar, with Remote Activation latched
on:

| Word | Raw | Meaning | Contribution |
|---|---|---|---|
| `W0` | `7` | PT1 7 bar (1:1) | `7` |
| `W1` | `4` | PT2 4 bar (1:1) | `4 × 65536 = 262,144` |
| `W2` | `1` | Remote Activation (latched) | `1 × 2^32 = 4,294,967,296` |
| `W3` | `0` | spare | `0` |

→ `value = 4,295,229,447`, published as
`{"id":7193,"cmd":"SetValue","value":4295229447}`. The gateway splits it back to
`[7, 4, 1, 0]`. A Remote Reset (or the read-back after one) carries `W2 = 0` →
`[7, 4, 0, 0]`.

**Two rules that make this safe:**

1. **Multiply, don't shift.** JS bitwise ops (`<<`, `&`, `|`) are 32-bit only, so
   `W2 << 32` wraps to `W2`. Words at offset ≥32 must be placed with `× 2**32`.
   That's why `joinWords` / `splitWords` use `Math.floor` + `/` + `*`, not shifts.
2. **Never clobber the other words.** One `SetValue` overwrites the *whole*
   register, so every write must carry all 4 words. A control changing one field
   pulls the rest from the latest draft (`injectDraftRef.current`) and the current
   latched `remoteActivationValue`. Otherwise a pressure write would flip Remote
   Activation, or a toggle would wipe the pressure set-points.

**By words, combined per write** — e.g. a pressure change:

```
slider → packToPlcCommand (by words → W0 + W1 + W2)
       → SetValue(7193, packed)
```

**JS-safe without BigInt.** `4,300,210,290` ≪ `Number.MAX_SAFE_INTEGER`
(`2^53 ≈ 9.0e15`). As long as `W3` (spare) stays 0, the value is < `2^48`, so a
plain `number` is exact. If W3 ever carries high bits, switch to `BigInt`.

### 5.2 Optimistic write → 5 s timeout → rollback, with 7193 read-back

Every TO PLC write is tracked as a **pending command** (`usePendingCommand`, ids
`to-plc:pressurePump1` / `to-plc:pressurePump2` / `to-plc:pumpActivation`). The
control that issued it is disabled while pending. Resolution is driven purely by the
**7193 read-back** in the metrics stream:

- **Success.** On each metrics snapshot the app unpacks `value(7193)` back to its 4
  words. A pressure command is acked when the echo is *fresh* (`receivedAt` past the
  send) **and** the whole packed value equals what it sent (`expectedPacked ===
  round(value(7193))`); a Remote Activation command is acked as soon as a fresh echo
  arrives. On ack the confirmed pressure / latched `remoteActivationValue` are
  committed from the read-back and the pending entry clears.
- **Reconcile when idle.** For any field with **no** pending command, the confirmed
  value simply *follows* the read-back — PT1/PT2 bar and Remote Activation track
  whatever 7193 currently reports, so a write from another client (or the PLC) is
  reflected without a local edit.
- **Timeout (5 s).** If no qualifying echo arrives within
  `DEFAULT_PENDING_COMMAND_TIMEOUT_MS`, the command is lost: pressure rolls its draft
  **and** confirmed value back to the pre-send snapshot; Remote Activation reverts to
  its previous latched value. The pump-room surfaces this as a brief status hint
  (`… timed out. Rolled back.`) that auto-clears — it does not block.
- **Disconnect.** Dropping out of `connected` resolves all in-flight commands via the
  rollback path, so nothing stays stuck pending.

A pressure control is disabled **only while its own write is pending**; the
pump-trip DO bits (14/15) are display-only and never block a pressure inject.

---

## 6. Pressure transmitter bar encoding

The PLC expects the set-point in the engineering unit **bar**. The transmitter maps
`4 mA → 0 bar`, `20 mA → 16 bar` (`bar = mA − 4`), but the UI now works **directly in
bar** — a button grid of integer steps `0…16` (`PRESSURE_MIN_BAR` / `PRESSURE_MAX_BAR`),
no mA slider. The selected bar goes into `W[0]` / `W[1]` **1:1** — the counter word
*is* the bar value:

```
write:  counter = round(bar)     // 7 bar → 7 in W[0]/W[1]  (read-back: bar = word)
```

- Zero point `PRESSURE_MA_ZERO_BAR = 4` (kept only so a value typed with a `mA`
  suffix is converted via `bar = mA − 4`; the grid itself is already in bar).
- Helper: `pressureBarToCounter(bar) = Math.round(bar)` in `src/lib/mqtt-topics.ts`
  (the earlier `× 10` scale was removed — the counter is raw bar now).

> ⚠️ Confirm the PLC reads `W[0]/W[1]` as **raw bar** (1:1) with the probe (§9)
> before trusting a live gateway — if it actually expects bar × 10, restore the
> scale in `pressureBarToCounter`.

---

## 7. Reconciliation rules

| Concern | Rule |
|---|---|
| DO status (FROM PLC) | Receive-only — bit-unpacked from 6563 metrics for display; the app never writes DO, so nothing to reconcile. |
| Pressure (TO PLC W0/W1) | Optimistic + read-back: confirmed value follows the 7193 echo; while a write is pending it acks on `expectedPacked === round(value(7193))` and **rolls back after 5 s** if unmatched (§5.2). |
| Remote Activation (TO PLC W2) | Latched toggle — writes `1`/`0`, holds the value only after a fresh 7193 read-back confirms it; **rolls back after 5 s** on no echo. Idle, it tracks the read-back. |
| Counter ack (accommodation) | Pending clears on a matching echo (temperature: exact int); otherwise the value rolls back after the 5 s timeout. |
| Alarm ack | Pending clears when metrics arrive after the send; otherwise rolled back after the 5 s timeout. |
| Command timeout | All writes go through `usePendingCommand` — no matching echo within 5 s ⇒ the control's state is restored to the pre-send snapshot (never stuck). |
| Offline → simulation | With MQTT down the pump room computes pack/unpack locally (FROM PLC word built by tapping channels on/off; TO PLC pressure saved locally, Remote Activation toggled locally, nothing published). |

---

## 8. Dashboard client — FROM PLC display + TO PLC read-back

The custom SCADA dashboard is a **second MQTT client** on the same gateway. Both
PLC registers live on the `…/metrics` topic, so subscribing to it delivers **both**
in every snapshot — no separate feed is needed:

| Register | id | Dashboard use | Direction |
|---|---|---|---|
| FROM PLC | 6563 | DO status — live plant state, bit-unpacked to 16 indicators | receive |
| TO PLC | 7193 | Read-back of the last command — unpack the 4 words to verify PT1 / PT2 / Remote Activation | receive (+ write) |

> The dashboard is also the **authoritative writer of Remote Activation** — per
> [`docs/DO.md`](../DO.md), `W[2]` is sent from the dashboard; the mobile app's
> button mirrors and read-back-reconciles it. Note the mobile app **also reads 7193
> back** now (it is no longer write-only). Any client writing 7193 must carry all 4
> words (§5.1 clobber rule).

### 8.1 FROM PLC (6563) → DO indicators

Read the counter numeric value (`Total value`), `Math.round`, mask to uint16, then
bit-unpack with the shared `DO_BIT_MAP`. Suggested operator grouping:

| Group | Bits | Channels | Interpretation |
|---|---|---|---|
| Pumps | 0, 1, 11 | Pump A / B / C Running | running feedback (`1` = running) |
| SV1 | 2, 3 | SV1 Opened / Closed | limit feedback — `10` open, `01` closed, `00` mid-travel, `11` sensor fault |
| SV2 | 4, 5 | SV2 Opened / Closed | same convention as SV1 |
| Zones | 6, 7 | Local / Remote Zone Activation | which zone triggered |
| Fire / tank | 8, 9, 10 | FGS Confirmed Fire, Level Tank High / Low | plant safety inputs |
| Mode | 12, 13 | Local / Remote Mode | mutually exclusive — `01`/`10` normal, `00`/`11` mode fault |
| Trips | 14, 15 | Pump A / B Tripped | `1` = tripped (display-only feedback) |

```
word = round(counter(6563)) & 0xFFFF
DO   = unpackChannels([word], DO_BIT_MAP)   // { pumpARunning: bool, … }
```

### 8.2 TO PLC (7193) → read-back / verification

The same snapshot also carries the last value written to 7193 (the app treats it as
write-only, but the gateway still echoes it as a Counter). Unpack it back into its
4 words to show the operator the currently-commanded set-points — regardless of
which client issued them:

```
words   = splitWords(value(7193), 4)          // [W0, W1, W2, W3]
PT1_bar = words[0]        → PT1_mA = PT1_bar + 4   // counter is raw bar (1:1)
PT2_bar = words[1]        → PT2_mA = PT2_bar + 4
remote  = words[2]                            // 1 = Remote Activation latched, 0 = reset
```

- PT1 / PT2 decode is the inverse of §6 (`bar = counter`, `mA = bar + 4`).
- `W[2]` is the **latched** Remote Activation state (`1` held while active, `0` after
  reset) — not a transient pulse.
- `W[3]` is spare (`0`).

Worked example (inverse of §5.1): read-back `4,295,229,447` → `splitWords` →
`[7, 4, 1, 0]` → PT1 `7 bar` (11 mA), PT2 `4 bar` (8 mA), Remote Activation `ON`,
spare `0`.

### 8.3 Two writers, one register — staying in sync

Both the dashboard and the mobile app write 7193, and **both now read it back**, so
each must reconcile its own state from the TO PLC read-back (§8.2, §5.2) on connect
and on every relevant metrics snapshot. Otherwise a write from one client — which
re-sends all 4 words from its local draft plus the latched Remote Activation — would
overwrite the other's set-point. The read-back is the single re-sync point; there is
no separate handshake. Each client only holds a field against the read-back while
its own write for that field is still pending (the un-acked window).

---

## 9. Probing the live gateway

`scripts/mqtt-probe.mjs` sends a command to each function and dumps the raw
echo (value + JS type + signal `type`/`unit`) so you can confirm scale/format:

```bash
# credentials come from the app Settings (device storage is not readable here)
MQTT_URL=mqtt://<host>:<port> MQTT_USERNAME=<user> MQTT_PASSWORD=<pass> \
  node scripts/mqtt-probe.mjs pressurePump1 pressurePump2

node scripts/mqtt-probe.mjs observe 20   # subscribe only, no writes
node scripts/mqtt-probe.mjs all          # every write-enabled probe
```

Example — read 7193 back after injecting PT1 = 7 bar to confirm the 1:1 bar scale:

```
• id=7193 name="Total value" value=7 (number, int)   → splitWords → W0=7  → 7 bar   (current: raw bar 1:1)
• id=7193 name="Total value" value=70 (number, int)  → splitWords → W0=70 → would mean bar×10 (restore scale)
```

---

## 10. Source map

| File | Responsibility |
|---|---|
| `src/lib/mqtt-topics.ts` | Config, topics, payload types, command builders, metrics parsers, pressure encoding. |
| `src/lib/bit-packed-word.ts` | Generic uint16 bit pack/unpack helpers. |
| `src/hooks/use-pending-command.ts` | Shared optimistic-command tracker: start / resolve / timeout (5 s) → rollback. |
| `src/providers/mqtt-provider.tsx` | Broker connection, split-metrics subscribe + merge/cache, publish, loopback latency ping. |
| `src/app/stations/accommodation-room.tsx` | Smoke / temperature / alarm inject (pending-command) + zone heating read-out. |
| `src/app/stations/pump-room.tsx` | DO read (6563) + packed TO PLC write **& read-back** (7193): pressure (bar), Remote Activation toggle, bit maps, interlocks. |
| `src/lib/accommodation-room-demo.ts`, `pump-room-demo.ts` | Draft defaults + local persistence. |
| `scripts/mqtt-probe.mjs` | Live gateway probe / echo dump. |
