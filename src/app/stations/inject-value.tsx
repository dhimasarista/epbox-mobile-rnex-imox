import { Slider } from '@expo/ui/community/slider';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAutoCooldown, type CooldownTarget } from '@/hooks/use-auto-cooldown';
import { useAutoFgsConfirmed } from '@/hooks/use-auto-fgs-confirmed';
import {
  AUTO_PUMP_DENSITY_OFF_PPM,
  AUTO_PUMP_TEMP_OFF_C,
} from '@/hooks/use-auto-pump-activation';
import {
  usePendingCommand,
  type PendingCommandState
} from '@/hooks/use-pending-command';
import {
  DEFAULT_ACCOMMODATION_ROOM_INPUTS,
  formatAccommodationSmokeDensity,
  formatAccommodationTemperature,
  getStoredAccommodationRoomInputs,
  parseAccommodationSmokeDensity,
  parseAccommodationTemperature,
  setStoredAccommodationRoomInputs,
  SMOKE_DENSITY_MAX_PPM,
  SMOKE_DENSITY_MIN_PPM,
  type AccommodationRoomInputs,
} from '@/lib/accommodation-room-demo';
import {
  buildCarloGavazziOtCommand,
  CARLO_GAVAZZI_GATEWAY_CONFIG,
  getAccommodationRoomMetricsState,
  getAccommodationRoomZoneHeatingState,
  type AccommodationRoomZoneHeatingState,
} from '@/lib/mqtt-topics';
import { useMqtt, useMqttTopic } from '@/providers/mqtt-provider';
import { AppColors } from '@/styles';
import { getSignalPalette, styles, type SignalTone } from '@/styles/screens/station.styles';

const ACCOMMODATION_TEMP_WARNING_C = 40;
const ACCOMMODATION_TEMP_ALERT_C = 82;
const ACCOMMODATION_TEMP_MAX_C = 120;
const ACCOMMODATION_SMOKE_DENSITY_WARNING_PPM = 5;
const ACCOMMODATION_SMOKE_DENSITY_ALERT_PPM = 11;
const COMMAND_DEBOUNCE_MS = 250;

type AccommodationEditableKey = 'temperatureValue' | 'smokeDensityValue';
type AccommodationEditableValue = AccommodationRoomInputs[AccommodationEditableKey];
type CounterCommandSnapshot = {
  kind: 'counter';
  field: AccommodationEditableKey;
  counterId: number;
  expectedMetricValue: number;
  baselineReceivedAt: number | null;
  previousConfirmedValue: AccommodationEditableValue;
  previousDraftValue: AccommodationEditableValue;
};

function getCounterCommandId(field: AccommodationEditableKey) {
  return `counter:${field}`;
}

function isCounterCommand(
  command: PendingCommandState<CounterCommandSnapshot>
): command is PendingCommandState<CounterCommandSnapshot> {
  return command.snapshot.kind === 'counter';
}

function getAccommodationFieldValue(
  form: AccommodationRoomInputs,
  field: AccommodationEditableKey
) {
  return field === 'temperatureValue' ? form.temperatureValue : form.smokeDensityValue;
}


function getAccommodationTemperatureSignalTone(value: number): SignalTone {
  if (value >= ACCOMMODATION_TEMP_ALERT_C) {
    return 'danger';
  }

  if (value >= ACCOMMODATION_TEMP_WARNING_C) {
    return 'warning';
  }

  return 'normal';
}

function getAccommodationTemperatureLabel(
  tone: SignalTone,
  heatingStatusValue?: number | null
) {
  if (heatingStatusValue === 12) {
    return 'Antifreeze Active';
  }

  if (tone === 'danger') {
    return `Alarm >= ${ACCOMMODATION_TEMP_ALERT_C} C`;
  }

  if (tone === 'warning') {
    return `Watch >= ${ACCOMMODATION_TEMP_WARNING_C} C`;
  }

  return 'Normal Range';
}

function formatEventTime(timestamp: number | null) {
  if (!timestamp) {
    return 'No metrics yet';
  }

  return new Date(timestamp).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}


function formatZoneTemperatureMetric(value: number | null, unit: string) {
  if (value === null) {
    return 'N/A';
  }

  const normalizedValue = Number.isInteger(value) ? `${value}` : value.toFixed(1);

  return unit ? `${normalizedValue} ${unit}` : normalizedValue;
}

function InjectValueHeader() {
  const router = useRouter();

  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.navigate('/explore')}>
        <Feather name="arrow-left" size={24} color={AppColors.text} />
      </TouchableOpacity>
      <Text style={styles.headerLabel}>Inject Value</Text>
      <View style={styles.headerGhost} />
    </View>
  );
}

