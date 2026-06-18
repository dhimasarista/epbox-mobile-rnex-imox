import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { hasMqttConnectionSettings } from '@/lib/mqtt-settings';
import { useMqtt, type MqttConnectionState } from '@/providers/mqtt-provider';
import { AppColors } from '@/styles';
import { styles } from '@/styles/screens/status.styles';

const STATUS_CARDS = [
  {
    title: 'Battery Health',
    value: 'Good',
    detail: '92% capacity retained',
    iconFamily: 'feather',
    iconName: 'battery-charging',
    accent: AppColors.success,
  },
  {
    title: 'Motor Output',
    value: 'Normal',
    detail: 'No active warnings',
    iconFamily: 'material',
    iconName: 'speedometer',
    accent: AppColors.primary,
  },
  {
    title: 'Connectivity',
    value: 'Ready',
    detail: 'Broker session available from this panel',
    iconFamily: 'feather',
    iconName: 'wifi',
    accent: '#3B82F6',
  },
] as const;

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
    label: 'Disconnected',
    detail: 'Broker session is closed.',
  },
  error: {
    accent: AppColors.error,
    label: 'Error',
    detail: 'Broker session needs attention.',
  },
};

export default function StatusScreen() {
  const {
    connect,
    disconnect,
    endpointLabel,
    isSettingsLoading,
    lastError,
    refreshSettings,
    settings,
    status,
    statusMessage,
  } = useMqtt();

  useFocusEffect(
    useCallback(() => {
      void refreshSettings();
    }, [refreshSettings])
  );

  const statusMeta = MQTT_STATUS_META[status];
  const hasSettings = hasMqttConnectionSettings(settings);
  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting';
  const actionLabel = !hasSettings
    ? 'Save MQTT Settings First'
    : isConnecting
      ? 'Connecting...'
      : isConnected
        ? 'Disconnect MQTT'
        : 'Connect MQTT';

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
            <Feather name="activity" size={16} color={AppColors.success} />
            <Text style={styles.headerBadgeText}>Live</Text>
          </View>
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>MQTT link</Text>
          <Text style={styles.heroValue}>{statusMeta.label}</Text>
          <Text style={styles.heroDetail}>
            {lastError ?? statusMeta.detail}
          </Text>
        </View>

        <View style={styles.mqttCard}>
          <View style={styles.mqttHeader}>
            <View style={styles.mqttIconWrap}>
              <MaterialCommunityIcons name="transmission-tower" size={18} color={AppColors.primary} />
            </View>
            <View style={[styles.mqttStatusBadge, { backgroundColor: `${statusMeta.accent}18` }]}>
              <View style={[styles.mqttStatusDot, { backgroundColor: statusMeta.accent }]} />
              <Text style={[styles.mqttStatusBadgeText, { color: statusMeta.accent }]}>
                {statusMeta.label}
              </Text>
            </View>
          </View>

          <Text style={styles.mqttTitle}>Broker Session</Text>
          <Text style={styles.mqttEndpoint}>
            {isSettingsLoading ? 'Loading saved MQTT settings...' : endpointLabel}
          </Text>
          <Text style={styles.mqttDetail}>{statusMessage}</Text>

          <View style={styles.mqttMetaRow}>
            <View style={styles.mqttMetaCard}>
              <Text style={styles.mqttMetaLabel}>Client ID</Text>
              <Text style={styles.mqttMetaValue}>
                {settings.clientId.trim() || 'Auto-generated on connect'}
              </Text>
            </View>
            <View style={styles.mqttMetaCard}>
              <Text style={styles.mqttMetaLabel}>Username</Text>
              <Text style={styles.mqttMetaValue}>
                {settings.username.trim() || 'Anonymous'}
              </Text>
            </View>
          </View>

          <Pressable
            disabled={isSettingsLoading || isConnecting || !hasSettings}
            onPress={handleConnectionAction}
            style={({ pressed }) => [
              styles.mqttActionButton,
              isConnected && styles.mqttActionButtonDisconnect,
              (pressed || isConnecting) && styles.mqttActionButtonPressed,
              (isSettingsLoading || isConnecting || !hasSettings) && styles.mqttActionButtonDisabled,
            ]}>
            <Text style={styles.mqttActionButtonText}>{actionLabel}</Text>
          </Pressable>
        </View>

        <View style={styles.grid}>
          {STATUS_CARDS.map((card) => {
            return (
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
            );
          })}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}
