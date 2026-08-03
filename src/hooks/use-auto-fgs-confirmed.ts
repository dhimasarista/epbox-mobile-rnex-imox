import { useEffect, useRef } from 'react';

import {
  buildCarloGavazziOtCommand,
  CARLO_GAVAZZI_GATEWAY_CONFIG,
  getCarloGavazziCounterNumericValue,
  packToPlcCommand,
  unpackToPlcCommand,
} from '@/lib/mqtt-topics';
import type { PublishTopicFn } from '@/providers/mqtt-provider';

type MetricsPayload = Parameters<typeof getCarloGavazziCounterNumericValue>[0];

// W3 word is a 3-bit status field:
//   bit 0 — temperature high (danger):   temp ≥ 82°C
//   bit 1 — temperature warning:         40°C ≤ temp < 82°C
//   bit 2 — smoke high (danger):         smoke ≥ 11 ppm
const FGS_TEMPERATURE_WARNING_C = 40;
const FGS_TEMPERATURE_ALERT_C = 82;
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
  const lastPublishedValueRef = useRef<number | null>(null);
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
    // Pack: bit 2 = smoke high, bit 1 = temp warning, bit 0 = temp high.
    const desiredFgsWord = (smokeHighBit << 2) | (tempWarnBit << 1) | tempHighBit;

    if (!enabled || !metricsPayload) {
      lastPublishedValueRef.current = null;
      return;
    }

    const toPlcDeviceId = CARLO_GAVAZZI_GATEWAY_CONFIG.fireFightingRoom.toPlc.deviceId;
    const packedValue = getCarloGavazziCounterNumericValue(metricsPayload, toPlcDeviceId);

    // If TO PLC metrics haven't arrived yet, use zero defaults for W0/W1/W2
    // so W3 can still be published — pump-room re-publishes W0/W1/W2 independently.
    const currentWords = packedValue !== null
      ? unpackToPlcCommand(Math.round(packedValue))
      : { pressurePump1Counter: 0, pressurePump2Counter: 0, pumpActivation: 0, fgsConfirmed: -1 };

    if (currentWords.fgsConfirmed === desiredFgsWord) {
      lastPublishedValueRef.current = null;
      return;
    }

    // For anomalous states (any bit set), skip the dedup guard so the command
    // is re-published on every metrics cycle until the gateway confirms it.
    // For normal state (all bits clear), keep the guard to avoid constant noise.
    const isAnomalous = desiredFgsWord !== 0;
    if (!isAnomalous && lastPublishedValueRef.current === desiredFgsWord) {
      return;
    }

    lastPublishedValueRef.current = desiredFgsWord;
    const nextPackedValue = packToPlcCommand({
      pressurePump1Counter: currentWords.pressurePump1Counter,
      pressurePump2Counter: currentWords.pressurePump2Counter,
      pumpActivation: currentWords.pumpActivation,
      fgsConfirmed: desiredFgsWord,
    });

    void publishRef
      .current(
        'gatewayOtCommand',
        buildCarloGavazziOtCommand(toPlcDeviceId, 'SetValue', nextPackedValue),
        { qos: 0, retain: false }
      )
      .catch(() => {
        if (lastPublishedValueRef.current === desiredFgsWord) {
          lastPublishedValueRef.current = null;
        }
      });
  }, [temperatureC, smokeDensityPpm, enabled, metricsPayload]);
}
