import mqtt, {
  type IClientOptions,
  type IClientPublishOptions,
  type MqttClient,
} from 'mqtt';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  buildMqttBrokerUrl,
  DEFAULT_MQTT_CONNECTION_SETTINGS,
  getMqttClientId,
  getMqttEndpointLabel,
  getMqttRuntimeTransport,
  getMqttRuntimeTransportLabel,
  getStoredMqttSettings,
  hasMqttConnectionSettings,
  type MqttConnectionSettings,
} from '@/lib/mqtt-settings';
import {
  getMqttTopicDefinition,
  getMqttTopicDefinitionByPath,
  mergeCarloGavazziMetricsPayload,
  MQTT_TOPIC_CATALOG,
  MQTT_TOPICS,
  type MqttTopicDefinition,
  type MqttTopicKey,
  type MqttTopicPayloadMap,
} from '@/lib/mqtt-topics';
import { readMetricsCache, writeMetricsCache } from '@/lib/mqtt-cache';

export type MqttConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';
// Broker session can stay "connected" while the physical gateway has gone silent;
// this window flags that the last metrics message is too old to trust.
export const GATEWAY_STALE_AFTER_MS = 60_000;
// How often the app fires a loopback latency probe while connected.
export const LATENCY_PING_INTERVAL_MS = 5_000;
export type MqttLogLevel = 'info' | 'success' | 'warning' | 'error';
export type MqttPublishOptions = Pick<IClientPublishOptions, 'qos' | 'retain'>;
export type MqttMessageSource = 'broker' | 'local-publish' | 'cache';

export type MqttLogEntry = {
  id: string;
  level: MqttLogLevel;
  message: string;
  timestamp: string;
};

export type MqttLatencySample = {
  label: string;
  requestTopicKey: MqttTopicKey;
  responseTopicKey: MqttTopicKey;
  startedAt: number;
  completedAt: number;
  durationMs: number;
};

export type MqttTopicMessage<TKey extends MqttTopicKey = MqttTopicKey> = {
  key: TKey;
  topic: string;
  payload: MqttTopicPayloadMap[TKey];
  raw: string;
  receivedAt: number;
  source: MqttMessageSource;
};

type MqttTopicMessages = Partial<Record<MqttTopicKey, MqttTopicMessage>>;

type PublishTopicFn = <TKey extends MqttTopicKey>(
  topicKey: TKey,
  payload: MqttTopicPayloadMap[TKey],
  options?: MqttPublishOptions
) => Promise<void>;

type GetTopicMessageFn = <TKey extends MqttTopicKey>(topicKey: TKey) => MqttTopicMessage<TKey> | null;

type RecordLatencySampleInput = {
  label: string;
  requestTopicKey: MqttTopicKey;
  responseTopicKey: MqttTopicKey;
  startedAt: number;
  completedAt?: number;
};

type MqttContextValue = {
  clearLogs: () => void;
  connect: () => Promise<void>;
  connectedAt: number | null;
  disconnect: () => void;
  endpointLabel: string;
  getTopicMessage: GetTopicMessageFn;
  isGatewayStale: boolean;
  isSettingsLoading: boolean;
  lastError: string | null;
  lastConnectedAt: number | null;
  lastGatewaySignalAt: number | null;
  latestLatencySample: MqttLatencySample | null;
  // Live broker round-trip latency (ms) from the loopback probe, or null until the
  // first echo arrives / while disconnected.
  latestPingLatencyMs: number | null;
  logs: MqttLogEntry[];
  publishTopic: PublishTopicFn;
  recordLatencySample: (sample: RecordLatencySampleInput) => void;
  refreshSettings: () => Promise<void>;
  settings: MqttConnectionSettings;
  status: MqttConnectionState;
  statusMessage: string;
  topicMessages: MqttTopicMessages;
};

const MqttContext = createContext<MqttContextValue | null>(null);

