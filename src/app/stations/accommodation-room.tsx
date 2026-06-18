import { Slider } from '@expo/ui/community/slider';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  DEFAULT_ACCOMMODATION_ROOM_INPUTS,
  formatAccommodationTemperature,
  getStoredAccommodationRoomInputs,
  parseAccommodationTemperature,
  setStoredAccommodationRoomInputs,
  type AccommodationRoomInputs
} from '@/lib/accommodation-room-demo';
import { AppColors } from '@/styles';
import { getSignalPalette, styles, type SignalTone } from '@/styles/screens/station.styles';

const ACCOMMODATION_TEMP_WARNING_C = 40;
const ACCOMMODATION_TEMP_ALERT_C = 55;
const ACCOMMODATION_TEMP_MAX_C = 120;

function getAccommodationTemperatureSignalTone(value: number): SignalTone {
  if (value >= ACCOMMODATION_TEMP_ALERT_C) {
    return 'danger';
  }

  if (value >= ACCOMMODATION_TEMP_WARNING_C) {
    return 'warning';
  }

  return 'normal';
}

function getAccommodationTemperatureLabel(tone: SignalTone) {
  if (tone === 'danger') {
    return `Alarm >= ${ACCOMMODATION_TEMP_ALERT_C} C`;
  }

  if (tone === 'warning') {
    return `Watch >= ${ACCOMMODATION_TEMP_WARNING_C} C`;
  }

  return 'Normal range';
}

function AccommodationRoomHeader() {
  const router = useRouter();

  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.navigate('/explore')}>
        <Feather name="arrow-left" size={24} color={AppColors.text} />
      </TouchableOpacity>
      <Text style={styles.headerLabel}>Accommodation Room</Text>
      <View style={styles.headerGhost} />
    </View>
  );
}

function AccommodationRoomHero() {
  return (
    <View style={styles.heroCard}>
      <View style={styles.heroTopRow}>
        <View style={styles.heroBadge}>
          <MaterialCommunityIcons name="bed-outline" size={14} color={AppColors.primary} />
          <Text style={styles.heroBadgeText}>Accommodation Room</Text>
        </View>
        <View style={styles.liveChip}>
          <View style={[styles.liveDot, styles.plcDot]} />
          <Text style={styles.liveChipText}>Active</Text>
        </View>
      </View>

      <Text style={styles.heroSubtitle}>
        Please calibrate the sensors and actuators to match reference parameters.
      </Text>
    </View>
  );
}

function EngineeringSignalBands({ tone }: { tone: SignalTone }) {
  return (
    <View style={styles.signalBandsRow}>
      <View
        style={[
          styles.signalBand,
          styles.signalBandNormal,
          tone === 'normal' && styles.signalBandActive,
        ]}
      />
      <View
        style={[
          styles.signalBand,
          styles.signalBandWarning,
          tone === 'warning' && styles.signalBandActive,
        ]}
      />
      <View
        style={[
          styles.signalBand,
          styles.signalBandDanger,
          tone === 'danger' && styles.signalBandActive,
        ]}
      />
    </View>
  );
}

function getToggleTheme() {
  return {
    surface: AppColors.surfaceError,
    border: '#F6B1B1',
    icon: AppColors.error,
  };
}

function AccommodationToggleField({
  label,
  value,
  activeText,
  inactiveText,
  activeIcon,
  inactiveIcon,
  hint,
  onChange,
}: {
  label: string;
  value: boolean;
  activeText: string;
  inactiveText: string;
  activeIcon: ComponentProps<typeof Feather>['name'];
  inactiveIcon: ComponentProps<typeof Feather>['name'];
  hint: string;
  onChange: (value: boolean) => void;
}) {
  const theme = getToggleTheme();

  return (
    <View style={styles.dashboardFieldBlock}>
      <View style={styles.dashboardControlCard}>
        <View style={styles.dashboardToggleRow}>
          <View>
            <Text style={styles.fieldLabel}>{label}</Text>
            <Text style={styles.dashboardToggleValue}>{value ? activeText : inactiveText}</Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.92}
            onPress={() => onChange(!value)}
            accessibilityRole="switch"
            accessibilityState={{ checked: value }}
            accessibilityLabel={label}
            style={[
              styles.alarmToggle,
              value
                ? { backgroundColor: theme.surface, borderColor: theme.border }
                : styles.alarmToggleInactive,
            ]}>
            <View
              style={[
                styles.alarmToggleThumb,
                value ? styles.alarmToggleThumbActive : styles.alarmToggleThumbInactive,
              ]}>
              <Feather
                name={value ? activeIcon : inactiveIcon}
                size={14}
                color={value ? theme.icon : AppColors.textSubtle}
              />
            </View>
          </TouchableOpacity>
        </View>

        <Text style={styles.dashboardControlHint}>{hint}</Text>
      </View>
    </View>
  );
}

