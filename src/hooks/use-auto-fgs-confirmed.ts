import { useEffect, useRef } from 'react';

import {
  buildCarloGavazziOtCommand,
  CARLO_GAVAZZI_GATEWAY_CONFIG,
  getCarloGavazziCounterNumericValue,
  getToPlcW2FgsWord,
  getToPlcW3ReservedStatus,
  packToPlcCommand,
  setToPlcW2FgsWord,
  TO_PLC_VALUE_SIGNAL_NAMES,
  unpackToPlcCommand,
} from '@/lib/mqtt-topics';
import type { PublishTopicFn } from '@/providers/mqtt-provider';

type MetricsPayload = Parameters<typeof getCarloGavazziCounterNumericValue>[0];

// Limit bits are carried in W2:
//   bit 1 = temp high, bit 2 = temp warning, bit 3 = smoke high,
//   bit 4 = smoke warning.
// W3 stays reserved so the packed decimal remains within the gateway numeric ceiling.
const FGS_TEMPERATURE_WARNING_C = 40;
const FGS_TEMPERATURE_ALERT_C = 82;
const FGS_SMOKE_DENSITY_WARNING_PPM = 5;
const FGS_SMOKE_DENSITY_ALERT_PPM = 11;

export function useAutoFgsConfirmed({
  enabled,
  temperatureC,
  smokeDensityPpm,
  metricsPayload,
  publishTopic,
}: {
  enabled: boolean;
  temperatureC: number | null;
  smokeDensityPpm: number | null;
  metricsPayload: MetricsPayload | null;
  publishTopic: PublishTopicFn;
}) {
  const inFlightValueRef = useRef<string | null>(null);
  const lastDesiredValueRef = useRef<string | null>(null);
  const publishRef = useRef(publishTopic);
  publishRef.current = publishTopic;

  useEffect(() => {
    const tempHighBit: 0 | 1 =
      temperatureC !== null && temperatureC >= FGS_TEMPERATURE_ALERT_C ? 1 : 0;
    const tempWarnBit: 0 | 1 =
      temperatureC !== null &&
      temperatureC >= FGS_TEMPERATURE_WARNING_C &&
      temperatureC < FGS_TEMPERATURE_ALERT_C ? 1 : 0;
    const smokeHighBit: 0 | 1 =
      smokeDensityPpm !== null && smokeDensityPpm >= FGS_SMOKE_DENSITY_ALERT_PPM ? 1 : 0;
    const smokeWarnBit: 0 | 1 =
      smokeDensityPpm !== null &&
      smokeDensityPpm >= FGS_SMOKE_DENSITY_WARNING_PPM &&
      smokeDensityPpm < FGS_SMOKE_DENSITY_ALERT_PPM ? 1 : 0;
    // Pack: bit 3 = smoke warning, bit 2 = smoke high, bit 1 = temp warning,
    // bit 0 = temp high.
    const desiredFgsWord =
      (smokeWarnBit << 3) | (smokeHighBit << 2) | (tempWarnBit << 1) | tempHighBit;

    if (!enabled || !metricsPayload) {
      inFlightValueRef.current = null;
      return;
    }

    const toPlcDeviceId = CARLO_GAVAZZI_GATEWAY_CONFIG.fireFightingRoom.toPlc.deviceId;
    const packedValue = getCarloGavazziCounterNumericValue(
      metricsPayload,
      toPlcDeviceId,
      TO_PLC_VALUE_SIGNAL_NAMES
    );

    if (packedValue === null) {
      inFlightValueRef.current = null;
      return;
    }

    const currentWords = unpackToPlcCommand(Math.round(packedValue));
    const desiredW2Word = setToPlcW2FgsWord(currentWords.pumpActivation, desiredFgsWord);
    const desiredW3Status = getToPlcW3ReservedStatus();
    const desiredSignature = `${desiredW2Word}:${desiredW3Status}`;
    const currentFgsWord = getToPlcW2FgsWord(currentWords.pumpActivation);
    const desiredChanged = lastDesiredValueRef.current !== desiredSignature;

    if (
      !desiredChanged &&
      currentFgsWord === desiredFgsWord &&
      currentWords.fgsConfirmed === desiredW3Status
    ) {
      inFlightValueRef.current = null;
      return;
    }

    if (!desiredChanged && inFlightValueRef.current === desiredSignature) {
      return;
    }

    inFlightValueRef.current = desiredSignature;
    lastDesiredValueRef.current = desiredSignature;
    const nextPackedValue = packToPlcCommand({
      pressurePump1Counter: currentWords.pressurePump1Counter,
      pressurePump2Counter: currentWords.pressurePump2Counter,
      pumpActivation: desiredW2Word,
      fgsConfirmed: desiredW3Status,
    });

    void publishRef
      .current(
        'gatewayOtCommand',
        buildCarloGavazziOtCommand(toPlcDeviceId, 'SetValue', nextPackedValue),
        { qos: 0, retain: false }
      )
      .then(() => {
        if (inFlightValueRef.current === desiredSignature) {
          inFlightValueRef.current = null;
        }
      })
      .catch(() => {
        if (inFlightValueRef.current === desiredSignature) {
          inFlightValueRef.current = null;
        }
      });
  }, [temperatureC, smokeDensityPpm, enabled, metricsPayload]);
}
