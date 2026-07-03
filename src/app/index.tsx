import { useNetworkSignal } from '@/hooks/use-network-signal';
import { getMqttTransportLabel } from '@/lib/mqtt-settings';
import {
  CARLO_GAVAZZI_GATEWAY_CONFIG,
  getZoneActivatedState,
  type CarloGavazziSwitchCommandName,
} from '@/lib/mqtt-topics';
import { useMqtt, useMqttTopic } from '@/providers/mqtt-provider';
import { AppColors } from '@/styles';
import { getBannerHeight, styles } from '@/styles/screens/home.styles';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import LottieView from 'lottie-react-native';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
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

  const { endpointLabel, latestLatencySample, publishTopic, recordLatencySample, status } = useMqtt();
  const brokerTransportLabel = getMqttTransportLabel(endpointLabel);
  const responseTimeValue = latestLatencySample?.durationMs ?? '--';

  const { payload: metricsPayload, message: metricsMessage } = useMqttTopic('gatewayMetrics');

  const localZoneOn = metricsPayload
    ? getZoneActivatedState(metricsPayload, CARLO_GAVAZZI_GATEWAY_CONFIG.localZoneActivated.deviceId)
    : null;
  const remoteZoneOn = metricsPayload
    ? getZoneActivatedState(metricsPayload, CARLO_GAVAZZI_GATEWAY_CONFIG.remoteZoneActivated.deviceId)
    : null;

  const connectionValue = localZoneOn === true ? 'Local' : remoteZoneOn === true ? 'Remote' : '--';

  const [pendingZoneCmd, setPendingZoneCmd] = useState<{
    cmd: CarloGavazziSwitchCommandName;
    requestedLabel: string;
    sentAt: number;
  } | null>(null);
  const [zoneFeedback, setZoneFeedback] = useState<'success' | 'error' | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFeedbackTimer = useCallback(() => {
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }
  }, []);

  // Confirmed by metrics: expected value matches incoming main signal
  useEffect(() => {
    if (!pendingZoneCmd || localZoneOn === null) {
      return;
    }

    const expectedOn = pendingZoneCmd.cmd === 'On';

    if (localZoneOn === expectedOn) {
      recordLatencySample({
        label: pendingZoneCmd.requestedLabel,
        requestTopicKey: 'gatewayOtCommand',
        responseTopicKey: 'gatewayMetrics',
        startedAt: pendingZoneCmd.sentAt,
        completedAt: metricsMessage?.receivedAt ?? Date.now(),
      });
      const feedbackTimer = setTimeout(() => {
        setPendingZoneCmd(null);
        clearFeedbackTimer();
        setZoneFeedback('success');
        feedbackTimerRef.current = setTimeout(() => setZoneFeedback(null), 2000);
      }, 0);

      return () => clearTimeout(feedbackTimer);
    }
  }, [clearFeedbackTimer, localZoneOn, metricsMessage?.receivedAt, pendingZoneCmd, recordLatencySample]);

  // Timeout: 8s without metrics confirmation → revert + error
  useEffect(() => {
    if (!pendingZoneCmd) {
      return;
    }

    const timer = setTimeout(() => {
      setPendingZoneCmd(null);
      setZoneFeedback('error');
      feedbackTimerRef.current = setTimeout(() => setZoneFeedback(null), 3000);
    }, 8000);

    return () => clearTimeout(timer);
  }, [pendingZoneCmd]);

  // Clear pending when MQTT disconnects
  useEffect(() => {
    if (status !== 'connected') {
      const clearPendingTimer = setTimeout(() => {
        setPendingZoneCmd(null);
      }, 0);

      return () => clearTimeout(clearPendingTimer);
    }
  }, [status]);

  // Cleanup on unmount
  useEffect(() => () => clearFeedbackTimer(), [clearFeedbackTimer]);

  // Optimistic display: show pending cmd direction while waiting
  const displayedZoneOn =
    pendingZoneCmd !== null ? pendingZoneCmd.cmd === 'On' : localZoneOn ?? false;

  const handleLocalZoneToggle = useCallback(async () => {
    if (status !== 'connected') {
      return;
    }

    const nextCmd: CarloGavazziSwitchCommandName = displayedZoneOn ? 'Off' : 'On';

    try {
      await publishTopic(
        'gatewayOtCommand',
        { id: CARLO_GAVAZZI_GATEWAY_CONFIG.localZoneActivated.deviceId, cmd: nextCmd },
        { qos: 0, retain: false }
      );
      setPendingZoneCmd({
        cmd: nextCmd,
        requestedLabel: `Local Zone ${nextCmd}`,
        sentAt: Date.now(),
      });
      setZoneFeedback(null);
    } catch {
      setZoneFeedback('error');
    }
  }, [displayedZoneOn, publishTopic, status]);

  const statCards = useMemo<HomeStatCardConfig[]>(
    () => [
      {
        title: 'Local/Remote\nConnections',
        iconName: 'zap',
        value: connectionValue,
        unit: '',
      },
      {
        title: 'Broker\nProtocol',
        iconName: 'activity',
        value: brokerTransportLabel,
        unit: '/MQTT'
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
    [brokerTransportLabel, connectionValue, responseTimeValue]
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

        {/* vessel Card */}
        <View style={styles.bannerCard}>
          <View style={[styles.bannerBackground, { height: bannerHeight }]}>
            <LottieView
              source={require('../../assets/animations/Vessel.json')}
              style={styles.bannerImage}
              autoPlay
              loop
            />
          </View>
        </View>

        {/* Battery Card */}
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
        
        {/* Spacer for custom bottom tab */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}
