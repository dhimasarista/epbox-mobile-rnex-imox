import { Slider } from '@expo/ui/community/slider';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
import { useAutoCooldown, type CooldownTarget } from '@/hooks/use-auto-cooldown';
import {
  AUTO_PUMP_DENSITY_OFF_PPM,
  AUTO_PUMP_DENSITY_ON_PPM,
  AUTO_PUMP_TEMP_OFF_C,
  useAutoPumpActivation,
} from '@/hooks/use-auto-pump-activation';
import {
  DEFAULT_PENDING_COMMAND_TIMEOUT_MS,
  usePendingCommand,
  type PendingCommandState,
} from '@/hooks/use-pending-command';
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
type AlarmCommandSnapshot = {
  kind: 'alarm';
  command: CarloGavazziAlarmCommandName;
  baselineReceivedAt: number | null;
};
type AccommodationCommandSnapshot = CounterCommandSnapshot | AlarmCommandSnapshot;

function getCounterCommandId(field: AccommodationEditableKey) {
  return `counter:${field}`;
}

function getAlarmCommandId(command: CarloGavazziAlarmCommandName) {
  return `alarm:${command}`;
}

function isCounterCommand(
  command: PendingCommandState<AccommodationCommandSnapshot>
): command is PendingCommandState<CounterCommandSnapshot> {
  return command.snapshot.kind === 'counter';
}

