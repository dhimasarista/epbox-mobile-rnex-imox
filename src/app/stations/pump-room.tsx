import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  DEFAULT_PENDING_COMMAND_TIMEOUT_MS,
  usePendingCommand,
  type PendingCommandState,
} from '@/hooks/use-pending-command';
import {
  getChannelBit,
  setChannelBit,
  unpackChannels,
  type BitChannelMap,
} from '@/lib/bit-packed-word';
import {
  buildCarloGavazziOtCommand,
  CARLO_GAVAZZI_GATEWAY_CONFIG,
  getCarloGavazziCounterNumericValue,
  packToPlcCommand,
  pressureBarToCounter,
  unpackToPlcCommand,
} from '@/lib/mqtt-topics';
import {
  DEFAULT_PUMP_ROOM_PLC_INPUTS,
  getStoredPumpRoomPlcInputs,
  PUMP_ROOM_PLC_FIELDS,
  setStoredPumpRoomPlcInputs,
  type PumpRoomPlcInputKey,
  type PumpRoomPlcInputs,
} from '@/lib/pump-room-demo';
import { useMqtt, useMqttTopic } from '@/providers/mqtt-provider';
import { AppColors, AppRadii, AppSpacing, layoutPrimitives, surfacePrimitives, textPrimitives } from '@/styles';
import { getSignalPalette, styles as stationStyles, type SignalTone } from '@/styles/screens/station.styles';

// ─── Types ───────────────────────────────────────────────────────────────────

type ActiveTab = 'plc' | 'inject';
type DerivedAlarmLevel = 'clear' | 'warning' | 'danger';
type DerivedAlarm = { level: DerivedAlarmLevel; conditions: string[] };
type ToPlcPendingKind = PumpRoomPlcInputKey | 'pumpActivation';
type ToPlcCommandSnapshot = {
  kind: ToPlcPendingKind;
  baselineReceivedAt: number | null;
  successMessage: string;
  nextPumpActivationValue?: 0 | 1;
  previousNextPumpActivationValue?: 0 | 1;
  nextRemoteActivationValue?: 0 | 1;
  previousRemoteActivationValue?: 0 | 1;
  pressureField?: PumpRoomPlcInputKey;
  previousConfirmedValue?: string;
  previousDraftValue?: string;
  nextValue?: string;
};

function getToPlcCommandId(kind: ToPlcPendingKind) {
  return `to-plc:${kind}`;
}


function isPressureCommand(
  command: PendingCommandState<ToPlcCommandSnapshot>
): command is PendingCommandState<
  ToPlcCommandSnapshot & {
    pressureField: PumpRoomPlcInputKey;
    previousConfirmedValue: string;
    previousDraftValue: string;
    nextValue: string;
  }
> {
  return command.snapshot.pressureField !== undefined;
}

// ─── FROM PLC — Digital Output status (id 6563, read-only) ───────────────────
// The PLC reports its DO output as one uint16 word (bit 0 = LSB). Per docs/DO.md
// bits 0..15 are functional channels. The app RECEIVES and
// bit-unpacks this word for display — it never writes DO. When MQTT is offline
// the screen switches to simulation: each channel becomes a tappable ON/OFF, and
// the decimal word + bits recompute live — so the calculation can be checked
// against the PLC engineer's, no typing required.

const DO_CHANNELS = [
  { key: 'pumpARunning',         label: 'Pump A Running' },
  { key: 'pumpBRunning',         label: 'Pump B Running' },
  { key: 'sv1Opened',            label: 'SV1 Opened' },
  { key: 'sv2Opened',            label: 'SV2 Opened' },
  { key: 'flowSwitch',           label: 'Flow Switch' },
  { key: 'dischargeActive',      label: 'Discharge Active' },
  { key: 'localZoneActivation',  label: 'Local Zone Activation' },
  { key: 'remoteZoneActivation', label: 'Remote Zone Activation' },
  { key: 'fgsConfFire',          label: 'FGS Confirmed Fire' },
  { key: 'levelTankHigh',        label: 'Tank Level High' },
  { key: 'levelTankLow',         label: 'Tank Level Low' },
  { key: 'pumpCRunning',         label: 'Pump C Running' },
  { key: 'localMode',            label: 'Mode Local' },
  { key: 'remoteMode',           label: 'Mode Remote' },
  { key: 'pumpATripped',         label: 'Pump A Tripped' },
  { key: 'pumpBTripped',         label: 'Pump B Tripped' },
] as const;

type DoKey = (typeof DO_CHANNELS)[number]['key'];

const DO_BIT_MAP: BitChannelMap<DoKey> = {
  pumpARunning:         { wordIndex: 0, bitIndex: 0  },
  pumpBRunning:         { wordIndex: 0, bitIndex: 1  },
  sv1Opened:            { wordIndex: 0, bitIndex: 2  },
  sv2Opened:            { wordIndex: 0, bitIndex: 3  },
  flowSwitch:           { wordIndex: 0, bitIndex: 4  },
  dischargeActive:      { wordIndex: 0, bitIndex: 5  },
  localZoneActivation:  { wordIndex: 0, bitIndex: 6  },
  remoteZoneActivation: { wordIndex: 0, bitIndex: 7  },
  fgsConfFire:          { wordIndex: 0, bitIndex: 8  },
  levelTankHigh:        { wordIndex: 0, bitIndex: 9  },
  levelTankLow:         { wordIndex: 0, bitIndex: 10 },
  pumpCRunning:         { wordIndex: 0, bitIndex: 11 },
  localMode:            { wordIndex: 0, bitIndex: 12 },
  remoteMode:           { wordIndex: 0, bitIndex: 13 },
  pumpATripped:         { wordIndex: 0, bitIndex: 14 },
  pumpBTripped:         { wordIndex: 0, bitIndex: 15 },
};

// Full 16-bit DO word.
const DO_WORD_MASK = 0xffff;

// ─── Inject Value Constants (pressure set-point) ─────────────────────────────

const PRESSURE_MIN_BAR = 0;
const PRESSURE_MAX_BAR = 16;

// Debounce button selections before publishing so we don't flood the OT channel.
const COMMAND_DEBOUNCE_MS = 250;
const PRESSURE_KEYS: PumpRoomPlcInputKey[] = ['pressurePump1', 'pressurePump2'];

