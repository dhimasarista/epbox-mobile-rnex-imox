import { Slider } from '@expo/ui/community/slider';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  DEFAULT_ACCOMMODATION_ROOM_INPUTS,
  formatAccommodationTemperature,
  getStoredAccommodationRoomInputs,
  parseAccommodationTemperature,
  setStoredAccommodationRoomInputs,
  type AccommodationRoomInputs,
} from '@/lib/accommodation-room-demo';
import {
  ACCOMMODATION_ROOM_ALARM_STATUS_OPTIONS,
  buildCarloGavazziAlarmCommand,
  buildCarloGavazziOtCommand,
  CARLO_GAVAZZI_GATEWAY_CONFIG,
  getAccommodationRoomAlarmState,
  getAccommodationRoomMetricsState,
  getAccommodationRoomZoneHeatingState,
  type AccommodationRoomZoneHeatingState,
  type CarloGavazziAlarmCommandName,
} from '@/lib/mqtt-topics';
import { useMqtt, useMqttTopic, type MqttConnectionState } from '@/providers/mqtt-provider';
import { AppColors } from '@/styles';
import { getSignalPalette, styles, type SignalTone } from '@/styles/screens/station.styles';

const ACCOMMODATION_TEMP_WARNING_C = 40;
const ACCOMMODATION_TEMP_ALERT_C = 55;
const ACCOMMODATION_TEMP_MAX_C = 120;
const COMMAND_DEBOUNCE_MS = 250;
const ALARM_WRITE_GUARD_MS = 5_000; // silent expiry — no countdown shown

type AccommodationEditableKey = 'smokeDetected' | 'temperatureValue';
type PendingCounterCommand = {
  counterId: number;
  expectedMetricValue: number;
  requestedLabel: string;
  sentAt: number;
};
type PendingCounterCommandMap = Partial<Record<AccommodationEditableKey, PendingCounterCommand>>;
type PendingAlarmCommand = {
  cmd: CarloGavazziAlarmCommandName;
  requestedLabel: string;
  sentAt: number;
  baselineReceivedAt: number | null;
};
// Only the command that was just sent is write-guarded; other alarm buttons
// (e.g. an emergency Reset while Acknowledge is still pending ack) stay usable.
type PendingAlarmCommandMap = Partial<Record<CarloGavazziAlarmCommandName, PendingAlarmCommand>>;

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

