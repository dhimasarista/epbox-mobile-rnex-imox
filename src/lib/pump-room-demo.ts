import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const PUMP_ROOM_DEMO_STORAGE_KEY = 'epbox.pump-room.demo.values';

export type PumpRoomPlcInputKey = 'pressurePump1' | 'pressurePump2' | 'dischargeFlowRate';

export type PumpRoomPlcInputs = Record<PumpRoomPlcInputKey, string>;

export type PumpRoomDashboardData = {
  temperatureZone: string;
  currentStatus: string;
  ampereStatus: string;
  pressurePump1: string;
  pressurePump2: string;
  dischargeFlowRate: string;
};

export const DEFAULT_PUMP_ROOM_PLC_INPUTS: PumpRoomPlcInputs = {
  pressurePump1: '7.4 bar',
  pressurePump2: '7.1 bar',
  dischargeFlowRate: '168 m3/h',
};

export const PUMP_ROOM_PLC_FIELDS: {
  key: PumpRoomPlcInputKey;
  label: string;
  placeholder: string;
}[] = [
  {
    key: 'pressurePump1',
    label: 'Pressure Transmitter - Pump 1',
    placeholder: 'Example: 7.4 bar',
  },
  {
    key: 'pressurePump2',
    label: 'Pressure Transmitter - Pump 2',
    placeholder: 'Example: 7.1 bar',
  },
  {
    key: 'dischargeFlowRate',
    label: 'Flow Rate Discharge',
    placeholder: 'Example: 168 m3/h',
  },
];

export const PUMP_ROOM_PLC_POINTS = [
  'Pressure transmitter Pump 1',
  'Pressure transmitter Pump 2',
  'Flow rate discharge',
] as const;

export const PUMP_ROOM_DASHBOARD_POINTS = [
  'Temperature zone (alarm)',
  'Current status',
  'Ampere status',
  'Pressure pump 1',
  'Pressure pump 2',
  'Flow rate discharge',
] as const;

export const MONITORED_ROOMS = [
  {
    id: 'pump-room',
    title: 'Pump Room',
    roomId: 'PR-001',
    deck: 'Lower Deck',
    status: 'Active',
    metricLabel: 'Discharge Flow',
    icon: 'fire-hydrant',
    active: true,
    description:
      'Primary integrated room. Fake PLC values are entered here, then shown again as dashboard outputs.',
  },
  {
    id: 'engine-room',
    title: 'Engine Room',
    roomId: 'ER-001',
    deck: 'Main Deck',
    status: 'Non-Active',
    metricLabel: 'N/A',
    icon: 'fire-truck',
    active: false,
    description:
      'Kept as standby room for now. Not yet connected to PLC fake inputs or dashboard outputs.',
  },
] as const;

export function buildPumpRoomDashboard(inputs: PumpRoomPlcInputs): PumpRoomDashboardData {
  return {
    temperatureZone: 'Alarm',
    currentStatus: 'Active',
    ampereStatus: '76 A',
    pressurePump1: inputs.pressurePump1,
    pressurePump2: inputs.pressurePump2,
    dischargeFlowRate: inputs.dischargeFlowRate,
  };
}

async function getStoredValue() {
  if (Platform.OS === 'web') {
    return globalThis.localStorage?.getItem(PUMP_ROOM_DEMO_STORAGE_KEY) ?? null;
  }

  return SecureStore.getItemAsync(PUMP_ROOM_DEMO_STORAGE_KEY);
}

export async function getStoredPumpRoomPlcInputs() {
  try {
    const rawValue = await getStoredValue();

    if (!rawValue) {
      return DEFAULT_PUMP_ROOM_PLC_INPUTS;
    }

    const parsed = JSON.parse(rawValue) as Partial<PumpRoomPlcInputs>;

    return {
      pressurePump1: parsed.pressurePump1 ?? DEFAULT_PUMP_ROOM_PLC_INPUTS.pressurePump1,
      pressurePump2: parsed.pressurePump2 ?? DEFAULT_PUMP_ROOM_PLC_INPUTS.pressurePump2,
      dischargeFlowRate:
        parsed.dischargeFlowRate ?? DEFAULT_PUMP_ROOM_PLC_INPUTS.dischargeFlowRate,
    };
  } catch {
    return DEFAULT_PUMP_ROOM_PLC_INPUTS;
  }
}

export async function setStoredPumpRoomPlcInputs(inputs: PumpRoomPlcInputs) {
  const serialized = JSON.stringify(inputs);

  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(PUMP_ROOM_DEMO_STORAGE_KEY, serialized);
    return;
  }

  await SecureStore.setItemAsync(PUMP_ROOM_DEMO_STORAGE_KEY, serialized);
}