// PT-001 / PT-002: alarm thresholds in bar
const PRESSURE_LOW_BAR = 2;      // live-low
const PRESSURE_WARNING_BAR = 7.5; // caution
const PRESSURE_DANGER_BAR = 10.2; // critical

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clampPressureBar(v: number) {
  return Math.min(Math.max(Number.isFinite(v) ? Math.round(v) : PRESSURE_MIN_BAR, PRESSURE_MIN_BAR), PRESSURE_MAX_BAR);
}

function parsePressureBar(v: string) {
  const parsed = Number.parseFloat(v);
  const normalized = v.toLowerCase().includes('ma') ? parsed - 4 : parsed;
  return clampPressureBar(normalized);
}

function formatPressureBar(v: number) { return `${clampPressureBar(v)} bar`; }

function getPressureTone(bar: number): SignalTone {
  if (bar >= PRESSURE_DANGER_BAR)  return 'danger';
  if (bar >= PRESSURE_WARNING_BAR) return 'warning';
  return 'normal';
}

// Pack the current pressure drafts and PLC flags into the TO PLC uint64 (7193).
function packInputs(inputs: PumpRoomPlcInputs, pumpActivation = 0, fgsConfirmed = 0) {
  return packToPlcCommand({
    pressurePump1Counter: pressureBarToCounter(parsePressureBar(inputs.pressurePump1)),
    pressurePump2Counter: pressureBarToCounter(parsePressureBar(inputs.pressurePump2)),
    pumpActivation,
    fgsConfirmed,
  });
}

function getPumpRoomInputsFromToPlcValue(value: number): PumpRoomPlcInputs {
  const words = unpackToPlcCommand(value);

  return {
    pressurePump1: formatPressureBar(words.pressurePump1Counter),
    pressurePump2: formatPressureBar(words.pressurePump2Counter),
  };
}