function isAlarmCommand(
  command: PendingCommandState<AccommodationCommandSnapshot>
): command is PendingCommandState<AlarmCommandSnapshot> {
  return command.snapshot.kind === 'alarm';
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
    <View style={styles.heroCard}>
      <View style={styles.heroTopRow}>
        {/* Sync badge doubles as the cooldown-simulation switch: tap to stop the
            auto temperature / smoke-density decrease while a pump is running. */}
        <TouchableOpacity
          style={[styles.heroBadge, !isCooldownSimEnabled && { opacity: 0.55 }]}
          onPress={onToggleCooldownSim}
          activeOpacity={0.8}
          accessibilityRole="switch"
          accessibilityState={{ checked: isCooldownSimEnabled }}
          accessibilityLabel="Auto cooldown simulation">
          <MaterialCommunityIcons
            name={isCooldownSimEnabled ? 'bed-outline' : 'pause'}
            size={14}
            color={AppColors.primary}
          />
          <Text style={styles.heroBadgeText}>
            {isCooldownSimEnabled ? syncLabel : `${syncLabel} · Sim Off`}
          </Text>
        </TouchableOpacity>
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

function AccommodationTemperatureField({
  confirmedValue,
  draftValue,
  hint,
  heatingState,
  disabled,
  onChange,
}: {
  confirmedValue: string;
  draftValue: string;
  hint: string;
  heatingState: AccommodationRoomZoneHeatingState;
  disabled: boolean;
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
            disabled={disabled}
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

function getAccommodationSmokeDensityTone(value: number): SignalTone {
  if (value >= AUTO_PUMP_DENSITY_ON_PPM) {
    return 'danger';
  }

  if (value >= AUTO_PUMP_DENSITY_OFF_PPM) {
    return 'warning';
  }

  return 'normal';
}

// Smoke density mirrors the temperature control (counter, 0–15 ppm). The MQTT
// device id is wired later; until then this stays a local slider (see the null
// counterIds.smokeDensity guard in the change handler).
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
  const signalTone = getAccommodationSmokeDensityTone(confirmedDensity);
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
              {formatAccommodationSmokeDensity(confirmedDensity)}
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

function AlarmCommandButton({
  label,
  tone,
  disabled,
  onPress,
}: {
  label: string;
  tone: 'primary' | 'secondary';
  disabled: boolean;
  countdownSeconds?: number | null;
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
  getCommandCountdown,
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
  getCommandCountdown: (command: CarloGavazziAlarmCommandName) => number | null;
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
            <View
              style={[
                styles.statusSegmentLamp,
                { backgroundColor: isAlarmOff ? AppColors.success : AppColors.border },
                isAlarmOff && styles.statusSegmentLampActive,
              ]}
            />
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
            <View
              style={[
                styles.statusSegmentLamp,
                { backgroundColor: isAlarmOn ? AppColors.error : AppColors.border },
                isAlarmOn && styles.statusSegmentLampActive,
              ]}
            />
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
            <View
              style={[
                styles.statusSegmentLamp,
                { backgroundColor: isSirenOn ? AppColors.warning : AppColors.border },
                isSirenOn && styles.statusSegmentLampActive,
              ]}
            />
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
          countdownSeconds={getCommandCountdown('Acknowledgement')}
          onPress={() => onCommandPress('Acknowledgement', 'Acknowledge Alarm')}
        />
        <AlarmCommandButton
          label="Reset Alarm"
          tone="primary"
          disabled={!isConnected || isCommandLocked('Reset')}
          countdownSeconds={getCommandCountdown('Reset')}
          onPress={() => onCommandPress('Reset', 'Reset Alarm')}
        />
        <AlarmCommandButton
          label="Reset ON"
          tone="secondary"
          disabled={!isConnected || isCommandLocked('ResetOn')}
          countdownSeconds={getCommandCountdown('ResetOn')}
          onPress={() => onCommandPress('ResetOn', 'Reset ON')}
        />
        <AlarmCommandButton
          label="Reset OFF"
          tone="secondary"
          disabled={!isConnected || isCommandLocked('ResetOff')}
          countdownSeconds={getCommandCountdown('ResetOff')}
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
  temperatureHint,
  isTemperaturePending,
  isSmokeDensityPending,
  onTemperatureChange,
  onSmokeDensityChange,
}: {
  confirmedForm: AccommodationRoomInputs;
  draftForm: AccommodationRoomInputs;
  heatingState: AccommodationRoomZoneHeatingState;
  temperatureHint: string;
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
        hint={temperatureHint}
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

export default function AccommodationRoom() {
  const { latestLatencySample, publishTopic, recordLatencySample, status } = useMqtt();
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
  } = usePendingCommand<AccommodationCommandSnapshot>();
  const [alarmCountdownNow, setAlarmCountdownNow] = useState(() => Date.now());
  // When off, the auto temperature / smoke-density cooldown does not run even while
  // a pump is reported running (toggled from the hero sync badge).
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

  const metricsState = useMemo(
    () => (metricsTopic.payload ? getAccommodationRoomMetricsState(metricsTopic.payload) : null),
    [metricsTopic.payload]
  );

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

  // Auto pump activation + cooldown (mobile-only, no backend):
  //  • When the confirmed temperature / smoke density crosses the fire threshold
  //    AND FROM PLC bit 13 (Remote Mode) is active, drive TO_PLC W2 (Pump
  //    Activation) so the PLC starts the pump — cleared once things fall back to
  //    normal. Mirrors the manual W2 command in src/app/stations/pump-room.tsx.
  //  • While FROM PLC reports a running pump (bit 0 / bit 1), nudge temperature
  //    and smoke density back down until they reach normal.
  const confirmedTemperatureC = parseAccommodationTemperature(confirmedForm.temperatureValue);
  const confirmedSmokeDensityPpm = parseAccommodationSmokeDensity(confirmedForm.smokeDensityValue);
  const smokeDensityCounterId =
    CARLO_GAVAZZI_GATEWAY_CONFIG.accommodationRoom.counterIds.smokeDensity;

  useAutoPumpActivation({
    enabled: status === 'connected',
    fire: {
      temperatureC: confirmedTemperatureC,
      densityEnabled: smokeDensityCounterId !== null,
      densityPpm: confirmedSmokeDensityPpm,
    },
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
  const pendingCommandEntries = Object.values(pendingCommandMap);
  const pendingAlarmEntries = pendingCommandEntries.filter(isAlarmCommand);
  const isAnyAlarmWriteWindowActive = pendingAlarmEntries.length > 0;

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

      // Smoke density is UI-only until its counter id is wired; callers keep it
      // local in that case, so reaching here with a null id is unexpected.
      if (counterId === null) {
        return;
      }

      if (status !== 'connected') {
        rollbackCounterCommand({
          id: commandId,
          label: requestedLabel,
          startedAt: Date.now(),
          expiresAt: Date.now(),
          snapshot: {
            kind: 'counter',
            field,
            counterId,
            expectedMetricValue: nextMetricValue,
            baselineReceivedAt: metricsReceivedAt,
            previousConfirmedValue: snapshot.previousConfirmedValue,
            previousDraftValue: snapshot.previousDraftValue,
          },
        });
        showCommandError('MQTT disconnected. Command not sent.');
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

  const sendAlarmCommand = useCallback(
    async (command: CarloGavazziAlarmCommandName, requestedLabel: string) => {
      const commandId = getAlarmCommandId(command);

      if (status !== 'connected') {
        showCommandError(`Disconnected. Unable to send ${requestedLabel}.`);
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
          kind: 'alarm',
          command,
          baselineReceivedAt: metricsReceivedAt,
        },
        onTimeout: (timedOutCommand) => {
          showCommandError(`${timedOutCommand.label} timed out. Try again.`);
        },
      });

      if (!pendingCommand) {
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
        setLastCommandError(null);
      } catch (error) {
        resolveCommand(commandId);
        showCommandError(error instanceof Error ? error.message : `Unable to send ${requestedLabel}.`);
      }
    },
    [isCommandPending, metricsReceivedAt, publishTopic, resolveCommand, showCommandError, startCommand, status]
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
      if (metricsState.temperatureValue !== null || metricsState.smokeDensityValue !== null) {
        setConfirmedForm((current) => {
          const next = { ...current };

          if (metricsState.temperatureValue !== null) {
            next.temperatureValue = metricsState.temperatureValue;
          }

          if (metricsState.smokeDensityValue !== null) {
            next.smokeDensityValue = metricsState.smokeDensityValue;
          }

          return next;
        });

        setDraftForm((current) => {
          const next = { ...current };

          if (
            metricsState.temperatureValue !== null &&
            (!isCommandPending(getCounterCommandId('temperatureValue')) ||
              ackedCounterCommands.some(
                (command) => command.snapshot.field === 'temperatureValue'
              ))
          ) {
            next.temperatureValue = metricsState.temperatureValue;
          }

          if (
            metricsState.smokeDensityValue !== null &&
            (!isCommandPending(getCounterCommandId('smokeDensityValue')) ||
              ackedCounterCommands.some(
                (command) => command.snapshot.field === 'smokeDensityValue'
              ))
          ) {
            next.smokeDensityValue = metricsState.smokeDensityValue;
          }

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

  useEffect(() => {
    if (metricsReceivedAt === null) {
      return;
    }

    const ackedCommands = Object.values(pendingCommandMap).filter(
      (command): command is PendingCommandState<AlarmCommandSnapshot> =>
        isAlarmCommand(command) &&
        (command.snapshot.baselineReceivedAt === null
          ? metricsReceivedAt >= command.startedAt
          : metricsReceivedAt > command.snapshot.baselineReceivedAt)
    );

    if (ackedCommands.length === 0) {
      return;
    }

    const latestAcked = [...ackedCommands].sort((left, right) => left.startedAt - right.startedAt).pop()!;
    recordLatencySampleRef.current({
      label: latestAcked.label,
      requestTopicKey: 'gatewayOtCommand',
      responseTopicKey: 'gatewayMetrics',
      startedAt: latestAcked.startedAt,
      completedAt: metricsReceivedAt,
    });

    ackedCommands.forEach((command) => {
      resolveCommand(command.id);
    });
    setLastCommandError(null);
  }, [metricsReceivedAt, pendingCommandMap, resolveCommand]);

  const handleTemperatureChange = useCallback(
    (nextValue: string) => {
      const nextTemperature = parseAccommodationTemperature(nextValue);

      if (!temperatureSnapshotRef.current) {
        temperatureSnapshotRef.current = {
          previousConfirmedValue: getAccommodationFieldValue(confirmedForm, 'temperatureValue'),
          previousDraftValue: getAccommodationFieldValue(draftForm, 'temperatureValue'),
        };
      }

      setDraftForm((current) => ({
        ...current,
        temperatureValue: formatAccommodationTemperature(nextTemperature),
      }));

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
          `Temperature ${formatAccommodationTemperature(nextTemperature)}`,
          snapshot
        );
      }, COMMAND_DEBOUNCE_MS);
    },
    [clearTemperatureDebounce, confirmedForm, draftForm, sendSetValueCommand]
  );

  const handleSmokeDensityChange = useCallback(
    (nextValue: string) => {
      const nextDensity = parseAccommodationSmokeDensity(nextValue);
      const densityCounterId =
        CARLO_GAVAZZI_GATEWAY_CONFIG.accommodationRoom.counterIds.smokeDensity;

      if (!smokeDensitySnapshotRef.current) {
        smokeDensitySnapshotRef.current = {
          previousConfirmedValue: getAccommodationFieldValue(confirmedForm, 'smokeDensityValue'),
          previousDraftValue: getAccommodationFieldValue(draftForm, 'smokeDensityValue'),
        };
      }

      setDraftForm((current) => ({
        ...current,
        smokeDensityValue: formatAccommodationSmokeDensity(nextDensity),
      }));

      clearSmokeDensityDebounce();
      smokeDensityDebounceRef.current = setTimeout(() => {
        const snapshot = smokeDensitySnapshotRef.current ?? {
          previousConfirmedValue: getAccommodationFieldValue(confirmedForm, 'smokeDensityValue'),
          previousDraftValue: getAccommodationFieldValue(draftForm, 'smokeDensityValue'),
        };
        smokeDensitySnapshotRef.current = null;

        // No counter id wired yet (or offline) → keep the density value local.
        if (densityCounterId === null || status !== 'connected') {
          setConfirmedForm((current) => ({
            ...current,
            smokeDensityValue: formatAccommodationSmokeDensity(nextDensity),
          }));
          return;
        }

        void sendSetValueCommand(
          'smokeDensityValue',
          nextDensity,
          `Smoke Density ${formatAccommodationSmokeDensity(nextDensity)}`,
          snapshot
        );
      }, COMMAND_DEBOUNCE_MS);
    },
    [clearSmokeDensityDebounce, confirmedForm, draftForm, sendSetValueCommand, status]
  );

  const pendingTemperatureCommand = pendingCommandMap[getCounterCommandId('temperatureValue')] ?? null;
  const pendingSmokeDensityCommand =
    pendingCommandMap[getCounterCommandId('smokeDensityValue')] ?? null;
  const isTemperaturePending = pendingTemperatureCommand !== null;
  const isSmokeDensityPending = pendingSmokeDensityCommand !== null;
  const isAlarmPending = pendingAlarmEntries.length > 0;
  const isAlarmCommandLocked = useCallback(
    (command: CarloGavazziAlarmCommandName) => !!pendingCommandMap[getAlarmCommandId(command)],
    [pendingCommandMap]
  );
  const getAlarmCommandCountdown = useCallback(
    (command: CarloGavazziAlarmCommandName) => {
      const pending = pendingCommandMap[getAlarmCommandId(command)];
      if (!pending) {
        return null;
      }
      const remainingMs = pending.expiresAt - alarmCountdownNow;
      return Math.max(0, Math.ceil(remainingMs / 1000));
    },
    [alarmCountdownNow, pendingCommandMap]
  );

  useEffect(() => {
    if (!isAlarmPending) {
      return;
    }

    setAlarmCountdownNow(Date.now());
    const intervalId = setInterval(() => setAlarmCountdownNow(Date.now()), 1_000);

    return () => clearInterval(intervalId);
  }, [isAlarmPending]);
  const isAnyPending =
    isTemperaturePending || isSmokeDensityPending || isAlarmPending;
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
    ? 'Auto-clears on reply or after 5s'
    : 'Ready to send';

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

  const temperatureHint = useMemo(() => {
    if (lastCommandError && isTemperaturePending) {
      return lastCommandError;
    }

    if (isTemperaturePending) {
      return `Requested ${
        pendingTemperatureCommand?.label ?? draftForm.temperatureValue
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
    pendingTemperatureCommand,
    status,
  ]);
  const latestPendingAlarmCommand = useMemo(() => {
    if (pendingAlarmEntries.length === 0) {
      return null;
    }

    return [...pendingAlarmEntries].sort((left, right) => left.startedAt - right.startedAt).pop() ?? null;
  }, [pendingAlarmEntries]);

  const alarmHint = useMemo(() => {
    if (lastCommandError && latestPendingAlarmCommand) {
      return lastCommandError;
    }

    if (latestPendingAlarmCommand) {
      return `${latestPendingAlarmCommand.label} sent · waiting for gateway.`;
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
      return `${latestPendingAlarmCommand.snapshot.command} sent · auto-clears on reply or after 5s.`;
    }

    return 'Reset and Acknowledge are safe to retry.';
  }, [latestPendingAlarmCommand]);
  const alarmBehaviorHint = useMemo(() => {
    if (isAnyAlarmWriteWindowActive) {
      return 'Sent · auto-clears on reply or after 5s.';
    }

    return 'ResetOn/Off and Alarm ON/OFF may need a fresh edge; Reset and Acknowledge retry safely.';
  }, [isAnyAlarmWriteWindowActive]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <AccommodationRoomHeader />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <AccommodationRoomHero
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
          temperatureHint={temperatureHint}
          isTemperaturePending={isTemperaturePending}
          isSmokeDensityPending={isSmokeDensityPending}
          onTemperatureChange={handleTemperatureChange}
          onSmokeDensityChange={handleSmokeDensityChange}
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
          getCommandCountdown={getAlarmCommandCountdown}
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
