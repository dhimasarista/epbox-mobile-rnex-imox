import { useNetworkSignal } from '@/hooks/use-network-signal';
import { getMqttTransportLabel } from '@/lib/mqtt-settings';
import { useMqtt } from '@/providers/mqtt-provider';
import { AppColors } from '@/styles';
import { getBannerHeight, styles } from '@/styles/screens/home.styles';
import { styles as settingsStyles } from '@/styles/screens/settings.styles';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import LottieView from 'lottie-react-native';
import { useCallback, useMemo, useState, type ComponentProps } from 'react';
import { ScrollView, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type HomeStatCardConfig = {
  title: string;
  iconName: ComponentProps<typeof Feather>['name'];
  value: number | string;
  unit?: string;
  prefix?: string;
};

function SignalBarStrip({
  activeBars,
  totalBars,
}: {
  activeBars: number;
  totalBars: number;
}) {
  return (
    <View style={styles.batteryVisualizer}>
      {Array.from({ length: totalBars }, (_, index) => (
        <View
          key={`signal-bar-${index}`}
          style={[styles.batteryBar, index < activeBars && styles.batteryBarActive]}
        />
      ))}
    </View>
  );
}

function HomeStatCard({ title, iconName, value, unit, prefix }: HomeStatCardConfig) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statHeader}>
        <Text style={styles.statTitle}>{title}</Text>
        <View style={styles.statIconContainer}>
          <Feather name={iconName} size={14} color={AppColors.primary} />
        </View>
      </View>
      <Text style={styles.statValue}>
        {prefix ? <Text style={styles.statUnit}>{prefix}</Text> : null}
        {value}
        {unit ? <Text style={styles.statUnit}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

export default function HomeScreen() {
  const { width, height } = useWindowDimensions();
  const bannerHeight = getBannerHeight(width, height);
  const [isSignalPollingEnabled, setIsSignalPollingEnabled] = useState(true);
  const signal = useNetworkSignal({
    enabled: isSignalPollingEnabled,
    refreshIntervalMs: 2000,
  });

  const { endpointLabel, isGatewayStale, latestPingLatencyMs, status } = useMqtt();
  const brokerTransportLabel = getMqttTransportLabel(endpointLabel);
  // Live broker round-trip from the loopback probe (updates every few seconds
  // while connected); dashes out when offline / before the first echo.
  const responseTimeValue =
    status === 'connected' && latestPingLatencyMs !== null ? latestPingLatencyMs : '--';

  const gatewayStatusValue =
    status !== 'connected' ? 'Offline' : isGatewayStale ? 'Stale' : 'Online';

  const statCards = useMemo<HomeStatCardConfig[]>(
    () => [
      {
        title: 'Connection\nStatus',
        iconName: 'radio',
        value: gatewayStatusValue,
      },
      {
        title: 'Broker\nProtocol',
        iconName: 'activity',
        value: brokerTransportLabel,
        unit: '/MQTT',
      },
      {
        title: 'Response\nTime',
        iconName: 'clock',
        value: responseTimeValue,
        unit: 'ms',
      },
      {
        title: 'Distance\nto Device',
        iconName: 'map-pin',
        value: 108,
        unit: 'Km',
      },
    ],
    [brokerTransportLabel, gatewayStatusValue, responseTimeValue]
  );

  useFocusEffect(
    useCallback(() => {
      setIsSignalPollingEnabled(true);

      return () => {
        setIsSignalPollingEnabled(false);
      };
    }, [])
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <View style={styles.titleRow}>
              <Text style={styles.appTitle}>EPBOX-ENGG</Text>
              <Feather name="chevron-down" size={20} color={AppColors.text} />
            </View>
            <View style={styles.statusRow}>
              <View style={styles.dot} />
              <Text style={styles.subtitle}>Batam, Riau Island</Text>
            </View>
          </View>
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconBtn}>
              <Ionicons name="notifications-outline" size={22} color={AppColors.text} />
              <View style={styles.notificationDot} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn}>
              <MaterialCommunityIcons name="line-scan" size={22} color={AppColors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Vessel Card */}
        <View style={styles.bannerCard}>
          <View style={[styles.bannerBackground, { height: bannerHeight }]}>
            <LottieView
              source={require('../../assets/animations/Vessel.json')}
              style={styles.bannerImage}
              resizeMode="cover"
              autoPlay
              loop
            />
          </View>
        </View>

        {/* Signal Card */}
        <View style={styles.batteryCard}>
          <View>
            <Text style={styles.batteryPercent}>{signal.value}</Text>
            <Text style={styles.batteryLabel}>{signal.label}</Text>
          </View>
          <SignalBarStrip activeBars={signal.activeBars} totalBars={signal.totalBars} />
        </View>

        {/* Stats Grid */}
        <View style={styles.grid}>
          {statCards.map((card) => (
            <HomeStatCard key={card.title} {...card} />
          ))}
        </View>
        <View style={{
          paddingBottom: 20,
        }} />
<View style={settingsStyles.infoCard}>
                  <Text style={settingsStyles.infoTitle}>EPBOX ENGINEERING</Text>
                  <Text style={settingsStyles.infoValue}>IMOX 2026</Text>
                  <Text style={settingsStyles.infoSubtitle}>Firmware version 0.1.0</Text>
                </View>
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}
