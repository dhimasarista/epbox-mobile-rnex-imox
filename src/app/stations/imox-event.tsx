import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppColors, AppRadii, AppSpacing, layoutPrimitives, surfacePrimitives, textPrimitives } from '@/styles';
import { StyleSheet } from 'react-native';

// ─── IO definitions ─────────────────────────────────────────────────────────

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
type DiState = Record<DiKey, boolean>;
type DoState = Record<DoKey, boolean>;

function makeDefaultState<T extends { key: string }>(channels: readonly T[]): Record<string, boolean> {
  return Object.fromEntries(channels.map((ch) => [ch.key, false])) as Record<string, boolean>;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ImoxEventHeader() {
  const router = useRouter();

  return (
    <View style={s.header}>
      <TouchableOpacity style={surfacePrimitives.iconButton} onPress={() => router.navigate('/explore')}>
        <Feather name="arrow-left" size={24} color={AppColors.text} />
      </TouchableOpacity>
      <Text style={s.headerLabel}>IMOX Event</Text>
      <View style={s.headerGhost} />
    </View>
  );
}

function ImoxEventHero() {
  return (
    <View style={s.heroCard}>
      <View style={s.heroTopRow}>
        <View style={s.heroBadge}>
          <MaterialCommunityIcons name="electric-switch" size={14} color={AppColors.primary} />
          <Text style={s.heroBadgeText}>PLC S7-1200</Text>
        </View>
        <View style={s.liveChip}>
          <View style={s.liveDot} />
          <Text style={s.liveChipText}>Local</Text>
        </View>
      </View>
      <Text style={s.heroTitle}>IMOX Event Station</Text>
      <Text style={s.heroSubtitle}>
        DI channels are read-only sensor inputs from the PLC. DO channels send boolean commands to the gateway.
      </Text>
    </View>
  );
}

function IoCountRow() {
  return (
    <View style={s.ioCountRow}>
      <View style={s.ioCountCard}>
        <Text style={s.ioCountValue}>12</Text>
        <Text style={s.ioCountLabel}>Digital Input</Text>
        <Text style={s.ioCountSub}>Read-only</Text>
      </View>
      <View style={[s.ioCountCard, s.ioCountCardDo]}>
        <Text style={[s.ioCountValue, s.ioCountValueDo]}>12</Text>
        <Text style={s.ioCountLabel}>Digital Output</Text>
        <Text style={s.ioCountSub}>Controllable</Text>
      </View>
    </View>
  );
}

// DI status indicator — read-only, shows current boolean value
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

// DO control toggle — sends boolean command
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
          <Text style={s.diMeta}>Ch {ch.channel} · Slot {ch.slot}</Text>
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

export default function ImoxEventStation() {
  const [diState, setDiState] = useState<DiState>(() => makeDefaultState(DI_CHANNELS) as DiState);
  const [doState, setDoState] = useState<DoState>(() => makeDefaultState(DO_CHANNELS) as DoState);

  const toggleDo = (key: DoKey) => {
    setDoState((current) => ({ ...current, [key]: !current[key] }));
  };

  // DI demo toggle — remove once wired to MQTT
  const toggleDi = (key: DiKey) => {
    setDiState((current) => ({ ...current, [key]: !current[key] }));
  };

  return (
    <SafeAreaView style={s.safeArea} edges={['top', 'left', 'right']}>
      <ImoxEventHeader />

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        <ImoxEventHero />
        <IoCountRow />

        {/* ── DI: Digital Input (read from PLC) ── */}
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
              <TouchableOpacity
                key={ch.key}
                activeOpacity={0.75}
                onPress={() => toggleDi(ch.key)}
                style={[
                  s.diRowWrap,
                  index < DI_CHANNELS.length - 1 && s.rowDivider,
                ]}>
                <DiStatusRow ch={ch} value={diState[ch.key]} />
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.sectionHint}>
            Tap a row to simulate DI value. In production these update from the PLC via MQTT.
          </Text>
        </View>

        {/* ── DO: Digital Output (write to PLC) ── */}
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
            Toggle sends a boolean command to the CG gateway via the OT command topic.
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

  // IO count
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
    gap: 2,
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
