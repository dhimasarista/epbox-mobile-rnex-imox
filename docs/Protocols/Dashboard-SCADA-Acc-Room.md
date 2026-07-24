# Accommodation Room — Dashboard / MQTT Integration Reference

End-to-end reference for the **Accommodation Room** station
(`src/app/stations/accommodation-room.tsx`): every value it **reads** from the
gateway, every command it **writes**, the exact **MQTT topics / JSON payloads**,
and the **optimistic → reconcile → timeout** lifecycle. Written for whoever builds
the dashboard / gateway side that has to answer these commands.

- Gateway: **Carlo Gavazzi UWP4.0**, edge id `cg-uwp40-01`, site `demo/site/batam`,
  namespace `epbox/imox`. Topic root: `epbox/imox/demo/site/batam/edge/cg-uwp40-01`.
- Single source of truth in code: `CARLO_GAVAZZI_GATEWAY_CONFIG.accommodationRoom`
  in `src/lib/mqtt-topics.ts`. The screen never hard-codes ids.
- Sibling docs: [`Dashboard-SCADA.md`](./Dashboard-SCADA.md) (pump room / DO word),
  [`MQTT.md`](./MQTT.md) (full command catalog per UWP function).

---

## 1. Device / register map (accommodation room)

All four devices arrive on the **`…/acc-room/metrics`** topic (one of the three
metrics siblings). The app merges them into the single `gatewayMetrics` store.

| Purpose | Device / counter id | Direction | Read as | Written by |
|---|---|---|---|---|
| **Smoke status** | `3549` (`counterIds.smokeStatus`) | read + write | boolean (`value ≥ 0.5`) | `SetValue 0/1` |
| **Zone temperature** | `3585` (`counterIds.temperature`) | read + write | number °C (rounded) | `SetValue <°C>` |
| **Alarm / siren** | `3667` (`alarm.deviceId`) | read + write | status code 1–6 + siren bool | alarm cmd (Ack/Reset/…) |
| **Zone heating** | `4147` (`zoneTemperature.deviceId`) | read-only | 6 heating signals | — (display only) |

Smoke and temperature are **round-trip** counters: the app writes a `SetValue` and
waits for the same value to come back on metrics. Alarm is a **command register**:
the app fires Ack/Reset actions and waits for the next fresh metrics snapshot. Zone
heating is **read-only** telemetry (shown in the "Heating Detail" modal).

---

## 2. MQTT topics

Defined in `MQTT_TOPICS`. Transport is WebSocket in dev (`ws://…/mqtt`) and TCP in
standalone builds (`mqtt://` / `mqtts://`), picked by `getMqttRuntimeTransport()`.

| Key | Topic | Direction | QoS / retain |
|---|---|---|---|
| `gatewayMetrics` | `…/acc-room/metrics` (+ `…/metrics`, `…/pressure-transmitter`) | subscribe | 0 / false |
| `gatewayOtCommand` | `…/cg-uwp40-01/cmd/ot` | publish | 0 / false |

The screen subscribes via `useMqttTopic('gatewayMetrics')` and publishes via
`publishTopic('gatewayOtCommand', …)`. All payloads are JSON.

---

## 3. Data flow

```
 Accommodation Room screen                        CG-UWP40 gateway
 ─────────────────────────                        ────────────────
   Smoke toggle / Temp slider / Alarm button
        │  publishTopic('gatewayOtCommand', …)
        ▼
   …/cg-uwp40-01/cmd/ot  ─────────────────────▶   UWP Counter (3549 / 3585)
                                                   UWP Alarm   (3667)
                                                        │  applies value / action
   …/acc-room/metrics    ◀─────────────────────   device signal snapshot (echo)
        │  parse → getAccommodationRoom*State()
        ▼
   reconcile (usePendingCommand) → confirmedForm → chips / tones / status lamps
```

The screen is **optimistic + reconciled + time-boxed**:

1. **Optimistic** — pressing a control updates `draftForm` immediately and disables
   the control (pending).
