import { useEffect, useRef } from 'react';

import {
  buildCarloGavazziOtCommand,
  CARLO_GAVAZZI_GATEWAY_CONFIG,
  getCarloGavazziCounterNumericValue,
  packToPlcCommand,
  unpackToPlcCommand,
} from '@/lib/mqtt-topics';
import type { MqttPublishOptions, PublishTopicFn } from '@/providers/mqtt-provider';

// Fire-condition thresholds for the mobile-side auto pump activation (hysteresis):
//  • ON  : temperature ≥ *_ON  OR smoke density ≥ *_ON
//  • OFF : temperature < *_OFF AND smoke density < *_OFF
// The wide ON→OFF gap prevents chattering: once activated the pump stays on until
// the room genuinely cools / clears below the safe thresholds.
export const AUTO_PUMP_TEMP_ON_C = 55;
export const AUTO_PUMP_TEMP_OFF_C = 30;
export const AUTO_PUMP_DENSITY_ON_PPM = 8;
export const AUTO_PUMP_DENSITY_OFF_PPM = 2;

const TO_PLC_DEVICE_ID = CARLO_GAVAZZI_GATEWAY_CONFIG.fireFightingRoom.toPlc.deviceId;
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

export type AutoPumpFireInputs = {
  temperatureC: number;
  // Smoke density only counts once its counter id is wired (densityEnabled).
  densityEnabled: boolean;
  densityPpm: number;
};

export function shouldAutoActivatePump({
  temperatureC,
  densityEnabled,
  densityPpm,
}: AutoPumpFireInputs) {
  return (
    temperatureC >= AUTO_PUMP_TEMP_ON_C || (densityEnabled && densityPpm >= AUTO_PUMP_DENSITY_ON_PPM)
  );
}

export function shouldAutoClearPump({
  temperatureC,
  densityEnabled,
  densityPpm,
}: AutoPumpFireInputs) {
  return (
    temperatureC < AUTO_PUMP_TEMP_OFF_C &&
    (!densityEnabled || densityPpm < AUTO_PUMP_DENSITY_OFF_PPM)
  );
}

// Build a TO_PLC (7193) SetValue that flips ONLY W2 (Pump Activation), keeping the
// current PT1/PT2 set-points intact by reading them back from the latest metrics.
// Mirrors the manual W2 command in src/app/stations/pump-room.tsx.
function buildToPlcActivationCommand(metricsPayload: MetricsPayload | null, pumpActivation: 0 | 1) {
  let pressurePump1Counter = 0;
  let pressurePump2Counter = 0;

  const toPlcValue = metricsPayload
    ? getCarloGavazziCounterNumericValue(metricsPayload, TO_PLC_DEVICE_ID)
    : null;

  if (toPlcValue !== null) {
    const words = unpackToPlcCommand(Math.round(toPlcValue));
    pressurePump1Counter = words.pressurePump1Counter;
    pressurePump2Counter = words.pressurePump2Counter;
  }

  return buildCarloGavazziOtCommand(
    TO_PLC_DEVICE_ID,
    'SetValue',
    packToPlcCommand({ pressurePump1Counter, pressurePump2Counter, pumpActivation })
  );
}

/**
 * Watches the confirmed smoke / temperature / smoke-density signals and, on the
 * rising edge of a fire condition, publishes a TO_PLC command that sets W2 (Pump
 * Activation) = 1 so the PLC starts the pump — but ONLY while FROM PLC bit 13
 * (Remote Mode) is active. Once the room clears below the safe thresholds it
 * publishes W2 = 0. Edge-latched via a ref so each transition publishes once.
 */
export function useAutoPumpActivation({
  enabled,
  fire,
  metricsPayload,
  publishTopic,
}: {
  enabled: boolean;
  fire: AutoPumpFireInputs;
  metricsPayload: MetricsPayload | null;
  publishTopic: PublishTopicFn;
}) {
  const isActivatedRef = useRef(false);
  const metricsPayloadRef = useRef(metricsPayload);
  metricsPayloadRef.current = metricsPayload;
  const publishRef = useRef(publishTopic);
  publishRef.current = publishTopic;

  const { temperatureC, densityEnabled, densityPpm } = fire;

  useEffect(() => {
    const publishOptions: MqttPublishOptions = { qos: 0, retain: false };
    const remoteMode = readFromPlcFlags(metricsPayloadRef.current).remoteMode;

    // Gate on connection AND Remote Mode: if the PLC is not in Remote Mode we do
    // not drive it at all. Drop the latch so a still-active fire condition re-fires
    // once Remote Mode (and the broker) come back.
    if (!enabled || !remoteMode) {
      isActivatedRef.current = false;
      return;
    }

    const fireInputs: AutoPumpFireInputs = { temperatureC, densityEnabled, densityPpm };

    if (!isActivatedRef.current && shouldAutoActivatePump(fireInputs)) {
      isActivatedRef.current = true;
      void publishRef.current(
        'gatewayOtCommand',
        buildToPlcActivationCommand(metricsPayloadRef.current, 1),
        publishOptions
      );
      return;
    }

    if (isActivatedRef.current && shouldAutoClearPump(fireInputs)) {
      isActivatedRef.current = false;
      void publishRef.current(
        'gatewayOtCommand',
        buildToPlcActivationCommand(metricsPayloadRef.current, 0),
        publishOptions
      );
    }
  }, [enabled, temperatureC, densityEnabled, densityPpm, metricsPayload]);
}
