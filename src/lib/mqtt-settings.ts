import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const MQTT_SETTINGS_STORAGE_KEY = 'epbox.connection.settings';
export type MqttRuntimeTransport = 'ws' | 'tcp';

export type MqttConnectionSettings = {
  serverAddress: string;
  port: string;
  clientId: string;
  username: string;
  password: string;
};

export const DEFAULT_MQTT_CONNECTION_SETTINGS: MqttConnectionSettings = {
  serverAddress: '',
  port: '',
  clientId: '',
  username: '',
  password: '',
};

export async function getStoredMqttSettingsValue() {
  if (Platform.OS === 'web') {
    return globalThis.localStorage?.getItem(MQTT_SETTINGS_STORAGE_KEY) ?? null;
  }

  return SecureStore.getItemAsync(MQTT_SETTINGS_STORAGE_KEY);
}

export async function setStoredMqttSettingsValue(value: string) {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(MQTT_SETTINGS_STORAGE_KEY, value);
    return;
  }

  await SecureStore.setItemAsync(MQTT_SETTINGS_STORAGE_KEY, value);
}

export async function getStoredMqttSettings() {
  try {
    const storedValue = await getStoredMqttSettingsValue();

    if (!storedValue) {
      return DEFAULT_MQTT_CONNECTION_SETTINGS;
    }

    const parsed = JSON.parse(storedValue) as Partial<MqttConnectionSettings>;

    return {
      serverAddress: parsed.serverAddress ?? '',
      port: parsed.port ?? '',
      clientId: parsed.clientId ?? '',
      username: parsed.username ?? '',
      password: parsed.password ?? '',
    };
  } catch {
    return DEFAULT_MQTT_CONNECTION_SETTINGS;
  }
}

export async function setStoredMqttSettings(settings: MqttConnectionSettings) {
  await setStoredMqttSettingsValue(JSON.stringify(settings));
}

export function hasMqttConnectionSettings(settings: MqttConnectionSettings) {
  return settings.serverAddress.trim().length > 0;
}

function getDefaultWebSocketProtocol(port: string) {
  return ['443', '8081', '8084', '8443', '8884'].includes(port) ? 'wss' : 'ws';
}

function getDefaultTcpProtocol(port: string) {
  return ['443', '8883', '8884'].includes(port) ? 'mqtts' : 'mqtt';
}

export function getMqttRuntimeTransport(): MqttRuntimeTransport {
  if (Platform.OS === 'web') {
    return 'ws';
  }

  return Constants.executionEnvironment === 'standalone' ? 'tcp' : 'ws';
}

export function getMqttRuntimeTransportLabel(transport = getMqttRuntimeTransport()) {
  return transport === 'tcp' ? 'TCP' : 'WS';
}

export function getMqttRuntimeTransportDetail(settings: MqttConnectionSettings) {
  const runtimeTransport = getMqttRuntimeTransport();
  const address = settings.serverAddress.trim();

  if (!address) {
    return 'Fill MQTT settings first';
  }

  if (address.includes('://')) {
    return 'Explicit protocol from saved broker URL';
  }

  if (runtimeTransport === 'tcp') {
    return 'Standalone native build uses MQTT TCP/TLS';
  }

  return 'Development runtime uses MQTT WebSocket';
}

export function buildMqttBrokerUrl(
  settings: MqttConnectionSettings,
  runtimeTransport = getMqttRuntimeTransport()
) {
  const rawAddress = settings.serverAddress.trim();
  const rawPort = settings.port.trim();

  if (!rawAddress) {
    throw new Error('MQTT server address is required.');
  }

  const addressWithProtocol = rawAddress.includes('://')
    ? rawAddress
    : runtimeTransport === 'tcp'
      ? `${getDefaultTcpProtocol(rawPort)}://${rawAddress}`
      : `${getDefaultWebSocketProtocol(rawPort)}://${rawAddress}`;

  const url = new URL(addressWithProtocol);

  if (rawPort && !url.port) {
    url.port = rawPort;
  }

  if ((url.protocol === 'ws:' || url.protocol === 'wss:') && (!url.pathname || url.pathname === '/')) {
    url.pathname = '/mqtt';
  }

  return url.toString();
}

export function getMqttEndpointLabel(
  settings: MqttConnectionSettings,
  runtimeTransport = getMqttRuntimeTransport()
) {
  if (!hasMqttConnectionSettings(settings)) {
    return 'Not configured';
  }

  try {
    return buildMqttBrokerUrl(settings, runtimeTransport);
  } catch {
    return settings.serverAddress.trim();
  }
}

export function getMqttTransportLabel(endpointLabel: string) {
  if (endpointLabel.startsWith('wss://')) {
    return 'WSS';
  }

  if (endpointLabel.startsWith('ws://')) {
    return 'WS';
  }

  if (endpointLabel.startsWith('mqtts://') || endpointLabel.startsWith('tls://')) {
    return 'MQTTS';
  }

  if (endpointLabel.startsWith('mqtt://') || endpointLabel.startsWith('tcp://')) {
    return 'MQTT';
  }

  return 'MQTT';
}

export function getMqttClientId(settings: MqttConnectionSettings) {
  const savedClientId = settings.clientId.trim();

  if (savedClientId) {
    return savedClientId;
  }

  return `epbox-mobile-${Platform.OS}-${Date.now()}`;
}