2. **Publish** — the JSON command is sent to `…/cmd/ot`.
3. **Reconcile** — the command is tracked by **`usePendingCommand`**
   (`src/hooks/use-pending-command.ts`). When a **fresh** metrics snapshot arrives
   (received *after* the send) that matches the expectation, the command resolves,
   `confirmedForm` adopts the gateway value, and an RTT latency sample is recorded.
4. **Timeout** — if no matching echo arrives within **5 s**
   (`DEFAULT_PENDING_COMMAND_TIMEOUT_MS`) the command is declared lost. Counter
   commands **roll back** to the snapshot taken at send; alarm commands simply
   re-enable the button (silent — no rollback needed). A control is never left
   stuck disabled.

"Fresh" = `metricsReceivedAt > baselineReceivedAt` (the receive time captured when
the command was sent), or `>= startedAt` if no baseline existed yet.

---

## 4. Reads — decoding metrics

### 4.1 Smoke + temperature — `getAccommodationRoomMetricsState(payload)`
- **Smoke** (device `3549`): numeric counter value → `smokeDetected = value ≥ 0.5`.
- **Temperature** (device `3585`): numeric counter value → `Math.round(value)` °C.
- Counter value is read from the first present of signal names
  `Total value` → `Adjustable value` → `Input value`, else the first numeric signal.

### 4.2 Alarm + siren — `getAccommodationRoomAlarmState(payload)`
Device `3667`, by signal **name**:
- `Alarm status` → rounded to a code **1–6** (see table below); anything else → `null`.
- `Siren status` → `sirenOn = value ≥ 0.5`.
- `outputs[]` = the 6 status options, each flagged `active` when its code equals the
  current `alarmStatusCode` (this is the list rendered as the status rows).

| Code | Label | UI tone |
|---|---|---|
| 1 | Alarm OFF | normal (Off) |
| 2 | Alarm ON | danger |
| 3 | Alarm was ON | warning |
| 4 | Acknowledged, alarm ON | danger |
| 5 | Acknowledged, alarm was ON | warning |
| 6 | Reset alarm | warning |

Tone rule (`getAccommodationAlarmTone`): danger if `sirenOn` or code ∈ {2,4};
warning if code ∈ {3,5,6}; else normal. The three lamps (Off / On / Siren) light
from this.

### 4.3 Zone heating — `getAccommodationRoomZoneHeatingState(payload)`
Read-only telemetry from device `4147`, by signal name:

| Field | Signal name | Notes |
|---|---|---|
| `heatingControlAnalogueValue` | `Heating control analogue signal` | value + unit (e.g. `%`) |
| `heatingSetPointValue` | `Heating set point signal` | value + unit (e.g. `°C`) |
| `heatingControlStatusValue` | `Heating control status signal` | `≥ 0.5` → ON (`heatingControlOn`) |
| `heatingSetPointSelectedValue` | `Heating set point selected signal` | 1=OFF, 2=SP1, 3=SP2, 4=SP3 |
| `heatingStatusValue` | `Heating status signal` | label table 1–17; **12 = Antifreeze** |
| `statusValue` | `Status signal` | `≥ 0.5` → ON |

`heatingControlOn` drives the 🔥 fire chip; `heatingStatusValue === 12` shows the
"Antifreeze Active" badge.

---

## 5. Writes — commands published to `…/cmd/ot`

All commands are built in `mqtt-topics.ts` and published as JSON via
`publishTopic('gatewayOtCommand', …)`.

### 5.1 Smoke status (counter `3549`)
Toggling the Smoke switch sends immediately (no debounce):

```jsonc
// buildCarloGavazziOtCommand(3549, 'SetValue', 1)   // Detected
{ "id": 3549, "cmd": "SetValue", "value": 1 }
// buildCarloGavazziOtCommand(3549, 'SetValue', 0)   // Clear
{ "id": 3549, "cmd": "SetValue", "value": 0 }
```
Ack when metrics echoes `3549` with `value ≥ 0.5` matching the sent 1/0.

### 5.2 Zone temperature (counter `3585`)
The slider debounces **250 ms** (`COMMAND_DEBOUNCE_MS`), then sends the rounded °C:

