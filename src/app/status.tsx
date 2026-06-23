import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  hasMqttConnectionSettings
} from '@/lib/mqtt-settings';
import {
  MQTT_TOPIC_CATALOG,
  useMqtt,
  type MqttConnectionState,
  type MqttLogLevel,
  type MqttTopicDefinition,
} from '@/providers/mqtt-provider';
import { AppColors } from '@/styles';
import { styles } from '@/styles/screens/status.styles';

type StatusOverviewCard = {
  title: string;
  value: string;
  detail: string;
  iconFamily: 'feather' | 'material';
  iconName: string;
  accent: string;
};

type LogFilter = 'all' | MqttLogLevel;

const MQTT_STATUS_META: Record<
  MqttConnectionState,
  { accent: string; label: string; detail: string }
> = {
  idle: {
    accent: AppColors.textSubtle,
    label: 'Idle',
    detail: 'Broker session is standing by.',
  },
  connecting: {
    accent: AppColors.primary,
    label: 'Connecting',
    detail: 'Opening MQTT session...',
  },
  connected: {
    accent: AppColors.success,
    label: 'Connected',
    detail: 'Broker session is active.',
  },
  disconnected: {
    accent: AppColors.textSubtle,
    label: 'Disconn..',
    detail: 'Broker session is closed.',
  },
  error: {
    accent: AppColors.error,
    label: 'Error',
    detail: 'Broker session needs attention.',
  },
};

const LOG_FILTERS: { label: string; value: LogFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Info', value: 'info' },
  { label: 'Success', value: 'success' },
  { label: 'Warning', value: 'warning' },
  { label: 'Error', value: 'error' },
] as const;

function getLogAccent(level: MqttLogLevel) {
  if (level === 'success') {
    return AppColors.success;
  }

  if (level === 'warning') {
    return AppColors.warning;
  }

  if (level === 'error') {
    return AppColors.error;
  }

  return AppColors.primary;
}

function getTopicDirectionAccent(direction: MqttTopicDefinition['direction']) {
  if (direction === 'publish') {
    return AppColors.primary;
  }

  if (direction === 'subscribe') {
    return AppColors.info;
  }

  return AppColors.success;
}

function getTopicDirectionLabel(direction: MqttTopicDefinition['direction']) {
  if (direction === 'publish') {
    return 'Publish';
  }

  if (direction === 'subscribe') {
    return 'Subscribe';
  }

  return 'Duplex';
}

