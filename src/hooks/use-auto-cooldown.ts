import { useEffect, useRef } from 'react';

import { readFromPlcFlags } from '@/hooks/use-auto-pump-activation';
import {
  buildCarloGavazziOtCommand,
  getCarloGavazziCounterNumericValue,
} from '@/lib/mqtt-topics';
import type { MqttPublishOptions, PublishTopicFn } from '@/providers/mqtt-provider';

// While a pump is running the mobile side simulates the room cooling: each tick
// nudges every wired counter down by a random step, until it reaches its floor.
export const COOLDOWN_MIN_STEP = 1;
export const COOLDOWN_MAX_STEP = 3;
const COOLDOWN_MIN_INTERVAL_MS = 500;
const COOLDOWN_MAX_INTERVAL_MS = 1000;

type MetricsPayload = Parameters<typeof getCarloGavazziCounterNumericValue>[0];

export type CooldownTarget = {
  // Counter to drive down. `null` (e.g. smoke density before its id is wired) is
  // skipped so nothing is published to an unknown device.
  counterId: number | null;
  // Latest confirmed value (re-read every render via ref so decrements compound
  // through the gateway echo).
  currentValue: number;
  // Stop nudging once value <= floor.
  floor: number;
};

function randomIntInclusive(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * When FROM PLC reports a running pump (bit 0 Pump A OR bit 1 Pump B), publishes
 * SetValue commands that lower each target counter by a random 1–3 every 0.5–1s
 * until it reaches its floor — so temperature (and later smoke density) fall back
 * to normal on their own. The display follows via the normal metrics reconcile.
 */
export function useAutoCooldown({
  enabled,
  metricsPayload,
  targets,
  publishTopic,
}: {
  enabled: boolean;
  metricsPayload: MetricsPayload | null;
  targets: CooldownTarget[];
  publishTopic: PublishTopicFn;
}) {
  const targetsRef = useRef(targets);
  targetsRef.current = targets;
  const metricsPayloadRef = useRef(metricsPayload);
  metricsPayloadRef.current = metricsPayload;
  const publishRef = useRef(publishTopic);
  publishRef.current = publishTopic;

  const { pumpARunning, pumpBRunning } = readFromPlcFlags(metricsPayload);
  const pumpRunning = pumpARunning || pumpBRunning;

  useEffect(() => {
    if (!enabled || !pumpRunning) {
      return;
    }

    const publishOptions: MqttPublishOptions = { qos: 0, retain: false };
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const scheduleNext = () => {
      timer = setTimeout(
        tick,
        randomIntInclusive(COOLDOWN_MIN_INTERVAL_MS, COOLDOWN_MAX_INTERVAL_MS)
      );
    };

    const tick = () => {
      if (cancelled) {
        return;
      }

      // Stop as soon as the pumps drop out.
      const live = readFromPlcFlags(metricsPayloadRef.current);
      if (!(live.pumpARunning || live.pumpBRunning)) {
        return;
      }

      targetsRef.current.forEach((target) => {
        if (target.counterId === null || target.currentValue <= target.floor) {
          return;
        }

        const nextValue = Math.max(
          target.floor,
          target.currentValue - randomIntInclusive(COOLDOWN_MIN_STEP, COOLDOWN_MAX_STEP)
        );

        void publishRef.current(
          'gatewayOtCommand',
          buildCarloGavazziOtCommand(target.counterId, 'SetValue', nextValue),
          publishOptions
        );
      });

      const anyAboveFloor = targetsRef.current.some(
        (target) => target.counterId !== null && target.currentValue > target.floor
      );

      if (anyAboveFloor) {
        scheduleNext();
      }
    };

    scheduleNext();

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [enabled, pumpRunning]);
}