```jsonc
// buildCarloGavazziOtCommand(3585, 'SetValue', 45)
{ "id": 3585, "cmd": "SetValue", "value": 45 }
```
Ack when metrics echoes `3585` with the **same rounded integer** value. The chip /
dot / tone follow the *confirmed* (echoed) value, not the live slider draft.

### 5.3 Alarm commands (device `3667`)
Four buttons are live (Acknowledge, Reset, Reset ON, Reset OFF); `TestAlarmOn` /
`TestAlarmOff` exist in the type but are commented out in the UI.

```jsonc
// buildCarloGavazziAlarmCommand(3667, 'Acknowledgement')
{ "id": 3667, "cmd": "Acknowledgement" }
{ "id": 3667, "cmd": "Reset" }
{ "id": 3667, "cmd": "ResetOn" }
{ "id": 3667, "cmd": "ResetOff" }
```
Command names (`CarloGavazziAlarmCommandName`): `Acknowledgement`, `Reset`,
`ResetOn`, `ResetOff`, `TestAlarmOn`, `TestAlarmOff`.

Alarm commands do **not** carry a value and are **not** matched to a specific
expected metric — they resolve on the **next fresh metrics snapshot** after send
(the gateway is expected to publish new alarm/siren status). Each pending alarm
button shows a **5 → 0 s countdown**; on timeout the button simply re-enables (the
command is treated as lost/silent, no state rollback).

---

## 6. Command lifecycle summary

| Control | id | Payload | Ack condition | On 5 s timeout |
|---|---|---|---|---|
| Smoke toggle | 3549 | `SetValue 0/1` | fresh metrics, `3549` value == sent 0/1 | roll back to snapshot |
| Temperature slider | 3585 | `SetValue <°C>` | fresh metrics, `3585` round == sent °C | roll back to snapshot |
| Acknowledge / Reset / Reset ON / Reset OFF | 3667 | alarm cmd | next fresh metrics after send | re-enable button (silent) |

Disconnect (`status !== 'connected'`) resolves every pending command through the
rollback path so no control stays disabled while offline. While offline, counter
edits are held locally and the buttons report "MQTT disconnected".

---

## 7. Envelope & serialization

`publishTopic` serializes the payload object to JSON and publishes to
`…/cg-uwp40-01/cmd/ot` at QoS 0, retain false. Metrics are parsed with `JSON.parse`
and merged (union by device id) across the three metrics topics before decoding.

A metrics device/signal snapshot looks like:

```jsonc
{
  "ip": "…", "sn": "…", "mac": "…", "time": "…",
  "devices": [
    { "id": 3667, "name": "…", "pn": "…", "signals": [
        { "id": …, "name": "Alarm status", "time": 1690000000, "value": 2, "unit": "", "type": … },
        { "id": …, "name": "Siren status", "time": 1690000000, "value": 1, "unit": "", "type": … }
    ] }
  ]
}
```

Signals are matched by **`name`** for alarm/heating, and by preferred counter signal
names for smoke/temperature — never by array position.

---

## 8. Source map

| Concern | Location |
|---|---|
| Screen UI + reconcile logic | `src/app/stations/accommodation-room.tsx` |
| Ids / signal names | `CARLO_GAVAZZI_GATEWAY_CONFIG.accommodationRoom` in `src/lib/mqtt-topics.ts` |
| Decoders | `getAccommodationRoomMetricsState` / `…AlarmState` / `…ZoneHeatingState` |
| Command builders | `buildCarloGavazziOtCommand`, `buildCarloGavazziAlarmCommand` |
| Alarm status codes | `ACCOMMODATION_ROOM_ALARM_STATUS_OPTIONS` |
| Pending / timeout hook | `src/hooks/use-pending-command.ts` (`DEFAULT_PENDING_COMMAND_TIMEOUT_MS = 5000`) |
| MQTT transport / provider | `src/providers/mqtt-provider.tsx`, `src/lib/mqtt-settings.ts` |
