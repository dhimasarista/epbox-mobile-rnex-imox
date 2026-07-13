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
type StepperChipTone = 'default' | 'stable' | 'warning' | 'danger';
type DerivedAlarmLevel = 'clear' | 'warning' | 'danger';
type DerivedAlarm = { level: DerivedAlarmLevel; conditions: string[] };

// ─── PLC IO Definitions ──────────────────────────────────────────────────────

const DI_CHANNELS = [
  { key: 'emergencyStop',        label: 'Emergency Stop',          channel: 1,  slot: 1, contactType: 'NC' },
  { key: 'btnStartPumpA',        label: 'Button - Start Pump A',   channel: 2,  slot: 1, contactType: 'NO' },
  { key: 'btnStopPumpA',         label: 'Button - Stop Pump A',    channel: 3,  slot: 1, contactType: 'NC' },
  { key: 'btnStartPumpB',        label: 'Button - Start Pump B',   channel: 4,  slot: 1, contactType: 'NO' },
  { key: 'btnStopPumpB',         label: 'Button - Stop Pump B',    channel: 5,  slot: 1, contactType: 'NC' },
  { key: 'btnZoneRelease',       label: 'Button - Zone Release',   channel: 6,  slot: 1, contactType: 'NO' },
  { key: 'selectorLocalRemote',  label: 'Selector Local / Remote', channel: 7,  slot: 1, contactType: 'NO' },
  { key: 'r3PumpARunning',       label: 'R3 – Pump A Status',      channel: 8,  slot: 1, contactType: 'NO' },
  { key: 'r4PumpBRunning',       label: 'R4 – Pump B Status',      channel: 9,  slot: 1, contactType: 'NO' },
  { key: 'r5PumpCRunning',       label: 'R5 – Pump C Status',      channel: 10, slot: 1, contactType: 'NO' },
  { key: 'levelSwitchLow',       label: 'Level Switch – Low Tank', channel: 11, slot: 1, contactType: 'NO' },
  { key: 'flowSwitch',           label: 'Flow Switch',             channel: 12, slot: 1, contactType: 'NO' },
] as const;

const DO_CHANNELS = [
  { key: 'solenoidValve1',   label: 'R1 – Solenoid Valve 1 Open', channel: 1,  slot: 1 },
  { key: 'solenoidValve2',   label: 'R2 – Solenoid Valve 2 Open', channel: 2,  slot: 1 },
  { key: 'r3PumpAStart',     label: 'R3 – Pump A Start',          channel: 3,  slot: 1 },
  { key: 'r4PumpBStart',     label: 'R4 – Pump B Start',          channel: 4,  slot: 1 },
  { key: 'r5PumpCStart',     label: 'R5 – Pump C Start',          channel: 5,  slot: 1 },
  { key: 'buzzer',           label: 'Buzzer',                      channel: 6,  slot: 1 },
  { key: 'lampZoneRelease',  label: 'Lamp – Zone Release',         channel: 7,  slot: 1 },
  { key: 'lampPumpARunning', label: 'Lamp – Pump A Running',       channel: 8,  slot: 1 },
  { key: 'lampPumpAStoped',  label: 'Lamp – Pump A Stopped',       channel: 9,  slot: 1 },
  { key: 'lampPumpBRunning', label: 'Lamp – Pump B Running',       channel: 10, slot: 1 },
  { key: 'lampPumpBStoped',  label: 'Lamp – Pump B Stopped',       channel: 1,  slot: 2 },
  { key: 'lampLocalRemote',  label: 'Lamp – Local / Remote',       channel: 2,  slot: 2 },
] as const;

type DiKey = (typeof DI_CHANNELS)[number]['key'];
type DoKey = (typeof DO_CHANNELS)[number]['key'];

