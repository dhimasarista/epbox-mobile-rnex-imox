import { formatAccommodationTemperature } from '@/lib/accommodation-room-demo';
import { joinWords, splitWords } from '@/lib/bit-packed-word';

export type MqttTopicDirection = 'publish' | 'subscribe' | 'duplex';
export type MqttTopicQos = 0 | 1 | 2;
export type MqttFlexiblePayload =
  | string
  | number
  | boolean
  | null
  | Record<string, unknown>
  | unknown[];

export type CarloGavazziOtValueCommandName = 'Increase' | 'Decrease' | 'SetValue';
export type CarloGavazziOtActionCommandName =
  | 'ResetValue'
  | 'Freeze'
  | 'Unfreeze'
  | 'FreezeUnfreezeToggle'
  | 'ResetRollover';
export type CarloGavazziOtCommandName =
  | CarloGavazziOtValueCommandName
  | CarloGavazziOtActionCommandName;
export type CarloGavazziAlarmCommandName =
  | 'Acknowledgement'
  | 'Reset'
  | 'ResetOn'
  | 'ResetOff'
  | 'TestAlarmOn'
  | 'TestAlarmOff';
export type CarloGavazziSwitchCommandName = 'On' | 'Off' | 'OnTimeout' | 'OnOffToggle';
// Force commands override the UWP function's "Running" automation logic, which otherwise
// keeps overwriting manual output changes. Highest priority over both automation and plain On/Off.
export type CarloGavazziForceCommandName = 'ForceOn' | 'ForceOff';
export type CarloGavazziAlarmStatusCode = 1 | 2 | 3 | 4 | 5 | 6;

export type CarloGavazziCounterCommandPayload =
  | {
      id: number;
      cmd: CarloGavazziOtValueCommandName;
      value: number;
    }
  | {
      id: number;
      cmd: CarloGavazziOtActionCommandName;
    };
export type CarloGavazziAlarmCommandPayload = {
  id: number;
  cmd: CarloGavazziAlarmCommandName;
};
export type CarloGavazziSwitchCommandPayload = {
  id: number;
  cmd: CarloGavazziSwitchCommandName;
};
export type CarloGavazziForceCommandPayload = {
  id: number;
  cmd: CarloGavazziForceCommandName;
  // Force ON carries the word value to force-write (e.g. the bit-packed DO
  // word). Force OFF releases the force override; value is unused for OFF
  // but kept required so callers always send the current known word.
  value: number;
};
export type CarloGavazziGatewayCommandPayload =
  | CarloGavazziCounterCommandPayload
  | CarloGavazziAlarmCommandPayload
  | CarloGavazziSwitchCommandPayload
  | CarloGavazziForceCommandPayload;

export type CarloGavazziMetricsSignal = {
  id: number;
  name: string;
  time: number;
  value: number | string | boolean | null;
  unit: string;
  type: number;
};

export type CarloGavazziMetricsDevice = {
  id: number;
  name: string;
  pn: string;
  signals: CarloGavazziMetricsSignal[];
};

export type CarloGavazziMetricsPayload = {
  ip: string;
  sn: string;
  mac: string;
  time: string;
  devices: CarloGavazziMetricsDevice[];
};

export type AccommodationRoomZoneHeatingState = {
  heatingControlAnalogueValue: number | null;
  heatingControlAnalogueUnit: string;
  heatingSetPointValue: number | null;
  heatingSetPointUnit: string;
  heatingControlStatusValue: number | null;
  heatingControlStatusLabel: string;
  heatingControlOn: boolean;
  heatingSetPointSelectedValue: number | null;
  heatingSetPointSelectedLabel: string;
  heatingStatusValue: number | null;
  heatingStatusLabel: string;
  statusValue: number | null;
  statusLabel: string;
};

export type MqttTopicPayloadMap = {
  gatewayMetrics: CarloGavazziMetricsPayload;
  gatewayOtCommand: CarloGavazziGatewayCommandPayload;
};

export type MqttTopicKey = keyof MqttTopicPayloadMap;

type TopicDefinitionConfig<TKey extends MqttTopicKey> = {
  key: TKey;
  topic: string;
  label: string;
  description: string;
  direction: MqttTopicDirection;
  qos?: MqttTopicQos;
  retain?: boolean;
};

