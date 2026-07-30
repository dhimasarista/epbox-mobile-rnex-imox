import {
  CARLO_GAVAZZI_GATEWAY_CONFIG,
  getCarloGavazziCounterNumericValue,
} from '@/lib/mqtt-topics';

// Fire-condition thresholds used by the Accommodation Room indicators and
// cooldown floor. W2 Remote Activation is manual-only from Pump Room.
export const AUTO_PUMP_TEMP_ON_C = 55;
export const AUTO_PUMP_TEMP_OFF_C = 30;
export const AUTO_PUMP_DENSITY_ON_PPM = 8;
export const AUTO_PUMP_DENSITY_OFF_PPM = 2;

const FROM_PLC_DEVICE_ID = CARLO_GAVAZZI_GATEWAY_CONFIG.fireFightingRoom.fromPlc.deviceId;
const FROM_PLC_WORD_MASK = 0xffff;

// FROM PLC (6563) DO-word bit positions — mirror DO_BIT_MAP in
// src/app/stations/pump-room.tsx (single source for the cross-screen bits used here).
export const FROM_PLC_BIT = {
  pumpARunning: 0,
  pumpBRunning: 1,
  remoteMode: 13,
} as const;

type MetricsPayload = Parameters<typeof getCarloGavazziCounterNumericValue>[0];

/** Decode the FROM PLC DO word into the flags the auto-logic needs. */
export function readFromPlcFlags(metricsPayload: MetricsPayload | null) {
  const value = metricsPayload
    ? getCarloGavazziCounterNumericValue(metricsPayload, FROM_PLC_DEVICE_ID)
    : null;
  const word = value === null ? 0 : Math.round(value) & FROM_PLC_WORD_MASK;

  return {
    remoteMode: ((word >> FROM_PLC_BIT.remoteMode) & 1) === 1,
    pumpARunning: ((word >> FROM_PLC_BIT.pumpARunning) & 1) === 1,
    pumpBRunning: ((word >> FROM_PLC_BIT.pumpBRunning) & 1) === 1,
  };
}
