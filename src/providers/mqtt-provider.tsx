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
  getStoredMqttSettings,
  hasMqttConnectionSettings,
  type MqttConnectionSettings,
} from '@/lib/mqtt-settings';

export type MqttConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

type MqttContextValue = {
  connect: () => Promise<void>;
  disconnect: () => void;
  endpointLabel: string;
  isSettingsLoading: boolean;
  lastError: string | null;
  refreshSettings: () => Promise<void>;
  settings: MqttConnectionSettings;
  status: MqttConnectionState;
  statusMessage: string;
};

const MqttContext = createContext<MqttContextValue | null>(null);

export function MqttProvider({ children }: PropsWithChildren) {
  const clientRef = useRef<MqttClient | null>(null);
  const [settings, setSettings] = useState(DEFAULT_MQTT_CONNECTION_SETTINGS);
  const [isSettingsLoading, setIsSettingsLoading] = useState(true);
  const [status, setStatus] = useState<MqttConnectionState>('idle');
  const [statusMessage, setStatusMessage] = useState('MQTT idle.');
  const [lastError, setLastError] = useState<string | null>(null);

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
        setLastError('MQTT settings are empty. Save broker details in Settings first.');
        setStatus('error');
        setStatusMessage('MQTT settings are required before connecting.');
        return;
      }

      disposeClient();

      const brokerUrl = buildMqttBrokerUrl(latestSettings);
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
      setStatusMessage(`Connecting to ${brokerUrl}`);

      const client = mqtt.connect(brokerUrl, options);
      clientRef.current = client;

      client.on('connect', () => {
        if (clientRef.current !== client) {
          return;
        }

        setLastError(null);
        setStatus('connected');
        setStatusMessage('MQTT connected.');
      });

      client.on('reconnect', () => {
        if (clientRef.current !== client) {
          return;
        }

        setStatus('connecting');
        setStatusMessage('Reconnecting to broker...');
      });

      client.on('offline', () => {
        if (clientRef.current !== client) {
          return;
        }

        setStatus('disconnected');
        setStatusMessage('MQTT is offline.');
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
      });

      client.on('error', (error) => {
        if (clientRef.current !== client) {
          return;
        }

        const errorMessage = error.message || 'Unable to connect to MQTT broker.';

        setLastError(errorMessage);
        setStatus('error');
        setStatusMessage(errorMessage);
        client.end(true);
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unable to start MQTT connection.';

      disposeClient('error', errorMessage);
      setLastError(errorMessage);
    }
  }, [disposeClient]);

  const disconnect = useCallback(() => {
    setLastError(null);
    disposeClient('disconnected', 'MQTT disconnected.');
  }, [disposeClient]);

  const endpointLabel = useMemo(() => getMqttEndpointLabel(settings), [settings]);

  const value = useMemo<MqttContextValue>(
    () => ({
      connect,
      disconnect,
      endpointLabel,
      isSettingsLoading,
      lastError,
      refreshSettings,
      settings,
      status,
      statusMessage,
    }),
    [
      connect,
      disconnect,
      endpointLabel,
      isSettingsLoading,
      lastError,
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
