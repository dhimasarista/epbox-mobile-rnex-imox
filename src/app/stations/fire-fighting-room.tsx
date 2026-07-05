import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
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
import { useMqtt, useMqttTopic } from '@/providers/mqtt-provider';
import { AppColors, AppRadii, AppSpacing, layoutPrimitives, surfacePrimitives, textPrimitives } from '@/styles';

// ─── IO definitions ─────────────────────────────────────────────────────────
//
// PLC S7-1200 punya 12 DI + 12 DO. Keduanya dibaca dari sinyal "Adjustable value"
// device id 6563 dalam gatewayMetrics. Combined value 24-bit lintas dua uint16:
//
//   word[0] bit  0–11  → DI channel 1–12   (global bit  0–11)
//   word[0] bit 12–15  → DO channel 1–4    (global bit 12–15)
//   word[1] bit  0–7   → DO channel 5–12   (global bit 16–23)
//
// Read:  getCarloGavazziMetricsSignalByName(payload, 6563, 'Adjustable value')
//        → split ke [w0, w1] → unpack DI dan DO
// Write: SetValue(6563, w1 * 65536 + w0) dengan DO bits yang diupdate

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
  { key: 'solenoidValve1',    label: 'R1 – Solenoid Valve 1 Open', channel: 1,  slot: 1 },
  { key: 'solenoidValve2',    label: 'R2 – Solenoid Valve 2 Open', channel: 2,  slot: 1 },
  { key: 'r3PumpAStart',      label: 'R3 – Pump A Start',          channel: 3,  slot: 1 },
  { key: 'r4PumpBStart',      label: 'R4 – Pump B Start',          channel: 4,  slot: 1 },
  { key: 'r5PumpCStart',      label: 'R5 – Pump C Start',          channel: 5,  slot: 1 },
  { key: 'buzzer',            label: 'Buzzer',                      channel: 6,  slot: 1 },
  { key: 'lampZoneRelease',   label: 'Lamp – Zone Release',        channel: 7,  slot: 1 },
  { key: 'lampPumpARunning',  label: 'Lamp – Pump A Running',      channel: 8,  slot: 1 },
  { key: 'lampPumpAStoped',   label: 'Lamp – Pump A Stopped',      channel: 9,  slot: 1 },
  { key: 'lampPumpBRunning',  label: 'Lamp – Pump B Running',      channel: 10, slot: 1 },
  { key: 'lampPumpBStoped',   label: 'Lamp – Pump B Stopped',      channel: 1,  slot: 2 },
  { key: 'lampLocalRemote',   label: 'Lamp – Local / Remote',      channel: 2,  slot: 2 },
] as const;

type DiKey = (typeof DI_CHANNELS)[number]['key'];
type DoKey = (typeof DO_CHANNELS)[number]['key'];

// DI dan DO dikemas dalam satu word gabungan dari device 6563.
// Layout 24-bit sequential (DI dulu, lalu DO) lintas dua uint16 word:
//   word[0] bit  0–11 = DI channel 1–12   (global bit  0–11)
//   word[0] bit 12–15 = DO channel 1–4    (global bit 12–15)
//   word[1] bit  0–7  = DO channel 5–12   (global bit 16–23)
//   word[1] bit  8–15 = unused (selalu 0)
//
// Jika kapasitas 24 channel tidak cukup di masa depan, naikkan ke uint32
// dengan menambah word[2] tanpa mengubah interface setChannelBit/unpackChannels.

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


// ─── Sub-components ──────────────────────────────────────────────────────────

function FireFightingRoomHeader() {
  const router = useRouter();

  return (
    <View style={s.header}>
      <TouchableOpacity style={surfacePrimitives.iconButton} onPress={() => router.navigate('/explore')}>
        <Feather name="arrow-left" size={24} color={AppColors.text} />
      </TouchableOpacity>
      <Text style={s.headerLabel}>Fire Fighting Room</Text>
      <View style={s.headerGhost} />
    </View>
  );
}

