import { createKeyValueStorage } from '@/lib/cross-platform-storage';

export const ACCOMMODATION_ROOM_STORAGE_KEY = 'epbox.accommodation-room.demo.values';
const accommodationRoomStorage = createKeyValueStorage(ACCOMMODATION_ROOM_STORAGE_KEY);

export type AccommodationRoomInputKey =
  | 'triggerEnable'
  | 'smokeDetected'
  | 'temperatureValue'
  | 'temperatureHighLimit'
  | 'manualOverride';

export type AccommodationRoomInputs = {
  triggerEnable: boolean;
  smokeDetected: boolean;
  temperatureValue: string;
  temperatureHighLimit: boolean;
  manualOverride: boolean;
};

export type AccommodationRoomDashboardData = {
  simulationActive: string;
  temperatureDisplay: string;
  fireAlarmStatus: string;
  pumpInterlock: string;
};

export const DEFAULT_ACCOMMODATION_ROOM_INPUTS: AccommodationRoomInputs = {
  triggerEnable: true,
  smokeDetected: false,
  temperatureValue: '34 C',
  temperatureHighLimit: false,
  manualOverride: false,
};

export const ACCOMMODATION_ROOM_PLC_POINTS = [
  'MOCK_ACC_SMOKE_DETECTED',
  'MOCK_ACC_TEMP_VALUE',
  'MOCK_ACC_TEMP_HIGH_LIMIT',
  'MOCK_ACC_MANUAL_OVERRIDE',
  'MOCK_ACC_TRIGGER_ENABLE',
] as const;

export const ACCOMMODATION_ROOM_DASHBOARD_POINTS = [
  'ACC_SIMULATION_ACTIVE',
  'ACC_TEMP_DISPLAY',
  'ACC_FIRE_ALARM_STS',
  'ACC_TO_PUMP_INTERLOCK',
] as const;

export function clampAccommodationTemperature(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(Math.round(value), 0), 120);
}

export function parseAccommodationTemperature(value: string) {
  const leadingNumberMatch = value.trim().match(/^\d+/);
  const parsedValue = leadingNumberMatch ? Number.parseInt(leadingNumberMatch[0], 10) : Number.NaN;

  return clampAccommodationTemperature(parsedValue);
}

export function formatAccommodationTemperature(value: number) {
  return `${clampAccommodationTemperature(value)} C`;
}

export function buildAccommodationRoomDashboard(
  inputs: AccommodationRoomInputs
): AccommodationRoomDashboardData {
  const simulationEnabled = inputs.triggerEnable;
  const fireAlarmActive =
    simulationEnabled && (inputs.smokeDetected || inputs.manualOverride);
  const pumpInterlockActive =
    simulationEnabled &&
    (inputs.smokeDetected || inputs.temperatureHighLimit || inputs.manualOverride);

  return {
    simulationActive: simulationEnabled ? 'Active' : 'Standby',
    temperatureDisplay: inputs.temperatureValue,
    fireAlarmStatus: fireAlarmActive ? 'Active' : 'Idle',
    pumpInterlock: pumpInterlockActive ? 'Enabled' : 'Standby',
  };
}

export async function getStoredAccommodationRoomInputs() {
  try {
    const rawValue = await accommodationRoomStorage.getItem();

    if (!rawValue) {
      return DEFAULT_ACCOMMODATION_ROOM_INPUTS;
    }

    const parsed = JSON.parse(rawValue) as Partial<AccommodationRoomInputs>;

    return {
      triggerEnable: parsed.triggerEnable ?? DEFAULT_ACCOMMODATION_ROOM_INPUTS.triggerEnable,
      smokeDetected: parsed.smokeDetected ?? DEFAULT_ACCOMMODATION_ROOM_INPUTS.smokeDetected,
      temperatureValue:
        parsed.temperatureValue ?? DEFAULT_ACCOMMODATION_ROOM_INPUTS.temperatureValue,
      temperatureHighLimit:
        parsed.temperatureHighLimit ?? DEFAULT_ACCOMMODATION_ROOM_INPUTS.temperatureHighLimit,
      manualOverride: parsed.manualOverride ?? DEFAULT_ACCOMMODATION_ROOM_INPUTS.manualOverride,
    };
  } catch {
    return DEFAULT_ACCOMMODATION_ROOM_INPUTS;
  }
}

export async function setStoredAccommodationRoomInputs(inputs: AccommodationRoomInputs) {
  await accommodationRoomStorage.setItem(JSON.stringify(inputs));
}
