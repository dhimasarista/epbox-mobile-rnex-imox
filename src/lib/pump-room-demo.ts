import { createKeyValueStorage } from '@/lib/cross-platform-storage';

export const PUMP_ROOM_DEMO_STORAGE_KEY = 'epbox.pump-room.demo.values';
const pumpRoomStorage = createKeyValueStorage(PUMP_ROOM_DEMO_STORAGE_KEY);

export type PumpRoomPlcInputKey = 'pressurePump1' | 'pressurePump2';

export type PumpRoomPlcInputs = Record<PumpRoomPlcInputKey, string>;

// Defaults in bar. The TO PLC words use the same integer value: UI 1 bar -> word 1.
export const DEFAULT_PUMP_ROOM_PLC_INPUTS: PumpRoomPlcInputs = {
  pressurePump1: '7 bar',
  pressurePump2: '7 bar',
};

export const PUMP_ROOM_PLC_FIELDS: {
  key: PumpRoomPlcInputKey;
  label: string;
  placeholder: string;
}[] = [
  {
    key: 'pressurePump1',
    label: 'PT-001 — Pressure Pump 1',
    placeholder: 'Example: 7 bar',
  },
  {
    key: 'pressurePump2',
    label: 'PT-002 — Pressure Pump 2',
    placeholder: 'Example: 7 bar',
  },
];

export async function getStoredPumpRoomPlcInputs() {
  try {
    const rawValue = await pumpRoomStorage.getItem();

    if (!rawValue) {
      return DEFAULT_PUMP_ROOM_PLC_INPUTS;
    }

    const parsed = JSON.parse(rawValue) as Partial<PumpRoomPlcInputs>;

    return {
      pressurePump1: parsed.pressurePump1 ?? DEFAULT_PUMP_ROOM_PLC_INPUTS.pressurePump1,
      pressurePump2: parsed.pressurePump2 ?? DEFAULT_PUMP_ROOM_PLC_INPUTS.pressurePump2,
    };
  } catch {
    return DEFAULT_PUMP_ROOM_PLC_INPUTS;
  }
}

export async function setStoredPumpRoomPlcInputs(inputs: PumpRoomPlcInputs) {
  await pumpRoomStorage.setItem(JSON.stringify(inputs));
}