function formatLogTimestamp() {
  return new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function createTopicMessage<TKey extends MqttTopicKey>(
  definition: MqttTopicDefinition<TKey>,
  payload: MqttTopicPayloadMap[TKey],
  raw: string,
  source: MqttMessageSource
): MqttTopicMessage<TKey> {
  return {
    key: definition.key,
    topic: definition.topic,
    payload,
    raw,
    receivedAt: Date.now(),
    source,
  };
}

function getFriendlyMqttErrorMessage(error: Error, brokerUrl: string) {
  const errorMessage = error.message || 'Unable to connect to MQTT broker.';

  if (errorMessage.includes('connack timeout')) {
    return `MQTT connack timeout — broker did not answer CONNECT on ${brokerUrl}. Retrying…`;
  }

  return errorMessage;
}

// Errors where the mqtt client should keep its built-in reconnect running.
// For permanent errors (bad credentials, protocol mismatch) we still hard-kill.
function isMqttTransientError(error: Error) {
  const msg = error.message ?? '';
  return msg.includes('connack timeout') || msg.includes('connect ETIMEDOUT') || msg.includes('ECONNREFUSED');
}

export function MqttProvider({ children }: PropsWithChildren) {
  const clientRef = useRef<MqttClient | null>(null);
  const [settings, setSettings] = useState(DEFAULT_MQTT_CONNECTION_SETTINGS);
  const [isSettingsLoading, setIsSettingsLoading] = useState(true);
  const [status, setStatus] = useState<MqttConnectionState>('idle');
  const [statusMessage, setStatusMessage] = useState('MQTT idle.');
  const [lastError, setLastError] = useState<string | null>(null);
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  const [lastConnectedAt, setLastConnectedAt] = useState<number | null>(null);
  const [latestLatencySample, setLatestLatencySample] = useState<MqttLatencySample | null>(null);
  const [latestPingLatencyMs, setLatestPingLatencyMs] = useState<number | null>(null);
  // Nonce + start time of the loopback probe we are currently waiting to hear back.
  const pendingPingRef = useRef<{ nonce: string; startedAt: number } | null>(null);
  const [topicMessages, setTopicMessages] = useState<MqttTopicMessages>({});
  const [logs, setLogs] = useState<MqttLogEntry[]>([
    {
      id: 'mqtt-log-init',
      level: 'info',
      message: 'MQTT panel ready.',
      timestamp: formatLogTimestamp(),
    },
  ]);

  const appendLog = useCallback((level: MqttLogLevel, message: string) => {
    setLogs((currentLogs) =>
      [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          level,
          message,
          timestamp: formatLogTimestamp(),
        },
        ...currentLogs,
      ].slice(0, 20)
    );
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([
      {
        id: `mqtt-log-cleared-${Date.now()}`,
        level: 'info',
        message: 'Log cleared by operator.',
        timestamp: formatLogTimestamp(),
      },
    ]);
  }, []);

  const disposeClient = useCallback((nextStatus?: MqttConnectionState, nextMessage?: string) => {
    const client = clientRef.current;

    if (client) {
      client.removeAllListeners();
      client.end(true);
      clientRef.current = null;
    }

    if (nextStatus) {
      setStatus(nextStatus);
    }

    if (nextMessage) {
      setStatusMessage(nextMessage);
    }

    if (nextStatus && nextStatus !== 'connected') {
      setConnectedAt(null);
    }
  }, []);

  const refreshSettings = useCallback(async () => {
    try {
      const storedSettings = await getStoredMqttSettings();

      setSettings(storedSettings);
    } finally {
      setIsSettingsLoading(false);
    }
  }, []);

  const subscribeToCatalog = useCallback(
    (client: MqttClient) => {
      MQTT_TOPIC_CATALOG.forEach((definition) => {
        if (definition.direction === 'publish') {
          return;
        }

        // A definition may fan out to several physical topics (the gateway now
        // splits metrics across metrics/pressure-transmitter/acc-room), all
        // routed back into one store — subscribe to every one.
        const topics = definition.subscribeTopics ?? [definition.topic];

        topics.forEach((topic) => {
          client.subscribe(topic, { qos: definition.qos ?? 0 }, (error) => {
            if (error) {
              appendLog('error', `Failed to subscribe ${definition.label} (${topic}): ${error.message}`);
              return;
            }

            appendLog('success', `Subscribed ${definition.label} (${topic}).`);
          });
        });
      });
    },
    [appendLog]
  );

  useEffect(() => {
    void refreshSettings();

    // Hydrate topicMessages from disk cache so screens show last known data
    // immediately on cold start, before the first MQTT message arrives.
    readMetricsCache().then((entry) => {
      if (!entry) return;

      const definition = MQTT_TOPICS.gatewayMetrics;
      setTopicMessages((current) => {
        // Do not overwrite a message that arrived from the broker already.
        if (current.gatewayMetrics?.source === 'broker') return current;
        return {
          ...current,
          gatewayMetrics: {
            key: definition.key,
            topic: definition.topic,
            payload: entry.payload,
            raw: '',
            receivedAt: entry.cachedAt,
            source: 'cache',
          },
        };
      });
    });

    return () => {
      disposeClient();
    };
  }, [disposeClient, refreshSettings]);

  const getTopicMessage = useCallback(
    function <TKey extends MqttTopicKey>(topicKey: TKey) {
      return (topicMessages[topicKey] as MqttTopicMessage<TKey> | undefined) ?? null;
    },
    [topicMessages]
  );

  const recordLatencySample = useCallback((sample: RecordLatencySampleInput) => {
    const completedAt = sample.completedAt ?? Date.now();

    setLatestLatencySample({
      label: sample.label,
      requestTopicKey: sample.requestTopicKey,
      responseTopicKey: sample.responseTopicKey,
      startedAt: sample.startedAt,
      completedAt,
      durationMs: Math.max(0, completedAt - sample.startedAt),
    });
  }, []);

  const publishTopic = useCallback(
    async function <TKey extends MqttTopicKey>(
      topicKey: TKey,
      payload: MqttTopicPayloadMap[TKey],
      options?: MqttPublishOptions
    ) {
      const client = clientRef.current;
      const definition = getMqttTopicDefinition(topicKey);

      if (!client || !client.connected) {
        // throw new Error(`MQTT is not connected. Unable to publish ${definition.label}.`);
        throw new Error(`MQTT is not connected`);
      }

      const rawPayload = definition.serialize(payload);

      await new Promise<void>((resolve, reject) => {
        client.publish(
          definition.topic,
          rawPayload,
          {
            qos: options?.qos ?? definition.qos ?? 0,
            retain: options?.retain ?? definition.retain ?? false,
          },
          (error) => {
            if (error) {
              reject(error);
              return;
            }

            resolve();
          }
        );
      });

      setTopicMessages((currentMessages) => ({
        ...currentMessages,
        [topicKey]: createTopicMessage(definition, payload, rawPayload, 'local-publish'),
      }));
    },
    []
  );

  const connect = useCallback(async () => {
    try {
      const latestSettings = await getStoredMqttSettings();

      setSettings(latestSettings);

      if (!hasMqttConnectionSettings(latestSettings)) {
        appendLog('warning', 'Connect requested without saved broker settings.');
        setLastError('MQTT settings are empty. Save broker details in Settings first.');
        setStatus('error');
        setStatusMessage('MQTT settings are required before connecting.');
        return;
      }

      disposeClient();

      const runtimeTransport = getMqttRuntimeTransport();
      const brokerUrl = buildMqttBrokerUrl(latestSettings, runtimeTransport);
      const options: IClientOptions = {
        clean: true,
        clientId: getMqttClientId(latestSettings),
        connectTimeout: 20_000,
        keepalive: 30,
        password: latestSettings.password.trim() || undefined,
        protocolVersion: 4,
        // Auto-reconnect every 5s: broker/gateway link is expected to be unstable
        // (maritime/edge networks), so the client must recover without operator action.
        reconnectPeriod: 5_000,
        username: latestSettings.username.trim() || undefined,
      };

      setLastError(null);
      setStatus('connecting');
      setStatusMessage(`Connecting via ${getMqttRuntimeTransportLabel(runtimeTransport)} to ${brokerUrl}`);
      appendLog(
        'info',
        `Connecting via ${getMqttRuntimeTransportLabel(runtimeTransport)} to ${brokerUrl}`
      );

      const client = mqtt.connect(brokerUrl, options);
      clientRef.current = client;

      client.on('connect', () => {
        if (clientRef.current !== client) {
          return;
        }

        setLastError(null);
        setStatus('connected');
        setStatusMessage('MQTT connected.');
        const now = Date.now();
        setConnectedAt(now);
        setLastConnectedAt(now);
        appendLog('success', 'Broker connected successfully.');
        subscribeToCatalog(client);
      });

      client.on('message', (topic, messageBuffer) => {
        if (clientRef.current !== client) {
          return;
        }

        const definition = getMqttTopicDefinitionByPath(topic);

        if (!definition) {
          return;
        }

        try {
          const rawPayload = messageBuffer.toString();
          const payload = definition.parse(rawPayload);

          // Loopback latency probe echoed back by the broker — time the round trip
          // and skip the topic store (it is not gateway data).
          if (definition.key === 'appLatencyPing') {
            const pingPayload = payload as MqttTopicPayloadMap['appLatencyPing'];
            const pending = pendingPingRef.current;
            if (pending && pending.nonce === pingPayload.nonce) {
              pendingPingRef.current = null;
              setLatestPingLatencyMs(Math.max(0, Date.now() - pending.startedAt));
            }
            return;
          }

          setTopicMessages((currentMessages) => {
            if (definition.key === 'gatewayMetrics') {
              const previousMessage = currentMessages.gatewayMetrics;
              const nextMetricsPayload = payload as MqttTopicPayloadMap['gatewayMetrics'];
              const previousMetricsPayload = previousMessage?.payload as
                | MqttTopicPayloadMap['gatewayMetrics']
                | undefined;
              // Metrics now arrive split across three topics, each a partial
              // snapshot (disjoint devices). Always merge (union by device id)
              // onto whatever we had — broker OR the disk cache — so devices from
              // the other topics stay visible instead of flickering away until
              // their own topic next ticks.
              const mergedPayload = previousMetricsPayload
                ? mergeCarloGavazziMetricsPayload(previousMetricsPayload, nextMetricsPayload)
                : nextMetricsPayload;

              // Persist to disk so cold-start shows last known data.
              void writeMetricsCache(mergedPayload);

              return {
                ...currentMessages,
                [definition.key]: createTopicMessage(definition, mergedPayload, rawPayload, 'broker'),
              };
            }

            return {
              ...currentMessages,
              [definition.key]: createTopicMessage(definition, payload, rawPayload, 'broker'),
            };
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown payload parsing error.';

          appendLog('error', `Failed to parse ${definition.label}: ${errorMessage}`);
        }
      });

      client.on('reconnect', () => {
        if (clientRef.current !== client) {
          return;
        }

        setStatus('connecting');
        setStatusMessage('Reconnecting to broker...');
        appendLog('warning', 'Reconnecting to broker...');
      });

      client.on('offline', () => {
        if (clientRef.current !== client) {
          return;
        }

        setStatus('disconnected');
        setStatusMessage('MQTT is offline.');
        appendLog('warning', 'MQTT session went offline.');
      });

      client.on('close', () => {
        if (clientRef.current !== client) {
          return;
        }

        clientRef.current = null;

        setStatus((currentStatus) => (currentStatus === 'error' ? 'error' : 'disconnected'));
        setStatusMessage((currentMessage) =>
          currentMessage === 'MQTT connected.' ? 'MQTT disconnected.' : currentMessage
        );
        appendLog('info', 'MQTT session closed.');
      });

      client.on('error', (error) => {
        if (clientRef.current !== client) {
          return;
        }

        const errorMessage = getFriendlyMqttErrorMessage(error, brokerUrl);

        setLastError(errorMessage);
        setConnectedAt(null);
        appendLog('error', errorMessage);

        if (isMqttTransientError(error)) {
          // Let the client's reconnectPeriod handle retry — do not hard-kill.
          setStatus('connecting');
          setStatusMessage(errorMessage);
        } else {
          setStatus('error');
          setStatusMessage(errorMessage);
          client.end(true);
        }
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unable to start MQTT connection.';

      disposeClient('error', errorMessage);
      setLastError(errorMessage);
      appendLog('error', errorMessage);
    }
  }, [appendLog, disposeClient, subscribeToCatalog]);

  const disconnect = useCallback(() => {
    setLastError(null);
    disposeClient('disconnected', 'MQTT disconnected.');
    appendLog('info', 'MQTT disconnected by operator.');
  }, [appendLog, disposeClient]);

  const endpointLabel = useMemo(() => getMqttEndpointLabel(settings), [settings]);

  const lastGatewaySignalAt = useMemo(() => {
    const receivedAt = topicMessages.gatewayMetrics?.receivedAt;
    return typeof receivedAt === 'number' ? receivedAt : null;
  }, [topicMessages.gatewayMetrics]);

  const [staleCheckNow, setStaleCheckNow] = useState(() => Date.now());

  useEffect(() => {
    if (status !== 'connected' || lastGatewaySignalAt === null) {
      return;
    }

    const intervalId = setInterval(() => {
      setStaleCheckNow(Date.now());
    }, 5_000);

    return () => {
      clearInterval(intervalId);
    };
  }, [lastGatewaySignalAt, status]);

  const isGatewayStale =
    status === 'connected' &&
    lastGatewaySignalAt !== null &&
    staleCheckNow - lastGatewaySignalAt > GATEWAY_STALE_AFTER_MS;

  // Live latency probe: while connected, publish a self-addressed ping and time
  // the broker's echo. Fires immediately on connect, then every interval. Safe —
  // it round-trips through the broker only, never the gateway/PLC.
  useEffect(() => {
    if (status !== 'connected') {
      pendingPingRef.current = null;
      setLatestPingLatencyMs(null);
      return;
    }

    const sendPing = () => {
      const client = clientRef.current;
      if (!client || !client.connected) {
        return;
      }

      const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const startedAt = Date.now();
      pendingPingRef.current = { nonce, startedAt };

      const definition = MQTT_TOPICS.appLatencyPing;
      client.publish(
        definition.topic,
        definition.serialize({ nonce, sentAt: startedAt }),
        { qos: definition.qos ?? 0 }
      );
    };

    sendPing();
    const intervalId = setInterval(sendPing, LATENCY_PING_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [status]);

  const value = useMemo<MqttContextValue>(
    () => ({
      clearLogs,
      connect,
      connectedAt,
      disconnect,
      endpointLabel,
      getTopicMessage,
      isGatewayStale,
      isSettingsLoading,
      lastError,
      lastConnectedAt,
      lastGatewaySignalAt,
      latestLatencySample,
      latestPingLatencyMs,
      logs,
      publishTopic,
      recordLatencySample,
      refreshSettings,
      settings,
      status,
      statusMessage,
      topicMessages,
    }),
    [
      clearLogs,
      connect,
      connectedAt,
      disconnect,
      endpointLabel,
      getTopicMessage,
      isGatewayStale,
      isSettingsLoading,
      lastError,
      lastConnectedAt,
      lastGatewaySignalAt,
      latestLatencySample,
      latestPingLatencyMs,
      logs,
      publishTopic,
      recordLatencySample,
      refreshSettings,
      settings,
      status,
      statusMessage,
      topicMessages,
    ]
  );

  return <MqttContext.Provider value={value}>{children}</MqttContext.Provider>;
}

export function useMqtt() {
  const context = useContext(MqttContext);

  if (!context) {
    throw new Error('useMqtt must be used within MqttProvider');
  }

  return context;
}

export function useMqttTopic<TKey extends MqttTopicKey>(topicKey: TKey) {
  const { getTopicMessage, publishTopic } = useMqtt();
  const message = getTopicMessage(topicKey);

  const publish = useCallback(
    (payload: MqttTopicPayloadMap[TKey], options?: MqttPublishOptions) =>
      publishTopic(topicKey, payload, options),
    [publishTopic, topicKey]
  );

  return useMemo(
    () => ({
      definition: getMqttTopicDefinition(topicKey),
      message,
      payload: message?.payload ?? null,
      publish,
    }),
    [message, publish, topicKey]
  );
}

export type {
  MqttTopicDefinition,
  MqttTopicKey,
  MqttTopicPayloadMap
} from '@/lib/mqtt-topics';
export { MQTT_TOPIC_CATALOG, MQTT_TOPICS };