export type MqttTopicDefinition<TKey extends MqttTopicKey = MqttTopicKey> =
  TopicDefinitionConfig<TKey> & {
    parse: (message: string) => MqttTopicPayloadMap[TKey];
    serialize: (payload: MqttTopicPayloadMap[TKey]) => string;
  };

// Keep gateway path and counter ids in one place so config changes stay easy.
export const CARLO_GAVAZZI_GATEWAY_CONFIG = {
  topicRoot: 'epbox/imox/demo/site/batam/edge/cg-uwp40-01',
  localZoneActivated: {
    deviceId: 3819,
  },
  remoteZoneActivated: {
    deviceId: 3794,
  },
  accommodationRoom: {
    counterIds: {
      smokeStatus: 3549,
      temperature: 3585,
    },
    alarm: {
      deviceId: 3667,
      signalNames: {
        alarmStatus: 'Alarm status',
        sirenStatus: 'Siren status',
      },
    },
    zoneTemperature: {
      deviceId: 4147,
      signalNames: {
        heatingControlAnalogue: 'Heating control analogue signal',
        heatingSetPoint: 'Heating set point signal',
        heatingControlStatus: 'Heating control status signal',
        heatingSetPointSelected: 'Heating set point selected signal',
        heatingStatus: 'Heating status signal',
        status: 'Status signal',
      },
    },
  },
  fireFightingRoom: {
    // Two separate PLC registers (see docs/DO.md):
    //  • FROM PLC - SIEMENS (6563): READ-only. One uint16 word, W[0], carrying
    //    the DO output status (14 channels) the PLC applied. Bit-unpacked on read.
    //  • TO PLC - SIEMENS (7193): the WRITE target. A packed uint64 (4×uint16):
    //    W[0]=PT1 counter, W[1]=PT2 counter, W[2]=Pump Activation (momentary),
    //    W[3]=spare. DO is NOT written — it is received on FROM PLC only.
    fromPlc: {
      deviceId: 6563,
    },
    toPlc: {
      deviceId: 7193,
    },
  },
  pumpRoom: {
    // Pressure Transmitters PT-001 / PT-002 are INJECT-ONLY: their set-points are
    // packed into the TO PLC word (7193, W[0] / W[1]) — see packToPlcCommand. The
    // app does not read them back, so no per-transmitter read ids live here.
    // Devices 6983 / 7019 stay documented in docs/device-id-registry.md for probing.
  },
} as const;

// TO PLC - SIEMENS (7193) is a packed uint64 exposed as one counter value.
// Word order (W[0] = least-significant word), per docs/DO.md:
export const TO_PLC_WORD_INDEX = {
  pressurePump1: 0, // W[0] — PT1 set-point counter (mA × 10)
  pressurePump2: 1, // W[1] — PT2 set-point counter (mA × 10)
  pumpActivation: 2, // W[2] — Pump Activation, momentary (1 = fire, else 0)
  spare: 3, // W[3] — reserved, always 0
} as const;

export const TO_PLC_WORD_COUNT = 4;

// Pack the two pressure counters + the momentary pump-activation word into the
// single uint64 value the TO PLC counter expects — the "by words" layer (see
// splitWords/joinWords). Pump Activation is a one-shot command: pass 1 only on
// the publish that fires it, otherwise 0. The spare word stays 0, so the result
// is < 2**48, safely inside Number.MAX_SAFE_INTEGER (no BigInt needed).
export function packToPlcCommand({
  pressurePump1Counter,
  pressurePump2Counter,
  pumpActivation = 0,
}: {
  pressurePump1Counter: number;
  pressurePump2Counter: number;
  pumpActivation?: number;
}): number {
  const words = new Array(TO_PLC_WORD_COUNT).fill(0);
  words[TO_PLC_WORD_INDEX.pressurePump1] = pressurePump1Counter;
  words[TO_PLC_WORD_INDEX.pressurePump2] = pressurePump2Counter;
  words[TO_PLC_WORD_INDEX.pumpActivation] = pumpActivation;
  return joinWords(words);
}