function formatConnectedTimestamp(timestamp: number | null) {
  if (!timestamp) {
    return 'No session yet';
  }

  return new Date(timestamp).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatSessionDuration(connectedAt: number | null, nowTimestamp: number) {
  if (!connectedAt) {
    return '00:00:00';
  }

  const totalSeconds = Math.max(0, Math.floor((nowTimestamp - connectedAt) / 1000));
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');

  return `${hours}:${minutes}:${seconds}`;
}

function formatTopicPayloadPreview(payload: unknown) {
  try {
    const serialized = JSON.stringify(payload);

    if (serialized.length <= 120) {
      return serialized;
    }

    return `${serialized.slice(0, 117)}...`;
  } catch {
    return 'Unable to preview payload.';
  }
}

export default function StatusScreen() {
  const {
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
    topicMessages,
  } = useMqtt();
  const [activeLogFilter, setActiveLogFilter] = useState<LogFilter>('all');
  const [nowTimestamp, setNowTimestamp] = useState(() => Date.now());

  useFocusEffect(
    useCallback(() => {
      void refreshSettings();
    }, [refreshSettings])
  );

  useEffect(() => {
    if (!connectedAt) {
      return;
    }

    const intervalId = setInterval(() => {
      setNowTimestamp(Date.now());
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [connectedAt]);

  const statusMeta = MQTT_STATUS_META[status];
  const hasSettings = hasMqttConnectionSettings(settings);
  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting';
  const actionLabel = isConnecting
    ? 'Connecting...'
    : isConnected
      ? 'Disconnect MQTT'
      : 'Connect MQTT';

  const overviewCards: StatusOverviewCard[] = useMemo(
    () => [
      {
        title: 'Session Duration',
        value: isConnected ? formatSessionDuration(connectedAt, nowTimestamp) : 'Offline',
        detail: isConnected ? 'Active uptime' : 'No running session',
        iconFamily: 'material',
        iconName: 'timer-outline',
        accent: '#3B82F6',
      },
    ],
    [
      connectedAt,
      endpointLabel,
      hasSettings,
      isConnected,
      isSettingsLoading,
      lastConnectedAt,
      lastError,
      nowTimestamp,
      settings,
      statusMessage,
      statusMeta.accent,
      statusMeta.label,
    ]
  );

  const filteredLogs = useMemo(
    () => logs.filter((log) => activeLogFilter === 'all' || log.level === activeLogFilter),
    [activeLogFilter, logs]
  );
  const topicCatalog = useMemo(
    () =>
      MQTT_TOPIC_CATALOG.map((definition) => ({
        definition,
        latestMessage: topicMessages[definition.key] ?? null,
      })),
    [topicMessages]
  );

  const handleConnectionAction = () => {
    if (isConnected) {
      disconnect();
      return;
    }

    void connect();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>System Status</Text>
          <View style={styles.headerBadge}>
            <MaterialCommunityIcons name="transmission-tower" size={18} color={statusMeta.accent} />
            <Text style={styles.headerBadgeText}>{statusMeta.label}</Text>
          </View>
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>{isSettingsLoading ? 'Loading saved settings...' : endpointLabel}</Text>
          <Text style={styles.heroValue}>Broker Connection</Text>
          {/* <Text style={styles.heroDetail}>{lastError ?? statusMeta.detail}</Text> */}
          <Pressable
            disabled={isSettingsLoading || isConnecting}
            onPress={handleConnectionAction}
            style={({ pressed }) => [
              styles.mqttActionButton,
              isConnected && styles.mqttActionButtonDisconnect,
              (pressed || isConnecting) && styles.mqttActionButtonPressed,
              (isSettingsLoading || isConnecting) && styles.mqttActionButtonDisabled,
            ]}>
            <Text style={styles.mqttActionButtonText}>{actionLabel}</Text>
          </Pressable>
        </View>

        {/* <Text style={[styles.sectionLabel, styles.sectionLabelStandalone]}>Overview</Text> */}
        <View style={styles.grid}>
          {overviewCards.map((card) => (
            <View key={card.title} style={styles.card}>
              <View style={[styles.iconWrap, { backgroundColor: `${card.accent}18` }]}>
                {card.iconFamily === 'feather' ? (
                  <Feather name={card.iconName as any} size={18} color={card.accent} />
                ) : (
                  <MaterialCommunityIcons name={card.iconName as any} size={18} color={card.accent} />
                )}
              </View>
              <Text style={styles.cardTitle}>{card.title}</Text>
              <Text style={styles.cardValue}>{card.value}</Text>
              <Text style={styles.cardDetail}>{card.detail}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionLabel, styles.sectionLabelStandalone]}>Topic Catalog</Text>
        <View style={styles.topicCard}>
          {topicCatalog.map(({ definition, latestMessage }, index) => {
            const accent = getTopicDirectionAccent(definition.direction);

            return (
              <View
                key={definition.key}
                style={[
                  styles.topicItem,
                  index < topicCatalog.length - 1 && styles.topicItemDivider,
                ]}>
                <View style={styles.topicTopRow}>
                  <Text style={styles.topicLabel}>{definition.label}</Text>
                  <View
                    style={[
                      styles.topicDirectionBadge,
                      { backgroundColor: `${accent}18` },
                    ]}>
                    <Text style={[styles.topicDirectionText, { color: accent }]}>
                      {getTopicDirectionLabel(definition.direction)}
                    </Text>
                  </View>
                </View>

                <Text style={styles.topicPath}>{definition.topic}</Text>
                {/* <Text style={styles.topicDescription}>{definition.description}</Text> */}
                <Text style={styles.topicPayload}>
                  {latestMessage
                    ? formatTopicPayloadPreview(latestMessage.payload)
                    : 'No payload yet. Connect MQTT and wait for gateway events or publish a command.'}
                </Text>
                <Text style={styles.topicTimestamp}>
                  {latestMessage
                    ? `Last update ${formatConnectedTimestamp(latestMessage.receivedAt)} via ${
                        latestMessage.source === 'broker' ? 'broker' : 'local publish'
                      }`
                    : 'Waiting for first payload'}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>Connection Log</Text>
          <Pressable onPress={clearLogs} style={({ pressed }) => [styles.clearLogButton, pressed && styles.clearLogButtonPressed]}>
            <Text style={styles.clearLogButtonText}>Clear Log</Text>
          </Pressable>
        </View>
        <View style={styles.logFilterRow}>
          {LOG_FILTERS.map((filter) => {
            const isActive = filter.value === activeLogFilter;

            return (
              <Pressable
                key={filter.value}
                onPress={() => setActiveLogFilter(filter.value)}
                style={[
                  styles.logFilterChip,
                  isActive && styles.logFilterChipActive,
                ]}>
                <Text
                  style={[
                    styles.logFilterChipText,
                    isActive && styles.logFilterChipTextActive,
                  ]}>
                  {filter.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.logCard}>
          {filteredLogs.length === 0 ? (
            <Text style={styles.logEmptyText}>No MQTT events yet.</Text>
          ) : (
            filteredLogs.map((log) => {
              const accent = getLogAccent(log.level);

              return (
                <View key={log.id} style={styles.logItem}>
                  <View style={[styles.logDot, { backgroundColor: accent }]} />
                  <View style={styles.logContent}>
                    <View style={styles.logTopRow}>
                      <Text style={styles.logMessage}>{log.message}</Text>
                      <Text style={styles.logTime}>{log.timestamp}</Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}
