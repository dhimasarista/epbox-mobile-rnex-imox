import { useCallback, useEffect, useRef, useState } from 'react';

import { usePendingCommand } from '@/hooks/use-pending-command';
import {
  buildCarloGavazziOtCommand,
  getCarloGavazziCounterNumericValue,
  type CarloGavazziMetricsPayload,
} from '@/lib/mqtt-topics';
import type { MqttConnectionState, PublishTopicFn } from '@/providers/mqtt-provider';

const COMMAND_DEBOUNCE_MS = 250;
const COMMAND_ID = 'counter';

type CounterCommandSnapshot = {
  previousConfirmedValue: number;
  previousDraftValue: number;
  expectedValue: number;
  baselineReceivedAt: number | null;
};

/**
 * Single-counter slider control: local draft value follows the finger, confirmed
 * value follows the gateway metrics, and a SetValue command is published on a
 * debounce with the mandatory pending-command lock/rollback/timeout pattern.
 */
export function useCounterSliderControl({
  label,
  counterId,
  status,
  metricsPayload,
  metricsReceivedAt,
  publishTopic,
  onError,
  initialValue = 0,
  timeoutMs,
}: {
  label: string;
  counterId: number;
  status: MqttConnectionState;
  metricsPayload: CarloGavazziMetricsPayload | null;
  metricsReceivedAt: number | null;
  publishTopic: PublishTopicFn;
  onError?: (message: string) => void;
  initialValue?: number;
  timeoutMs?: number;
}) {
  const [draftValue, setDraftValue] = useState(initialValue);
  const [confirmedValue, setConfirmedValue] = useState(initialValue);
  const { commands, isPending, resolveAllCommands, resolveCommand, startCommand } =
    usePendingCommand<CounterCommandSnapshot>();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapshotRef = useRef<{ previousConfirmedValue: number; previousDraftValue: number } | null>(
    null
  );
  const statusRef = useRef(status);
  statusRef.current = status;
  const latestMetricValueRef = useRef<number | null>(null);
  const draftValueRef = useRef(draftValue);
  draftValueRef.current = draftValue;
  const confirmedValueRef = useRef(confirmedValue);
  confirmedValueRef.current = confirmedValue;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const pendingCommand = commands[COMMAND_ID] ?? null;

  const rollback = useCallback((command: { snapshot: CounterCommandSnapshot }) => {
    const latestMetricValue = statusRef.current === 'connected' ? latestMetricValueRef.current : null;
    setDraftValue(latestMetricValue ?? command.snapshot.previousDraftValue);
    setConfirmedValue(latestMetricValue ?? command.snapshot.previousConfirmedValue);
  }, []);

  const sendSetValue = useCallback(
    async (nextValue: number, snapshot: CounterCommandSnapshot) => {
      if (status !== 'connected') {
        rollback({ snapshot });
        onErrorRef.current?.(`MQTT disconnected. ${label} not sent.`);
        return;
      }

      if (isPending(COMMAND_ID)) {
        onErrorRef.current?.(`${label} is already waiting for gateway response.`);
        return;
      }

      const started = startCommand({
        id: COMMAND_ID,
        label,
        snapshot,
        timeoutMs,
        onTimeout: (command) => {
          rollback(command);
          onErrorRef.current?.(`${command.label} timed out. Rolled back.`);
        },
      });

      if (!started) {
        return;
      }

      try {
        await publishTopic('gatewayOtCommand', buildCarloGavazziOtCommand(counterId, 'SetValue', nextValue));
      } catch (error) {
        resolveCommand(COMMAND_ID, { onResolve: rollback });
        onErrorRef.current?.(error instanceof Error ? error.message : `Unable to send ${label}.`);
      }
    },
    [counterId, isPending, label, publishTopic, resolveCommand, rollback, startCommand, status]
  );

  const onChange = useCallback(
    (nextValue: number) => {
      const roundedValue = Math.round(nextValue);

      if (!snapshotRef.current) {
        snapshotRef.current = {
          previousConfirmedValue: confirmedValueRef.current,
          previousDraftValue: draftValueRef.current,
        };
      }

      setDraftValue(roundedValue);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        const snapshot = snapshotRef.current ?? {
          previousConfirmedValue: confirmedValueRef.current,
          previousDraftValue: draftValueRef.current,
        };
        snapshotRef.current = null;

        void sendSetValue(roundedValue, {
          ...snapshot,
          expectedValue: roundedValue,
          baselineReceivedAt: metricsReceivedAt,
        });
      }, COMMAND_DEBOUNCE_MS);
    },
    [metricsReceivedAt, sendSetValue]
  );

  // Reconcile confirmed/draft value from the latest gateway metrics, and clear the
  // pending command once its expected value comes back confirmed.
  useEffect(() => {
    if (!metricsPayload) {
      return;
    }

    const numericValue = getCarloGavazziCounterNumericValue(metricsPayload, counterId);

    if (numericValue === null) {
      return;
    }

    const roundedValue = Math.round(numericValue);
    latestMetricValueRef.current = roundedValue;
    setConfirmedValue(roundedValue);

    if (!pendingCommand) {
      setDraftValue(roundedValue);
      return;
    }

    const isFreshGatewayResponse =
      metricsReceivedAt !== null &&
      (pendingCommand.snapshot.baselineReceivedAt === null
        ? metricsReceivedAt >= pendingCommand.startedAt
        : metricsReceivedAt > pendingCommand.snapshot.baselineReceivedAt);

    if (isFreshGatewayResponse && pendingCommand.snapshot.expectedValue === roundedValue) {
      setDraftValue(roundedValue);
      resolveCommand(COMMAND_ID);
    }
  }, [counterId, metricsPayload, metricsReceivedAt, pendingCommand, resolveCommand]);

  // Disconnect: cancel in-flight debounce and roll every pending command back.
  useEffect(() => {
    if (status === 'connected') {
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    snapshotRef.current = null;
    resolveAllCommands({ onResolve: rollback });
  }, [resolveAllCommands, rollback, status]);

  return {
    confirmedValue,
    draftValue,
    isPending: pendingCommand !== null,
    onChange,
  };
}