// Inverse of packToPlcCommand: split a TO PLC decimal back into its words. Used
// by the simulation view to verify the "by words" packing calculation.
export function unpackToPlcCommand(value: number) {
  const words = splitWords(value, TO_PLC_WORD_COUNT);
  return {
    words,
    pressurePump1Counter: words[TO_PLC_WORD_INDEX.pressurePump1],
    pressurePump2Counter: words[TO_PLC_WORD_INDEX.pressurePump2],
    pumpActivation: words[TO_PLC_WORD_INDEX.pumpActivation],
  };
}

const VALUE_COMMANDS = ['Increase', 'Decrease', 'SetValue'] as const;
const COUNTER_VALUE_SIGNAL_NAMES = ['Total value', 'Adjustable value', 'Input value'] as const;

export const ACCOMMODATION_ROOM_ALARM_STATUS_OPTIONS = [
  { code: 1 as const, label: 'Alarm OFF' },
  { code: 2 as const, label: 'Alarm ON' },
  { code: 3 as const, label: 'Alarm was ON' },
  { code: 4 as const, label: 'Acknowledged, alarm ON' },
  { code: 5 as const, label: 'Acknowledged, alarm was ON' },
  { code: 6 as const, label: 'Reset alarm' },
] as const;

const ZONE_TEMPERATURE_HEATING_SET_POINT_SELECTION_LABELS: Record<number, string> = {
  1: 'OFF',
  2: 'SP1',
  3: 'SP2',
  4: 'SP3',
};

const ZONE_TEMPERATURE_HEATING_STATUS_LABELS: Record<number, string> = {
  1: 'Control OFF',
  2: 'Set Point 1',
  3: 'Set Point 1',
  4: 'Set Point 2',
  5: 'Set Point 2',
  6: 'Set Point 3',
  7: 'Set Point 3',
  8: 'Manual Set Point',
  9: 'Manual Set Point',
  10: 'Safe Mode',
  11: 'Safe Mode',
  12: 'Antifreeze',
  13: 'Auxiliary',
  14: 'Forced ON',
  15: 'Antifreeze',
  16: 'Forced OFF',
  17: 'System Function',
};

function isValueCommand(cmd: CarloGavazziOtCommandName): cmd is CarloGavazziOtValueCommandName {
  return (VALUE_COMMANDS as readonly string[]).includes(cmd);
}

function parseMaybeJsonMessage(message: string): MqttFlexiblePayload {
  try {
    return JSON.parse(message) as MqttFlexiblePayload;
  } catch {
    return message;
  }
}

function serializeMaybeJsonPayload(payload: MqttFlexiblePayload) {
  return typeof payload === 'string' ? payload : JSON.stringify(payload);
}

function createFlexibleTopicDefinition<TKey extends MqttTopicKey>(
  config: TopicDefinitionConfig<TKey>
): MqttTopicDefinition<TKey> {
  return {
    ...config,
    qos: config.qos ?? 0,
    retain: config.retain ?? false,
    parse: (message) => parseMaybeJsonMessage(message) as MqttTopicPayloadMap[TKey],
    serialize: (payload) => serializeMaybeJsonPayload(payload as MqttFlexiblePayload),
  };
}

function createJsonTopicDefinition<TKey extends MqttTopicKey>(
  config: TopicDefinitionConfig<TKey>
): MqttTopicDefinition<TKey> {
  return {
    ...config,
    qos: config.qos ?? 0,
    retain: config.retain ?? false,
    parse: (message) => JSON.parse(message) as MqttTopicPayloadMap[TKey],
    serialize: (payload) => JSON.stringify(payload),
  };
}

export const MQTT_TOPICS = {
  gatewayMetrics: createJsonTopicDefinition({
    key: 'gatewayMetrics',
    topic: `${CARLO_GAVAZZI_GATEWAY_CONFIG.topicRoot}/metrics`,
    label: 'Gateway Metrics',
    description: 'Device and signal snapshots returned by the gateway.',
    direction: 'subscribe',
  }),
  gatewayOtCommand: createJsonTopicDefinition({
    key: 'gatewayOtCommand',
    topic: `${CARLO_GAVAZZI_GATEWAY_CONFIG.topicRoot}/cmd/ot`,
    label: 'Gateway OT Command',
    description: 'Carlo Gavazzi command channel used by station controls and alarm actions.',
    direction: 'publish',
    qos: 0,
    retain: false,
  }),
} satisfies {
  [TKey in MqttTopicKey]: MqttTopicDefinition<TKey>;
};

