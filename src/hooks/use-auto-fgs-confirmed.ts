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

// W3 word is a 2-bit status field:
//   bit 0 — FGS confirmed (danger): temp ≥ 82°C OR smoke ≥ 11 ppm
//   bit 1 — warning active:         temp ≥ 40°C OR smoke ≥ 5 ppm
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
  const lastPublishedValueRef = useRef<number | null>(null);
  const publishRef = useRef(publishTopic);
  publishRef.current = publishTopic;

  useEffect(() => {
    const dangerBit: 0 | 1 =
      (temperatureC !== null && temperatureC >= FGS_TEMPERATURE_ALERT_C) ||
      (smokeDensityPpm !== null && smokeDensityPpm >= FGS_SMOKE_DENSITY_ALERT_PPM)
        ? 1 : 0;
    // Warning only activates when danger is NOT active (mutually exclusive).
    const warningBit: 0 | 1 =
      dangerBit === 0 && (
        (temperatureC !== null && temperatureC >= FGS_TEMPERATURE_WARNING_C) ||
        (smokeDensityPpm !== null && smokeDensityPpm >= FGS_SMOKE_DENSITY_WARNING_PPM)
      ) ? 1 : 0;
    // Pack: bit 1 = warning, bit 0 = danger. Possible values: 0 (normal), 1 (danger), 2 (warning).
    const desiredFgsWord = (warningBit << 1) | dangerBit;

    if (!enabled || !metricsPayload) {
      lastPublishedValueRef.current = null;
      return;
    }

    const toPlcDeviceId = CARLO_GAVAZZI_GATEWAY_CONFIG.fireFightingRoom.toPlc.deviceId;
    const packedValue = getCarloGavazziCounterNumericValue(metricsPayload, toPlcDeviceId);

    if (packedValue === null) {
      return;
    }

    const currentWords = unpackToPlcCommand(Math.round(packedValue));

    if (currentWords.fgsConfirmed === desiredFgsWord) {
      lastPublishedValueRef.current = null;
      return;
    }

    if (lastPublishedValueRef.current === desiredFgsWord) {
      return;
    }

    lastPublishedValueRef.current = desiredFgsWord;
    const nextPackedValue = packToPlcCommand({
      pressurePump1Counter: currentWords.pressurePump1Counter,
      pressurePump2Counter: currentWords.pressurePump2Counter,
      pumpActivation: 0,
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
