import { Slider } from '@expo/ui/community/slider';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  type BitChannelMap,
  setChannelBit,
  unpackChannels,
} from '@/lib/bit-packed-word';
import {
  buildCarloGavazziOtCommand,
  CARLO_GAVAZZI_GATEWAY_CONFIG,
  getCarloGavazziMetricsSignalByName,
  getPumpRoomPressureState,
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

// A pressure SetValue that has been published but not yet echoed back by metrics.
type PendingPressureCommand = {
  counterId: number;
  expectedMa: number;
  requestedLabel: string;
  sentAt: number;
};
type PendingPressureMap = Partial<Record<PumpRoomPlcInputKey, PendingPressureCommand>>;

// ─── PLC Digital Output Definitions ──────────────────────────────────────────
// Digital Output only — Digital Input is not surfaced on this screen. The DO
// word is a dedicated 16-bit register (bit 0 = LSB). Per docs/DO.md: bits 0..13
// carry the functional outputs, bits 14..15 are spare. The published SetValue
// is that single word, no DI area packed in.

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

// Re-based to bit 0: DO occupies its own word, one bit per channel in order.
// Bits 14 & 15 are spare (not rendered, kept 0).
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
// Metrics echo mA as a float; treat it as an ack when within half a step.
const PRESSURE_ACK_TOLERANCE_MA = 0.05;
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
        <Text style={[s.tabBtnText, active === 'plc' && s.tabBtnTextActive]}>PLC</Text>
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

// ─── PLC Tab sub-components ───────────────────────────────────────────────────

function GatewayWordDisplay({ doWord }: { doWord: number }) {
  const doBits = (doWord & DO_WORD_MASK).toString(2).padStart(16, '0');
  return (
    <View style={s.ioCountRow}>
      <View style={s.ioCountCard}>
        <Text style={s.ioCountValue}>{doWord}</Text>
        <Text style={s.ioCountLabel}>DO Word (SetValue)</Text>
      </View>
      <View style={s.ioCountCard}>
        <Text style={[s.ioCountValue, s.ioCountValueBin]}>{doBits}</Text>
        <Text style={s.ioCountLabel}>DO bits (b15…b0)</Text>
      </View>
    </View>
  );
}

function DoControlRow({ ch, value, onToggle }: { ch: (typeof DO_CHANNELS)[number]; value: boolean; onToggle: () => void }) {
  const activeColor       = AppColors.success;
  const activeBgColor     = AppColors.surfaceSuccess;
  const activeBorderColor = '#9BD7B6';
  return (
    <View style={[s.doRow, value && { backgroundColor: activeBgColor, borderColor: activeBorderColor }]}>
      <View style={s.doLeft}>
        <View style={[s.doIndicator, { backgroundColor: value ? activeColor : AppColors.border }]} />
        <Text style={s.diLabel} numberOfLines={1}>{ch.label}</Text>
      </View>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onToggle}
        style={[s.doToggleBtn, value && { backgroundColor: activeColor }]}
        accessibilityRole="switch"
        accessibilityState={{ checked: value }}
        accessibilityLabel={ch.label}>
        <Text style={[s.doToggleBtnText, value && s.doToggleBtnTextActive]}>{value ? 'ON' : 'OFF'}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Inject Value Tab sub-components ─────────────────────────────────────────

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
  draftValue,
  confirmedValue,
  isPending,
  onChange,
}: {
  label: string;
  draftValue: string;
  confirmedValue: string;
  isPending: boolean;
  onChange: (v: string) => void;
}) {
  // Slider position follows the local draft; tone/chip/bar follow the gateway
  // confirmed value — same "confirmed reflects reality" rule as the room screen.
  const draftMa = parseMa(draftValue);
  const confirmedMa = parseMa(confirmedValue);
  const tone = getPressureTone(confirmedMa);
  const palette = getSignalPalette(tone);
  const bar  = maToPressureBar(confirmedMa);
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
          <View style={[stationStyles.signalValueDot, { backgroundColor: isPending ? AppColors.warning : palette.accent }]} />
          <Text style={[stationStyles.signalValueText, { color: palette.text }]}>{formatMa(confirmedMa)}</Text>
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

  // ── PLC tab state ──
  const { publishTopic, recordLatencySample, status } = useMqtt();
  const recordLatencySampleRef = useRef(recordLatencySample);
  recordLatencySampleRef.current = recordLatencySample;
  const metricsTopic = useMqttTopic('gatewayMetrics');
  const metricsReceivedAt = metricsTopic.message?.receivedAt ?? null;
  const [draftDoWord, setDraftDoWord] = useState(0);
  const [lastDoWord, setLastDoWord] = useState(0);
  const [lastCommandError, setLastCommandError] = useState<string | null>(null);
  const [isPendingDo, setIsPendingDo] = useState(false);
  const isPendingDoRef = useRef(isPendingDo);
  isPendingDoRef.current = isPendingDo;
  const doExpireTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doBaselineReceivedAtRef = useRef<number | null>(null);
  const doState = unpackChannels([draftDoWord], DO_BIT_MAP);

  // ── Inject Value tab state ──
  // draft = what the slider shows / user is dragging; confirmed = last value
  // echoed back by the gateway metrics. Mirrors the accommodation-room mapping.
  const [injectDraft, setInjectDraft] = useState(DEFAULT_PUMP_ROOM_PLC_INPUTS);
  const [injectConfirmed, setInjectConfirmed] = useState(DEFAULT_PUMP_ROOM_PLC_INPUTS);
  const [pendingPressure, setPendingPressure] = useState<PendingPressureMap>({});
  const pendingPressureRef = useRef(pendingPressure);
  pendingPressureRef.current = pendingPressure;
  const pressureDebounceRef = useRef<Partial<Record<PumpRoomPlcInputKey, ReturnType<typeof setTimeout>>>>({});
  const hasHydratedRef = useRef(false);
  const derivedAlarm = getDerivedAlarm(injectDraft);
  const isPressurePending = Object.keys(pendingPressure).length > 0;

  // ── PLC: sync metrics → DO word ──
  useEffect(() => {
    if (!metricsTopic.payload) return;
    const sig = getCarloGavazziMetricsSignalByName(
      metricsTopic.payload,
      CARLO_GAVAZZI_GATEWAY_CONFIG.fireFightingRoom.doWord.deviceId,
      'Adjustable value'
    );
    if (!sig || typeof sig.value !== 'number') return;
    const timer = setTimeout(() => {
      const doWord = Math.round(sig.value as number) & DO_WORD_MASK;
      setLastDoWord(doWord);
      // Draft is optimistic while a toggle is in flight; otherwise it tracks the
      // gateway echo so externally-driven output changes stay reflected.
      if (!isPendingDoRef.current) setDraftDoWord(doWord);
    }, 0);
    return () => clearTimeout(timer);
  }, [metricsReceivedAt, metricsTopic.payload]);

  // ── PLC: clear pending when gateway echoes back ──
  useEffect(() => {
    if (!isPendingDo || metricsReceivedAt === null) return;
    if (doBaselineReceivedAtRef.current !== null && metricsReceivedAt <= doBaselineReceivedAtRef.current) return;
    if (doExpireTimeoutRef.current !== null) { clearTimeout(doExpireTimeoutRef.current); doExpireTimeoutRef.current = null; }
    doBaselineReceivedAtRef.current = null;
    setIsPendingDo(false);
  }, [isPendingDo, metricsReceivedAt]);

  const toggleDo = useCallback((key: DoKey) => {
    const nextWord = setChannelBit([draftDoWord], DO_BIT_MAP, key, !doState[key])[0] & DO_WORD_MASK;
    setDraftDoWord(nextWord);
    if (status !== 'connected') { setLastCommandError('MQTT disconnected.'); return; }
    doBaselineReceivedAtRef.current = metricsReceivedAt;
    setIsPendingDo(true);
    if (doExpireTimeoutRef.current !== null) clearTimeout(doExpireTimeoutRef.current);
    doExpireTimeoutRef.current = setTimeout(() => {
      doExpireTimeoutRef.current = null;
      doBaselineReceivedAtRef.current = null;
      setIsPendingDo(false);
      setLastCommandError(null);
    }, 5_000);
    void publishTopic(
      'gatewayOtCommand',
      // DO word only (0..4095) — re-based to bit 0, no DI area packed in.
      buildCarloGavazziOtCommand(CARLO_GAVAZZI_GATEWAY_CONFIG.fireFightingRoom.doWord.deviceId, 'SetValue', nextWord),
      { qos: 0, retain: false }
    ).then(() => { setLastDoWord(nextWord); setLastCommandError(null); })
     .catch((err: unknown) => { setLastCommandError(err instanceof Error ? err.message : 'SetValue failed.'); });
  }, [draftDoWord, doState, metricsReceivedAt, publishTopic, status]);

  const statusHint = useMemo(() => {
    if (lastCommandError) return lastCommandError;
    if (isPendingDo) return 'Waiting for gateway response…';
    if (status !== 'connected') return 'MQTT disconnected.';
    return null;
  }, [isPendingDo, lastCommandError, status]);

  // ── Inject Value: hydrate from storage ──
  useEffect(() => {
    let mounted = true;
    getStoredPumpRoomPlcInputs().then((stored) => {
      if (!mounted) return;
      setInjectDraft(stored);
      setInjectConfirmed(stored);
      hasHydratedRef.current = true;
    });
    const debounces = pressureDebounceRef.current;
    return () => {
      mounted = false;
      PRESSURE_KEYS.forEach((key) => {
        const timer = debounces[key];
        if (timer) clearTimeout(timer);
      });
    };
  }, []);

  useEffect(() => {
    if (!hasHydratedRef.current) return;
    void setStoredPumpRoomPlcInputs(injectConfirmed);
  }, [injectConfirmed]);

  // Drop in-flight pressure commands when the broker session drops.
  useEffect(() => {
    if (status === 'connected') return;
    setPendingPressure({});
  }, [status]);

  const sendPressureCommand = useCallback(
    async (key: PumpRoomPlcInputKey, nextMa: number, requestedLabel: string) => {
      if (status !== 'connected') { setLastCommandError('MQTT disconnected.'); return; }
      const counterId = CARLO_GAVAZZI_GATEWAY_CONFIG.pumpRoom.counterIds[key];
      try {
        await publishTopic(
          'gatewayOtCommand',
          // Counter register is an unsigned int — encode mA as (mA × 10).
          buildCarloGavazziOtCommand(counterId, 'SetValue', pressureMaToCounter(nextMa)),
          { qos: 0, retain: false }
        );
        setPendingPressure((cur) => ({
          ...cur,
          [key]: { counterId, expectedMa: nextMa, requestedLabel, sentAt: Date.now() },
        }));
        setLastCommandError(null);
      } catch (err) {
        setLastCommandError(err instanceof Error ? err.message : `Unable to send ${requestedLabel}.`);
      }
    },
    [publishTopic, status]
  );

  // ── Inject Value: reconcile pressure counters against metrics echo ──
  useEffect(() => {
    if (!metricsTopic.payload) return;
    const pressureState = getPumpRoomPressureState(metricsTopic.payload);
    const metricByKey: Record<PumpRoomPlcInputKey, number | null> = {
      pressurePump1: pressureState.pressurePump1Ma,
      pressurePump2: pressureState.pressurePump2Ma,
    };
    const latestPending = pendingPressureRef.current;
    const timer = setTimeout(() => {
      // Confirmed value always tracks the gateway echo.
      setInjectConfirmed((cur) => {
        const next = { ...cur };
        PRESSURE_KEYS.forEach((key) => {
          const ma = metricByKey[key];
          if (ma !== null) next[key] = formatMa(ma);
        });
        return next;
      });

      const ackedKeys = PRESSURE_KEYS.filter((key) => {
        const ma = metricByKey[key];
        const pending = latestPending[key];
        return ma !== null && pending && Math.abs(pending.expectedMa - ma) <= PRESSURE_ACK_TOLERANCE_MA;
      });

      // Draft follows the echo except while a command is still awaiting its ack.
      setInjectDraft((cur) => {
        const next = { ...cur };
        PRESSURE_KEYS.forEach((key) => {
          const ma = metricByKey[key];
          if (ma === null) return;
          if (!latestPending[key] || ackedKeys.includes(key)) {
            next[key] = formatMa(ma);
          }
        });
        return next;
      });

      if (ackedKeys.length > 0) {
        const latestAcked = ackedKeys
          .map((key) => latestPending[key]!)
          .sort((left, right) => left.sentAt - right.sentAt)
          .pop();
        if (latestAcked) {
          recordLatencySampleRef.current({
            label: latestAcked.requestedLabel,
            requestTopicKey: 'gatewayOtCommand',
            responseTopicKey: 'gatewayMetrics',
            startedAt: latestAcked.sentAt,
            completedAt: metricsReceivedAt ?? Date.now(),
          });
        }
        setPendingPressure((cur) => {
          const next = { ...cur };
          ackedKeys.forEach((key) => { delete next[key]; });
          return next;
        });
        setLastCommandError(null);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [metricsReceivedAt, metricsTopic.payload]);

  const updatePressureField = useCallback(
    (key: PumpRoomPlcInputKey, value: string) => {
      const nextMa = parseMa(value);
      setInjectDraft((cur) => ({ ...cur, [key]: formatMa(nextMa) }));

      const existing = pressureDebounceRef.current[key];
      if (existing) clearTimeout(existing);
      const label = key === 'pressurePump1' ? 'PT-001' : 'PT-002';
      pressureDebounceRef.current[key] = setTimeout(() => {
        void sendPressureCommand(key, nextMa, `${label} ${formatMa(nextMa)}`);
      }, COMMAND_DEBOUNCE_MS);
    },
    [sendPressureCommand]
  );

  const injectStatusHint = useMemo(() => {
    if (lastCommandError) return lastCommandError;
    if (isPressurePending) return 'Injecting pressure — waiting for gateway echo…';
    if (status !== 'connected') return 'MQTT disconnected.';
    return null;
  }, [isPressurePending, lastCommandError, status]);

  return (
    <SafeAreaView style={s.safeArea} edges={['top', 'left', 'right']}>
      <Header />
      <TabBar active={activeTab} onChange={setActiveTab} />

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

        {activeTab === 'plc' ? (
          <>
            <GatewayWordDisplay doWord={lastDoWord} />

            {statusHint ? <Text style={s.statusHint}>{statusHint}</Text> : null}

            {/* DO */}
            <View style={s.sectionBlock}>
              <View style={s.sectionHeader}>
                <View style={s.sectionLabelRow}>
                  <View style={[s.sectionDot, { backgroundColor: AppColors.primary }]} />
                  <Text style={s.sectionTitle}>Digital Output</Text>
                </View>
                <Text style={[s.sectionBadge, s.sectionBadgeDo]}>Controllable</Text>
              </View>
              <View style={s.doStack}>
                {DO_CHANNELS.map((ch) => (
                  <DoControlRow key={ch.key} ch={ch} value={doState[ch.key]} onToggle={() => toggleDo(ch.key)} />
                ))}
              </View>
            </View>
          </>
        ) : (
          <>
            {injectStatusHint ? <Text style={s.statusHint}>{injectStatusHint}</Text> : null}

            {/* Sensor calibration — PT-001 / PT-002 in 4–20 mA */}
            <View style={stationStyles.sectionCard}>
              {PUMP_ROOM_PLC_FIELDS.map((field) => (
                <PressureSlider
                  key={field.key}
                  label={field.label}
                  draftValue={injectDraft[field.key]}
                  confirmedValue={injectConfirmed[field.key]}
                  isPending={pendingPressure[field.key] !== undefined}
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

  diLabel: { fontSize: 13, fontWeight: '700', color: AppColors.text },

  doStack: { gap: AppSpacing.sm },
  doRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: AppSpacing.md, backgroundColor: AppColors.surface,
    borderRadius: AppRadii.lg, borderWidth: 1, borderColor: AppColors.border,
    paddingHorizontal: AppSpacing.md, paddingVertical: AppSpacing.md,
  },
  doLeft: { flexDirection: 'row', alignItems: 'center', gap: AppSpacing.sm, flex: 1, minWidth: 0 },
  doIndicator: { width: 10, height: 10, borderRadius: AppRadii.full, flexShrink: 0 },
  doToggleBtn: {
    minWidth: 56, height: 36, borderRadius: AppRadii.full,
    backgroundColor: AppColors.surfaceMuted, borderWidth: 1, borderColor: AppColors.border,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: AppSpacing.md,
  },
  doToggleBtnText: { fontSize: 12, fontWeight: '800', color: AppColors.textSubtle, letterSpacing: 0.5 },
  doToggleBtnTextActive: { color: AppColors.textInverse },

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