export const MQTT_TOPIC_CATALOG = Object.values(MQTT_TOPICS) as MqttTopicDefinition[];

const MQTT_TOPIC_LOOKUP = MQTT_TOPIC_CATALOG.reduce<Record<string, MqttTopicDefinition>>(
  (lookup, definition) => {
    lookup[definition.topic] = definition;
    return lookup;
  },
  {}
);

export function getMqttTopicDefinition<TKey extends MqttTopicKey>(
  topicKey: TKey
): MqttTopicDefinition<TKey> {
  return MQTT_TOPICS[topicKey] as unknown as MqttTopicDefinition<TKey>;
}

export function getMqttTopicDefinitionByPath(topic: string) {
  return MQTT_TOPIC_LOOKUP[topic] ?? null;
}

export function buildCarloGavazziOtCommand(
  id: number,
  cmd: CarloGavazziOtCommandName,
  value?: number
): CarloGavazziCounterCommandPayload {
  if (isValueCommand(cmd)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`${cmd} command requires a numeric value.`);
    }

    return {
      id,
      cmd,
      value,
    };
  }

  return { id, cmd };
}

export function buildCarloGavazziAlarmCommand(
  id: number,
  cmd: CarloGavazziAlarmCommandName
): CarloGavazziAlarmCommandPayload {
  return { id, cmd };
}

export function buildCarloGavazziForceCommand(
  id: number,
  cmd: CarloGavazziForceCommandName,
  value: number
): CarloGavazziForceCommandPayload {
  return { id, cmd, value };
}

export function getCarloGavazziMetricsDevice(
  payload: CarloGavazziMetricsPayload,
  deviceId: number
) {
  return payload.devices.find((device) => device.id === deviceId) ?? null;
}

export function mergeCarloGavazziMetricsPayload(
  previousPayload: CarloGavazziMetricsPayload,
  nextPayload: CarloGavazziMetricsPayload
): CarloGavazziMetricsPayload {
  const previousDeviceMap = new Map(previousPayload.devices.map((device) => [device.id, device]));
  const mergedDevices: CarloGavazziMetricsDevice[] = previousPayload.devices.map((device) => ({
    ...device,
    signals: [...device.signals],
  }));
  const mergedDeviceIndex = new Map(mergedDevices.map((device, index) => [device.id, index]));

  nextPayload.devices.forEach((nextDevice) => {
    const previousDevice = previousDeviceMap.get(nextDevice.id);

    if (!previousDevice) {
      mergedDevices.push({
        ...nextDevice,
        signals: [...nextDevice.signals],
      });
      mergedDeviceIndex.set(nextDevice.id, mergedDevices.length - 1);
      return;
    }

    const mergedSignals = [...previousDevice.signals];
    const signalIndexByKey = new Map(
      mergedSignals.map((signal, index) => [`${signal.id}:${signal.name}`, index])
    );

    nextDevice.signals.forEach((nextSignal) => {
      const signalKey = `${nextSignal.id}:${nextSignal.name}`;
      const existingIndex = signalIndexByKey.get(signalKey);

      if (existingIndex === undefined) {
        mergedSignals.push(nextSignal);
        signalIndexByKey.set(signalKey, mergedSignals.length - 1);
        return;
      }

      mergedSignals[existingIndex] = nextSignal;
    });

    const targetIndex = mergedDeviceIndex.get(nextDevice.id);

    if (targetIndex === undefined) {
      mergedDevices.push({
        ...nextDevice,
        signals: mergedSignals,
      });
      mergedDeviceIndex.set(nextDevice.id, mergedDevices.length - 1);
      return;
    }

    mergedDevices[targetIndex] = {
      ...previousDevice,
      ...nextDevice,
      signals: mergedSignals,
    };
  });

  return {
    ...previousPayload,
    ...nextPayload,
    devices: mergedDevices,
  };
}

export function getCarloGavazziMetricsSignalByName(
  payload: CarloGavazziMetricsPayload,
  deviceId: number,
  signalName: string
) {
  const device = getCarloGavazziMetricsDevice(payload, deviceId);

  if (!device) {
    return null;
  }

  return device.signals.find((signal) => signal.name === signalName) ?? null;
}

