import { Slider } from '@expo/ui/community/slider';
import { Text, View } from 'react-native';

import { getSignalPalette, styles, type SignalTone } from '@/styles/screens/station.styles';

export const ZONE_TEMPERATURE_MIN_C = 0;
export const ZONE_TEMPERATURE_MAX_C = 120;
const ZONE_TEMPERATURE_WARNING_C = 40;
const ZONE_TEMPERATURE_ALERT_C = 82;

export const ZONE_SMOKE_DENSITY_MIN_PPM = 0;
export const ZONE_SMOKE_DENSITY_MAX_PPM = 15;
const ZONE_SMOKE_DENSITY_WARNING_PPM = 5;
const ZONE_SMOKE_DENSITY_ALERT_PPM = 11;

function getZoneTemperatureTone(value: number): SignalTone {
  if (value >= ZONE_TEMPERATURE_ALERT_C) return 'danger';
  if (value >= ZONE_TEMPERATURE_WARNING_C) return 'warning';
  return 'normal';
}

function getZoneTemperatureLabel(tone: SignalTone) {
  if (tone === 'danger') return `Alarm >= ${ZONE_TEMPERATURE_ALERT_C} C`;
  if (tone === 'warning') return `Watch >= ${ZONE_TEMPERATURE_WARNING_C} C`;
  return 'Normal Range';
}

function getZoneSmokeDensityTone(value: number): SignalTone {
  if (value >= ZONE_SMOKE_DENSITY_ALERT_PPM) return 'danger';
  if (value >= ZONE_SMOKE_DENSITY_WARNING_PPM) return 'warning';
  return 'normal';
}

function ZoneSignalBands({ tone }: { tone: SignalTone }) {
  return (
    <View style={styles.signalBandsRow}>
      <View style={[styles.signalBand, styles.signalBandNormal, tone === 'normal' && styles.signalBandActive]} />
      <View style={[styles.signalBand, styles.signalBandWarning, tone === 'warning' && styles.signalBandActive]} />
      <View style={[styles.signalBand, styles.signalBandDanger, tone === 'danger' && styles.signalBandActive]} />
    </View>
  );
}

export function ZoneTemperatureSlider({
  value,
  onChange,
  disabled = false,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const rounded = Math.round(value);
  const tone = getZoneTemperatureTone(rounded);
  const palette = getSignalPalette(tone);

  return (
    <View style={styles.dashboardFieldBlock}>
      <View style={styles.dashboardControlCard}>
        <View style={styles.dashboardControlHeader}>
          <Text style={styles.fieldLabel}>Zone Temperature</Text>
          <View
            style={[
              styles.signalValueChip,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}>
            <View style={[styles.signalValueDot, { backgroundColor: palette.accent }]} />
            <Text style={[styles.signalValueText, { color: palette.text }]}>
              {rounded} °C
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.signalSliderShell,
            tone === 'normal' && styles.signalSliderShellNormal,
            tone === 'warning' && styles.signalSliderShellWarning,
            tone === 'danger' && styles.signalSliderShellDanger,
          ]}>
          <Slider
            value={value}
            minimumValue={ZONE_TEMPERATURE_MIN_C}
            maximumValue={ZONE_TEMPERATURE_MAX_C}
            step={1}
            minimumTrackTintColor={palette.accent}
            maximumTrackTintColor={palette.track}
            thumbTintColor={palette.accent}
            disabled={disabled}
            onValueChange={onChange}
            style={styles.dashboardPressureSlider}
          />

          <ZoneSignalBands tone={tone} />
        </View>

        <View style={styles.sliderRangeRow}>
          <Text style={styles.sliderRangeText}>{ZONE_TEMPERATURE_MIN_C} C</Text>
          <View
            style={[
              styles.signalStateBadge,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}>
            <Text style={[styles.signalStateText, { color: palette.text }]}>
              {getZoneTemperatureLabel(tone)}
            </Text>
          </View>
          <Text style={styles.sliderRangeText}>{ZONE_TEMPERATURE_MAX_C} C</Text>
        </View>
      </View>
    </View>
  );
}

export function ZoneSmokeDensitySlider({
  value,
  onChange,
  disabled = false,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const rounded = Math.round(value);
  const tone = getZoneSmokeDensityTone(rounded);
  const palette = getSignalPalette(tone);

  return (
    <View style={styles.dashboardFieldBlock}>
      <View style={styles.dashboardControlCard}>
        <View style={styles.dashboardControlHeader}>
          <Text style={styles.fieldLabel}>Smoke Density</Text>
          <View
            style={[
              styles.signalValueChip,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}>
            <View style={[styles.signalValueDot, { backgroundColor: palette.accent }]} />
            <Text style={[styles.signalValueText, { color: palette.text }]}>
              {rounded} ppm
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.signalSliderShell,
            tone === 'normal' && styles.signalSliderShellNormal,
            tone === 'warning' && styles.signalSliderShellWarning,
            tone === 'danger' && styles.signalSliderShellDanger,
          ]}>
          <Slider
            value={value}
            minimumValue={ZONE_SMOKE_DENSITY_MIN_PPM}
            maximumValue={ZONE_SMOKE_DENSITY_MAX_PPM}
            step={1}
            minimumTrackTintColor={palette.accent}
            maximumTrackTintColor={palette.track}
            thumbTintColor={palette.accent}
            disabled={disabled}
            onValueChange={onChange}
            style={styles.dashboardPressureSlider}
          />

          <ZoneSignalBands tone={tone} />
        </View>

        <View style={styles.sliderRangeRow}>
          <Text style={styles.sliderRangeText}>{ZONE_SMOKE_DENSITY_MIN_PPM} ppm</Text>
          <Text style={styles.sliderRangeText}>{ZONE_SMOKE_DENSITY_MAX_PPM} ppm</Text>
        </View>
      </View>
    </View>
  );
}