function AccommodationTemperatureField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const temperatureValue = parseAccommodationTemperature(value);
  const signalTone = getAccommodationTemperatureSignalTone(temperatureValue);
  const signalPalette = getSignalPalette(signalTone);

  return (
    <View style={styles.dashboardFieldBlock}>
      <View style={styles.dashboardControlCard}>
        <View style={styles.dashboardControlHeader}>
          <Text style={styles.fieldLabel}>Zone Temperature</Text>
          <View
            style={[
              styles.signalValueChip,
              {
                backgroundColor: signalPalette.surface,
                borderColor: signalPalette.border,
              },
            ]}>
            <View
              style={[
                styles.signalValueDot,
                { backgroundColor: signalPalette.accent },
              ]}
            />
            <Text
              style={[
                styles.signalValueText,
                { color: signalPalette.text },
              ]}>
              {formatAccommodationTemperature(temperatureValue)}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.signalSliderShell,
            signalTone === 'normal' && styles.signalSliderShellNormal,
            signalTone === 'warning' && styles.signalSliderShellWarning,
            signalTone === 'danger' && styles.signalSliderShellDanger,
          ]}>
          <Slider
            value={temperatureValue}
            minimumValue={0}
            maximumValue={ACCOMMODATION_TEMP_MAX_C}
            step={1}
            minimumTrackTintColor={signalPalette.accent}
            maximumTrackTintColor={signalPalette.track}
            thumbTintColor={signalPalette.accent}
            onValueChange={(nextValue) => onChange(formatAccommodationTemperature(nextValue))}
            style={styles.dashboardPressureSlider}
          />

          <EngineeringSignalBands tone={signalTone} />
        </View>

        <View style={styles.sliderRangeRow}>
          <Text style={styles.sliderRangeText}>0 C</Text>
          <View
            style={[
              styles.signalStateBadge,
              {
                backgroundColor: signalPalette.surface,
                borderColor: signalPalette.border,
              },
            ]}>
            <Text
              style={[
                styles.signalStateText,
                { color: signalPalette.text },
              ]}>
              {getAccommodationTemperatureLabel(signalTone)}
            </Text>
          </View>
          <Text style={styles.sliderRangeText}>{ACCOMMODATION_TEMP_MAX_C} C</Text>
        </View>

        <Text style={styles.dashboardControlHint}>Simulated zone temperature delivered to PLC.</Text>
      </View>
    </View>
  );
}

function AccommodationSourceSection({
  form,
  onChange,
}: {
  form: AccommodationRoomInputs;
  onChange: <Key extends keyof AccommodationRoomInputs>(
    key: Key,
    value: AccommodationRoomInputs[Key]
  ) => void;
}) {
  return (
    <View style={styles.sectionCard}>
      <AccommodationToggleField
        label="Smoke Detected"
        value={form.smokeDetected}
        activeText="Detected"
        inactiveText="Clear"
        activeIcon="cloud-lightning"
        inactiveIcon="wind"
        hint="Simulated fire or smoke event inside accommodation."
        onChange={(nextValue) => onChange('smokeDetected', nextValue)}
      />

      <AccommodationTemperatureField
        value={form.temperatureValue}
        onChange={(nextValue) => onChange('temperatureValue', nextValue)}
      />
    </View>
  );
}

export default function AccommodationRoom() {
  const [form, setForm] = useState(DEFAULT_ACCOMMODATION_ROOM_INPUTS);
  const hasHydratedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    async function loadValues() {
      const stored = await getStoredAccommodationRoomInputs();

      if (isMounted) {
        setForm(stored);
        hasHydratedRef.current = true;
      }
    }

    loadValues();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasHydratedRef.current) {
      return;
    }

    void setStoredAccommodationRoomInputs(form);
  }, [form]);

  const updateField = <Key extends keyof AccommodationRoomInputs>(
    key: Key,
    value: AccommodationRoomInputs[Key]
  ) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <AccommodationRoomHeader />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <AccommodationRoomHero />
        <AccommodationSourceSection form={form} onChange={updateField} />
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}