function getNumericSignalValue(signal: CarloGavazziMetricsSignal) {
  if (typeof signal.value === 'number' && Number.isFinite(signal.value)) {
    return signal.value;
  }

  if (typeof signal.value === 'string') {
    const parsedValue = Number.parseFloat(signal.value);

    if (Number.isFinite(parsedValue)) {
      return parsedValue;
    }
  }

  if (typeof signal.value === 'boolean') {
    return signal.value ? 1 : 0;
  }

  return null;
}

function getNumericSignalSnapshot(
  payload: CarloGavazziMetricsPayload,
  deviceId: number,
  signalName: string
) {
  const signal = getCarloGavazziMetricsSignalByName(payload, deviceId, signalName);

  if (!signal) {
    return {
      value: null,
      unit: '',
    };
  }

  return {
    value: getNumericSignalValue(signal),
    unit: signal.unit,
  };
}

export function getCarloGavazziCounterNumericValue(
  payload: CarloGavazziMetricsPayload,
  deviceId: number,
  preferredSignalNames: readonly string[] = COUNTER_VALUE_SIGNAL_NAMES
) {
  const device = getCarloGavazziMetricsDevice(payload, deviceId);

  if (!device) {
    return null;
  }

  for (const signalName of preferredSignalNames) {
    const matchingSignal = device.signals.find((signal) => signal.name === signalName);
    const numericValue = matchingSignal ? getNumericSignalValue(matchingSignal) : null;

    if (numericValue !== null) {
      return numericValue;
    }
  }

  for (const signal of device.signals) {
    const numericValue = getNumericSignalValue(signal);

    if (numericValue !== null) {
      return numericValue;
    }
  }

  return null;
}

export function getCarloGavazziCounterBooleanValue(
  payload: CarloGavazziMetricsPayload,
  deviceId: number
) {
  const numericValue = getCarloGavazziCounterNumericValue(payload, deviceId);

  if (numericValue === null) {
    return null;
  }

  return numericValue >= 0.5;
}

export function getAccommodationRoomMetricsState(payload: CarloGavazziMetricsPayload) {
  const smokeDetected = getCarloGavazziCounterBooleanValue(
    payload,
    CARLO_GAVAZZI_GATEWAY_CONFIG.accommodationRoom.counterIds.smokeStatus
  );
  const temperatureNumber = getCarloGavazziCounterNumericValue(
    payload,
    CARLO_GAVAZZI_GATEWAY_CONFIG.accommodationRoom.counterIds.temperature
  );

  return {
    smokeDetected,
    temperatureNumber,
    temperatureValue:
      temperatureNumber === null
        ? null
        : formatAccommodationTemperature(Math.round(temperatureNumber)),
  };
}

// A pressure set-point word is a Modbus unsigned integer, so a fractional mA
// cannot be stored directly. Encode mA as (mA × 10) before packing it into the
// TO PLC word (W[1] / W[2]); the 0.1 mA slider resolution survives the round
// trip. Inject-only — there is no read-back to decode.
export const PRESSURE_MA_COUNTER_SCALE = 10;

export function pressureMaToCounter(mA: number) {
  return Math.round(mA * PRESSURE_MA_COUNTER_SCALE);
}

function getBinarySignalLabel(value: number | null) {
  if (value === null) {
    return 'N/A';
  }

  return value >= 0.5 ? 'ON' : 'OFF';
}

function getHeatingSetPointSelectedLabel(value: number | null) {
  if (value === null) {
    return 'N/A';
  }

  return ZONE_TEMPERATURE_HEATING_SET_POINT_SELECTION_LABELS[Math.round(value)] ?? 'N/A';
}

function getHeatingStatusLabel(value: number | null) {
  if (value === null) {
    return 'N/A';
  }

  return ZONE_TEMPERATURE_HEATING_STATUS_LABELS[Math.round(value)] ?? 'N/A';
}

