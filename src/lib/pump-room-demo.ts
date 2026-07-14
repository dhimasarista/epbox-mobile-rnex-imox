import { createKeyValueStorage } from '@/lib/cross-platform-storage';

export const PUMP_ROOM_DEMO_STORAGE_KEY = 'epbox.pump-room.demo.values';
const pumpRoomStorage = createKeyValueStorage(PUMP_ROOM_DEMO_STORAGE_KEY);

export type PumpRoomPlcInputKey = 'pressurePump1' | 'pressurePump2' | 'dischargeFlowRate';

export type PumpRoomPlcInputs = Record<PumpRoomPlcInputKey, string>;

// Defaults in 4–20 mA (raw signal). 4 mA = live zero, 20 mA = full scale.
// PT-001 / PT-002: 4 mA = 0 bar, 20 mA = 16 bar  →  11.4 mA ≈ 7.4 bar
// FT-001:          4 mA = 0 m³/h, 20 mA = 300 m³/h → 13.0 mA ≈ 168 m³/h
export const DEFAULT_PUMP_ROOM_PLC_INPUTS: PumpRoomPlcInputs = {
  pressurePump1: '11.4 mA',
  pressurePump2: '11.1 mA',
  dischargeFlowRate: '13.0 mA',
};

export const PUMP_ROOM_PLC_FIELDS: {
  key: PumpRoomPlcInputKey;
  label: string;
  placeholder: string;
}[] = [
  {
    key: 'pressurePump1',
    label: 'PT-001 — Pressure Pump 1',
    placeholder: 'Example: 11.4 mA',
  },
  {
    key: 'pressurePump2',
    label: 'PT-002 — Pressure Pump 2',
    placeholder: 'Example: 11.1 mA',
  },
  {
    key: 'dischargeFlowRate',
    label: 'FT-001 — Flow Rate Discharge',
    placeholder: 'Example: 13.0 mA',
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
      dischargeFlowRate:
        parsed.dischargeFlowRate ?? DEFAULT_PUMP_ROOM_PLC_INPUTS.dischargeFlowRate,
    };
  } catch {
    return DEFAULT_PUMP_ROOM_PLC_INPUTS;
  }
}

export async function setStoredPumpRoomPlcInputs(inputs: PumpRoomPlcInputs) {
  await pumpRoomStorage.setItem(JSON.stringify(inputs));
}