const DI_BIT_MAP: BitChannelMap<DiKey> = {
  emergencyStop:       { wordIndex: 0, bitIndex: 0  },
  btnStartPumpA:       { wordIndex: 0, bitIndex: 1  },
  btnStopPumpA:        { wordIndex: 0, bitIndex: 2  },
  btnStartPumpB:       { wordIndex: 0, bitIndex: 3  },
  btnStopPumpB:        { wordIndex: 0, bitIndex: 4  },
  btnZoneRelease:      { wordIndex: 0, bitIndex: 5  },
  selectorLocalRemote: { wordIndex: 0, bitIndex: 6  },
  r3PumpARunning:      { wordIndex: 0, bitIndex: 7  },
  r4PumpBRunning:      { wordIndex: 0, bitIndex: 8  },
  r5PumpCRunning:      { wordIndex: 0, bitIndex: 9  },
  levelSwitchLow:      { wordIndex: 0, bitIndex: 10 },
  flowSwitch:          { wordIndex: 0, bitIndex: 11 },
};

const DO_BIT_MAP: BitChannelMap<DoKey> = {
  solenoidValve1:   { wordIndex: 0, bitIndex: 12 },
  solenoidValve2:   { wordIndex: 0, bitIndex: 13 },
  r3PumpAStart:     { wordIndex: 0, bitIndex: 14 },
  r4PumpBStart:     { wordIndex: 0, bitIndex: 15 },
  r5PumpCStart:     { wordIndex: 1, bitIndex: 0  },
  buzzer:           { wordIndex: 1, bitIndex: 1  },
  lampZoneRelease:  { wordIndex: 1, bitIndex: 2  },
  lampPumpARunning: { wordIndex: 1, bitIndex: 3  },
  lampPumpAStoped:  { wordIndex: 1, bitIndex: 4  },
  lampPumpBRunning: { wordIndex: 1, bitIndex: 5  },
  lampPumpBStoped:  { wordIndex: 1, bitIndex: 6  },
  lampLocalRemote:  { wordIndex: 1, bitIndex: 7  },
};

// ─── Inject Value Constants ───────────────────────────────────────────────────

const PRESSURE_MIN_BAR = 0;
const PRESSURE_LOW_BAR = 2;
const PRESSURE_WARNING_BAR = 7.5;
const PRESSURE_DANGER_BAR = 10.2;
const PRESSURE_SLIDER_MAX_BAR = 16;
const FLOW_RATE_FIELD_KEY: PumpRoomPlcInputKey = 'dischargeFlowRate';
const FLOW_RATE_MIN_M3H = 0;
const FLOW_RATE_STEP_M3H = 1;
const FLOW_BLOCKAGE_THRESHOLD_M3H = 50;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clampPressure(v: number) { return Math.min(Math.max(Number.isFinite(v) ? v : 0, PRESSURE_MIN_BAR), PRESSURE_SLIDER_MAX_BAR); }
function parsePressure(v: string)  { return clampPressure(Number.parseFloat(v.replace(',', '.'))); }
function formatPressure(v: number) { return `${clampPressure(v).toFixed(1)} bar`; }

function clampFlow(v: number)  { return Math.max(Number.isFinite(v) ? Math.round(v) : 0, FLOW_RATE_MIN_M3H); }
function parseFlow(v: string)  { const m = v.trim().match(/^\d+/); return clampFlow(m ? parseInt(m[0], 10) : NaN); }
function formatFlow(v: number) { return `${clampFlow(v)} m3/h`; }

function getPressureTone(v: number): SignalTone {
  if (v >= PRESSURE_DANGER_BAR) return 'danger';
  if (v >= PRESSURE_WARNING_BAR) return 'warning';
  return 'normal';
}

