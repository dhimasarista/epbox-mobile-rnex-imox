import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ZoneSmokeDensitySlider, ZoneTemperatureSlider } from '@/components/zone-input-sliders';
import { useCounterSliderControl } from '@/hooks/use-counter-slider-control';
import { CARLO_GAVAZZI_GATEWAY_CONFIG } from '@/lib/mqtt-topics';
import { useMqtt, useMqttTopic } from '@/providers/mqtt-provider';
import { AppColors } from '@/styles';
import { styles } from '@/styles/screens/station.styles';

const { temperature: TEMPERATURE_COUNTER_ID, smokeDensity: SMOKE_DENSITY_COUNTER_ID } =
  CARLO_GAVAZZI_GATEWAY_CONFIG.accommodationRoomStation.counterIds;

export default function AccommodationRoom() {
  const router = useRouter();
  const { publishTopic, status } = useMqtt();
  const metricsTopic = useMqttTopic('gatewayMetrics');
  const metricsReceivedAt = metricsTopic.message?.receivedAt ?? null;
  const [commandError, setCommandError] = useState<string | null>(null);
  const commandErrorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showCommandError = useCallback((message: string) => {
    setCommandError(message);

    if (commandErrorTimeoutRef.current) {
      clearTimeout(commandErrorTimeoutRef.current);
    }

    commandErrorTimeoutRef.current = setTimeout(() => {
      setCommandError((current) => (current === message ? null : current));
      commandErrorTimeoutRef.current = null;
    }, 2_500);
  }, []);

  const temperature = useCounterSliderControl({
    label: 'Zone Temperature',
    counterId: TEMPERATURE_COUNTER_ID,
    status,
    metricsPayload: metricsTopic.payload,
    metricsReceivedAt,
    publishTopic,
    onError: showCommandError,
    timeoutMs: 30_000,
  });

  const smokeDensity = useCounterSliderControl({
    label: 'Smoke Density',
    counterId: SMOKE_DENSITY_COUNTER_ID,
    status,
    metricsPayload: metricsTopic.payload,
    metricsReceivedAt,
    publishTopic,
    onError: showCommandError,
    timeoutMs: 30_000,
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.navigate('/explore')}>
          <Feather name="arrow-left" size={24} color={AppColors.text} />
        </TouchableOpacity>
        <Text style={styles.headerLabel}>Accommodation Room</Text>
        <View style={styles.headerGhost} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {commandError ? (
          <Text style={{ fontSize: 12, fontWeight: '600', color: AppColors.warning }}>
            {commandError}
          </Text>
        ) : null}

        <ZoneTemperatureSlider
          value={temperature.draftValue}
          onChange={temperature.onChange}
          disabled={temperature.isPending}
        />
        <ZoneSmokeDensitySlider
          value={smokeDensity.draftValue}
          onChange={smokeDensity.onChange}
          disabled={smokeDensity.isPending}
        />
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}