function FireFightingRoomHero({ isPending }: { isPending: boolean }) {
  return (
    <View style={s.heroCard}>
      <View style={s.heroTopRow}>
        <View style={s.heroBadge}>
          <MaterialCommunityIcons name="electric-switch" size={14} color={AppColors.primary} />
          <Text style={s.heroBadgeText}>PLC S7-1200</Text>
        </View>
        <View style={s.liveChip}>
          <View style={[s.liveDot, { backgroundColor: isPending ? AppColors.warning : AppColors.success }]} />
          <Text style={s.liveChipText}>{isPending ? 'Sending' : 'Local'}</Text>
        </View>
      </View>
      <Text style={s.heroTitle}>Fire Fighting Room</Text>
      <Text style={s.heroSubtitle}>
        12 DI channels (read-only via "Input value") + 12 DO channels (writable via SetValue
        ke "Adjustable value"). Keduanya dari element 6563 (PLC - SIEMENS).
      </Text>
    </View>
  );
}

// Combined "Adjustable value" dari device 6563 — berisi DI (bit 0–11) dan DO (bit 12–23).
// Left: decimal combined, Right: binary split DI | DO.
function GatewayWordDisplay({ lastCombinedWord }: { lastCombinedWord: number }) {
  const diBits = (lastCombinedWord & 0x0fff).toString(2).padStart(12, '0');
  const doBits = ((lastCombinedWord >>> 12) & 0x0fff).toString(2).padStart(12, '0');
  return (
    <View style={s.ioCountRow}>
      <View style={[s.ioCountCard, s.ioCountCardDo]}>
        <Text style={[s.ioCountValue, s.ioCountValueDo]}>{lastCombinedWord}</Text>
        <Text style={s.ioCountLabel}>Adjustable Value</Text>
        <Text style={s.ioCountSub}>decimal — last received / sent</Text>
      </View>
      <View style={[s.ioCountCard, s.ioCountCardDo]}>
        <Text style={[s.ioCountValue, s.ioCountValueDo, s.ioCountValueBin]}>
          {diBits} {doBits}
        </Text>
        <Text style={s.ioCountLabel}>Bit Representation</Text>
        <Text style={s.ioCountSub}>DI (b11–b0) · DO (b23–b12)</Text>
      </View>
    </View>
  );
}

// DI status indicator — read-only, unpacked from diWord received via metrics
function DiStatusRow({
  ch,
  value,
}: {
  ch: (typeof DI_CHANNELS)[number];
  value: boolean;
}) {
  const isActive = value;
  const isEmergency = ch.key === 'emergencyStop';

  const dotColor = isEmergency && isActive
    ? AppColors.error
    : isActive
    ? AppColors.success
    : AppColors.border;

  const valueColor = isEmergency && isActive
    ? AppColors.error
    : isActive
    ? AppColors.success
    : AppColors.textSubtle;

  return (
    <View style={s.diRow}>
      <View style={s.diLeft}>
        <View style={[s.diDot, { backgroundColor: dotColor }]} />
        <View style={s.diTextBlock}>
          <Text style={s.diLabel} numberOfLines={1}>{ch.label}</Text>
          <Text style={s.diMeta}>Ch {ch.channel} · Slot {ch.slot} · {ch.contactType}</Text>
        </View>
      </View>
      <View style={[s.diValueChip, isActive && (isEmergency ? s.diChipDanger : s.diChipActive)]}>
        <Text style={[s.diValueText, { color: valueColor }]}>
          {isActive ? 'TRUE' : 'FALSE'}
        </Text>
      </View>
    </View>
  );
}