function getDerivedAlarm(form: PumpRoomPlcInputs): DerivedAlarm {
  const p1 = parsePressureBar(form.pressurePump1);
  const p2 = parsePressureBar(form.pressurePump2);
  const conditions: string[] = [];
  let level: DerivedAlarmLevel = 'clear';

  if (p1 >= PRESSURE_DANGER_BAR || p2 >= PRESSURE_DANGER_BAR) {
    conditions.push('High Pressure');
    level = 'danger';
  } else if (p1 >= PRESSURE_WARNING_BAR || p2 >= PRESSURE_WARNING_BAR) {
    conditions.push('Pressure Warning');
    level = 'warning';
  }

  if (p1 < PRESSURE_LOW_BAR || p2 < PRESSURE_LOW_BAR) {
    conditions.push('Low Pressure');
    level = 'danger';
  }

  return { level, conditions };
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function Header() {
  const router = useRouter();
  return (
    <View style={s.header}>
      <TouchableOpacity style={surfacePrimitives.iconButton} onPress={() => router.navigate('/explore')}>
        <Feather name="arrow-left" size={24} color={AppColors.text} />
      </TouchableOpacity>
      <Text style={s.headerLabel}>Pump Room</Text>
      <View style={s.headerGhost} />
    </View>
  );
}

function TabBar({ active, onChange }: { active: ActiveTab; onChange: (t: ActiveTab) => void }) {
  return (
    <View style={s.tabBar}>
      <TouchableOpacity
        style={[s.tabBtn, active === 'plc' && s.tabBtnActive]}
        onPress={() => onChange('plc')}
        accessibilityRole="tab"
        accessibilityState={{ selected: active === 'plc' }}>
        <Text style={[s.tabBtnText, active === 'plc' && s.tabBtnTextActive]}>FROM PLC</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[s.tabBtn, active === 'inject' && s.tabBtnActive]}
        onPress={() => onChange('inject')}
        accessibilityRole="tab"
        accessibilityState={{ selected: active === 'inject' }}>
        <Text style={[s.tabBtnText, active === 'inject' && s.tabBtnTextActive]}>Inject Value</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── FROM PLC tab sub-components ──────────────────────────────────────────────

function GatewayWordDisplay({ doWord, simulation }: { doWord: number; simulation: boolean }) {
  const doBits = (doWord & DO_WORD_MASK).toString(2).padStart(16, '0');
  return (
    <View style={s.ioCountRow}>
      <View style={s.ioCountCard}>
        <Text style={s.ioCountValue}>{doWord}</Text>
        <Text style={s.ioCountLabel}>{simulation ? 'DO Word (SIM)' : 'DO Word (FROM PLC)'}</Text>
      </View>
      <View style={s.ioCountCard}>
        <Text style={[s.ioCountValue, s.ioCountValueBin]}>{doBits}</Text>
        <Text style={s.ioCountLabel}>DO bits (b15…b0)</Text>
      </View>
    </View>
  );
}

function DoStatusCard({
  ch,
  value,
  channelNumber,
  simulation,
  onToggle,
}: {
  ch: (typeof DO_CHANNELS)[number];
  value: boolean;
  channelNumber: number;
  simulation: boolean;
  onToggle?: () => void;
}) {
  const activeColor = AppColors.success;
  const body = (
    <>
      <View style={s.doCardTop}>
        <View style={[s.doIndicator, { backgroundColor: value ? activeColor : AppColors.border }]} />
        <Text style={s.doCardChannel}>{channelNumber}</Text>
      </View>
      <View style={s.doCardIcon}>
        <View style={[s.doCardIconBadge, value && s.doCardIconBadgeActive]}>
          <Feather name="power" size={22} color={value ? AppColors.textInverse : AppColors.textSubtle} />
        </View>
      </View>
      <Text style={[s.doCardLabel, value && { color: activeColor }]} numberOfLines={2}>
        {ch.label}
      </Text>
    </>
  );
  const cardStyle = [s.doCard, value && s.doCardActive];

  // Simulation: whole card is a toggle (tap to flip the bit). Connected: read-only.
  if (simulation && onToggle) {
    return (
      <TouchableOpacity
        style={cardStyle}
        onPress={onToggle}
        activeOpacity={0.7}
        accessibilityRole="switch"
        accessibilityState={{ checked: value }}
        accessibilityLabel={`${ch.label} (channel ${channelNumber})`}>
        {body}
      </TouchableOpacity>
    );
  }
  return <View style={cardStyle}>{body}</View>;
}

// ─── TO PLC tab sub-components ───────────────────────────────────────────────

function ToPlcWordDisplay({
  pt1Counter,
  pt2Counter,
  pumpActivation,
  fgsConfirmed,
  packed,
}: {
  pt1Counter: number;
  pt2Counter: number;
  pumpActivation: number;
  fgsConfirmed: number;
  packed: number;
}) {
  const fgsBit0 = fgsConfirmed & 1;
  const fgsBit1 = (fgsConfirmed >> 1) & 1;
  const simpleWords = [
    { label: 'W0 · PT1', value: pt1Counter, active: pt1Counter > 0 },
    { label: 'W1 · PT2', value: pt2Counter, active: pt2Counter > 0 },
    { label: 'W2 · Pump Act', value: pumpActivation, active: pumpActivation > 0 },
  ];
  return (
    <View style={s.toPlcBlock}>
      <View style={s.ioCountCard}>
        <Text style={s.ioCountValue} numberOfLines={1} adjustsFontSizeToFit>{packed}</Text>
        <Text style={s.ioCountLabel}>TO_PLC uint64 (to send)</Text>
      </View>
      <View style={s.wordGrid}>
        {simpleWords.map((w) => (
          <View key={w.label} style={[s.wordCell, w.active && s.wordCellActive]}>
            <Text style={[s.wordValue, w.active && s.wordValueActive]}>{w.value}</Text>
            <Text style={s.wordLabel}>{w.label}</Text>
          </View>
        ))}
        <View style={[s.wordCell, fgsConfirmed > 0 && s.wordCellActive]}>
          <Text style={[s.wordValue, fgsConfirmed > 0 && s.wordValueActive]}>{fgsConfirmed}</Text>
          <Text style={s.wordLabel}>W3 · FGS</Text>
          <View style={s.fgsBitRow}>
            <View style={[s.fgsBit, fgsBit0 === 1 && s.fgsBitActive]}>
              <Text style={[s.fgsBitText, fgsBit0 === 1 && s.fgsBitTextActive]}>0 · Confirmed</Text>
            </View>
            <View style={[s.fgsBit, fgsBit1 === 1 && s.fgsBitActive]}>
              <Text style={[s.fgsBitText, fgsBit1 === 1 && s.fgsBitTextActive]}>1 · Warning</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

function PressureButtonGrid({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  const draftBar = parsePressureBar(value);
  const tone = getPressureTone(draftBar);
  const palette = getSignalPalette(tone);

  return (
    <View style={stationStyles.fieldBlock}>
      <View style={stationStyles.fieldHeaderRow}>
        <Text style={stationStyles.fieldLabel}>{label}</Text>
        <View style={[stationStyles.signalValueChip, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={[stationStyles.signalValueDot, { backgroundColor: palette.accent }]} />
          <Text style={[stationStyles.signalValueText, { color: palette.text }]}>{formatPressureBar(draftBar)}</Text>
        </View>
      </View>
      <View style={s.pressureBarControl}>
        {Array.from({ length: PRESSURE_MAX_BAR - PRESSURE_MIN_BAR + 1 }, (_, index) => {
          const barValue = PRESSURE_MIN_BAR + index;
          const isFilled = barValue <= draftBar;
          const isSelected = barValue === draftBar;
          const buttonTone = getPressureTone(barValue);
          const buttonPalette = getSignalPalette(buttonTone);

          return (
            <TouchableOpacity
              key={barValue}
              activeOpacity={0.82}
              disabled={disabled}
              onPress={() => onChange(formatPressureBar(barValue))}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected, disabled }}
              accessibilityLabel={`${label} ${barValue} bar`}
              style={[
                s.pressureBarSegment,
                index === 0 && s.pressureBarSegmentFirst,
                index === PRESSURE_MAX_BAR - PRESSURE_MIN_BAR && s.pressureBarSegmentLast,
                {
                  borderColor: isSelected ? buttonPalette.accent : AppColors.border,
                  backgroundColor: isFilled ? buttonPalette.accent : AppColors.surfaceMuted,
                },
                disabled && s.pressureBarSegmentDisabled,
              ]}>
              <Text
                style={[
                  s.pressureBarSegmentText,
                  isFilled && s.pressureBarSegmentTextFilled,
                ]}>
                {barValue}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={stationStyles.sliderRangeRow}>
        <Text style={stationStyles.sliderRangeText}>{PRESSURE_MIN_BAR}</Text>
        <Text style={stationStyles.sliderRangeText}>{PRESSURE_MAX_BAR}</Text>
      </View>
    </View>
  );
}

function PumpActivationButton({
  simulation,
  disabled,
  nextValue,
  blockReason,
  onPress,
}: {
  simulation: boolean;
  disabled: boolean;
  nextValue: 0 | 1;
  blockReason?: string | null;
  onPress: () => void;
}) {
  const isReset = nextValue === 0;
  const label = isReset ? 'Remote Reset' : 'Remote Activation';
  const isBlocked = !!blockReason;

  return (
    <View>
      <TouchableOpacity
        style={[
          s.pumpActBtn,
          simulation && s.pumpActBtnSim,
          isReset && s.pumpActBtnOff,
          (disabled || isBlocked) && s.pumpActBtnDisabled,
        ]}
        disabled={disabled || isBlocked}
        onPress={onPress}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled || isBlocked }}
        accessibilityLabel={label}>
        <Feather name={isReset ? 'power' : 'zap'} size={16} color={AppColors.textInverse} />
        <Text style={s.pumpActBtnText}>{label}</Text>
      </TouchableOpacity>
      {blockReason ? (
        <Text style={s.pumpActBlockReason}>{blockReason} — remote activation locked</Text>
      ) : null}
    </View>
  );
}

function DerivedAlarmCard({ alarm }: { alarm: DerivedAlarm }) {
  const isClear   = alarm.level === 'clear';
  const isDanger  = alarm.level === 'danger';
  const bg     = isClear ? AppColors.surfaceSuccess : isDanger ? AppColors.surfaceError : '#FFF9E8';
  const border = isClear ? '#9BD7B6'               : isDanger ? '#F4B7B7'              : '#F2D17A';
  const color  = isClear ? AppColors.success        : isDanger ? AppColors.error         : '#A16207';
  const icon   = isClear ? 'check-circle'           : isDanger ? 'alert-octagon'         : 'alert-triangle';
  const label  = isClear ? 'System Normal'          : alarm.conditions.join(' · ');
  return (
    <View style={[s.derivedAlarmCard, { backgroundColor: bg, borderColor: border }]}>
      <Feather name={icon as any} size={16} color={color} />
      <Text style={[s.derivedAlarmText, { color }]}>{label}</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

type PumpRoomProps = {
  embedded?: boolean;
  contentOnly?: boolean;
  fixedTab?: ActiveTab;
  simFgsConfirmed?: number;
};

export default function PumpRoom({
  contentOnly = false,
  embedded = false,
  fixedTab,
  simFgsConfirmed,
}: PumpRoomProps = {}) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('plc');
  const selectedTab = fixedTab ?? activeTab;

  const { publishTopic, recordLatencySample, status } = useMqtt();
  const recordLatencySampleRef = useRef(recordLatencySample);
  recordLatencySampleRef.current = recordLatencySample;
  const metricsTopic = useMqttTopic('gatewayMetrics');
  const metricsReceivedAt = metricsTopic.message?.receivedAt ?? null;

  const [lastCommandError, setLastCommandError] = useState<string | null>(null);
  const {
    commands: pendingToPlcCommandMap,
    isPending: isToPlcCommandPending,
    resolveAllCommands: resolveAllToPlcCommands,
    resolveCommand: resolveToPlcCommand,
    startCommand: startToPlcCommand,
  } = usePendingCommand<ToPlcCommandSnapshot>();

  // When MQTT is offline, the whole screen runs as a local pack/unpack simulator.
  const isSimulation = status !== 'connected';

  // ── FROM PLC tab state (DO status) ──
  const [lastDoWord, setLastDoWord] = useState(0);   // received from FROM PLC (6563)
  const [simDoWord, setSimDoWord] = useState(0);     // simulation: built by tapping channels
  const doWord = isSimulation ? simDoWord : lastDoWord;
  const doState = unpackChannels([doWord], DO_BIT_MAP);

  // Simulation: tap a channel to flip its bit; decimal + bits recompute from the word.
  const toggleDoChannel = useCallback((key: DoKey) => {
    setSimDoWord((prev) => setChannelBit([prev], DO_BIT_MAP, key, !getChannelBit([prev], DO_BIT_MAP, key))[0]);
  }, []);

  // ── TO PLC tab state (inject PT-001/PT-002 + momentary pump activation) ──
  const [injectDraft, setInjectDraft] = useState(DEFAULT_PUMP_ROOM_PLC_INPUTS);
  const [confirmedInject, setConfirmedInject] = useState(DEFAULT_PUMP_ROOM_PLC_INPUTS);
  const injectDraftRef = useRef(injectDraft);
  injectDraftRef.current = injectDraft;
  const pressureDebounceRef = useRef<Partial<Record<PumpRoomPlcInputKey, ReturnType<typeof setTimeout>>>>({});
  const pressureSnapshotRef = useRef<
    Partial<
      Record<
        PumpRoomPlcInputKey,
        {
          previousConfirmedValue: string;
          previousDraftValue: string;
        }
      >
    >
  >({});
  const hasHydratedRef = useRef(false);
  const derivedAlarm = getDerivedAlarm(injectDraft);
  // Command success/failure is surfaced as a transient note without blocking navigation.
  const [injectFlash, setInjectFlash] = useState<string | null>(null);
  const injectFlashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commandErrorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [remoteActivationValue, setRemoteActivationValue] = useState<0 | 1>(0);
  const [fgsConfirmedValue, setFgsConfirmedValue] = useState(0);
  const [nextPumpActivationValue, setNextPumpActivationValue] = useState<0 | 1>(1);

  // When offline and a simFgsConfirmed prop is provided (from engine-room slider state), prefer it.
  const effectiveFgsConfirmed = isSimulation && simFgsConfirmed !== undefined
    ? simFgsConfirmed
    : fgsConfirmedValue;

  // W[2] is held only after MQTT feedback confirms the remote activation/reset command.
  const pt1Counter = pressureBarToCounter(parsePressureBar(injectDraft.pressurePump1));
  const pt2Counter = pressureBarToCounter(parsePressureBar(injectDraft.pressurePump2));
  const toPlcPacked = packInputs(injectDraft, remoteActivationValue, effectiveFgsConfirmed);

  const flashInject = useCallback((message: string) => {
    setInjectFlash(message);
    if (injectFlashTimeoutRef.current) clearTimeout(injectFlashTimeoutRef.current);
    injectFlashTimeoutRef.current = setTimeout(() => setInjectFlash(null), 2_000);
  }, []);

  const showCommandError = useCallback((message: string) => {
    setLastCommandError(message);

    if (commandErrorTimeoutRef.current) clearTimeout(commandErrorTimeoutRef.current);
    commandErrorTimeoutRef.current = setTimeout(() => {
      setLastCommandError((current) => (current === message ? null : current));
      commandErrorTimeoutRef.current = null;
    }, 2_500);
  }, []);

  const rollbackToPlcCommand = useCallback((command: PendingCommandState<ToPlcCommandSnapshot>) => {
    if (isPressureCommand(command)) {
      const { pressureField, previousConfirmedValue, previousDraftValue } = command.snapshot;

      setInjectDraft((current) => ({
        ...current,
        [pressureField]: previousDraftValue,
      }));
      setConfirmedInject((current) => {
        const next = {
          ...current,
          [pressureField]: previousConfirmedValue,
        };
        if (hasHydratedRef.current) void setStoredPumpRoomPlcInputs(next);
        return next;
      });
    }

    if (command.snapshot.previousNextPumpActivationValue !== undefined) {
      setNextPumpActivationValue(command.snapshot.previousNextPumpActivationValue);
    }

    if (command.snapshot.previousRemoteActivationValue !== undefined) {
      setRemoteActivationValue(command.snapshot.previousRemoteActivationValue);
    }
  }, []);

  const commitToPlcCommand = useCallback((command: PendingCommandState<ToPlcCommandSnapshot>) => {
    if (isPressureCommand(command)) {
      const { nextValue, pressureField } = command.snapshot;

      setConfirmedInject((current) => {
        const next = {
          ...current,
          [pressureField]: nextValue,
        };
        if (hasHydratedRef.current) void setStoredPumpRoomPlcInputs(next);
        return next;
      });
    }

    if (
      command.snapshot.kind === 'pumpActivation' &&
      command.snapshot.nextPumpActivationValue !== undefined
    ) {
      setNextPumpActivationValue(command.snapshot.nextPumpActivationValue);
    }

    if (
      command.snapshot.kind === 'pumpActivation' &&
      command.snapshot.nextRemoteActivationValue !== undefined
    ) {
      setRemoteActivationValue(command.snapshot.nextRemoteActivationValue);
    }

    flashInject(command.snapshot.successMessage);
  }, [flashInject]);

  // ── FROM PLC: sync metrics → DO word (only while connected) ──
  useEffect(() => {
    if (status !== 'connected' || !metricsTopic.payload) return;
    const value = getCarloGavazziCounterNumericValue(
      metricsTopic.payload,
      CARLO_GAVAZZI_GATEWAY_CONFIG.fireFightingRoom.fromPlc.deviceId
    );
    if (value === null) return;
    const timer = setTimeout(() => setLastDoWord(Math.round(value) & DO_WORD_MASK), 0);
    return () => clearTimeout(timer);
  }, [metricsReceivedAt, metricsTopic.payload, status]);

  useEffect(() => {
    if (!metricsTopic.payload || metricsReceivedAt === null) {
      return;
    }

    const toPlcValue = getCarloGavazziCounterNumericValue(
      metricsTopic.payload,
      CARLO_GAVAZZI_GATEWAY_CONFIG.fireFightingRoom.toPlc.deviceId
    );

    if (toPlcValue === null) {
      return;
    }

    const roundedToPlcValue = Math.round(toPlcValue);
    const gatewayInputs = getPumpRoomInputsFromToPlcValue(roundedToPlcValue);
    const gatewayWords = unpackToPlcCommand(roundedToPlcValue);
    const gatewayRemoteActivationValue: 0 | 1 =
      Math.round(gatewayWords.pumpActivation) >= 1 ? 1 : 0;
    const gatewayFgsConfirmedValue = Math.round(gatewayWords.fgsConfirmed);
    const ackedCommands = Object.values(pendingToPlcCommandMap).filter((command) => {
      const isFresh =
        command.snapshot.baselineReceivedAt === null
          ? metricsReceivedAt >= command.startedAt
          : metricsReceivedAt > command.snapshot.baselineReceivedAt;

      if (command.snapshot.kind === 'pumpActivation') {
        return isFresh;
      }

      return (
        isFresh &&
        isPressureCommand(command) &&
        gatewayInputs[command.snapshot.pressureField] === command.snapshot.nextValue
      );
    });
    const isCommandAcked = (commandId: string) =>
      ackedCommands.some((command) => command.id === commandId);
    const shouldSyncPressurePump1 =
      !isToPlcCommandPending(getToPlcCommandId('pressurePump1')) ||
      isCommandAcked(getToPlcCommandId('pressurePump1'));
    const shouldSyncPressurePump2 =
      !isToPlcCommandPending(getToPlcCommandId('pressurePump2')) ||
      isCommandAcked(getToPlcCommandId('pressurePump2'));
    const shouldSyncRemoteActivation =
      !isToPlcCommandPending(getToPlcCommandId('pumpActivation')) ||
      isCommandAcked(getToPlcCommandId('pumpActivation'));

    if (shouldSyncPressurePump1 || shouldSyncPressurePump2) {
      setConfirmedInject((current) => {
        const next = { ...current };

        if (shouldSyncPressurePump1) {
          next.pressurePump1 = gatewayInputs.pressurePump1;
        }

        if (shouldSyncPressurePump2) {
          next.pressurePump2 = gatewayInputs.pressurePump2;
        }

        if (hasHydratedRef.current) void setStoredPumpRoomPlcInputs(next);
        return next;
      });

      setInjectDraft((current) => {
        const next = { ...current };

        if (shouldSyncPressurePump1) {
          next.pressurePump1 = gatewayInputs.pressurePump1;
        }

        if (shouldSyncPressurePump2) {
          next.pressurePump2 = gatewayInputs.pressurePump2;
        }

        return next;
      });
    }

    if (shouldSyncRemoteActivation) {
      setRemoteActivationValue(gatewayRemoteActivationValue);
      setNextPumpActivationValue(gatewayRemoteActivationValue === 1 ? 0 : 1);
    }
    setFgsConfirmedValue(gatewayFgsConfirmedValue);

    if (ackedCommands.length === 0) {
      return;
    }

    const latestAcked =
      [...ackedCommands].sort((left, right) => left.startedAt - right.startedAt).pop() ?? null;

    if (latestAcked) {
      recordLatencySampleRef.current({
        label: latestAcked.label,
        requestTopicKey: 'gatewayOtCommand',
        responseTopicKey: 'gatewayMetrics',
        startedAt: latestAcked.startedAt,
        completedAt: metricsReceivedAt,
      });
    }

    ackedCommands.forEach((command) => {
      resolveToPlcCommand(command.id, {
        onResolve: commitToPlcCommand,
      });
    });
    setLastCommandError(null);
  }, [
    commitToPlcCommand,
    isToPlcCommandPending,
    metricsReceivedAt,
    metricsTopic.payload,
    pendingToPlcCommandMap,
    resolveToPlcCommand,
  ]);

  useEffect(() => {
    if (status === 'connected') {
      return;
    }

    const timer = setTimeout(() => {
      resolveAllToPlcCommands({
        onResolve: rollbackToPlcCommand,
      });
    }, 0);

    return () => clearTimeout(timer);
  }, [resolveAllToPlcCommands, rollbackToPlcCommand, status]);

  const publishPackedToPlc = useCallback(
    (packed: number) =>
      publishTopic(
        'gatewayOtCommand',
        buildCarloGavazziOtCommand(
          CARLO_GAVAZZI_GATEWAY_CONFIG.fireFightingRoom.toPlc.deviceId,
          'SetValue',
          packed
        ),
        { qos: 0, retain: false }
      ),
    [publishTopic]
  );

  const sendToPlcCommand = useCallback(
    async (
      kind: ToPlcPendingKind,
      overrides: { pressurePump1Bar?: number; pressurePump2Bar?: number; pumpActivation?: number },
      snapshot: Omit<
        ToPlcCommandSnapshot,
        | 'baselineReceivedAt'
        | 'previousNextPumpActivationValue'
        | 'previousRemoteActivationValue'
      >
    ) => {
      const commandId = getToPlcCommandId(kind);

      if (isToPlcCommandPending(commandId)) {
        showCommandError(`${snapshot.successMessage} is already waiting for gateway response.`);
        return;
      }

      const pressurePump1Bar =
        overrides.pressurePump1Bar ?? parsePressureBar(injectDraftRef.current.pressurePump1);
      const pressurePump2Bar =
        overrides.pressurePump2Bar ?? parsePressureBar(injectDraftRef.current.pressurePump2);
      const pressurePump1Counter = pressureBarToCounter(pressurePump1Bar);
      const pressurePump2Counter = pressureBarToCounter(pressurePump2Bar);
      const packed = packToPlcCommand({
        pressurePump1Counter,
        pressurePump2Counter,
        pumpActivation: overrides.pumpActivation ?? remoteActivationValue,
        fgsConfirmed: fgsConfirmedValue,
      });
      const pendingCommand = startToPlcCommand({
        id: commandId,
        label: snapshot.successMessage,
        snapshot: {
          ...snapshot,
          baselineReceivedAt: metricsReceivedAt,
          previousNextPumpActivationValue: nextPumpActivationValue,
          previousRemoteActivationValue: remoteActivationValue,
        },
        timeoutMs: DEFAULT_PENDING_COMMAND_TIMEOUT_MS,
        onTimeout: (command) => {
          if (
            command.snapshot.kind === 'pumpActivation' &&
            command.snapshot.nextRemoteActivationValue === 0
          ) {
            setRemoteActivationValue(0);
            setNextPumpActivationValue(1);
            showCommandError(`${command.label} timed out. UI reset to 0.`);
            return;
          }

          rollbackToPlcCommand(command);
          showCommandError(`${command.label} timed out. Rolled back.`);
        },
      });

      if (!pendingCommand) {
        return;
      }

      try {
        await publishPackedToPlc(packed);

        setLastCommandError(null);
      } catch (err: unknown) {
        resolveToPlcCommand(commandId, {
          onResolve: rollbackToPlcCommand,
        });
        showCommandError(
          err instanceof Error ? err.message : `Unable to send ${snapshot.successMessage}.`
        );
      }
    },
    [
      isToPlcCommandPending,
      fgsConfirmedValue,
      metricsReceivedAt,
      nextPumpActivationValue,
      publishPackedToPlc,
      remoteActivationValue,
      resolveToPlcCommand,
      rollbackToPlcCommand,
      showCommandError,
      startToPlcCommand,
    ]
  );

  // ── TO PLC: hydrate pressure drafts from storage ──
  useEffect(() => {
    let mounted = true;
    getStoredPumpRoomPlcInputs().then((stored) => {
      if (!mounted) return;
      setInjectDraft(stored);
      setConfirmedInject(stored);
      hasHydratedRef.current = true;
    });
    const debounces = pressureDebounceRef.current;
    return () => {
      mounted = false;
      PRESSURE_KEYS.forEach((key) => {
        const timer = debounces[key];
        if (timer) clearTimeout(timer);
      });
      if (injectFlashTimeoutRef.current) clearTimeout(injectFlashTimeoutRef.current);
      if (commandErrorTimeoutRef.current) clearTimeout(commandErrorTimeoutRef.current);
    };
  }, []);

  // Button selection settles -> persist + (if connected) publish the packed word. Offline it
  // stays local so you can watch the pack calculation without a broker.
  const updatePressureField = useCallback(
    (key: PumpRoomPlcInputKey, value: string) => {
      const commandId = getToPlcCommandId(key);

      if (isToPlcCommandPending(commandId)) {
        showCommandError(`${key === 'pressurePump1' ? 'PT-001' : 'PT-002'} is already waiting for gateway response.`);
        return;
      }

      const nextBar = parsePressureBar(value);
      const nextFormattedValue = formatPressureBar(nextBar);
      const currentFormattedValue = formatPressureBar(parsePressureBar(injectDraftRef.current[key]));

      if (currentFormattedValue === nextFormattedValue) {
        return;
      }

      if (!pressureSnapshotRef.current[key]) {
        pressureSnapshotRef.current[key] = {
          previousConfirmedValue: confirmedInject[key],
          previousDraftValue: injectDraftRef.current[key],
        };
      }

      const nextInputs = { ...injectDraftRef.current, [key]: nextFormattedValue };
      setInjectDraft(nextInputs);

      const existing = pressureDebounceRef.current[key];
      if (existing) clearTimeout(existing);
      pressureDebounceRef.current[key] = setTimeout(() => {
        const label = key === 'pressurePump1' ? 'PT-001' : 'PT-002';
        const snapshot = pressureSnapshotRef.current[key] ?? {
          previousConfirmedValue: confirmedInject[key],
          previousDraftValue: injectDraftRef.current[key],
        };
        pressureSnapshotRef.current[key] = undefined;

        if (status !== 'connected') {
          setConfirmedInject((current) => {
            const next = { ...current, [key]: nextFormattedValue };
            if (hasHydratedRef.current) void setStoredPumpRoomPlcInputs(next);
            return next;
          });
          return;
        }

        void sendToPlcCommand(
          key,
          key === 'pressurePump1'
            ? { pressurePump1Bar: nextBar }
            : { pressurePump2Bar: nextBar },
          {
            kind: key,
            pressureField: key,
            previousConfirmedValue: snapshot.previousConfirmedValue,
            previousDraftValue: snapshot.previousDraftValue,
            nextValue: nextFormattedValue,
            successMessage: `${label} ${nextFormattedValue} injected → PLC`,
          }
        );
      }, COMMAND_DEBOUNCE_MS);
    },
    [
      confirmedInject,
      isToPlcCommandPending,
      sendToPlcCommand,
      showCommandError,
      status,
    ]
  );

  const triggerPumpActivation = useCallback(() => {
    const commandId = getToPlcCommandId('pumpActivation');
    const valueToSend = nextPumpActivationValue;
    const nextValue: 0 | 1 = valueToSend === 1 ? 0 : 1;
    const label = valueToSend === 1 ? 'Remote Activation' : 'Remote Reset';

    if (isToPlcCommandPending(commandId)) {
      showCommandError(`${label} is already waiting for gateway response.`);
      return;
    }

    if (status !== 'connected') {
      setRemoteActivationValue(valueToSend);
      setNextPumpActivationValue(nextValue);
      flashInject(
        `SIM — ${label} → ${packInputs(injectDraftRef.current, valueToSend, fgsConfirmedValue)}`
      );
      return;
    }

    void sendToPlcCommand(
      'pumpActivation',
      { pumpActivation: valueToSend },
      {
        kind: 'pumpActivation',
        nextPumpActivationValue: nextValue,
        nextRemoteActivationValue: valueToSend,
        successMessage: `${label} sent → PLC`,
      }
    );
  }, [
    flashInject,
    fgsConfirmedValue,
    isToPlcCommandPending,
    nextPumpActivationValue,
    sendToPlcCommand,
    showCommandError,
    status,
  ]);

  const isPumpActivationPending = isToPlcCommandPending(getToPlcCommandId('pumpActivation'));
  const getPressurePending = useCallback(
    (key: PumpRoomPlcInputKey) => isToPlcCommandPending(getToPlcCommandId(key)),
    [isToPlcCommandPending]
  );
  const latestPendingToPlcCommand = useMemo(() => {
    const pendingCommands = Object.values(pendingToPlcCommandMap);

    if (pendingCommands.length === 0) {
      return null;
    }

    return [...pendingCommands].sort((left, right) => left.startedAt - right.startedAt).pop() ?? null;
  }, [pendingToPlcCommandMap]);

  const fromPlcStatusHint = useMemo(() => {
    if (isSimulation) return 'MQTT offline.';
    return null;
  }, [isSimulation]);

  const injectStatusHint = useMemo(() => {
    if (lastCommandError) return lastCommandError;
    if (injectFlash) return injectFlash;
    if (latestPendingToPlcCommand) return `${latestPendingToPlcCommand.label} · waiting for gateway.`;
    if (isSimulation) return 'Local Save';
    return null;
  }, [injectFlash, isSimulation, lastCommandError, latestPendingToPlcCommand]);

  const panelContent = (
    <>
      {selectedTab === 'plc' ? (
        <>
          <GatewayWordDisplay doWord={doWord} simulation={isSimulation} />

          {fromPlcStatusHint ? <Text style={s.statusHint}>{fromPlcStatusHint}</Text> : null}

          {/* DO status — received & read-only when connected; tap-to-toggle in simulation */}
          <View style={s.sectionBlock}>
            <View style={s.sectionHeader}>
              <View style={s.sectionLabelRow}>
                <View style={[s.sectionDot, { backgroundColor: AppColors.primary }]} />
                <Text style={s.sectionTitle}>Digital Output</Text>
              </View>
              <Text style={[s.sectionBadge, s.sectionBadgeDo]}>
                {isSimulation ? 'Simulasi · tekan ON/OFF' : 'Status · read-only'}
              </Text>
            </View>
            <View style={s.doGrid}>
              {DO_CHANNELS.map((ch) => (
                <DoStatusCard
                  key={ch.key}
                  ch={ch}
                  value={doState[ch.key]}
                  channelNumber={DO_BIT_MAP[ch.key].bitIndex}
                  simulation={isSimulation}
                  onToggle={() => toggleDoChannel(ch.key)}
                />
              ))}
            </View>
          </View>
        </>
      ) : (
        <>
          {/* {injectStatusHint ? <Text style={s.statusHint}>{injectStatusHint}</Text> : null} */}

          <ToPlcWordDisplay
            pt1Counter={pt1Counter}
            pt2Counter={pt2Counter}
            pumpActivation={remoteActivationValue}
            fgsConfirmed={effectiveFgsConfirmed}
            packed={toPlcPacked}
          />
          {/* Remote Activation / Reset — W2 command edge */}
          <PumpActivationButton
            simulation={isSimulation}
            disabled={isPumpActivationPending}
            nextValue={nextPumpActivationValue}
            onPress={triggerPumpActivation}
          />

          {/* PT-001 / PT-002 inject in bar (W0 / W1) */}
          <View style={stationStyles.sectionCard}>
            {PUMP_ROOM_PLC_FIELDS.map((field) => (
              <PressureButtonGrid
                key={field.key}
                label={field.label}
                value={injectDraft[field.key]}
                disabled={getPressurePending(field.key)}
                onChange={(v) => updatePressureField(field.key, v)}
              />
            ))}
          </View>

          {/* Derived alarm */}
          {/* <View style={stationStyles.summaryCard}>
            <DerivedAlarmCard alarm={derivedAlarm} />
          </View> */}
        </>
      )}
    </>
  );

  if (contentOnly) {
    return panelContent;
  }

  const content = (
    <>
      {!embedded ? <Header /> : null}
      {!fixedTab ? <TabBar active={activeTab} onChange={setActiveTab} /> : null}

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {panelContent}

        <View style={s.bottomSpacer} />
      </ScrollView>
    </>
  );

  if (embedded) {
    return <View style={s.safeArea}>{content}</View>;
  }

  return (
    <SafeAreaView style={s.safeArea} edges={['top', 'left', 'right']}>
      {content}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safeArea: layoutPrimitives.screen,

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: AppSpacing.screen,
    paddingTop: AppSpacing.md,
    paddingBottom: AppSpacing.md,
  },
  headerLabel: { fontSize: 17, fontWeight: '700', color: AppColors.text },
  headerGhost: { width: 40, height: 40 },

  tabBar: {
    flexDirection: 'row',
    marginHorizontal: AppSpacing.screen,
    marginBottom: AppSpacing.md,
    backgroundColor: AppColors.surfaceMuted,
    borderRadius: AppRadii.lg,
    padding: 4,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: AppSpacing.sm,
    borderRadius: AppRadii.md,
    alignItems: 'center',
  },
  tabBtnActive: { backgroundColor: AppColors.surface },
  tabBtnText: { fontSize: 13, fontWeight: '700', color: AppColors.textMuted },
  tabBtnTextActive: { color: AppColors.text },

  scrollContent: {
    padding: AppSpacing.screen,
    paddingBottom: AppSpacing.bottom,
    gap: AppSpacing.xxl,
  },

  statusHint: {
    fontSize: 12,
    lineHeight: 16,
    color: AppColors.textSubtle,
    textAlign: 'center',
  },

  ioCountRow: { flexDirection: 'row', gap: AppSpacing.md },
  ioCountCard: {
    flex: 1,
    backgroundColor: AppColors.surfaceAccent,
    borderRadius: AppRadii.xl,
    borderWidth: 1,
    borderColor: '#F5D3C5',
    paddingVertical: AppSpacing.lg,
    paddingHorizontal: AppSpacing.md,
    alignItems: 'center',
    gap: 6,
  },
  ioCountValue: { fontSize: 24, fontWeight: '900', color: AppColors.primary },
  ioCountValueBin: { fontSize: 14, letterSpacing: 1.5, fontVariant: ['tabular-nums'] },
  ioCountLabel: { fontSize: 11, fontWeight: '700', color: AppColors.textMuted },

  toPlcBlock: { gap: AppSpacing.md },
  wordGrid: { flexDirection: 'row', gap: AppSpacing.sm },
  wordCell: {
    flex: 1,
    backgroundColor: AppColors.surface,
    borderRadius: AppRadii.lg,
    borderWidth: 1,
    borderColor: AppColors.border,
    paddingVertical: AppSpacing.sm,
    paddingHorizontal: 4,
    alignItems: 'center',
    gap: 4,
  },
  wordCellActive: { backgroundColor: AppColors.surfaceAccent, borderColor: '#F5D3C5' },
  wordValue: { fontSize: 16, fontWeight: '900', color: AppColors.text, fontVariant: ['tabular-nums'] },
  wordValueActive: { color: AppColors.primary },
  wordLabel: { fontSize: 9, fontWeight: '700', color: AppColors.textSubtle, textAlign: 'center' },

  sectionBlock: { gap: AppSpacing.sm },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: AppSpacing.sm },
  sectionDot: { width: 8, height: 8, borderRadius: AppRadii.full },
  sectionTitle: { ...textPrimitives.label, fontSize: 14 },
  sectionBadge: {
    fontSize: 11, fontWeight: '700', color: AppColors.info,
    backgroundColor: '#EFF6FF', borderRadius: AppRadii.full,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: '#BFDBFE', overflow: 'hidden',
  },
  sectionBadgeDo: { color: AppColors.primary, backgroundColor: AppColors.surfaceAccent, borderColor: '#F5D3C5' },

  doIndicator: { width: 10, height: 10, borderRadius: AppRadii.full, flexShrink: 0 },

  doGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: AppSpacing.sm },
  doCard: {
    flexGrow: 1,
    flexBasis: '22%',
    minWidth: 72,
    backgroundColor: AppColors.surface,
    borderRadius: AppRadii.lg,
    borderWidth: 1,
    borderColor: AppColors.border,
    paddingHorizontal: AppSpacing.md,
    paddingVertical: AppSpacing.md,
    gap: AppSpacing.sm,
  },
  doCardActive: { backgroundColor: AppColors.surfaceSuccess, borderColor: '#9BD7B6' },
  doCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  doCardChannel: {
    fontSize: 12, fontWeight: '800', color: AppColors.textSubtle,
    fontVariant: ['tabular-nums'],
  },
  doCardIcon: { alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },
  doCardIconBadge: {
    width: 44, height: 44, borderRadius: AppRadii.full,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: AppColors.surfaceMuted,
  },
  doCardIconBadgeActive: { backgroundColor: AppColors.success },
  doCardLabel: { fontSize: 12, fontWeight: '700', color: AppColors.text, textAlign: 'center' },

  pumpActBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: AppSpacing.sm,
    backgroundColor: AppColors.primary,
    borderRadius: AppRadii.sm,
    paddingVertical: AppSpacing.md,
    paddingHorizontal: AppSpacing.lg,
  },
  pumpActBtnSim: { backgroundColor: AppColors.error },
  pumpActBtnOff: { backgroundColor: AppColors.text },
  pumpActBtnDisabled: { opacity: 0.55 },
  pumpActBtnText: { fontSize: 14, fontWeight: '800', color: AppColors.textInverse, letterSpacing: 0.3 },
  pumpActBlockReason: { marginTop: 6, fontSize: 11, fontWeight: '500', color: AppColors.warning, textAlign: 'center' },

  fgsBitRow: { marginTop: 4, gap: 3, width: '100%' },
  fgsBit: { paddingHorizontal: 4, paddingVertical: 2, borderRadius: 3, backgroundColor: AppColors.border },
  fgsBitActive: { backgroundColor: AppColors.primary },
  fgsBitText: { fontSize: 9, fontWeight: '600', color: AppColors.textSubtle, textAlign: 'center' },
  fgsBitTextActive: { color: AppColors.textInverse },

  derivedAlarmCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.sm,
    borderRadius: AppRadii.lg,
    borderWidth: 1,
    paddingHorizontal: AppSpacing.md,
    paddingVertical: AppSpacing.md,
  },
  derivedAlarmText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },

  pressureBarControl: {
    flexDirection: 'row',
    marginTop: AppSpacing.sm,
    borderRadius: AppRadii.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.surfaceMuted,
  },
  pressureBarSegment: {
    flex: 1,
    minWidth: 0,
    height: 42,
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressureBarSegmentFirst: {
    borderTopLeftRadius: AppRadii.md,
    borderBottomLeftRadius: AppRadii.md,
  },
  pressureBarSegmentLast: {
    borderRightWidth: 0,
    borderTopRightRadius: AppRadii.md,
    borderBottomRightRadius: AppRadii.md,
  },
  pressureBarSegmentDisabled: {
    opacity: 0.45,
  },
  pressureBarSegmentText: {
    fontSize: 9,
    fontWeight: '800',
    color: AppColors.text,
    fontVariant: ['tabular-nums'],
  },
  pressureBarSegmentTextFilled: {
    color: AppColors.textInverse,
  },

  bottomSpacer: { height: 96 },
});