function getDerivedAlarm(form: PumpRoomPlcInputs, pumpRunning: boolean): DerivedAlarm {
  const p1 = parsePressure(form.pressurePump1);
  const p2 = parsePressure(form.pressurePump2);
  const flow = parseFlow(form.dischargeFlowRate);
  const conditions: string[] = [];
  let level: DerivedAlarmLevel = 'clear';

  if (p1 >= PRESSURE_DANGER_BAR || p2 >= PRESSURE_DANGER_BAR) {
    conditions.push('High Pressure');
    level = 'danger';
  } else if (p1 >= PRESSURE_WARNING_BAR || p2 >= PRESSURE_WARNING_BAR) {
    conditions.push('Pressure Warning');
    level = 'warning';
  }

  if (pumpRunning) {
    if (p1 < PRESSURE_LOW_BAR || p2 < PRESSURE_LOW_BAR) {
      conditions.push('Low Pressure');
      level = 'danger';
    }
    if (flow === 0) {
      conditions.push('No Flow');
      level = 'danger';
    } else if (flow < FLOW_BLOCKAGE_THRESHOLD_M3H && (p1 >= PRESSURE_WARNING_BAR || p2 >= PRESSURE_WARNING_BAR)) {
      conditions.push('Possible Blockage');
      if (level !== 'danger') level = 'warning';
    }
  }

  return { level, conditions };
}

