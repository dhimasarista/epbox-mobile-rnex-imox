import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const MQTT_SETTINGS_STORAGE_KEY = 'epbox.connection.settings';

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

export function buildMqttBrokerUrl(settings: MqttConnectionSettings) {
  const rawAddress = settings.serverAddress.trim();
  const rawPort = settings.port.trim();

  if (!rawAddress) {
    throw new Error('MQTT server address is required.');
  }

  const addressWithProtocol = rawAddress.includes('://')
    ? rawAddress
    : `${getDefaultWebSocketProtocol(rawPort)}://${rawAddress}`;

  const url = new URL(addressWithProtocol);

  if (rawPort && !url.port) {
    url.port = rawPort;
  }

  if (!url.pathname || url.pathname === '/') {
    url.pathname = '/mqtt';
  }

  return url.toString();
}

export function getMqttEndpointLabel(settings: MqttConnectionSettings) {
  if (!hasMqttConnectionSettings(settings)) {
    return 'Not configured';
  }

  try {
    return buildMqttBrokerUrl(settings);
  } catch {
    return settings.serverAddress.trim();
  }
}

export function getMqttClientId(settings: MqttConnectionSettings) {
  const savedClientId = settings.clientId.trim();

  if (savedClientId) {
    return savedClientId;
  }

  return `epbox-mobile-${Platform.OS}-${Date.now()}`;
}
