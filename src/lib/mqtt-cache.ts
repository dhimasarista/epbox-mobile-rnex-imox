// Persists the last known gatewayMetrics payload to disk so screens show
// stale-but-real data on cold start before the first MQTT message arrives.
// Native: expo-file-system cacheDirectory (survives app restart, cleared by OS
// under storage pressure — intentional for cache semantics).
// Web: localStorage key (same behaviour as other local storage in the app).

import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import type { CarloGavazziMetricsPayload } from '@/lib/mqtt-topics';

const WEB_STORAGE_KEY = 'epbox.mqtt.metrics-cache';
const CACHE_FILENAME = 'epbox-mqtt-metrics-cache.json';

export type MetricsCacheEntry = {
  payload: CarloGavazziMetricsPayload;
  cachedAt: number;
};

function getCacheFile() {
  return new File(Paths.cache, CACHE_FILENAME);
}

export async function readMetricsCache(): Promise<MetricsCacheEntry | null> {
  try {
    if (Platform.OS === 'web') {
      const raw = globalThis.localStorage?.getItem(WEB_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as MetricsCacheEntry;
    }

    const file = getCacheFile();
    if (!file.exists) return null;

    const raw = await file.text();
    return JSON.parse(raw) as MetricsCacheEntry;
  } catch {
    return null;
  }
}

export async function writeMetricsCache(payload: CarloGavazziMetricsPayload): Promise<void> {
  try {
    const entry: MetricsCacheEntry = { payload, cachedAt: Date.now() };
    const raw = JSON.stringify(entry);

    if (Platform.OS === 'web') {
      globalThis.localStorage?.setItem(WEB_STORAGE_KEY, raw);
      return;
    }

    getCacheFile().write(raw);
  } catch {
    // Cache write failure is non-fatal — app still works from live MQTT.
  }
}

export async function clearMetricsCache(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.removeItem(WEB_STORAGE_KEY);
      return;
    }

    const file = getCacheFile();
    if (file.exists) {
      file.delete();
    }
  } catch {
    // non-fatal
  }
}