function getChipStyles(tone: StepperChipTone) {
  if (tone === 'stable')  return { container: stationStyles.dashboardValueChipStable,  text: stationStyles.dashboardValueChipTextStable  };
  if (tone === 'warning') return { container: stationStyles.dashboardValueChipWarning, text: stationStyles.dashboardValueChipTextWarning };
  if (tone === 'danger')  return { container: stationStyles.dashboardValueChipDanger,  text: stationStyles.dashboardValueChipTextDanger  };
  return { container: undefined, text: undefined };
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

function GatewayWordDisplay({ lastCombinedWord }: { lastCombinedWord: number }) {
  const diBits = (lastCombinedWord & 0x0fff).toString(2).padStart(12, '0');
  const doBits = ((lastCombinedWord >>> 12) & 0x0fff).toString(2).padStart(12, '0');
  return (
    <View style={s.ioCountRow}>
      <View style={s.ioCountCard}>
        <Text style={s.ioCountValue}>{lastCombinedWord}</Text>
        <Text style={s.ioCountLabel}>Adjustable Value</Text>
      </View>
      <View style={s.ioCountCard}>
        <Text style={[s.ioCountValue, s.ioCountValueBin]}>{diBits} {doBits}</Text>
        <Text style={s.ioCountLabel}>DI · DO</Text>
      </View>
    </View>
  );
}

function DiStatusRow({ ch, value }: { ch: (typeof DI_CHANNELS)[number]; value: boolean }) {
  const isEmergency = ch.key === 'emergencyStop';
  const dotColor = isEmergency && value ? AppColors.error : value ? AppColors.success : AppColors.border;
  const valueColor = isEmergency && value ? AppColors.error : value ? AppColors.success : AppColors.textSubtle;
  return (
    <View style={s.diRow}>
      <View style={s.diLeft}>
        <View style={[s.diDot, { backgroundColor: dotColor }]} />
        <View style={s.diTextBlock}>
          <Text style={s.diLabel} numberOfLines={1}>{ch.label}</Text>
          <Text style={s.diMeta}>Ch {ch.channel} · Slot {ch.slot} · {ch.contactType}</Text>
        </View>
      </View>
      <View style={[s.diValueChip, value && (isEmergency ? s.diChipDanger : s.diChipActive)]}>
        <Text style={[s.diValueText, { color: valueColor }]}>{value ? 'TRUE' : 'FALSE'}</Text>
      </View>
    </View>
  );
}

function DoControlRow({ ch, value, onToggle }: { ch: (typeof DO_CHANNELS)[number]; value: boolean; onToggle: () => void }) {
  const isBuzzer = ch.key === 'buzzer';
  const isLamp   = ch.key.startsWith('lamp');
  const activeColor     = isBuzzer ? AppColors.warning  : isLamp ? AppColors.primary : AppColors.success;
  const activeBgColor   = isBuzzer ? '#FFF4DB'          : isLamp ? AppColors.surfaceAccent : AppColors.surfaceSuccess;
  const activeBorderColor = isBuzzer ? '#F2D17A'        : isLamp ? '#F5D3C5' : '#9BD7B6';
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

function PressureSlider({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const pv = parsePressure(value);
  const tone = getPressureTone(pv);
  const palette = getSignalPalette(tone);
  return (
    <View style={stationStyles.fieldBlock}>
      <View style={stationStyles.fieldHeaderRow}>
        <Text style={stationStyles.fieldLabel}>{label}</Text>
        <View style={[stationStyles.signalValueChip, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={[stationStyles.signalValueDot, { backgroundColor: palette.accent }]} />
          <Text style={[stationStyles.signalValueText, { color: palette.text }]}>{formatPressure(pv)}</Text>
        </View>
      </View>
      <View style={[stationStyles.signalSliderShell, tone === 'normal' && stationStyles.signalSliderShellNormal, tone === 'warning' && stationStyles.signalSliderShellWarning, tone === 'danger' && stationStyles.signalSliderShellDanger]}>
        <Slider
          value={pv}
          minimumValue={PRESSURE_MIN_BAR}
          maximumValue={PRESSURE_SLIDER_MAX_BAR}
          step={0.1}
          minimumTrackTintColor={palette.accent}
          maximumTrackTintColor={palette.track}
          thumbTintColor={palette.accent}
          onValueChange={(v) => onChange(formatPressure(v))}
          style={stationStyles.pressureSlider}
        />
        <EngineeringSignalBands tone={tone} />
      </View>
      <View style={stationStyles.sliderRangeRow}>
        <Text style={stationStyles.sliderRangeText}>0 bar</Text>
        <View style={[stationStyles.signalStateBadge, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={[stationStyles.signalStateText, { color: palette.text }]}>
            {tone === 'danger' ? `≥ ${PRESSURE_DANGER_BAR} bar` : tone === 'warning' ? `≥ ${PRESSURE_WARNING_BAR} bar` : 'Normal'}
          </Text>
        </View>
        <Text style={stationStyles.sliderRangeText}>16 bar</Text>
      </View>
    </View>
  );
}

function Stepper({ label, value, unit, chipText, chipTone = 'default', onStep, minDisabled, maxDisabled = false }: {
  label: string; value: string; unit: string; chipText: string; chipTone?: StepperChipTone;
  onStep: (d: number) => void; minDisabled: boolean; maxDisabled?: boolean;
}) {
  const chip = getChipStyles(chipTone);
  return (
    <>
      <View style={stationStyles.dashboardControlHeader}>
        <Text style={stationStyles.fieldLabel}>{label}</Text>
        <View style={[stationStyles.dashboardValueChip, chip.container]}>
          <Text style={[stationStyles.dashboardValueChipText, chip.text]}>{chipText}</Text>
        </View>
      </View>
      <View style={stationStyles.dashboardStepperRow}>
        <TouchableOpacity style={[stationStyles.dashboardStepperButton, minDisabled && stationStyles.stepperButtonDisabled]} onPress={() => onStep(-1)} disabled={minDisabled}>
          <Feather name="minus" size={18} color={minDisabled ? AppColors.textSubtle : AppColors.text} />
        </TouchableOpacity>
        <View style={stationStyles.dashboardReadoutShell}>
          <Text style={stationStyles.dashboardReadoutValue}>{value}</Text>
          <Text style={stationStyles.dashboardReadoutUnit}>{unit}</Text>
        </View>
        <TouchableOpacity style={[stationStyles.dashboardStepperButton, maxDisabled && stationStyles.stepperButtonDisabled]} onPress={() => onStep(1)} disabled={maxDisabled}>
          <Feather name="plus" size={18} color={maxDisabled ? AppColors.textSubtle : AppColors.text} />
        </TouchableOpacity>
      </View>
    </>
  );
}

function PumpRunningToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={stationStyles.dashboardFieldBlock}>
      <View style={stationStyles.dashboardToggleRow}>
        <View>
          <Text style={stationStyles.fieldLabel}>Pump Running</Text>
          <Text style={stationStyles.dashboardToggleValue}>{value ? 'Running' : 'Stopped'}</Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={() => onChange(!value)}
          accessibilityRole="switch"
          accessibilityState={{ checked: value }}
          style={[
            stationStyles.alarmToggle,
            value ? stationStyles.alarmToggleActive : stationStyles.alarmToggleInactive,
            value && { backgroundColor: AppColors.surfaceSuccess, borderColor: '#9BD7B6' },
          ]}>
          <View style={[stationStyles.alarmToggleThumb, value ? stationStyles.alarmToggleThumbActive : stationStyles.alarmToggleThumbInactive]}>
            <Feather name={value ? 'activity' : 'power'} size={14} color={value ? AppColors.success : AppColors.textSubtle} />
          </View>
        </TouchableOpacity>
      </View>
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
  const { publishTopic, status } = useMqtt();
  const metricsTopic = useMqttTopic('gatewayMetrics');
  const metricsReceivedAt = metricsTopic.message?.receivedAt ?? null;
  const [confirmedWords, setConfirmedWords] = useState([0, 0]);
  const [draftWords, setDraftWords] = useState([0, 0]);
  const [lastCombinedWord, setLastCombinedWord] = useState(0);
  const [lastCommandError, setLastCommandError] = useState<string | null>(null);
  const [isPendingDo, setIsPendingDo] = useState(false);
  const doExpireTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doBaselineReceivedAtRef = useRef<number | null>(null);
  const diState = unpackChannels(confirmedWords, DI_BIT_MAP);
  const doState = unpackChannels(draftWords, DO_BIT_MAP);

  // ── Inject Value tab state ──
  const [form, setForm] = useState(DEFAULT_PUMP_ROOM_PLC_INPUTS);
  const [pumpRunning, setPumpRunning] = useState(false);
  const hasHydratedRef = useRef(false);
  const derivedAlarm = getDerivedAlarm(form, pumpRunning);

  // ── PLC: sync metrics → confirmed/draft words ──
  useEffect(() => {
    if (!metricsTopic.payload) return;
    const sig = getCarloGavazziMetricsSignalByName(
      metricsTopic.payload,
      CARLO_GAVAZZI_GATEWAY_CONFIG.fireFightingRoom.doWord.deviceId,
      'Adjustable value'
    );
    if (!sig || typeof sig.value !== 'number') return;
    const timer = setTimeout(() => {
      const rounded = Math.round(sig.value as number);
      const word0 = rounded & 0xffff;
      const word1 = (rounded >>> 16) & 0xffff;
      setConfirmedWords([word0, word1]);
      setDraftWords((cur) => [(cur[0] & 0xf000) | (word0 & 0x0fff), cur[1]]);
      setLastCombinedWord(rounded);
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
    const newWords = setChannelBit(draftWords, DO_BIT_MAP, key, !doState[key]);
    setDraftWords(newWords);
    if (status !== 'connected') { setLastCommandError('MQTT disconnected.'); return; }
    const combinedValue = newWords[1] * 65536 + newWords[0];
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
      buildCarloGavazziOtCommand(CARLO_GAVAZZI_GATEWAY_CONFIG.fireFightingRoom.doWord.deviceId, 'SetValue', combinedValue),
      { qos: 0, retain: false }
    ).then(() => { setLastCombinedWord(combinedValue); setLastCommandError(null); })
     .catch((err: unknown) => { setLastCommandError(err instanceof Error ? err.message : 'SetValue failed.'); });
  }, [draftWords, doState, metricsReceivedAt, publishTopic, status]);

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
      setForm(stored);
      hasHydratedRef.current = true;
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!hasHydratedRef.current) return;
    void setStoredPumpRoomPlcInputs(form);
  }, [form]);

  const updateField = (key: PumpRoomPlcInputKey, value: string) =>
    setForm((cur) => ({ ...cur, [key]: value }));

  const updateFlowStep = (delta: number) =>
    setForm((cur) => ({ ...cur, [FLOW_RATE_FIELD_KEY]: formatFlow(parseFlow(cur[FLOW_RATE_FIELD_KEY]) + delta) }));

  return (
    <SafeAreaView style={s.safeArea} edges={['top', 'left', 'right']}>
      <Header />
      <TabBar active={activeTab} onChange={setActiveTab} />

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

        {activeTab === 'plc' ? (
          <>
            <GatewayWordDisplay lastCombinedWord={lastCombinedWord} />

            {statusHint ? <Text style={s.statusHint}>{statusHint}</Text> : null}

            {/* DI */}
            <View style={s.sectionBlock}>
              <View style={s.sectionHeader}>
                <View style={s.sectionLabelRow}>
                  <View style={[s.sectionDot, { backgroundColor: AppColors.info }]} />
                  <Text style={s.sectionTitle}>Digital Input</Text>
                </View>
                <Text style={s.sectionBadge}>Read Only</Text>
              </View>
              <View style={s.ioCard}>
                {DI_CHANNELS.map((ch, i) => (
                  <View key={ch.key} style={[s.diRowWrap, i < DI_CHANNELS.length - 1 && s.rowDivider]}>
                    <DiStatusRow ch={ch} value={diState[ch.key]} />
                  </View>
                ))}
              </View>
            </View>

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
            {/* Sensor calibration */}
            <View style={stationStyles.sectionCard}>
              {PUMP_ROOM_PLC_FIELDS.map((field) => {
                if (field.key === FLOW_RATE_FIELD_KEY) {
                  const fv = parseFlow(form[field.key]);
                  return (
                    <View key={field.key} style={stationStyles.fieldBlock}>
                      <View style={stationStyles.dashboardControlCard}>
                        <Stepper
                          label={field.label}
                          value={String(fv)}
                          unit="m3/h"
                          chipText={`${fv} m3/h`}
                          chipTone={fv > 0 ? 'stable' : 'default'}
                          onStep={(d) => updateFlowStep(d * FLOW_RATE_STEP_M3H)}
                          minDisabled={fv <= FLOW_RATE_MIN_M3H}
                        />
                      </View>
                    </View>
                  );
                }
                return (
                  <PressureSlider
                    key={field.key}
                    label={field.label}
                    value={form[field.key]}
                    onChange={(v) => updateField(field.key, v)}
                  />
                );
              })}
            </View>

            {/* Pump status + derived alarm */}
            <View style={stationStyles.summaryCard}>
              <PumpRunningToggle value={pumpRunning} onChange={setPumpRunning} />
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

  ioCard: {
    backgroundColor: AppColors.surface,
    borderRadius: AppRadii.xl,
    borderWidth: 1,
    borderColor: AppColors.border,
    overflow: 'hidden',
  },
  diRowWrap: { paddingHorizontal: AppSpacing.md, paddingVertical: 12 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: AppColors.border },
  diRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: AppSpacing.sm },
  diLeft: { flexDirection: 'row', alignItems: 'center', gap: AppSpacing.sm, flex: 1, minWidth: 0 },
  diDot: { width: 10, height: 10, borderRadius: AppRadii.full, flexShrink: 0 },
  diTextBlock: { flex: 1, minWidth: 0 },
  diLabel: { fontSize: 13, fontWeight: '700', color: AppColors.text },
  diMeta: { fontSize: 11, fontWeight: '600', color: AppColors.textSubtle, marginTop: 1 },
  diValueChip: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: AppRadii.full,
    backgroundColor: AppColors.surfaceMuted, borderWidth: 1, borderColor: AppColors.border,
    minWidth: 56, alignItems: 'center',
  },
  diChipActive: { backgroundColor: AppColors.surfaceSuccess, borderColor: '#9BD7B6' },
  diChipDanger: { backgroundColor: AppColors.surfaceError, borderColor: '#F4B7B7' },
  diValueText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },

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

  bottomSpacer: { height: 96 },
});