function getAccommodationAlarmTone(
  alarmStatusCode: number | null,
  sirenOn: boolean | null
): SignalTone {
  if (sirenOn || alarmStatusCode === 2 || alarmStatusCode === 4) {
    return 'danger';
  }

  if (alarmStatusCode === 3 || alarmStatusCode === 5 || alarmStatusCode === 6) {
    return 'warning';
  }

  return 'normal';
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

function getMqttLinkMeta(
  connectionState: MqttConnectionState,
  latestRoundtripMs: number | null,
  isPending: boolean
) {
  if (connectionState !== 'connected') {
    return {
      label: 'Offline',
      detail: 'No broker session',
      tone: 'danger' as const,
    };
  }

  if (isPending) {
    return {
      label: 'Waiting Ack',
      detail: 'Awaiting metrics',
      tone: 'warning' as const,
    };
  }

  if (latestRoundtripMs === null) {
    return {
      label: 'Ready',
      detail: 'No RTT sample yet',
      tone: 'normal' as const,
    };
  }

  if (latestRoundtripMs >= 2500) {
    return {
      label: 'Slow',
      detail: `${latestRoundtripMs} ms`,
      tone: 'danger' as const,
    };
  }

  if (latestRoundtripMs >= 1000) {
    return {
      label: 'Busy',
      detail: `${latestRoundtripMs} ms`,
      tone: 'warning' as const,
    };
  }

  return {
    label: 'Fast',
    detail: `${latestRoundtripMs} ms`,
    tone: 'normal' as const,
  };
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

function AccommodationRoomHero({
  syncLabel,
  syncHint,
  isPending,
}: {
  syncLabel: string;
  syncHint: string;
  isPending: boolean;
}) {
  return (
    <View style={styles.heroCard}>
      <View style={styles.heroTopRow}>
        <View style={styles.heroBadge}>
          <MaterialCommunityIcons name="bed-outline" size={14} color={AppColors.primary} />
          <Text style={styles.heroBadgeText}>{syncLabel}</Text>
        </View>
        <View style={styles.liveChip}>
          <View
            style={[
              styles.liveDot,
              { backgroundColor: isPending ? AppColors.warning : AppColors.success },
            ]}
          />
          <Text style={styles.liveChipText}>{syncHint}</Text>
        </View>
      </View>

      <Text style={styles.heroSubtitle}>This room used for Inject Data to CG Gateway & PLC, please use value properly.</Text>
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
  confirmedValue,
  activeText,
  inactiveText,
  activeIcon,
  inactiveIcon,
  hint,
  onChange,
}: {
  label: string;
  value: boolean;
  confirmedValue: boolean;
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
            <Text style={styles.dashboardToggleValue}>
              {confirmedValue ? activeText : inactiveText}
            </Text>
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

        {/* <Text style={styles.dashboardControlHint}>{hint}</Text> */}
      </View>
    </View>
  );
}

function AccommodationTemperatureField({
  confirmedValue,
  draftValue,
  hint,
  heatingState,
  onChange,
}: {
  confirmedValue: string;
  draftValue: string;
  hint: string;
  heatingState: AccommodationRoomZoneHeatingState;
  onChange: (value: string) => void;
}) {
  const confirmedTemperatureValue = parseAccommodationTemperature(confirmedValue);
  const draftTemperatureValue = parseAccommodationTemperature(draftValue);
  const signalTone = getAccommodationTemperatureSignalTone(confirmedTemperatureValue);
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
              {formatAccommodationTemperature(confirmedTemperatureValue)}
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
              isAntifreezeActive
                ? {
                    backgroundColor: '#DBEAFE',
                    borderColor: '#93C5FD',
                  }
                : {
                    backgroundColor: signalPalette.surface,
                    borderColor: signalPalette.border,
                  },
            ]}>
            <Text
              style={[
                styles.signalStateText,
                { color: isAntifreezeActive ? AppColors.info : signalPalette.text },
              ]}>
              {getAccommodationTemperatureLabel(signalTone, heatingState.heatingStatusValue)}
            </Text>
          </View>
          <Text style={styles.sliderRangeText}>{ACCOMMODATION_TEMP_MAX_C} C</Text>
        </View>

        {/* <Text style={styles.dashboardControlHint}>{hint}</Text> */}
      </View>
    </View>
  );
}