export function getAccommodationRoomZoneHeatingState(
  payload: CarloGavazziMetricsPayload
): AccommodationRoomZoneHeatingState {
  const { deviceId, signalNames } = CARLO_GAVAZZI_GATEWAY_CONFIG.accommodationRoom.zoneTemperature;
  const heatingControlAnalogue = getNumericSignalSnapshot(
    payload,
    deviceId,
    signalNames.heatingControlAnalogue
  );
  const heatingSetPoint = getNumericSignalSnapshot(payload, deviceId, signalNames.heatingSetPoint);
  const heatingControlStatus = getNumericSignalSnapshot(
    payload,
    deviceId,
    signalNames.heatingControlStatus
  );
  const heatingSetPointSelected = getNumericSignalSnapshot(
    payload,
    deviceId,
    signalNames.heatingSetPointSelected
  );
  const heatingStatus = getNumericSignalSnapshot(payload, deviceId, signalNames.heatingStatus);
  const statusSignal = getNumericSignalSnapshot(payload, deviceId, signalNames.status);

  return {
    heatingControlAnalogueValue: heatingControlAnalogue.value,
    heatingControlAnalogueUnit: heatingControlAnalogue.unit,
    heatingSetPointValue: heatingSetPoint.value,
    heatingSetPointUnit: heatingSetPoint.unit,
    heatingControlStatusValue: heatingControlStatus.value,
    heatingControlStatusLabel: getBinarySignalLabel(heatingControlStatus.value),
    heatingControlOn: heatingControlStatus.value !== null && heatingControlStatus.value >= 0.5,
    heatingSetPointSelectedValue: heatingSetPointSelected.value,
    heatingSetPointSelectedLabel: getHeatingSetPointSelectedLabel(heatingSetPointSelected.value),
    heatingStatusValue: heatingStatus.value,
    heatingStatusLabel: getHeatingStatusLabel(heatingStatus.value),
    statusValue: statusSignal.value,
    statusLabel: getBinarySignalLabel(statusSignal.value),
  };
}

function getSignalTimestamp(signal: CarloGavazziMetricsSignal | null) {
  if (!signal || !Number.isFinite(signal.time)) {
    return null;
  }

  return signal.time;
}

function getAlarmStatusCode(value: number | null): CarloGavazziAlarmStatusCode | null {
  if (
    value === 1 ||
    value === 2 ||
    value === 3 ||
    value === 4 ||
    value === 5 ||
    value === 6
  ) {
    return value;
  }

  return null;
}

export function getAccommodationRoomAlarmState(payload: CarloGavazziMetricsPayload) {
  const { deviceId, signalNames } = CARLO_GAVAZZI_GATEWAY_CONFIG.accommodationRoom.alarm;
  const alarmSignal = getCarloGavazziMetricsSignalByName(payload, deviceId, signalNames.alarmStatus);
  const sirenSignal = getCarloGavazziMetricsSignalByName(payload, deviceId, signalNames.sirenStatus);
  const alarmStatusNumeric = alarmSignal ? getNumericSignalValue(alarmSignal) : null;
  const sirenNumeric = sirenSignal ? getNumericSignalValue(sirenSignal) : null;
  const timestamps = [getSignalTimestamp(alarmSignal), getSignalTimestamp(sirenSignal)].filter(
    (value): value is number => value !== null
  );
  const alarmStatusCode =
    alarmStatusNumeric === null ? null : getAlarmStatusCode(Math.round(alarmStatusNumeric));
  const alarmStatusMeta =
    ACCOMMODATION_ROOM_ALARM_STATUS_OPTIONS.find((item) => item.code === alarmStatusCode) ?? null;
  const sirenOn = sirenNumeric === null ? null : sirenNumeric >= 0.5;

  return {
    alarmStatusCode,
    alarmStatusLabel: alarmStatusMeta?.label ?? 'N/A',
    sirenOn,
    lastSignalAt: timestamps.length > 0 ? Math.max(...timestamps) : null,
    outputs: ACCOMMODATION_ROOM_ALARM_STATUS_OPTIONS.map((item) => ({
      ...item,
      active: item.code === alarmStatusCode,
    })),
  };
}

export function getZoneActivatedState(
  payload: CarloGavazziMetricsPayload,
  deviceId: number
): boolean | null {
  const signal = getCarloGavazziMetricsSignalByName(payload, deviceId, 'Main signal');

  if (!signal) {
    return null;
  }

  return signal.value === 1;
}