function InjectValueHero({
  syncLabel,
  syncHint,
  isPending,
  isCooldownSimEnabled,
  onToggleCooldownSim,
}: {
  syncLabel: string;
  syncHint: string;
  isPending: boolean;
  isCooldownSimEnabled: boolean;
  onToggleCooldownSim: () => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <TouchableOpacity
        style={[styles.heroBadge, !isCooldownSimEnabled && { opacity: 0.75 }]}
        onPress={onToggleCooldownSim}
        activeOpacity={0.8}
        accessibilityRole="switch"
        accessibilityState={{ checked: isCooldownSimEnabled }}
        accessibilityLabel="Auto cooldown simulation">
        <MaterialCommunityIcons
          name={isCooldownSimEnabled ? 'pause' : 'play'}
          size={14}
          color={AppColors.primary}
        />
        <Text style={styles.heroBadgeText}>
          {isCooldownSimEnabled ? syncLabel : 'Off'}
        </Text>
      </TouchableOpacity>
      <Text
        style={{
          fontSize: 12,
          fontWeight: '600',
          color: isPending ? AppColors.warning : AppColors.textSubtle,
        }}>
        {syncHint}
      </Text>
    </View>
  );
}

function EngineeringSignalBands({ tone }: { tone: SignalTone }) {
  return (
    <View style={styles.signalBandsRow}>
      <View style={[styles.signalBand, styles.signalBandNormal, tone === 'normal' && styles.signalBandActive]} />
      <View style={[styles.signalBand, styles.signalBandWarning, tone === 'warning' && styles.signalBandActive]} />
      <View style={[styles.signalBand, styles.signalBandDanger, tone === 'danger' && styles.signalBandActive]} />
    </View>
  );
}

function AccommodationTemperatureField({
  confirmedValue,
  draftValue,
  heatingState,
  disabled,
  onChange,
}: {
  confirmedValue: string;
  draftValue: string;
  heatingState: AccommodationRoomZoneHeatingState;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const confirmedTemperatureValue = parseAccommodationTemperature(confirmedValue);
  const draftTemperatureValue = parseAccommodationTemperature(draftValue);
  const signalTone = getAccommodationTemperatureSignalTone(draftTemperatureValue);
  const signalPalette = getSignalPalette(signalTone);
  const [isHeatingDetailVisible, setIsHeatingDetailVisible] = useState(false);
  const isHeatingOn = heatingState.heatingControlOn;
  const isAntifreezeActive = heatingState.heatingStatusValue === 12;
  const heatingStatusSummary =
    heatingState.heatingStatusValue === null
      ? heatingState.heatingStatusLabel
      : `${Math.round(heatingState.heatingStatusValue)} - ${heatingState.heatingStatusLabel}`;
  const detailRows = [
    {
      label: 'Heating Control',
      value: formatZoneTemperatureMetric(
        heatingState.heatingControlAnalogueValue,
        heatingState.heatingControlAnalogueUnit
      ),
    },
    {
      label: 'Heating Set Point',
      value: formatZoneTemperatureMetric(
        heatingState.heatingSetPointValue,
        heatingState.heatingSetPointUnit
      ),
    },
    {
      label: 'Heating Control Status',
      value: heatingState.heatingControlStatusLabel,
    },
    {
      label: 'Set Point Selected',
      value: heatingState.heatingSetPointSelectedLabel,
    },
    {
      label: 'Heating Status',
      value: heatingStatusSummary,
    },
    {
      label: 'Status Signal',
      value: heatingState.statusLabel,
    },
  ];

  return (
    <View style={styles.dashboardFieldBlock}>
      <View style={styles.dashboardControlCard}>
        <View style={styles.dashboardControlHeader}>
          <Text style={styles.fieldLabel}>Zone Temperature</Text>

          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-evenly',
            gap: 4,
          }}>
            {isHeatingOn ? (
              <View
            style={[
              styles.signalValueChip,
              {
                backgroundColor: "#F4B7B7",
                borderColor: "#f89498",
              },
            ]}>
            <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setIsHeatingDetailVisible(true)}
                style={styles.heatingIndicatorButton}>
                <MaterialCommunityIcons
                  name="fire"
                  size={14}
                  color="#EF4444"
                />
              </TouchableOpacity>
          </View>
            ) : null}
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
              {formatAccommodationTemperature(draftTemperatureValue)}
            </Text>
          </View>
          </View>
        </View>

        <Modal
          animationType="fade"
          transparent
          visible={isHeatingDetailVisible}
          onRequestClose={() => setIsHeatingDetailVisible(false)}>
          <View style={styles.heatingDetailOverlay}>
            <View style={styles.heatingDetailCard}>
              <View style={styles.heatingDetailHeader}>
                <View style={styles.heatingDetailTitleRow}>
                  <MaterialCommunityIcons name="fire" size={18} color={AppColors.error} />
                  <Text style={styles.heatingDetailTitle}>Heating Detail</Text>
                </View>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setIsHeatingDetailVisible(false)}
                  style={styles.heatingDetailCloseButton}>
                  <Feather name="x" size={18} color={AppColors.text} />
                </TouchableOpacity>
              </View>

              {detailRows.map((row) => (
                <View key={row.label} style={styles.heatingDetailRow}>
                  <Text style={styles.heatingDetailLabel}>{row.label}</Text>
                  <Text style={styles.heatingDetailValue}>{row.value}</Text>
                </View>
              ))}
            </View>
          </View>
        </Modal>

        <View
          style={[
            styles.signalSliderShell,
            signalTone === 'normal' && styles.signalSliderShellNormal,
            signalTone === 'warning' && styles.signalSliderShellWarning,
            signalTone === 'danger' && styles.signalSliderShellDanger,
          ]}>
          <Slider
            value={draftTemperatureValue}
            minimumValue={0}
            maximumValue={ACCOMMODATION_TEMP_MAX_C}
            step={1}
            minimumTrackTintColor={signalPalette.accent}
            maximumTrackTintColor={signalPalette.track}
            thumbTintColor={signalPalette.accent}
            disabled={disabled}
            onValueChange={(nextValue) => onChange(formatAccommodationTemperature(nextValue))}
            style={styles.dashboardPressureSlider}
          />

          <EngineeringSignalBands tone={signalTone} />
        </View>

        <View style={styles.sliderRangeRow}>
          <Text style={styles.sliderRangeText}>0 C</Text>
          <Text style={styles.sliderRangeText}>{ACCOMMODATION_TEMP_MAX_C} C</Text>
        </View>
      </View>
    </View>
  );
}

