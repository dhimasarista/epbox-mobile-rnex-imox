import mqtt, { type IClientOptions, type MqttClient } from 'mqtt';
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

export type MqttConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';
export type MqttLogLevel = 'info' | 'success' | 'warning' | 'error';

export type MqttLogEntry = {
  id: string;
  level: MqttLogLevel;
  message: string;
  timestamp: string;
};

type MqttContextValue = {
  clearLogs: () => void;
  connect: () => Promise<void>;
  connectedAt: number | null;
  disconnect: () => void;
  endpointLabel: string;
  isSettingsLoading: boolean;
  lastError: string | null;
  lastConnectedAt: number | null;
  logs: MqttLogEntry[];
  refreshSettings: () => Promise<void>;
  settings: MqttConnectionSettings;
  status: MqttConnectionState;
  statusMessage: string;
};

const MqttContext = createContext<MqttContextValue | null>(null);

function formatLogTimestamp() {
  return new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
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
  const [logs, setLogs] = useState<MqttLogEntry[]>([
    {
      id: 'mqtt-log-init',
      level: 'info',
      message: 'MQTT panel ready.',
      timestamp: formatLogTimestamp(),
    },
  ]);

  const appendLog = useCallback((level: MqttLogLevel, message: string) => {
    setLogs((currentLogs) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        level,
        message,
        timestamp: formatLogTimestamp(),
      },
      ...currentLogs,
    ].slice(0, 12));
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

  useEffect(() => {
    refreshSettings();

    return () => {
      disposeClient();
    };
  }, [disposeClient, refreshSettings]);

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
        connectTimeout: 10_000,
        keepalive: 30,
        password: latestSettings.password.trim() || undefined,
        protocolVersion: 4,
        reconnectPeriod: 0,
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

        const errorMessage = error.message || 'Unable to connect to MQTT broker.';

        setLastError(errorMessage);
        setStatus('error');
        setStatusMessage(errorMessage);
        setConnectedAt(null);
        appendLog('error', errorMessage);
        client.end(true);
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unable to start MQTT connection.';

      disposeClient('error', errorMessage);
      setLastError(errorMessage);
      appendLog('error', errorMessage);
    }
  }, [appendLog, disposeClient]);

  const disconnect = useCallback(() => {
    setLastError(null);
    disposeClient('disconnected', 'MQTT disconnected.');
    appendLog('info', 'MQTT disconnected by operator.');
  }, [appendLog, disposeClient]);

  const endpointLabel = useMemo(() => getMqttEndpointLabel(settings), [settings]);

  const value = useMemo<MqttContextValue>(
    () => ({
      clearLogs,
      connect,
      connectedAt,
      disconnect,
      endpointLabel,
      isSettingsLoading,
      lastError,
      lastConnectedAt,
      logs,
      refreshSettings,
      settings,
      status,
      statusMessage,
    }),
    [
      clearLogs,
      connect,
      connectedAt,
      disconnect,
      endpointLabel,
      isSettingsLoading,
      lastError,
      lastConnectedAt,
      logs,
      refreshSettings,
      settings,
      status,
      statusMessage,
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
