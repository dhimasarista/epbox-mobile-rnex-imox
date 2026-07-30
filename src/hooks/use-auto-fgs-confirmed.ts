import { useEffect, useRef } from 'react';

import {
  buildCarloGavazziOtCommand,
  CARLO_GAVAZZI_GATEWAY_CONFIG,
  getAccommodationAlarmFgsConfirmed,
  getCarloGavazziCounterNumericValue,
  packToPlcCommand,
  unpackToPlcCommand,
  type CarloGavazziAlarmStatusCode,
} from '@/lib/mqtt-topics';
import type { PublishTopicFn } from '@/providers/mqtt-provider';

type MetricsPayload = Parameters<typeof getCarloGavazziCounterNumericValue>[0];

export function useAutoFgsConfirmed({
  enabled,
  alarmStatusCode,
  metricsPayload,
  publishTopic,
}: {
  enabled: boolean;
  alarmStatusCode: CarloGavazziAlarmStatusCode | null;
  metricsPayload: MetricsPayload | null;
  publishTopic: PublishTopicFn;
}) {
  const lastPublishedValueRef = useRef<0 | 1 | null>(null);
  const publishRef = useRef(publishTopic);
  publishRef.current = publishTopic;

  useEffect(() => {
    const desiredFgsConfirmed = getAccommodationAlarmFgsConfirmed(alarmStatusCode);

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
  }, [alarmStatusCode, enabled, metricsPayload]);
}