function AlarmCommandButton({
  label,
  tone,
  disabled,
  onPress,
}: {
  label: string;
  tone: 'primary' | 'secondary';
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.alarmCommandButton,
        tone === 'primary' ? styles.alarmCommandButtonPrimary : styles.alarmCommandButtonSecondary,
        disabled && styles.alarmCommandButtonDisabled,
      ]}>
      <Text
        style={[
          styles.alarmCommandButtonText,
          tone === 'primary'
            ? styles.alarmCommandButtonTextPrimary
            : styles.alarmCommandButtonTextSecondary,
        ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function AccommodationAlarmSection({
  alarmStatusLabel,
  alarmStatusCode,
  sirenOn,
  outputs,
  hint,
  commandHint,
  behaviorHint,
  isConnected,
  isCommandLocked,
  isPending,
  mqttLinkLabel,
  mqttLinkDetail,
  mqttLinkTone,
  writeWindowLabel,
  writeWindowDetail,
  onCommandPress,
}: {
  alarmStatusLabel: string;
  alarmStatusCode: number | null;
  sirenOn: boolean | null;
  outputs: { code: number; label: string; active: boolean }[];
  hint: string;
  commandHint: string;
  behaviorHint: string;
  isConnected: boolean;
  isCommandLocked: (command: CarloGavazziAlarmCommandName) => boolean;
  isPending: boolean;
  mqttLinkLabel: string;
  mqttLinkDetail: string;
  mqttLinkTone: SignalTone;
  writeWindowLabel: string;
  writeWindowDetail: string;
  onCommandPress: (command: CarloGavazziAlarmCommandName, label: string) => void;
}) {
  const alarmTone = getAccommodationAlarmTone(alarmStatusCode, sirenOn);
  const alarmPalette = getSignalPalette(alarmTone);
  const isAlarmOff = alarmTone === 'normal';
  const isAlarmOn  = !isAlarmOff;
  const isSirenOn  = sirenOn === true;

  return (
    <View style={styles.sectionCard}>
      <View style={styles.statusSegmentRow}>
        {/* Off */}
        <View
          style={[
            styles.statusSegmentButton,
            isAlarmOff && styles.statusSegmentButtonActive,
            isAlarmOff && { backgroundColor: AppColors.surfaceSuccess, borderColor: '#9BD7B6' },
          ]}>
          <View style={styles.statusSegmentTopRow}>
            <View style={[styles.statusSegmentLamp, { backgroundColor: AppColors.success }, isAlarmOff && styles.statusSegmentLampActive]} />
            <Text style={styles.statusSegmentCode}>00</Text>
          </View>
          <View style={[styles.statusSegmentCap, isAlarmOff && styles.statusSegmentCapActive]}>
            <Feather name="check" size={18} color={isAlarmOff ? AppColors.success : AppColors.textSubtle} />
          </View>
          <Text style={[styles.statusSegmentText, isAlarmOff && styles.statusSegmentTextActive]}>Off</Text>
        </View>

        {/* On */}
        <View
          style={[
            styles.statusSegmentButton,
            isAlarmOn && styles.statusSegmentButtonActive,
            isAlarmOn && { backgroundColor: AppColors.surfaceError, borderColor: '#F4B7B7' },
          ]}>
          <View style={styles.statusSegmentTopRow}>
            <View style={[styles.statusSegmentLamp, { backgroundColor: AppColors.error }, isAlarmOn && styles.statusSegmentLampActive]} />
            <Text style={styles.statusSegmentCode}>01</Text>
          </View>
          <View style={[styles.statusSegmentCap, isAlarmOn && styles.statusSegmentCapActive]}>
            <Feather name="alert-triangle" size={18} color={isAlarmOn ? AppColors.error : AppColors.textSubtle} />
          </View>
          <Text style={[styles.statusSegmentText, isAlarmOn && styles.statusSegmentTextActive]}>
            {isAlarmOn ? alarmStatusLabel : 'On'}
          </Text>
        </View>

        {/* Siren */}
        <View
          style={[
            styles.statusSegmentButton,
            isSirenOn && styles.statusSegmentButtonActive,
            isSirenOn && { backgroundColor: '#FFF4DB', borderColor: '#F2D17A' },
          ]}>
          <View style={styles.statusSegmentTopRow}>
            <View style={[styles.statusSegmentLamp, { backgroundColor: AppColors.warning }, isSirenOn && styles.statusSegmentLampActive]} />
            <Text style={styles.statusSegmentCode}>SRN</Text>
          </View>
          <View style={[styles.statusSegmentCap, isSirenOn && styles.statusSegmentCapActive]}>
            <Feather name="volume-2" size={18} color={isSirenOn ? AppColors.warning : AppColors.textSubtle} />
          </View>
          <Text style={[styles.statusSegmentText, isSirenOn && styles.statusSegmentTextActive]}>Siren</Text>
        </View>
      </View>
      <View style={styles.alarmOutputList}>
        {outputs.map((output) => (
          <View
            key={`${output.code}-${output.label}`}
            style={[
              styles.alarmOutputRow,
              output.active && styles.alarmOutputRowActive,
            ]}>
            <View
              style={[
                styles.alarmOutputDot,
                {
                  backgroundColor: output.active ? alarmPalette.accent : AppColors.border,
                },
              ]}
            />
            <Text
              style={[
                styles.alarmOutputLabel,
                output.active && { color: alarmPalette.text },
              ]}>
              {output.label}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.alarmCommandGrid}>
        <AlarmCommandButton
          label="Acknowledge Alarm"
          tone="primary"
          disabled={!isConnected || isCommandLocked('Acknowledgement')}
          onPress={() => onCommandPress('Acknowledgement', 'Acknowledge Alarm')}
        />
        <AlarmCommandButton
          label="Reset Alarm"
          tone="primary"
          disabled={!isConnected || isCommandLocked('Reset')}
          onPress={() => onCommandPress('Reset', 'Reset Alarm')}
        />
        <AlarmCommandButton
          label="Reset ON"
          tone="secondary"
          disabled={!isConnected || isCommandLocked('ResetOn')}
          onPress={() => onCommandPress('ResetOn', 'Reset ON')}
        />
        <AlarmCommandButton
          label="Reset OFF"
          tone="secondary"
          disabled={!isConnected || isCommandLocked('ResetOff')}
          onPress={() => onCommandPress('ResetOff', 'Reset OFF')}
        />
        {/* <AlarmCommandButton
          label="Alarm ON"
          tone="secondary"
          disabled={!isConnected || isActionLocked}
          onPress={() => onCommandPress('TestAlarmOn', 'Alarm ON')}
        />
        <AlarmCommandButton
          label="Alarm OFF"
          tone="secondary"
          disabled={!isConnected || isActionLocked}
          onPress={() => onCommandPress('TestAlarmOff', 'Alarm OFF')}
        /> */}
      </View>

      <Text style={styles.dashboardControlHint}>{commandHint}</Text>
    </View>
  );
}

function AccommodationSourceSection({
  confirmedForm,
  draftForm,
  heatingState,
  smokeHint,
  temperatureHint,
  onSmokeChange,
  onTemperatureChange,
}: {
  confirmedForm: AccommodationRoomInputs;
  draftForm: AccommodationRoomInputs;
  heatingState: AccommodationRoomZoneHeatingState;
  smokeHint: string;
  temperatureHint: string;
  onSmokeChange: (value: boolean) => void;
  onTemperatureChange: (value: string) => void;
}) {
  return (
    <View style={styles.sectionCard}>
      <AccommodationToggleField
        label="Smoke Detected"
        value={draftForm.smokeDetected}
        confirmedValue={confirmedForm.smokeDetected}
        activeText="Detected"
        inactiveText="Clear"
        activeIcon="cloud-lightning"
        inactiveIcon="wind"
        hint={smokeHint}
        onChange={onSmokeChange}
      />

      <AccommodationTemperatureField
        confirmedValue={confirmedForm.temperatureValue}
        draftValue={draftForm.temperatureValue}
        hint={temperatureHint}
        heatingState={heatingState}
        onChange={onTemperatureChange}
      />
    </View>
  );
}

export default function AccommodationRoom() {
  const { latestLatencySample, publishTopic, recordLatencySample, status } = useMqtt();
  const recordLatencySampleRef = useRef(recordLatencySample);
  recordLatencySampleRef.current = recordLatencySample;
  const metricsTopic = useMqttTopic('gatewayMetrics');
  const [draftForm, setDraftForm] = useState(DEFAULT_ACCOMMODATION_ROOM_INPUTS);
  const [confirmedForm, setConfirmedForm] = useState(DEFAULT_ACCOMMODATION_ROOM_INPUTS);
  const [pendingCommands, setPendingCommands] = useState<PendingCounterCommandMap>({});
  const [pendingAlarmCommands, setPendingAlarmCommands] = useState<PendingAlarmCommandMap>({});
  const [lastCommandError, setLastCommandError] = useState<string | null>(null);
  const alarmExpireTimeoutsRef = useRef<Map<CarloGavazziAlarmCommandName, ReturnType<typeof setTimeout>>>(new Map());
  // Refs so effects can read latest state without triggering re-runs.
  const pendingCommandsRef = useRef(pendingCommands);
  pendingCommandsRef.current = pendingCommands;
  const pendingAlarmCommandsRef = useRef(pendingAlarmCommands);
  pendingAlarmCommandsRef.current = pendingAlarmCommands;
  const hasHydratedRef = useRef(false);
  const temperatureDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const metricsReceivedAt = metricsTopic.message?.receivedAt ?? null;

  const clearTemperatureDebounce = useCallback(() => {
    if (!temperatureDebounceRef.current) {
      return;
    }

    clearTimeout(temperatureDebounceRef.current);
    temperatureDebounceRef.current = null;
  }, []);

  const alarmState = useMemo(
    () =>
      metricsTopic.payload
        ? getAccommodationRoomAlarmState(metricsTopic.payload)
        : {
            alarmStatusCode: null,
            alarmStatusLabel: 'OFF',
            sirenOn: null,
            lastSignalAt: null,
            outputs: ACCOMMODATION_ROOM_ALARM_STATUS_OPTIONS.map((item) => ({
              ...item,
              active: false,
            })),
          },
    [metricsTopic.payload]
  );
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
  const isAnyAlarmWriteWindowActive = Object.keys(pendingAlarmCommands).length > 0;

  const sendSetValueCommand = useCallback(
    async (field: AccommodationEditableKey, nextMetricValue: number, requestedLabel: string) => {
      if (status !== 'connected') {
        setLastCommandError(`MQTT disconnected`);
        return;
      }

      const counterId =
        field === 'temperatureValue'
          ? CARLO_GAVAZZI_GATEWAY_CONFIG.accommodationRoom.counterIds.temperature
          : CARLO_GAVAZZI_GATEWAY_CONFIG.accommodationRoom.counterIds.smokeStatus;

      try {
        await publishTopic(
          'gatewayOtCommand',
          buildCarloGavazziOtCommand(counterId, 'SetValue', nextMetricValue)
        );

        setPendingCommands((current) => ({
          ...current,
          [field]: {
            counterId,
            expectedMetricValue: nextMetricValue,
            requestedLabel,
            sentAt: Date.now(),
          },
        }));
        setLastCommandError(null);
      } catch (error) {
        setLastCommandError(
          error instanceof Error ? error.message : `Unable to send ${requestedLabel}.`
        );
      }
    },
    [publishTopic, status]
  );

  const sendAlarmCommand = useCallback(
    async (command: CarloGavazziAlarmCommandName, requestedLabel: string) => {
      if (status !== 'connected') {
        setLastCommandError(`Disconnected \n ${requestedLabel}.`);
        return;
      }

      if (pendingAlarmCommands[command]) {
        setLastCommandError(`${requestedLabel} is already in flight — waiting for gateway response.`);
        return;
      }

      try {
        await publishTopic(
          'gatewayOtCommand',
          buildCarloGavazziAlarmCommand(
            CARLO_GAVAZZI_GATEWAY_CONFIG.accommodationRoom.alarm.deviceId,
            command
          )
        );
        const sentAt = Date.now();

        setPendingAlarmCommands((current) => ({
          ...current,
          [command]: { cmd: command, requestedLabel, sentAt, baselineReceivedAt: metricsReceivedAt },
        }));
        setLastCommandError(null);

        // Silent expiry: clear this command after 5s if metrics never confirm it.
        const expireId = setTimeout(() => {
          alarmExpireTimeoutsRef.current.delete(command);
          setPendingAlarmCommands((current) => {
            const next = { ...current };
            delete next[command];
            return next;
          });
          setLastCommandError(null);
        }, ALARM_WRITE_GUARD_MS);

        alarmExpireTimeoutsRef.current.set(command, expireId);
      } catch (error) {
        setLastCommandError(
          error instanceof Error ? error.message : `Unable to send ${requestedLabel}.`
        );
      }
    },
    [metricsReceivedAt, pendingAlarmCommands, publishTopic, status]
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
    };
  }, [clearTemperatureDebounce]);


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
    const clearPendingTimer = setTimeout(() => {
      setPendingCommands({});
      setPendingAlarmCommands({});
    }, 0);

    return () => clearTimeout(clearPendingTimer);
  }, [clearTemperatureDebounce, status]);

  useEffect(() => {
    if (isAnyAlarmWriteWindowActive) {
      return;
    }

    const clearWriteWindowErrorTimer = setTimeout(() => {
      setLastCommandError((current) =>
        current?.startsWith('UWP write window is still active') ? null : current
      );
    }, 0);

    return () => clearTimeout(clearWriteWindowErrorTimer);
  }, [isAnyAlarmWriteWindowActive]);

  useEffect(() => {
    if (!metricsTopic.payload) {
      return;
    }

    const metricsState = getAccommodationRoomMetricsState(metricsTopic.payload);
    const nextTemperatureMetricValue =
      metricsState.temperatureNumber === null ? null : Math.round(metricsState.temperatureNumber);
    const nextSmokeMetricValue =
      metricsState.smokeDetected === null ? null : metricsState.smokeDetected ? 1 : 0;
    const latestPendingCommands = pendingCommandsRef.current;

    const temperatureAcked =
      latestPendingCommands.temperatureValue !== undefined &&
      nextTemperatureMetricValue !== null &&
      latestPendingCommands.temperatureValue.expectedMetricValue === nextTemperatureMetricValue;
    const smokeAcked =
      latestPendingCommands.smokeDetected !== undefined &&
      nextSmokeMetricValue !== null &&
      latestPendingCommands.smokeDetected.expectedMetricValue === nextSmokeMetricValue;

    const processMetricsTimer = setTimeout(() => {
      if (metricsState.temperatureValue !== null || metricsState.smokeDetected !== null) {
        setConfirmedForm((current) => {
          const next = { ...current };

          if (metricsState.temperatureValue !== null) {
            next.temperatureValue = metricsState.temperatureValue;
          }

          if (metricsState.smokeDetected !== null) {
            next.smokeDetected = metricsState.smokeDetected;
          }

          return next;
        });

        setDraftForm((current) => {
          const next = { ...current };

          if (
            metricsState.temperatureValue !== null &&
            (!latestPendingCommands.temperatureValue || temperatureAcked)
          ) {
            next.temperatureValue = metricsState.temperatureValue;
          }

          if (metricsState.smokeDetected !== null && (!latestPendingCommands.smokeDetected || smokeAcked)) {
            next.smokeDetected = metricsState.smokeDetected;
          }

          return next;
        });
      }

      if (temperatureAcked || smokeAcked) {
        const ackedCommands = [
          temperatureAcked ? latestPendingCommands.temperatureValue ?? null : null,
          smokeAcked ? latestPendingCommands.smokeDetected ?? null : null,
        ]
          .filter((command): command is PendingCounterCommand => command !== null)
          .sort((left, right) => left.sentAt - right.sentAt);
        const latestAckedCommand = ackedCommands[ackedCommands.length - 1] ?? null;

        if (latestAckedCommand) {
          recordLatencySampleRef.current({
            label: latestAckedCommand.requestedLabel,
            requestTopicKey: 'gatewayOtCommand',
            responseTopicKey: 'gatewayMetrics',
            startedAt: latestAckedCommand.sentAt,
            completedAt: metricsReceivedAt ?? Date.now(),
          });
        }

        setPendingCommands((current) => {
          const next = { ...current };

          if (temperatureAcked) {
            delete next.temperatureValue;
          }

          if (smokeAcked) {
            delete next.smokeDetected;
          }

          return next;
        });
        setLastCommandError(null);
      }
    }, 0);

    return () => clearTimeout(processMetricsTimer);
  }, [metricsReceivedAt, metricsTopic.payload]);

  useEffect(() => {
    if (metricsReceivedAt === null) {
      return;
    }

    const ackedCommands = (
      Object.entries(pendingAlarmCommandsRef.current) as [CarloGavazziAlarmCommandName, PendingAlarmCommand][]
    ).filter(
      ([, pending]) =>
        pending.baselineReceivedAt === null || metricsReceivedAt > pending.baselineReceivedAt
    );

    if (ackedCommands.length === 0) {
      return;
    }

    // Cancel the 5s silent expiry timers — metrics arrived first.
    ackedCommands.forEach(([command]) => {
      const expireId = alarmExpireTimeoutsRef.current.get(command);
      if (expireId !== undefined) {
        clearTimeout(expireId);
        alarmExpireTimeoutsRef.current.delete(command);
      }
    });

    const latestAcked = ackedCommands.sort((left, right) => left[1].sentAt - right[1].sentAt).pop()!;
    recordLatencySampleRef.current({
      label: latestAcked[1].requestedLabel,
      requestTopicKey: 'gatewayOtCommand',
      responseTopicKey: 'gatewayMetrics',
      startedAt: latestAcked[1].sentAt,
      completedAt: metricsReceivedAt,
    });

    setPendingAlarmCommands((current) => {
      const next = { ...current };
      ackedCommands.forEach(([command]) => {
        delete next[command];
      });
      return next;
    });
    setLastCommandError(null);
  }, [metricsReceivedAt]);

  const handleSmokeDetectedChange = useCallback(
    (nextValue: boolean) => {
      setDraftForm((current) => ({
        ...current,
        smokeDetected: nextValue,
      }));

      void sendSetValueCommand(
        'smokeDetected',
        nextValue ? 1 : 0,
        `Smoke Status ${nextValue ? 'Detected' : 'Clear'}`
      );
    },
    [sendSetValueCommand]
  );

  const handleTemperatureChange = useCallback(
    (nextValue: string) => {
      const nextTemperature = parseAccommodationTemperature(nextValue);

      setDraftForm((current) => ({
        ...current,
        temperatureValue: formatAccommodationTemperature(nextTemperature),
      }));

      clearTemperatureDebounce();
      temperatureDebounceRef.current = setTimeout(() => {
        void sendSetValueCommand(
          'temperatureValue',
          nextTemperature,
          `Temperature ${formatAccommodationTemperature(nextTemperature)}`
        );
      }, COMMAND_DEBOUNCE_MS);
    },
    [clearTemperatureDebounce, sendSetValueCommand]
  );

  const isTemperaturePending = pendingCommands.temperatureValue !== undefined;
  const isSmokePending = pendingCommands.smokeDetected !== undefined;
  const isAlarmPending = Object.keys(pendingAlarmCommands).length > 0;
  const isAlarmCommandLocked = useCallback(
    (command: CarloGavazziAlarmCommandName) => !!pendingAlarmCommands[command],
    [pendingAlarmCommands]
  );
  const isAnyPending = isTemperaturePending || isSmokePending || isAlarmPending;
  const lastMetricsAt = metricsReceivedAt;
  const lastAlarmMetricsAt = alarmState.lastSignalAt ?? lastMetricsAt;
  const latestAlarmRoundtripMs =
    latestLatencySample?.requestTopicKey === 'gatewayOtCommand' &&
    latestLatencySample.responseTopicKey === 'gatewayMetrics'
      ? latestLatencySample.durationMs
      : null;
  const mqttLinkMeta = getMqttLinkMeta(status, latestAlarmRoundtripMs, isAlarmPending);
  const writeWindowLabel = isAnyAlarmWriteWindowActive ? 'Sending…' : 'Ready';
  const writeWindowDetail = isAnyAlarmWriteWindowActive
    ? 'Waiting for gateway response'
    : 'Next edge can be sent';

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

  const smokeHint = useMemo(() => {
    if (lastCommandError && isSmokePending) {
      return lastCommandError;
    }

    if (isSmokePending) {
      return `Request ${
        pendingCommands.smokeDetected?.requestedLabel ?? 'Smoke Status'
      }.`;
    }

    if (status !== 'connected') {
      return 'Disconnected';
    }

    if (lastMetricsAt) {
      return `Confirmed state from metrics at ${formatEventTime(lastMetricsAt)}.`;
    }

    return 'Smoke status follows the confirmed value returned by the gateway metrics.';
  }, [isSmokePending, lastCommandError, lastMetricsAt, pendingCommands.smokeDetected, status]);

  const temperatureHint = useMemo(() => {
    if (lastCommandError && isTemperaturePending) {
      return lastCommandError;
    }

    if (isTemperaturePending) {
      return `Requested ${
        pendingCommands.temperatureValue?.requestedLabel ?? draftForm.temperatureValue
      }.`;
    }

    if (status !== 'connected') {
      return 'Disconnected';
    }

    if (lastMetricsAt) {
      return `Confirmed temperature ${confirmedForm.temperatureValue} from metrics at ${formatEventTime(
        lastMetricsAt
      )}.`;
    }

    return 'Temperature chip and dot follow the metrics response, not the slider draft.';
  }, [
    confirmedForm.temperatureValue,
    draftForm.temperatureValue,
    isTemperaturePending,
    lastCommandError,
    lastMetricsAt,
    pendingCommands.temperatureValue,
    status,
  ]);
  const latestPendingAlarmCommand = useMemo(() => {
    const pendingEntries = Object.values(pendingAlarmCommands) as PendingAlarmCommand[];

    if (pendingEntries.length === 0) {
      return null;
    }

    return pendingEntries.sort((left, right) => left.sentAt - right.sentAt).pop() ?? null;
  }, [pendingAlarmCommands]);

  const alarmHint = useMemo(() => {
    if (lastCommandError && latestPendingAlarmCommand) {
      return lastCommandError;
    }

    if (latestPendingAlarmCommand) {
      return `${latestPendingAlarmCommand.requestedLabel} sent — waiting for gateway metrics to confirm.`;
    }

    if (status !== 'connected') {
      return 'Alarm command buttons stay disabled until MQTT reconnects.';
    }

    if (lastAlarmMetricsAt) {
      return `Alarm and siren outputs last refreshed at ${formatEventTime(lastAlarmMetricsAt)}.`;
    }

    return 'Waiting for alarm metrics from the gateway.';
  }, [lastAlarmMetricsAt, lastCommandError, latestPendingAlarmCommand, status]);

  const alarmCommandHint = useMemo(() => {
    if (latestPendingAlarmCommand) {
      return `${latestPendingAlarmCommand.cmd} → device ${CARLO_GAVAZZI_GATEWAY_CONFIG.accommodationRoom.alarm.deviceId}. Clears when metrics arrive or after 5s.`;
    }

    return 'Pulse actions like Reset or Acknowledge are safest for repeated retries.';
  }, [latestPendingAlarmCommand]);
  const alarmBehaviorHint = useMemo(() => {
    if (isAnyAlarmWriteWindowActive) {
      return 'Command sent — clears automatically when gateway responds or after 5s.';
    }

    return 'If ResetOn, ResetOff, TestAlarmOn, or TestAlarmOff seem ignored, create a new edge first or use pulse commands such as Reset and Acknowledge.';
  }, [isAnyAlarmWriteWindowActive]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <AccommodationRoomHeader />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <AccommodationRoomHero
          syncLabel={heroSyncLabel}
          syncHint={heroSyncHint}
          isPending={isAnyPending}
        />
        <AccommodationSourceSection
          confirmedForm={confirmedForm}
          draftForm={draftForm}
          heatingState={zoneHeatingState}
          smokeHint={smokeHint}
          temperatureHint={temperatureHint}
          onSmokeChange={handleSmokeDetectedChange}
          onTemperatureChange={handleTemperatureChange}
        />
        <AccommodationAlarmSection
          alarmStatusLabel={alarmState.alarmStatusLabel}
          alarmStatusCode={alarmState.alarmStatusCode}
          sirenOn={alarmState.sirenOn}
          outputs={alarmState.outputs}
          hint={alarmHint}
          commandHint={alarmCommandHint}
          behaviorHint={alarmBehaviorHint}
          isConnected={status === 'connected'}
          isCommandLocked={isAlarmCommandLocked}
          isPending={isAlarmPending}
          mqttLinkLabel={mqttLinkMeta.label}
          mqttLinkDetail={mqttLinkMeta.detail}
          mqttLinkTone={mqttLinkMeta.tone}
          writeWindowLabel={writeWindowLabel}
          writeWindowDetail={writeWindowDetail}
          onCommandPress={sendAlarmCommand}
        />
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}
