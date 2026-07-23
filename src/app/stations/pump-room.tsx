import { Slider } from '@expo/ui/community/slider';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getChannelBit,
  setChannelBit,
  unpackChannels,
  type BitChannelMap,
} from '@/lib/bit-packed-word';
import {
  DEFAULT_PENDING_COMMAND_TIMEOUT_MS,
  usePendingCommand,
  type PendingCommandState,
} from '@/hooks/use-pending-command';
import {
  buildCarloGavazziOtCommand,
  CARLO_GAVAZZI_GATEWAY_CONFIG,
  getCarloGavazziCounterNumericValue,
  packToPlcCommand,
  pressureMaToCounter,
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
  expectedPacked: number;
  successMessage: string;
  previousPumpActPulse: number;
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
// bits 0..13 are functional channels, bits 14..15 spare. The app RECEIVES and
// bit-unpacks this word for display — it never writes DO. When MQTT is offline
// the screen switches to simulation: each channel becomes a tappable ON/OFF, and
// the decimal word + bits recompute live — so the calculation can be checked
// against the PLC engineer's, no typing required.

const DO_CHANNELS = [
  { key: 'pumpARunning',         label: 'Pump A Running' },
  { key: 'pumpBRunning',         label: 'Pump B Running' },
  { key: 'sv1Opened',            label: 'SV1 Opened' },
  { key: 'sv1Closed',            label: 'SV1 Closed' },
  { key: 'sv2Opened',            label: 'SV2 Opened' },
  { key: 'sv2Closed',            label: 'SV2 Closed' },
  { key: 'localZoneActivation',  label: 'Local Zone Activation' },
  { key: 'remoteZoneActivation', label: 'Remote Zone Activation' },
  { key: 'fgsConfFire',          label: 'FGS Confirmed Fire' },
  { key: 'levelTankHigh',        label: 'Level Tank High' },
  { key: 'levelTankLow',         label: 'Level Tank Low' },
  { key: 'pumpCRunning',         label: 'Pump C Running' },
  { key: 'localMode',            label: 'Local Mode' },
  { key: 'remoteMode',           label: 'Remote Mode' },
] as const;

type DoKey = (typeof DO_CHANNELS)[number]['key'];

const DO_BIT_MAP: BitChannelMap<DoKey> = {
  pumpARunning:         { wordIndex: 0, bitIndex: 0  },
  pumpBRunning:         { wordIndex: 0, bitIndex: 1  },
  sv1Opened:            { wordIndex: 0, bitIndex: 2  },
  sv1Closed:            { wordIndex: 0, bitIndex: 3  },
  sv2Opened:            { wordIndex: 0, bitIndex: 4  },
  sv2Closed:            { wordIndex: 0, bitIndex: 5  },
  localZoneActivation:  { wordIndex: 0, bitIndex: 6  },
  remoteZoneActivation: { wordIndex: 0, bitIndex: 7  },
  fgsConfFire:          { wordIndex: 0, bitIndex: 8  },
  levelTankHigh:        { wordIndex: 0, bitIndex: 9  },
  levelTankLow:         { wordIndex: 0, bitIndex: 10 },
  pumpCRunning:         { wordIndex: 0, bitIndex: 11 },
  localMode:            { wordIndex: 0, bitIndex: 12 },
  remoteMode:           { wordIndex: 0, bitIndex: 13 },
};

// Full 16-bit DO word (bits 14 & 15 spare).
const DO_WORD_MASK = 0xffff;

// ─── Inject Value Constants (4–20 mA signal) ────────────────────────────────

const MA_MIN = 4;
const MA_MAX = 20;
const MA_STEP = 0.1;

// Debounce slider drags before publishing so we don't flood the OT channel.
const COMMAND_DEBOUNCE_MS = 250;
const PRESSURE_KEYS: PumpRoomPlcInputKey[] = ['pressurePump1', 'pressurePump2'];

// PT-001 / PT-002: alarm thresholds in mA
const PRESSURE_LOW_MA     = 6;     // live-low
const PRESSURE_WARNING_MA = 11.5;  // caution
const PRESSURE_DANGER_MA  = 14.2;  // critical

const PRESSURE_MAX_BAR = MA_MAX - MA_MIN; // 16 bar full scale

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clampMa(v: number) { return Math.min(Math.max(Number.isFinite(v) ? v : MA_MIN, MA_MIN), MA_MAX); }
function parseMa(v: string)  { return clampMa(Number.parseFloat(v)); }
function formatMa(v: number) { return `${clampMa(v).toFixed(1)} mA`; }

function maToPressureBar(mA: number) { return mA - MA_MIN; }

function getPressureTone(mA: number): SignalTone {
  if (mA >= PRESSURE_DANGER_MA)  return 'danger';
  if (mA >= PRESSURE_WARNING_MA) return 'warning';
  return 'normal';
}

// Pack the current pressure drafts (+ an optional momentary pump-activation) into
// the TO PLC uint64 (7193): W0=PT1, W1=PT2, W2=Pump Activation, W3=spare.
function packInputs(inputs: PumpRoomPlcInputs, pumpActivation = 0) {
  return packToPlcCommand({
    pressurePump1Counter: pressureMaToCounter(parseMa(inputs.pressurePump1)),
    pressurePump2Counter: pressureMaToCounter(parseMa(inputs.pressurePump2)),
    pumpActivation,
  });
}

function getDerivedAlarm(form: PumpRoomPlcInputs): DerivedAlarm {
  const p1 = parseMa(form.pressurePump1);
  const p2 = parseMa(form.pressurePump2);
  const conditions: string[] = [];
  let level: DerivedAlarmLevel = 'clear';

  if (p1 >= PRESSURE_DANGER_MA || p2 >= PRESSURE_DANGER_MA) {
    conditions.push('High Pressure');
    level = 'danger';
  } else if (p1 >= PRESSURE_WARNING_MA || p2 >= PRESSURE_WARNING_MA) {
    conditions.push('Pressure Warning');
    level = 'warning';
  }

  if (p1 < PRESSURE_LOW_MA || p2 < PRESSURE_LOW_MA) {
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
        <Text style={[s.tabBtnText, active === 'inject' && s.tabBtnTextActive]}>TO PLC</Text>
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

function DoStatusRow({
  ch,
  value,
  bitIndex,
  simulation,
  onToggle,
}: {
  ch: (typeof DO_CHANNELS)[number];
  value: boolean;
  bitIndex: number;
  simulation: boolean;
  onToggle?: () => void;
}) {
  const activeColor = AppColors.success;
  const body = (
    <>
      <View style={s.doLeft}>
        <View style={[s.doIndicator, { backgroundColor: value ? activeColor : AppColors.border }]} />
        <Text style={s.diLabel} numberOfLines={1}>{ch.label}</Text>
        <Text style={s.doBitTag}>b{bitIndex}</Text>
      </View>
      <View style={[s.doStatusPill, value && { backgroundColor: activeColor, borderColor: activeColor }]}>
        <Text style={[s.doStatusPillText, value && s.doStatusPillTextOn]}>{value ? 'ON' : 'OFF'}</Text>
      </View>
    </>
  );
  const rowStyle = [s.doRow, value && { backgroundColor: AppColors.surfaceSuccess, borderColor: '#9BD7B6' }];

  // Simulation: whole row is a toggle (tap to flip the bit). Connected: read-only.
  if (simulation && onToggle) {
    return (
      <TouchableOpacity
        style={rowStyle}
        onPress={onToggle}
        activeOpacity={0.7}
        accessibilityRole="switch"
        accessibilityState={{ checked: value }}
        accessibilityLabel={`${ch.label} (bit ${bitIndex})`}>
        {body}
      </TouchableOpacity>
    );
  }
  return <View style={rowStyle}>{body}</View>;
}

// ─── TO PLC tab sub-components ───────────────────────────────────────────────

function ToPlcWordDisplay({
  pt1Counter,
  pt2Counter,
  pumpActivation,
  packed,
}: {
  pt1Counter: number;
  pt2Counter: number;
  pumpActivation: number;
  packed: number;
}) {
  // Show every one of the 4 words so the packed uint64 is fully transparent.
  const words = [
    { label: 'W0 · PT1', value: pt1Counter, active: pt1Counter > 0 },
    { label: 'W1 · PT2', value: pt2Counter, active: pt2Counter > 0 },
    { label: 'W2 · Pump Act', value: pumpActivation, active: pumpActivation > 0 },
    { label: 'W3 · spare', value: 0, active: false },
  ];
  return (
    <View style={s.toPlcBlock}>
      <View style={s.ioCountCard}>
        <Text style={s.ioCountValue} numberOfLines={1} adjustsFontSizeToFit>{packed}</Text>
        <Text style={s.ioCountLabel}>TO_PLC uint64 (to send)</Text>
      </View>
      <View style={s.wordGrid}>
        {words.map((w) => (
          <View key={w.label} style={[s.wordCell, w.active && s.wordCellActive]}>
            <Text style={[s.wordValue, w.active && s.wordValueActive]}>{w.value}</Text>
            <Text style={s.wordLabel}>{w.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function EngineeringSignalBands({ tone }: { tone: SignalTone }) {
  return (
    <View style={stationStyles.signalBandsRow}>
      <View style={[stationStyles.signalBand, stationStyles.signalBandNormal,  tone === 'normal'  && stationStyles.signalBandActive]} />
      <View style={[stationStyles.signalBand, stationStyles.signalBandWarning, tone === 'warning' && stationStyles.signalBandActive]} />
      <View style={[stationStyles.signalBand, stationStyles.signalBandDanger,  tone === 'danger'  && stationStyles.signalBandActive]} />
    </View>
  );
}

function PressureBlockBar({ bar, tone }: { bar: number; tone: SignalTone }) {
  return (
    <View style={s.blockBarRow}>
      {Array.from({ length: PRESSURE_MAX_BAR }, (_, i) => {
        const segBar = i + 1;
        const filled = bar >= segBar - 0.5;
        const segTone: SignalTone =
          segBar > PRESSURE_DANGER_MA - MA_MIN ? 'danger'
          : segBar > PRESSURE_WARNING_MA - MA_MIN ? 'warning'
          : 'normal';
        const palette = getSignalPalette(segTone);
        return (
          <View
            key={i}
            style={[s.blockBarSegment, { backgroundColor: filled ? palette.accent : palette.track }]}
          />
        );
      })}
    </View>
  );
}

function PressureSlider({
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
  // Inject-only: the slider value is the single source of truth (no gateway
  // echo to reconcile against), so tone / chip / bar all read from it directly.
  const draftMa = parseMa(value);
  const tone = getPressureTone(draftMa);
  const palette = getSignalPalette(tone);
  const bar  = maToPressureBar(draftMa);
  const statusLabel = tone === 'danger'
    ? `≥ ${PRESSURE_DANGER_MA} mA`
    : tone === 'warning'
    ? `≥ ${PRESSURE_WARNING_MA} mA`
    : 'Normal';
  return (
    <View style={stationStyles.fieldBlock}>
      <View style={stationStyles.fieldHeaderRow}>
        <Text style={stationStyles.fieldLabel}>{label}</Text>
        <View style={[stationStyles.signalValueChip, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={[stationStyles.signalValueDot, { backgroundColor: palette.accent }]} />
          <Text style={[stationStyles.signalValueText, { color: palette.text }]}>{formatMa(draftMa)}</Text>
        </View>
      </View>
      <View style={[stationStyles.signalSliderShell, tone === 'normal' && stationStyles.signalSliderShellNormal, tone === 'warning' && stationStyles.signalSliderShellWarning, tone === 'danger' && stationStyles.signalSliderShellDanger]}>
        <Slider
          value={draftMa}
          minimumValue={MA_MIN}
          maximumValue={MA_MAX}
          step={MA_STEP}
          minimumTrackTintColor={palette.accent}
          maximumTrackTintColor={palette.track}
          thumbTintColor={palette.accent}
          disabled={disabled}
          onValueChange={(v) => onChange(formatMa(v))}
          style={stationStyles.pressureSlider}
        />
        <EngineeringSignalBands tone={tone} />
      </View>
      <View style={stationStyles.sliderRangeRow}>
        <Text style={stationStyles.sliderRangeText}>4 mA</Text>
        <View style={[stationStyles.signalStateBadge, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={[stationStyles.signalStateText, { color: palette.text }]}>{statusLabel}</Text>
        </View>
        <Text style={stationStyles.sliderRangeText}>20 mA</Text>
      </View>
      <View style={s.euDisplayRow}>
        <Text style={s.euDisplayLabel}>Pressure</Text>
        <Text style={[s.euDisplayValue, { color: palette.text }]}>{bar.toFixed(1)} bar</Text>
      </View>
      <PressureBlockBar bar={bar} tone={tone} />
    </View>
  );
}

function PumpActivationButton({
  simulation,
  disabled,
  onFire,
}: {
  simulation: boolean;
  disabled: boolean;
  onFire: () => void;
}) {
  return (
    <TouchableOpacity
      style={[s.pumpActBtn, simulation && s.pumpActBtnSim, disabled && s.pumpActBtnDisabled]}
      disabled={disabled}
      onPress={onFire}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel="Pump Activation">
      <Feather name="zap" size={16} color={AppColors.textInverse} />
      <Text style={s.pumpActBtnText}>
        {simulation ? 'Pump Activation' : 'Kirim Pump Activation'}
      </Text>
    </TouchableOpacity>
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

export default function PumpRoom() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('plc');

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

  // Pump Activation is momentary — normally W[2] = 0. When fired we pulse it to 1
  // for ~2 s so the packed word / W-grid transparently shows what was sent.
  const [pumpActPulse, setPumpActPulse] = useState(0);
  const pumpActPulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live TO PLC preview. W[2] follows the momentary pulse so the grid stays honest.
  const pt1Counter = pressureMaToCounter(parseMa(injectDraft.pressurePump1));
  const pt2Counter = pressureMaToCounter(parseMa(injectDraft.pressurePump2));
  const toPlcPacked = packInputs(injectDraft, pumpActPulse);

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

    setPumpActPulse(command.snapshot.previousPumpActPulse);
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

    flashInject(command.snapshot.successMessage);
  }, [flashInject]);

  const pulsePumpActivation = useCallback(() => {
    setPumpActPulse(1);
    if (pumpActPulseTimeoutRef.current) clearTimeout(pumpActPulseTimeoutRef.current);
    pumpActPulseTimeoutRef.current = setTimeout(() => setPumpActPulse(0), 2_000);
  }, []);

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
    const ackedCommands = Object.values(pendingToPlcCommandMap).filter((command) => {
      const isFresh =
        command.snapshot.baselineReceivedAt === null
          ? metricsReceivedAt >= command.startedAt
          : metricsReceivedAt > command.snapshot.baselineReceivedAt;

      if (command.snapshot.kind === 'pumpActivation') {
        return isFresh;
      }

      return isFresh && command.snapshot.expectedPacked === roundedToPlcValue;
    });

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
      overrides: { pressurePump1Ma?: number; pressurePump2Ma?: number; pumpActivation?: number },
      snapshot: Omit<
        ToPlcCommandSnapshot,
        'baselineReceivedAt' | 'expectedPacked' | 'previousPumpActPulse'
      >
    ) => {
      const commandId = getToPlcCommandId(kind);

      if (isToPlcCommandPending(commandId)) {
        showCommandError(`${snapshot.successMessage} is already waiting for gateway response.`);
        return;
      }

      const pressurePump1Ma = overrides.pressurePump1Ma ?? parseMa(injectDraftRef.current.pressurePump1);
      const pressurePump2Ma = overrides.pressurePump2Ma ?? parseMa(injectDraftRef.current.pressurePump2);
      const packed = packToPlcCommand({
        pressurePump1Counter: pressureMaToCounter(pressurePump1Ma),
        pressurePump2Counter: pressureMaToCounter(pressurePump2Ma),
        pumpActivation: overrides.pumpActivation ?? 0,
      });
      const pendingCommand = startToPlcCommand({
        id: commandId,
        label: snapshot.successMessage,
        snapshot: {
          ...snapshot,
          baselineReceivedAt: metricsReceivedAt,
          expectedPacked: packed,
          previousPumpActPulse: pumpActPulse,
        },
        timeoutMs: DEFAULT_PENDING_COMMAND_TIMEOUT_MS,
        onTimeout: (command) => {
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
      metricsReceivedAt,
      publishPackedToPlc,
      pumpActPulse,
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
      if (pumpActPulseTimeoutRef.current) clearTimeout(pumpActPulseTimeoutRef.current);
    };
  }, []);

  // Slider settle → persist + (if connected) publish the packed word. Offline it
  // stays local so you can watch the pack calculation without a broker.
  const updatePressureField = useCallback(
    (key: PumpRoomPlcInputKey, value: string) => {
      const commandId = getToPlcCommandId(key);

      if (isToPlcCommandPending(commandId)) {
        showCommandError(`${key === 'pressurePump1' ? 'PT-001' : 'PT-002'} is already waiting for gateway response.`);
        return;
      }

      const nextMa = parseMa(value);
      const nextFormattedValue = formatMa(nextMa);
      const currentFormattedValue = formatMa(parseMa(injectDraftRef.current[key]));

      if (currentFormattedValue === nextFormattedValue) {
        return;
      }

      if (!pressureSnapshotRef.current[key]) {
        pressureSnapshotRef.current[key] = {
          previousConfirmedValue: confirmedInject[key],
          previousDraftValue: injectDraftRef.current[key],
        };
      }

      const nextInputs = { ...injectDraftRef.current, [key]: formatMa(nextMa) };
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
          key === 'pressurePump1' ? { pressurePump1Ma: nextMa } : { pressurePump2Ma: nextMa },
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
    [confirmedInject, isToPlcCommandPending, sendToPlcCommand, showCommandError, status]
  );

  // Momentary: fire once with W[2] = 1. The pulse lights up W2 in the grid either
  // way; offline it just shows the packed value instead of publishing.
  const firePumpActivation = useCallback(() => {
    const commandId = getToPlcCommandId('pumpActivation');

    if (isToPlcCommandPending(commandId)) {
      showCommandError('Pump Activation is already waiting for gateway response.');
      return;
    }

    pulsePumpActivation();
    if (status !== 'connected') {
      flashInject(`SIM — Pump Activation → ${packInputs(injectDraftRef.current, 1)}`);
      return;
    }
    void sendToPlcCommand(
      'pumpActivation',
      { pumpActivation: 1 },
      {
        kind: 'pumpActivation',
        successMessage: 'Pump Activation sent → PLC',
      }
    );
  }, [
    flashInject,
    isToPlcCommandPending,
    pulsePumpActivation,
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
    if (isSimulation) return 'Mode simulasi — MQTT offline. Tekan channel untuk ON/OFF; desimal & bit terhitung otomatis.';
    return null;
  }, [isSimulation]);

  const injectStatusHint = useMemo(() => {
    if (lastCommandError) return lastCommandError;
    if (injectFlash) return injectFlash;
    if (latestPendingToPlcCommand) return `${latestPendingToPlcCommand.label} · waiting for gateway.`;
    if (isSimulation) return 'Mode simulasi — TO_PLC dihitung lokal, tidak dikirim.';
    return null;
  }, [injectFlash, isSimulation, lastCommandError, latestPendingToPlcCommand]);

  return (
    <SafeAreaView style={s.safeArea} edges={['top', 'left', 'right']}>
      <Header />
      <TabBar active={activeTab} onChange={setActiveTab} />

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

        {activeTab === 'plc' ? (
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
              <View style={s.doStack}>
                {DO_CHANNELS.map((ch) => (
                  <DoStatusRow
                    key={ch.key}
                    ch={ch}
                    value={doState[ch.key]}
                    bitIndex={DO_BIT_MAP[ch.key].bitIndex}
                    simulation={isSimulation}
                    onToggle={() => toggleDoChannel(ch.key)}
                  />
                ))}
              </View>
            </View>
          </>
        ) : (
          <>
            {injectStatusHint ? <Text style={s.statusHint}>{injectStatusHint}</Text> : null}

            <ToPlcWordDisplay
              pt1Counter={pt1Counter}
              pt2Counter={pt2Counter}
              pumpActivation={pumpActPulse}
              packed={toPlcPacked}
            />
            {/* Pump Activation — momentary command (W2) */}
            <PumpActivationButton
              simulation={isSimulation}
              disabled={isPumpActivationPending}
              onFire={firePumpActivation}
            />

            {/* PT-001 / PT-002 inject in 4–20 mA (W0 / W1) */}
            <View style={stationStyles.sectionCard}>
              {PUMP_ROOM_PLC_FIELDS.map((field) => (
                <PressureSlider
                  key={field.key}
                  label={field.label}
                  value={injectDraft[field.key]}
                  disabled={getPressurePending(field.key)}
                  onChange={(v) => updatePressureField(field.key, v)}
                />
              ))}
            </View>

            

            {/* Derived alarm */}
            <View style={stationStyles.summaryCard}>
              <DerivedAlarmCard alarm={derivedAlarm} />
            </View>
          </>
        )}

        <View style={s.bottomSpacer} />
      </ScrollView>
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

  diLabel: { fontSize: 13, fontWeight: '700', color: AppColors.text, flexShrink: 1 },
  doBitTag: {
    fontSize: 10, fontWeight: '800', color: AppColors.textSubtle,
    backgroundColor: AppColors.surfaceMuted, borderRadius: AppRadii.sm,
    paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden',
    fontVariant: ['tabular-nums'], flexShrink: 0,
  },

  doStack: { gap: AppSpacing.sm },
  doRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: AppSpacing.md, backgroundColor: AppColors.surface,
    borderRadius: AppRadii.lg, borderWidth: 1, borderColor: AppColors.border,
    paddingHorizontal: AppSpacing.md, paddingVertical: AppSpacing.md,
  },
  doLeft: { flexDirection: 'row', alignItems: 'center', gap: AppSpacing.sm, flex: 1, minWidth: 0 },
  doIndicator: { width: 10, height: 10, borderRadius: AppRadii.full, flexShrink: 0 },
  doStatusPill: {
    minWidth: 56, height: 32, borderRadius: AppRadii.full,
    backgroundColor: AppColors.surfaceMuted, borderWidth: 1, borderColor: AppColors.border,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: AppSpacing.md,
  },
  doStatusPillText: { fontSize: 12, fontWeight: '800', color: AppColors.textSubtle, letterSpacing: 0.5 },
  doStatusPillTextOn: { color: AppColors.textInverse },

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
  pumpActBtnDisabled: { opacity: 0.55 },
  pumpActBtnText: { fontSize: 14, fontWeight: '800', color: AppColors.textInverse, letterSpacing: 0.3 },

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

  euDisplayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: AppSpacing.xs,
    marginTop: AppSpacing.xs,
  },
  euDisplayLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: AppColors.textSubtle,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  euDisplayValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  blockBarRow: {
    flexDirection: 'row',
    gap: 3,
    marginTop: AppSpacing.sm,
  },
  blockBarSegment: {
    flex: 1,
    height: 18,
    borderRadius: 3,
  },

  bottomSpacer: { height: 96 },
});