// DO control toggle — edits the local draft word per channel. Publishing
// happens separately via the SEND button in GatewayControlRow.
function DoControlRow({
  ch,
  value,
  onToggle,
}: {
  ch: (typeof DO_CHANNELS)[number];
  value: boolean;
  onToggle: () => void;
}) {
  const isLamp = ch.key.startsWith('lamp');
  const isBuzzer = ch.key === 'buzzer';

  const activeColor = isBuzzer
    ? AppColors.warning
    : isLamp
    ? AppColors.primary
    : AppColors.success;

  const activeBgColor = isBuzzer
    ? '#FFF4DB'
    : isLamp
    ? AppColors.surfaceAccent
    : AppColors.surfaceSuccess;

  const activeBorderColor = isBuzzer
    ? '#F2D17A'
    : isLamp
    ? '#F5D3C5'
    : '#9BD7B6';

  return (
    <View style={[s.doRow, value && { backgroundColor: activeBgColor, borderColor: activeBorderColor }]}>
      <View style={s.doLeft}>
        <View style={[s.doIndicator, { backgroundColor: value ? activeColor : AppColors.border }]} />
        <View style={s.diTextBlock}>
          <Text style={s.diLabel} numberOfLines={1}>{ch.label}</Text>
        </View>
      </View>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onToggle}
        style={[s.doToggleBtn, value && { backgroundColor: activeColor }]}
        accessibilityRole="switch"
        accessibilityState={{ checked: value }}
        accessibilityLabel={ch.label}>
        <Text style={[s.doToggleBtnText, value && s.doToggleBtnTextActive]}>
          {value ? 'ON' : 'OFF'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function FireFightingRoom() {
  const { publishTopic, status } = useMqtt();
  const metricsTopic = useMqttTopic('gatewayMetrics');
  const metricsReceivedAt = metricsTopic.message?.receivedAt ?? null;

  // "Adjustable value" device 6563 berisi DI+DO combined (24-bit lintas dua uint16).
  // confirmedWords: last confirmed dari gateway. draftWords: optimistic setelah toggle DO.
  const [confirmedWords, setConfirmedWords] = useState([0, 0]);
  const [draftWords, setDraftWords] = useState([0, 0]);
  const [lastCombinedWord, setLastCombinedWord] = useState(0);
  const [lastCommandError, setLastCommandError] = useState<string | null>(null);
  const [isPendingDo, setIsPendingDo] = useState(false);
  const doExpireTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doBaselineReceivedAtRef = useRef<number | null>(null);

  const diState = unpackChannels(confirmedWords, DI_BIT_MAP);
  const doState = unpackChannels(draftWords, DO_BIT_MAP);

  // Baca "Adjustable value" dari device 6563 → split ke dua uint16 word.
  // DI bits (0–11) di-sync dari gateway. DO bits di draftWords dipertahankan
  // agar tidak di-reset oleh metrics yang datang sebelum SetValue dikonfirmasi.
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
      setDraftWords((cur) => [
        (cur[0] & 0xf000) | (word0 & 0x0fff), // DO Ch1–4 dari draft, DI dari gateway
        cur[1],                                 // DO Ch5–12 dari draft
      ]);
      setLastCombinedWord(rounded);
    }, 0);

    return () => clearTimeout(timer);
  }, [metricsReceivedAt, metricsTopic.payload]);

  // Clear pending indicator when gateway echoes back after a toggle (metricsReceivedAt changed).
  useEffect(() => {
    if (!isPendingDo || metricsReceivedAt === null) return;
    if (doBaselineReceivedAtRef.current !== null && metricsReceivedAt <= doBaselineReceivedAtRef.current) return;

    if (doExpireTimeoutRef.current !== null) {
      clearTimeout(doExpireTimeoutRef.current);
      doExpireTimeoutRef.current = null;
    }
    doBaselineReceivedAtRef.current = null;
    setIsPendingDo(false);
  }, [isPendingDo, metricsReceivedAt]);

  // Toggle DO → SetValue(6563, combined) langsung. Combined = w1 * 65536 + w0.
  const toggleDo = useCallback(
    (key: DoKey) => {
      const newWords = setChannelBit(draftWords, DO_BIT_MAP, key, !doState[key]);
      setDraftWords(newWords);

      if (status !== 'connected') {
        setLastCommandError('MQTT disconnected — toggle tersimpan lokal.');
        return;
      }

      const combinedValue = newWords[1] * 65536 + newWords[0];

      doBaselineReceivedAtRef.current = metricsReceivedAt;
      setIsPendingDo(true);

      if (doExpireTimeoutRef.current !== null) {
        clearTimeout(doExpireTimeoutRef.current);
      }
      doExpireTimeoutRef.current = setTimeout(() => {
        doExpireTimeoutRef.current = null;
        doBaselineReceivedAtRef.current = null;
        setIsPendingDo(false);
        setLastCommandError(null);
      }, 5_000);

      void publishTopic(
        'gatewayOtCommand',
        buildCarloGavazziOtCommand(
          CARLO_GAVAZZI_GATEWAY_CONFIG.fireFightingRoom.doWord.deviceId,
          'SetValue',
          combinedValue
        ),
        { qos: 0, retain: false }
      ).then(() => {
        setLastCombinedWord(combinedValue);
        setLastCommandError(null);
      }).catch((error: unknown) => {
        setLastCommandError(error instanceof Error ? error.message : 'SetValue failed.');
      });
    },
    [draftWords, doState, metricsReceivedAt, publishTopic, status]
  );

  const forceHint = useMemo(() => {
    if (lastCommandError) return lastCommandError;
    if (isPendingDo) return 'SetValue sent — waiting for gateway metrics to confirm. Clears in 5s if no response.';
    if (status !== 'connected') return 'MQTT disconnected. Toggle switches bebas — publish saat reconnect.';
    return `Toggle DO switch → SetValue (id ${CARLO_GAVAZZI_GATEWAY_CONFIG.fireFightingRoom.doWord.deviceId}, QoS 0). Baca dari "Adjustable value" signal device 6563.`;
  }, [isPendingDo, lastCommandError, status]);

  return (
    <SafeAreaView style={s.safeArea} edges={['top', 'left', 'right']}>
      <FireFightingRoomHeader />

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        <FireFightingRoomHero isPending={false} />
        <GatewayWordDisplay lastCombinedWord={lastCombinedWord} />
        <Text style={s.forceHint}>{forceHint}</Text>

        {/* ── DI: Digital Input (read-only, unpacked from diWord via metrics) ── */}
        <View style={s.sectionBlock}>
          <View style={s.sectionHeader}>
            <View style={s.sectionLabelRow}>
              <View style={[s.sectionDot, { backgroundColor: AppColors.info }]} />
              <Text style={s.sectionTitle}>Digital Input</Text>
            </View>
            <Text style={s.sectionBadge}>Read Only</Text>
          </View>

          <View style={s.ioCard}>
            {DI_CHANNELS.map((ch, index) => (
              <View
                key={ch.key}
                style={[
                  s.diRowWrap,
                  index < DI_CHANNELS.length - 1 && s.rowDivider,
                ]}>
                <DiStatusRow ch={ch} value={diState[ch.key]} />
              </View>
            ))}
          </View>

          <Text style={s.sectionHint}>
            Unpacked from the DI word received via MQTT. DI element ID is pending engineering
            confirmation — all channels show FALSE until wired up.
          </Text>
        </View>

        {/* ── DO: Digital Output (write to PLC via SetValue, element 6563) ── */}
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
              <DoControlRow
                key={ch.key}
                ch={ch}
                value={doState[ch.key]}
                onToggle={() => toggleDo(ch.key)}
              />
            ))}
          </View>

          <Text style={s.sectionHint}>
            Toggling a switch only edits the local draft word. Press SEND above to write it to
            the gateway via SetValue (id {CARLO_GAVAZZI_GATEWAY_CONFIG.fireFightingRoom.doWord.deviceId}, QoS 0).
          </Text>
        </View>

        <View style={s.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

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
  headerLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: AppColors.text,
  },
  headerGhost: {
    width: 40,
    height: 40,
  },

  scrollContent: {
    padding: AppSpacing.screen,
    paddingBottom: AppSpacing.bottom,
    gap: AppSpacing.xxl,
  },

  // Hero
  heroCard: {
    backgroundColor: AppColors.text,
    borderRadius: AppRadii.hero,
    padding: AppSpacing.screen,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: AppSpacing.md,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.surfaceAccent,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: AppRadii.full,
    gap: AppSpacing.xs,
  },
  heroBadgeText: {
    ...textPrimitives.captionStrong,
    color: AppColors.primary,
  },
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.xs,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: AppRadii.full,
    backgroundColor: AppColors.success,
  },
  liveChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D5D9D5',
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: AppColors.textInverse,
    marginBottom: AppSpacing.xs,
  },
  heroSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: AppColors.textInverseSubtle,
  },

  // Gateway control row (SetValue + confirmed word)
  ioCountRow: {
    flexDirection: 'row',
    gap: AppSpacing.md,
  },
  ioCountCard: {
    flex: 1,
    backgroundColor: AppColors.surfaceSuccess,
    borderRadius: AppRadii.xl,
    borderWidth: 1,
    borderColor: '#9BD7B6',
    paddingVertical: AppSpacing.lg,
    paddingHorizontal: AppSpacing.md,
    alignItems: 'center',
    gap: 6,
  },
  ioCountCardForceActive: {
    backgroundColor: AppColors.surfaceError,
    borderColor: '#F4B7B7',
  },
  ioCountCardDo: {
    backgroundColor: AppColors.surfaceAccent,
    borderColor: '#F5D3C5',
  },
  ioCountValue: {
    fontSize: 28,
    fontWeight: '900',
    color: AppColors.success,
  },
  ioCountValueDo: {
    color: AppColors.primary,
  },
  ioCountValueBin: {
    fontSize: 18,
    letterSpacing: 1.5,
    fontVariant: ['tabular-nums'],
  },
  ioCountLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.text,
  },
  ioCountSub: {
    fontSize: 11,
    fontWeight: '600',
    color: AppColors.textSubtle,
  },
  forceToggleBtn: {
    minWidth: 120,
    height: 36,
    borderRadius: AppRadii.full,
    backgroundColor: AppColors.surfaceMuted,
    borderWidth: 1,
    borderColor: AppColors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: AppSpacing.md,
  },
  forceToggleBtnActive: {
    backgroundColor: AppColors.error,
    borderColor: AppColors.error,
  },
  forceToggleBtnDisabled: {
    opacity: 0.6,
  },
  forceToggleBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: AppColors.textSubtle,
    letterSpacing: 0.5,
  },
  forceToggleBtnTextActive: {
    color: AppColors.textInverse,
  },
  forceHint: {
    fontSize: 11,
    lineHeight: 16,
    color: AppColors.textSubtle,
    textAlign: 'center',
    paddingHorizontal: AppSpacing.md,
  },

  // Section
  sectionBlock: {
    gap: AppSpacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.sm,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: AppRadii.full,
  },
  sectionTitle: {
    ...textPrimitives.label,
    fontSize: 14,
  },
  sectionBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: AppColors.info,
    backgroundColor: '#EFF6FF',
    borderRadius: AppRadii.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    overflow: 'hidden',
  },
  sectionBadgeDo: {
    color: AppColors.primary,
    backgroundColor: AppColors.surfaceAccent,
    borderColor: '#F5D3C5',
  },
  sectionHint: {
    fontSize: 11,
    lineHeight: 16,
    color: AppColors.textSubtle,
    textAlign: 'center',
    paddingHorizontal: AppSpacing.md,
  },

  // DI table
  ioCard: {
    backgroundColor: AppColors.surface,
    borderRadius: AppRadii.xl,
    borderWidth: 1,
    borderColor: AppColors.border,
    overflow: 'hidden',
  },
  diRowWrap: {
    paddingHorizontal: AppSpacing.md,
    paddingVertical: 12,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border,
  },
  diRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: AppSpacing.sm,
  },
  diLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.sm,
    flex: 1,
    minWidth: 0,
  },
  diDot: {
    width: 10,
    height: 10,
    borderRadius: AppRadii.full,
    flexShrink: 0,
  },
  diTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  diLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.text,
  },
  diMeta: {
    fontSize: 11,
    fontWeight: '600',
    color: AppColors.textSubtle,
    marginTop: 1,
  },
  diValueChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: AppRadii.full,
    backgroundColor: AppColors.surfaceMuted,
    borderWidth: 1,
    borderColor: AppColors.border,
    minWidth: 56,
    alignItems: 'center',
  },
  diChipActive: {
    backgroundColor: AppColors.surfaceSuccess,
    borderColor: '#9BD7B6',
  },
  diChipDanger: {
    backgroundColor: AppColors.surfaceError,
    borderColor: '#F4B7B7',
  },
  diValueText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // DO controls
  doStack: {
    gap: AppSpacing.sm,
  },
  doRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: AppSpacing.md,
    backgroundColor: AppColors.surface,
    borderRadius: AppRadii.lg,
    borderWidth: 1,
    borderColor: AppColors.border,
    paddingHorizontal: AppSpacing.md,
    paddingVertical: AppSpacing.md,
  },
  doLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.sm,
    flex: 1,
    minWidth: 0,
  },
  doIndicator: {
    width: 10,
    height: 10,
    borderRadius: AppRadii.full,
    flexShrink: 0,
  },
  doToggleBtn: {
    minWidth: 56,
    height: 36,
    borderRadius: AppRadii.full,
    backgroundColor: AppColors.surfaceMuted,
    borderWidth: 1,
    borderColor: AppColors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: AppSpacing.md,
  },
  doToggleBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: AppColors.textSubtle,
    letterSpacing: 0.5,
  },
  doToggleBtnTextActive: {
    color: AppColors.textInverse,
  },

  bottomSpacer: { height: 96 },
});
