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
  const lastPublishedValueRef = useRef<0 | 1 | null>(null);
  const publishRef = useRef(publishTopic);
  publishRef.current = publishTopic;

  useEffect(() => {
    const tempTriggered = temperatureC !== null && temperatureC >= FGS_TEMPERATURE_ALERT_C;
    const smokeTriggered = smokeDensityPpm !== null && smokeDensityPpm >= FGS_SMOKE_DENSITY_ALERT_PPM;
    const desiredFgsConfirmed: 0 | 1 = tempTriggered || smokeTriggered ? 1 : 0;

    if (!enabled || !metricsPayload || desiredFgsConfirmed === null) {
      lastPublishedValueRef.current = null;
      return;
    }

    const toPlcDeviceId = CARLO_GAVAZZI_GATEWAY_CONFIG.fireFightingRoom.toPlc.deviceId;
    const packedValue = getCarloGavazziCounterNumericValue(metricsPayload, toPlcDeviceId);

    if (packedValue === null) {
      return;
    }

    const currentWords = unpackToPlcCommand(Math.round(packedValue));

    if (currentWords.fgsConfirmed === desiredFgsConfirmed) {
      lastPublishedValueRef.current = null;
      return;
    }

    if (lastPublishedValueRef.current === desiredFgsConfirmed) {
      return;
    }

    lastPublishedValueRef.current = desiredFgsConfirmed;
    const nextPackedValue = packToPlcCommand({
      pressurePump1Counter: currentWords.pressurePump1Counter,
      pressurePump2Counter: currentWords.pressurePump2Counter,
      pumpActivation: 0,
      fgsConfirmed: desiredFgsConfirmed,
    });

    void publishRef
      .current(
        'gatewayOtCommand',
        buildCarloGavazziOtCommand(toPlcDeviceId, 'SetValue', nextPackedValue),
        { qos: 0, retain: false }
      )
      .catch(() => {
        if (lastPublishedValueRef.current === desiredFgsConfirmed) {
          lastPublishedValueRef.current = null;
        }
      });
  }, [temperatureC, smokeDensityPpm, enabled, metricsPayload]);
}