function getAccommodationSmokeDensityTone(value: number): SignalTone {
  if (value >= ACCOMMODATION_SMOKE_DENSITY_ALERT_PPM) {
    return 'danger';
  }

  if (value >= ACCOMMODATION_SMOKE_DENSITY_WARNING_PPM) {
    return 'warning';
  }

  return 'normal';
}

function AccommodationSmokeDensityField({
  confirmedValue,
  draftValue,
  disabled,
  onChange,
}: {
  confirmedValue: string;
  draftValue: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const confirmedDensity = parseAccommodationSmokeDensity(confirmedValue);
  const draftDensity = parseAccommodationSmokeDensity(draftValue);
  const signalTone = getAccommodationSmokeDensityTone(draftDensity);
  const signalPalette = getSignalPalette(signalTone);

  return (
    <View style={styles.dashboardFieldBlock}>
      <View style={styles.dashboardControlCard}>
        <View style={styles.dashboardControlHeader}>
          <Text style={styles.fieldLabel}>Smoke Density</Text>
          <View
            style={[
              styles.signalValueChip,
              { backgroundColor: signalPalette.surface, borderColor: signalPalette.border },
            ]}>
            <View style={[styles.signalValueDot, { backgroundColor: signalPalette.accent }]} />
            <Text style={[styles.signalValueText, { color: signalPalette.text }]}>
              {formatAccommodationSmokeDensity(draftDensity)}
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
            value={draftDensity}
            minimumValue={SMOKE_DENSITY_MIN_PPM}
            maximumValue={SMOKE_DENSITY_MAX_PPM}
            step={1}
            minimumTrackTintColor={signalPalette.accent}
            maximumTrackTintColor={signalPalette.track}
            thumbTintColor={signalPalette.accent}
            disabled={disabled}
            onValueChange={(nextValue) => onChange(formatAccommodationSmokeDensity(nextValue))}
            style={styles.dashboardPressureSlider}
          />

          <EngineeringSignalBands tone={signalTone} />
        </View>

        <View style={styles.sliderRangeRow}>
          <Text style={styles.sliderRangeText}>{SMOKE_DENSITY_MIN_PPM} ppm</Text>
          <Text style={styles.sliderRangeText}>{SMOKE_DENSITY_MAX_PPM} ppm</Text>
        </View>
      </View>
    </View>
  );
}

export function computeFgsWord(temperatureC: number, smokePpm: number): number {
  const tempHighBit: 0 | 1 = temperatureC >= ACCOMMODATION_TEMP_ALERT_C ? 1 : 0;
  const tempWarnBit: 0 | 1 =
    temperatureC >= ACCOMMODATION_TEMP_WARNING_C && temperatureC < ACCOMMODATION_TEMP_ALERT_C ? 1 : 0;
  const smokeHighBit: 0 | 1 = smokePpm >= ACCOMMODATION_SMOKE_DENSITY_ALERT_PPM ? 1 : 0;
  const smokeWarnBit: 0 | 1 =
    smokePpm >= ACCOMMODATION_SMOKE_DENSITY_WARNING_PPM &&
    smokePpm < ACCOMMODATION_SMOKE_DENSITY_ALERT_PPM ? 1 : 0;
  return (smokeWarnBit << 3) | (smokeHighBit << 2) | (tempWarnBit << 1) | tempHighBit;
}

function FgsCalcDisplay({
  temperatureC,
  smokePpm,
}: {
  temperatureC: number;
  smokePpm: number;
}) {
  const word = computeFgsWord(temperatureC, smokePpm);
  const tempHighBit = word & 1;
  const tempWarnBit = (word >> 1) & 1;
  const smokeHighBit = (word >> 2) & 1;
  const smokeWarnBit = (word >> 3) & 1;

  const bits = [
    { label: 'b0 · Temp High', value: tempHighBit, tone: tempHighBit ? 'danger' : 'normal' },
    { label: 'b1 · Temp Warn', value: tempWarnBit, tone: tempWarnBit ? 'warning' : 'normal' },
    { label: 'b2 · Smoke High', value: smokeHighBit, tone: smokeHighBit ? 'danger' : 'normal' },
    { label: 'b3 · Smoke Warn', value: smokeWarnBit, tone: smokeWarnBit ? 'warning' : 'normal' },
  ] as const;

  return (
    <View style={styles.sectionCard}>
      <Text style={[styles.fieldLabel, { marginBottom: 8 }]}>FGS W3 Calculation</Text>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {bits.map((bit) => {
          const palette = getSignalPalette(bit.tone);
          return (
            <View key={bit.label} style={[
              styles.signalValueChip,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}>
              <View style={[styles.signalValueDot, { backgroundColor: palette.accent }]} />
              <Text style={[styles.signalValueText, { color: palette.text }]}>
                {bit.label}: {bit.value}
              </Text>
            </View>
          );
        })}
        <View style={[
          styles.signalValueChip,
          { backgroundColor: AppColors.surface, borderColor: AppColors.border },
        ]}>
          <Text style={[styles.signalValueText, { color: AppColors.text }]}>
            W3 = {word}
          </Text>
        </View>
      </View>
    </View>
  );
}

function AccommodationSourceSection({
  confirmedForm,
  draftForm,
  heatingState,
  isTemperaturePending,
  isSmokeDensityPending,
  onTemperatureChange,
  onSmokeDensityChange,
}: {
  confirmedForm: AccommodationRoomInputs;
  draftForm: AccommodationRoomInputs;
  heatingState: AccommodationRoomZoneHeatingState;
  isTemperaturePending: boolean;
  isSmokeDensityPending: boolean;
  onTemperatureChange: (value: string) => void;
  onSmokeDensityChange: (value: string) => void;
}) {
  return (
    <View style={styles.sectionCard}>
      <AccommodationTemperatureField
        confirmedValue={confirmedForm.temperatureValue}
        draftValue={draftForm.temperatureValue}
        heatingState={heatingState}
        disabled={isTemperaturePending}
        onChange={onTemperatureChange}
      />

      <AccommodationSmokeDensityField
        confirmedValue={confirmedForm.smokeDensityValue}
        draftValue={draftForm.smokeDensityValue}
        disabled={isSmokeDensityPending}
        onChange={onSmokeDensityChange}
      />
    </View>
  );
}

type InjectValueProps = {
  contentOnly?: boolean;
  embedded?: boolean;
  onFgsWordChange?: (word: number) => void;
};

export default function InjectValue({
  contentOnly = false,
  embedded = false,
  onFgsWordChange,
}: InjectValueProps = {}) {
  const { publishTopic, recordLatencySample, status } = useMqtt();
  const recordLatencySampleRef = useRef(recordLatencySample);
  recordLatencySampleRef.current = recordLatencySample;
  const metricsTopic = useMqttTopic('gatewayMetrics');
  const [draftForm, setDraftForm] = useState(DEFAULT_ACCOMMODATION_ROOM_INPUTS);
  const [confirmedForm, setConfirmedForm] = useState(DEFAULT_ACCOMMODATION_ROOM_INPUTS);
  const [lastCommandError, setLastCommandError] = useState<string | null>(null);
  const {
    commands: pendingCommandMap,
    isPending: isCommandPending,
    resolveAllCommands,
    resolveCommand,
    startCommand,
  } = usePendingCommand<CounterCommandSnapshot>();
  const [isCooldownSimEnabled, setIsCooldownSimEnabled] = useState(true);
  const hasHydratedRef = useRef(false);
  const temperatureDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const temperatureSnapshotRef = useRef<{
    previousConfirmedValue: AccommodationEditableValue;
    previousDraftValue: AccommodationEditableValue;
  } | null>(null);
  const smokeDensityDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const smokeDensitySnapshotRef = useRef<{
    previousConfirmedValue: AccommodationEditableValue;
    previousDraftValue: AccommodationEditableValue;
  } | null>(null);
  const commandErrorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const metricsReceivedAt = metricsTopic.message?.receivedAt ?? null;
  const latestMetricsValuesRef = useRef<Partial<Record<AccommodationEditableKey, AccommodationEditableValue>>>({});
  const statusRef = useRef(status);
  statusRef.current = status;

  const onFgsWordChangeRef = useRef(onFgsWordChange);
  onFgsWordChangeRef.current = onFgsWordChange;

  const metricsState = useMemo(
    () => (metricsTopic.payload ? getAccommodationRoomMetricsState(metricsTopic.payload) : null),
    [metricsTopic.payload]
  );

  useEffect(() => {
    const tempC = parseAccommodationTemperature(draftForm.temperatureValue);
    const smokePpm = parseAccommodationSmokeDensity(draftForm.smokeDensityValue);
    onFgsWordChangeRef.current?.(computeFgsWord(tempC, smokePpm));
  }, [draftForm]);

  useEffect(() => {
    if (!metricsState) {
      return;
    }

    latestMetricsValuesRef.current = {
      ...latestMetricsValuesRef.current,
      ...(metricsState.temperatureValue !== null
        ? { temperatureValue: metricsState.temperatureValue }
        : {}),
      ...(metricsState.smokeDensityValue !== null
        ? { smokeDensityValue: metricsState.smokeDensityValue }
        : {}),
    };
  }, [metricsState]);

  const confirmedTemperatureC = parseAccommodationTemperature(confirmedForm.temperatureValue);
  const confirmedSmokeDensityPpm = parseAccommodationSmokeDensity(confirmedForm.smokeDensityValue);
  const draftTemperatureC = parseAccommodationTemperature(draftForm.temperatureValue);
  const draftSmokeDensityPpm = parseAccommodationSmokeDensity(draftForm.smokeDensityValue);
  const smokeDensityCounterId =
    CARLO_GAVAZZI_GATEWAY_CONFIG.accommodationRoom.counterIds.smokeDensity;

  useAutoFgsConfirmed({
    enabled: status === 'connected',
    temperatureC: draftTemperatureC,
    smokeDensityPpm: draftSmokeDensityPpm,
    metricsPayload: metricsTopic.payload,
    publishTopic,
  });

  const cooldownTargets: CooldownTarget[] = [
    {
      counterId: CARLO_GAVAZZI_GATEWAY_CONFIG.accommodationRoom.counterIds.temperature,
      currentValue: confirmedTemperatureC,
      floor: AUTO_PUMP_TEMP_OFF_C - 1,
    },
    {
      counterId: smokeDensityCounterId,
      currentValue: confirmedSmokeDensityPpm,
      floor: Math.max(0, AUTO_PUMP_DENSITY_OFF_PPM - 1),
    },
  ];

  useAutoCooldown({
    enabled: status === 'connected' && isCooldownSimEnabled,
    metricsPayload: metricsTopic.payload,
    targets: cooldownTargets,
    publishTopic,
  });

  const showCommandError = useCallback((message: string) => {
    setLastCommandError(message);

    if (commandErrorTimeoutRef.current) {
      clearTimeout(commandErrorTimeoutRef.current);
    }

    commandErrorTimeoutRef.current = setTimeout(() => {
      setLastCommandError((current) => (current === message ? null : current));
      commandErrorTimeoutRef.current = null;
    }, 2_500);
  }, []);

  const rollbackCounterCommand = useCallback(
    (command: PendingCommandState<CounterCommandSnapshot>) => {
      const { field, previousConfirmedValue, previousDraftValue } = command.snapshot;
      const latestMetricValue =
        statusRef.current === 'connected' ? latestMetricsValuesRef.current[field] : undefined;
      const rollbackConfirmedValue = latestMetricValue ?? previousConfirmedValue;
      const rollbackDraftValue = latestMetricValue ?? previousDraftValue;

      if (field === 'temperatureValue') {
        setDraftForm((current) => ({
          ...current,
          temperatureValue: rollbackDraftValue as string,
        }));
        setConfirmedForm((current) => ({
          ...current,
          temperatureValue: rollbackConfirmedValue as string,
        }));
        return;
      }

      setDraftForm((current) => ({
        ...current,
        smokeDensityValue: rollbackDraftValue as string,
      }));
      setConfirmedForm((current) => ({
        ...current,
        smokeDensityValue: rollbackConfirmedValue as string,
      }));
    },
    []
  );

  const clearTemperatureDebounce = useCallback(() => {
    if (!temperatureDebounceRef.current) {
      return;
    }

    clearTimeout(temperatureDebounceRef.current);
    temperatureDebounceRef.current = null;
  }, []);

  const clearSmokeDensityDebounce = useCallback(() => {
    if (!smokeDensityDebounceRef.current) {
      return;
    }

    clearTimeout(smokeDensityDebounceRef.current);
    smokeDensityDebounceRef.current = null;
  }, []);

  const zoneHeatingState = useMemo(
    () =>
      metricsTopic.payload
        ? getAccommodationRoomZoneHeatingState(metricsTopic.payload)
        : {
            heatingControlAnalogueValue: null,
            heatingControlAnalogueUnit: '%',
            heatingSetPointValue: null,
            heatingSetPointUnit: '°C',
            heatingControlStatusValue: null,
            heatingControlStatusLabel: 'N/A',
            heatingControlOn: false,
            heatingSetPointSelectedValue: null,
            heatingSetPointSelectedLabel: 'N/A',
            heatingStatusValue: null,
            heatingStatusLabel: 'N/A',
            statusValue: null,
            statusLabel: 'N/A',
          },
    [metricsTopic.payload]
  );

  const sendSetValueCommand = useCallback(
    async (
      field: AccommodationEditableKey,
      nextMetricValue: number,
      requestedLabel: string,
      snapshot: {
        previousConfirmedValue: AccommodationRoomInputs[AccommodationEditableKey];
        previousDraftValue: AccommodationRoomInputs[AccommodationEditableKey];
      }
    ) => {
      const commandId = getCounterCommandId(field);
      const counterId =
        field === 'temperatureValue'
          ? CARLO_GAVAZZI_GATEWAY_CONFIG.accommodationRoom.counterIds.temperature
          : CARLO_GAVAZZI_GATEWAY_CONFIG.accommodationRoom.counterIds.smokeDensity;

      if (counterId === null) {
        return;
      }

      if (status !== 'connected') {
        // Offline: commit locally so the slider stays at the new position.
        if (field === 'temperatureValue') {
          setConfirmedForm((current) => ({
            ...current,
            temperatureValue: formatAccommodationTemperature(nextMetricValue),
          }));
        } else {
          setConfirmedForm((current) => ({
            ...current,
            smokeDensityValue: formatAccommodationSmokeDensity(nextMetricValue),
          }));
        }
        return;
      }

      if (isCommandPending(commandId)) {
        showCommandError(`${requestedLabel} is already waiting for gateway response.`);
        return;
      }

      const pendingCommand = startCommand({
        id: commandId,
        label: requestedLabel,
        snapshot: {
          kind: 'counter',
          field,
          counterId,
          expectedMetricValue: nextMetricValue,
          baselineReceivedAt: metricsReceivedAt,
          previousConfirmedValue: snapshot.previousConfirmedValue,
          previousDraftValue: snapshot.previousDraftValue,
        },
        onTimeout: (command) => {
          if (!isCounterCommand(command)) {
            return;
          }

          rollbackCounterCommand(command);
          showCommandError(`${command.label} timed out. Rolled back.`);
        },
      });

      if (!pendingCommand) {
        return;
      }

      try {
        await publishTopic(
          'gatewayOtCommand',
          buildCarloGavazziOtCommand(counterId, 'SetValue', nextMetricValue)
        );
        setLastCommandError(null);
      } catch (error) {
        resolveCommand(commandId, {
          onResolve: (command) => {
            if (!isCounterCommand(command)) {
              return;
            }

            rollbackCounterCommand(command);
          },
        });
        showCommandError(error instanceof Error ? error.message : `Unable to send ${requestedLabel}.`);
      }
    },
    [
      isCommandPending,
      metricsReceivedAt,
      publishTopic,
      resolveCommand,
      rollbackCounterCommand,
      showCommandError,
      startCommand,
      status,
    ]
  );

  useEffect(() => {
    let isMounted = true;

    async function loadValues() {
      const stored = await getStoredAccommodationRoomInputs();

      if (isMounted) {
        setDraftForm(stored);
        setConfirmedForm(stored);
        hasHydratedRef.current = true;
      }
    }

    void loadValues();

    return () => {
      isMounted = false;
      clearTemperatureDebounce();
      clearSmokeDensityDebounce();
      if (commandErrorTimeoutRef.current) {
        clearTimeout(commandErrorTimeoutRef.current);
      }
    };
  }, [clearSmokeDensityDebounce, clearTemperatureDebounce]);


  useEffect(() => {
    if (!hasHydratedRef.current) {
      return;
    }

    void setStoredAccommodationRoomInputs(confirmedForm);
  }, [confirmedForm]);

  useEffect(() => {
    if (status === 'connected') {
      const clearMqttErrorTimer = setTimeout(() => {
        setLastCommandError((current) =>
          current?.startsWith('MQTT disconnected') ? null : current
        );
      }, 0);

      return () => clearTimeout(clearMqttErrorTimer);
    }

    clearTemperatureDebounce();
    clearSmokeDensityDebounce();
    temperatureSnapshotRef.current = null;
    smokeDensitySnapshotRef.current = null;
    const clearPendingTimer = setTimeout(() => {
      resolveAllCommands({
        onResolve: (command) => {
          if (!isCounterCommand(command)) {
            return;
          }

          rollbackCounterCommand(command);
        },
      });
    }, 0);

    return () => clearTimeout(clearPendingTimer);
  }, [
    clearSmokeDensityDebounce,
    clearTemperatureDebounce,
    resolveAllCommands,
    rollbackCounterCommand,
    status,
  ]);

  useEffect(() => {
    if (!metricsState) {
      return;
    }

    const nextTemperatureMetricValue =
      metricsState.temperatureNumber === null ? null : Math.round(metricsState.temperatureNumber);
    const nextSmokeDensityMetricValue =
      metricsState.smokeDensityNumber === null ? null : Math.round(metricsState.smokeDensityNumber);
    const latestPendingCommands = Object.values(pendingCommandMap).filter(isCounterCommand);

    const isFreshGatewayResponse = (command: PendingCommandState<CounterCommandSnapshot>) =>
      metricsReceivedAt !== null &&
      (command.snapshot.baselineReceivedAt === null
        ? metricsReceivedAt >= command.startedAt
        : metricsReceivedAt > command.snapshot.baselineReceivedAt);

    const ackedCounterCommands = latestPendingCommands.filter((command) => {
      if (!isFreshGatewayResponse(command)) {
        return false;
      }

      if (command.snapshot.field === 'temperatureValue') {
        return (
          nextTemperatureMetricValue !== null &&
          command.snapshot.expectedMetricValue === nextTemperatureMetricValue
        );
      }

      return (
        nextSmokeDensityMetricValue !== null &&
        command.snapshot.expectedMetricValue === nextSmokeDensityMetricValue
      );
    });

    const processMetricsTimer = setTimeout(() => {
      // Only sync from MQTT while connected — offline slider values must not be overwritten.
      if (statusRef.current !== 'connected') {
        return;
      }

      if (metricsState.temperatureValue !== null || metricsState.smokeDensityValue !== null) {
        const canSyncTemperature =
          metricsState.temperatureValue !== null &&
          temperatureSnapshotRef.current === null &&
          (!isCommandPending(getCounterCommandId('temperatureValue')) ||
            ackedCounterCommands.some((command) => command.snapshot.field === 'temperatureValue'));
        const canSyncSmokeDensity =
          metricsState.smokeDensityValue !== null &&
          smokeDensitySnapshotRef.current === null &&
          (!isCommandPending(getCounterCommandId('smokeDensityValue')) ||
            ackedCounterCommands.some((command) => command.snapshot.field === 'smokeDensityValue'));

        setConfirmedForm((current) => {
          const next = { ...current };
          if (canSyncTemperature) next.temperatureValue = metricsState.temperatureValue!;
          if (canSyncSmokeDensity) next.smokeDensityValue = metricsState.smokeDensityValue!;
          return next;
        });

        setDraftForm((current) => {
          const next = { ...current };
          if (canSyncTemperature) next.temperatureValue = metricsState.temperatureValue!;
          if (canSyncSmokeDensity) next.smokeDensityValue = metricsState.smokeDensityValue!;
          return next;
        });
      }

      if (ackedCounterCommands.length > 0) {
        const latestAckedCommand =
          [...ackedCounterCommands].sort((left, right) => left.startedAt - right.startedAt).pop() ??
          null;

        if (latestAckedCommand && metricsReceivedAt !== null) {
          recordLatencySampleRef.current({
            label: latestAckedCommand.label,
            requestTopicKey: 'gatewayOtCommand',
            responseTopicKey: 'gatewayMetrics',
            startedAt: latestAckedCommand.startedAt,
            completedAt: metricsReceivedAt,
          });
        }

        ackedCounterCommands.forEach((command) => {
          resolveCommand(command.id);
        });
        setLastCommandError(null);
      }
    }, 0);

    return () => clearTimeout(processMetricsTimer);
  }, [isCommandPending, metricsReceivedAt, metricsState, pendingCommandMap, resolveCommand]);

  const handleTemperatureChange = useCallback(
    (nextValue: string) => {
      const nextTemperature = parseAccommodationTemperature(nextValue);
      const formatted = formatAccommodationTemperature(nextTemperature);

      setDraftForm((current) => ({ ...current, temperatureValue: formatted }));

      // Offline: commit both draft and confirmed immediately — no debounce, no MQTT.
      if (statusRef.current !== 'connected') {
        setConfirmedForm((current) => ({ ...current, temperatureValue: formatted }));
        temperatureSnapshotRef.current = null;
        return;
      }

      if (!temperatureSnapshotRef.current) {
        temperatureSnapshotRef.current = {
          previousConfirmedValue: getAccommodationFieldValue(confirmedForm, 'temperatureValue'),
          previousDraftValue: getAccommodationFieldValue(draftForm, 'temperatureValue'),
        };
      }

      clearTemperatureDebounce();
      temperatureDebounceRef.current = setTimeout(() => {
        const snapshot = temperatureSnapshotRef.current ?? {
          previousConfirmedValue: getAccommodationFieldValue(confirmedForm, 'temperatureValue'),
          previousDraftValue: getAccommodationFieldValue(draftForm, 'temperatureValue'),
        };
        temperatureSnapshotRef.current = null;

        void sendSetValueCommand(
          'temperatureValue',
          nextTemperature,
          `Temperature ${formatted}`,
          snapshot
        );
      }, COMMAND_DEBOUNCE_MS);
    },
    [clearTemperatureDebounce, confirmedForm, draftForm, sendSetValueCommand]
  );

  const handleSmokeDensityChange = useCallback(
    (nextValue: string) => {
      const nextDensity = parseAccommodationSmokeDensity(nextValue);
      const formatted = formatAccommodationSmokeDensity(nextDensity);
      const densityCounterId =
        CARLO_GAVAZZI_GATEWAY_CONFIG.accommodationRoom.counterIds.smokeDensity;

      setDraftForm((current) => ({ ...current, smokeDensityValue: formatted }));

      // Offline: commit both draft and confirmed immediately — no debounce, no MQTT.
      if (statusRef.current !== 'connected') {
        setConfirmedForm((current) => ({ ...current, smokeDensityValue: formatted }));
        smokeDensitySnapshotRef.current = null;
        return;
      }

      if (!smokeDensitySnapshotRef.current) {
        smokeDensitySnapshotRef.current = {
          previousConfirmedValue: getAccommodationFieldValue(confirmedForm, 'smokeDensityValue'),
          previousDraftValue: getAccommodationFieldValue(draftForm, 'smokeDensityValue'),
        };
      }

      clearSmokeDensityDebounce();
      smokeDensityDebounceRef.current = setTimeout(() => {
        const snapshot = smokeDensitySnapshotRef.current ?? {
          previousConfirmedValue: getAccommodationFieldValue(confirmedForm, 'smokeDensityValue'),
          previousDraftValue: getAccommodationFieldValue(draftForm, 'smokeDensityValue'),
        };
        smokeDensitySnapshotRef.current = null;

        if (densityCounterId === null) {
          setConfirmedForm((current) => ({ ...current, smokeDensityValue: formatted }));
          return;
        }

        void sendSetValueCommand(
          'smokeDensityValue',
          nextDensity,
          `Smoke Density ${formatted}`,
          snapshot
        );
      }, COMMAND_DEBOUNCE_MS);
    },
    [clearSmokeDensityDebounce, confirmedForm, draftForm, sendSetValueCommand]
  );

  const pendingTemperatureCommand = pendingCommandMap[getCounterCommandId('temperatureValue')] ?? null;
  const pendingSmokeDensityCommand =
    pendingCommandMap[getCounterCommandId('smokeDensityValue')] ?? null;
  const isTemperaturePending = pendingTemperatureCommand !== null;
  const isSmokeDensityPending = pendingSmokeDensityCommand !== null;
  const isAnyPending = isTemperaturePending || isSmokeDensityPending;
  const lastMetricsAt = metricsReceivedAt;

  const heroSyncLabel = useMemo(() => {
    if (status !== 'connected') {
      return 'Offline';
    }

    return isAnyPending ? 'Sync' : 'Synced';
  }, [isAnyPending, status]);

  const heroSyncHint = useMemo(() => {
    if (lastCommandError) {
      return lastCommandError;
    }

    if (status !== 'connected') {
      return '--:--:--';
    }

    if (isAnyPending) {
      return '99:99:99';
    }

    if (lastMetricsAt) {
      return `${formatEventTime(lastMetricsAt)}`;
    }

    return '00:00:00';
  }, [isAnyPending, lastCommandError, lastMetricsAt, status]);

  const panelContent = (
    <>
      <InjectValueHero
        syncLabel={heroSyncLabel}
        syncHint={heroSyncHint}
        isPending={isAnyPending}
        isCooldownSimEnabled={isCooldownSimEnabled}
        onToggleCooldownSim={() => setIsCooldownSimEnabled((current) => !current)}
      />
      <AccommodationSourceSection
        confirmedForm={confirmedForm}
        draftForm={draftForm}
        heatingState={zoneHeatingState}
        isTemperaturePending={isTemperaturePending}
        isSmokeDensityPending={isSmokeDensityPending}
        onTemperatureChange={handleTemperatureChange}
        onSmokeDensityChange={handleSmokeDensityChange}
      />
      {/* <FgsCalcDisplay
        temperatureC={parseAccommodationTemperature(draftForm.temperatureValue)}
        smokePpm={parseAccommodationSmokeDensity(draftForm.smokeDensityValue)}
      /> */}
    </>
  );

  if (contentOnly) {
    return panelContent;
  }

  const content = (
    <>
      {!embedded ? <InjectValueHeader /> : null}

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {panelContent}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </>
  );

  if (embedded) {
    return <View style={styles.safeArea}>{content}</View>;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {content}
    </SafeAreaView>
  );
}
