import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  type BitChannelMap,
  setChannelBit,
  unpackChannels,
  WORD_BIT_LENGTH,
} from '@/lib/bit-packed-word';
import {
  buildCarloGavazziForceCommand,
  CARLO_GAVAZZI_GATEWAY_CONFIG,
  type CarloGavazziForceCommandName,
} from '@/lib/mqtt-topics';
import { useMqtt } from '@/providers/mqtt-provider';
import { AppColors, AppRadii, AppSpacing, layoutPrimitives, surfacePrimitives, textPrimitives } from '@/styles';
import { StyleSheet } from 'react-native';

// ─── IO definitions ─────────────────────────────────────────────────────────
//
// The PLC (S7-1200) does not expose these 12 DI + 12 DO as 24 separate Modbus
// registers. Every channel here is a single boolean, so the PLC bit-packs
// them into 16-bit words (uint16) before the Carlo Gavazzi UWP-4.0 gateway
// forwards plain decimal numbers over MQTT. This screen unpacks those
// decimals back into individual channel bits for display.
//
// 24 channels do not fit in one 16-bit word (max 16 flags per word), so two
// words are used. Channels are packed sequentially across both words in
// declaration order — DI first, then DO — NOT one word per DI/DO group:
//   global bit 0-11  -> DI channels 1-12   -> word0 bit 0-11
//   global bit 12-15 -> DO channels 1-4    -> word0 bit 12-15
//   global bit 16-23 -> DO channels 5-12   -> word1 bit 0-7
// A word value is a plain bitmask, e.g. DI channel 1 + DI channel 2 both
// active at once is bit0=1, bit1=1 -> word0 = 0b11 = 3 (not two separate
// scenarios to enumerate — every combination is just the sum of active bits).
//
// Bit position per channel (wordIndex/bitIndex below) is a PLACEHOLDER —
// engineering has not confirmed the final PLC bit layout yet. Update
// DI_BIT_MAP / DO_BIT_MAP once that mapping is confirmed; nothing else in
// this file needs to change.

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

// PLACEHOLDER mapping — replace with the confirmed PLC bit layout when
// available. Channels are packed sequentially (DI 1-12, then DO 1-12) across
// as many words as needed, wrapping into the next word past bit 15.
function getSequentialWordPosition(globalIndex: number) {
  return {
    wordIndex: Math.floor(globalIndex / WORD_BIT_LENGTH),
    bitIndex: globalIndex % WORD_BIT_LENGTH,
  };
}

const DI_BIT_MAP: BitChannelMap<DiKey> = DI_CHANNELS.reduce((map, ch, index) => {
  map[ch.key] = getSequentialWordPosition(index);
  return map;
}, {} as BitChannelMap<DiKey>);

const DO_BIT_MAP: BitChannelMap<DoKey> = DO_CHANNELS.reduce((map, ch, index) => {
  map[ch.key] = getSequentialWordPosition(DI_CHANNELS.length + index);
  return map;
}, {} as BitChannelMap<DoKey>);

// Command/response round-trip guard, matching Accommodation Room's
// ALARM_WRITE_GUARD_MS: how long we wait for gatewayMetrics to confirm a
// Force command before giving up and reverting the draft DO word.
const FORCE_WRITE_TIMEOUT_MS = 5_000;

type PendingForceCommand = {
  cmd: CarloGavazziForceCommandName;
  wordValue: number;
  sentAt: number;
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
        24 DI/DO channels are bit-packed by the PLC across two Modbus words before the CG
        UWP-4.0 gateway forwards them as decimals over MQTT. DI is read-only; DO is force-controlled.
      </Text>
    </View>
  );
}

// Card 1: Force ON/OFF command sent to the gateway to override UWP automation.
// Card 2: last raw decimal word(s) received from PLC → gateway → MQTT (pre-unpack).
function GatewayControlRow({
  isForceOn,
  isDisabled,
  onForcePress,
  lastWords,
}: {
  isForceOn: boolean;
  isDisabled: boolean;
  onForcePress: (nextForceOn: boolean) => void;
  lastWords: number[];
}) {
  return (
    <View style={s.ioCountRow}>
      <View style={[s.ioCountCard, isForceOn && s.ioCountCardForceActive]}>
        <Text style={s.ioCountLabel}>Force Control</Text>
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={isDisabled}
          onPress={() => onForcePress(!isForceOn)}
          style={[
            s.forceToggleBtn,
            isForceOn && s.forceToggleBtnActive,
            isDisabled && s.forceToggleBtnDisabled,
          ]}
          accessibilityRole="switch"
          accessibilityState={{ checked: isForceOn, disabled: isDisabled }}
          accessibilityLabel="Force ON/OFF">
          <Text style={[s.forceToggleBtnText, isForceOn && s.forceToggleBtnTextActive]}>
            {isForceOn ? 'FORCE ON' : 'FORCE OFF'}
          </Text>
        </TouchableOpacity>
        <Text style={s.ioCountSub}>Sends the whole DO word below</Text>
      </View>
      <View style={[s.ioCountCard, s.ioCountCardDo]}>
        <Text style={[s.ioCountValue, s.ioCountValueDo]}>{lastWords.join(' / ')}</Text>
        <Text style={s.ioCountLabel}>Last Word Values</Text>
        <Text style={s.ioCountSub}>Raw decimals from gateway (word0 / word1)</Text>
      </View>
    </View>
  );
}

// DI status indicator — read-only, unpacked from the unified word
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

// DO control toggle — edits the local draft word (per-channel bit), does not
// publish by itself. Publishing the resulting word happens via Force ON/OFF.
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

export default function FireFightingRoom() {
  const { publishTopic, status } = useMqtt();

  // `confirmedWords` mirrors Accommodation Room's confirmedForm: it only
  // changes once the gateway echoes back a matching word via gatewayMetrics.
  // `draftWords` mirrors draftForm: it changes immediately on user input for
  // a responsive UI, and is what DI/DO rows render from while pending.
  const [confirmedWords, setConfirmedWords] = useState<number[]>([0, 0]);
  const [draftWords, setDraftWords] = useState<number[]>([0, 0]);
  const [pendingForceCommand, setPendingForceCommand] = useState<PendingForceCommand | null>(null);
  const [lastCommandError, setLastCommandError] = useState<string | null>(null);

  const diState = unpackChannels(draftWords, DI_BIT_MAP);
  const doState = unpackChannels(draftWords, DO_BIT_MAP);
  const isForceOn = pendingForceCommand?.cmd === 'ForceOn';
  const isPending = pendingForceCommand !== null;

  // Same pattern as Accommodation Room's connection-loss effect: once the
  // broker disconnects, a pending command can never be confirmed, so drop it
  // immediately rather than leaving the UI stuck on "Sending" — but leave
  // draftWords untouched, since the user is still allowed to play with the
  // switches locally while offline (they only get published on reconnect).
  useEffect(() => {
    if (status === 'connected') {
      return;
    }

    setPendingForceCommand(null);
  }, [status]);

  // Timeout-revert: if the broker is connected but no gatewayMetrics echo
  // confirms the sent word within FORCE_WRITE_TIMEOUT_MS, treat the command
  // as lost — revert the draft word back to the last confirmed value.
  useEffect(() => {
    if (!pendingForceCommand) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setPendingForceCommand((current) => {
        if (!current || current.sentAt !== pendingForceCommand.sentAt) {
          return current;
        }

        setDraftWords(confirmedWords);
        setLastCommandError('No response from gateway. Force command timed out and was reverted.');
        return null;
      });
    }, FORCE_WRITE_TIMEOUT_MS);

    return () => clearTimeout(timeoutId);
  }, [confirmedWords, pendingForceCommand]);

  const toggleDo = useCallback(
    (key: DoKey) => {
      setDraftWords((current) => setChannelBit(current, DO_BIT_MAP, key, !doState[key]));
    },
    [doState]
  );

  const handleForcePress = useCallback(
    async (nextForceOn: boolean) => {
      if (status !== 'connected') {
        setLastCommandError('MQTT disconnected. Switches stay local until the broker reconnects.');
        return;
      }

      const cmd: CarloGavazziForceCommandName = nextForceOn ? 'ForceOn' : 'ForceOff';
      // PLACEHOLDER: which word carries the DO bits (word0 vs word1) depends
      // on the confirmed PLC bit layout — see DO_BIT_MAP above.
      const wordValue = draftWords[0] ?? 0;

      try {
        await publishTopic(
          'gatewayOtCommand',
          buildCarloGavazziForceCommand(
            CARLO_GAVAZZI_GATEWAY_CONFIG.fireFightingRoom.doWord.deviceId,
            cmd,
            wordValue
          )
        );

        setPendingForceCommand({ cmd, wordValue, sentAt: Date.now() });
        setLastCommandError(null);
      } catch (error) {
        setLastCommandError(error instanceof Error ? error.message : `Unable to send ${cmd}.`);
      }
    },
    [draftWords, publishTopic, status]
  );

  // In production, a gatewayMetrics message carrying the DO word would land
  // here (mirroring Accommodation Room's ack effect) and call this to
  // confirm the pending command: setConfirmedWords(nextWords);
  // setPendingForceCommand(null). Left as a placeholder until the fire
  // fighting room's gateway topic/device ID is available.

  const forceHint = useMemo(() => {
    if (lastCommandError) {
      return lastCommandError;
    }

    if (isPending) {
      return `${pendingForceCommand!.cmd} sent (word ${pendingForceCommand!.wordValue}). Waiting for gateway confirmation.`;
    }

    if (status !== 'connected') {
      return 'MQTT disconnected. Toggle switches freely — they only publish once reconnected.';
    }

    return 'Toggle DO switches below, then press Force ON to write the resulting word to the gateway.';
  }, [isPending, lastCommandError, pendingForceCommand, status]);

  return (
    <SafeAreaView style={s.safeArea} edges={['top', 'left', 'right']}>
      <FireFightingRoomHeader />

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        <FireFightingRoomHero isPending={isPending} />
        <GatewayControlRow
          isForceOn={isForceOn}
          isDisabled={isPending}
          onForcePress={(next) => void handleForcePress(next)}
          lastWords={confirmedWords}
        />
        <Text style={s.forceHint}>{forceHint}</Text>

        {/* ── DI: Digital Input (read from PLC, unpacked from word) ── */}
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
            Unpacked from the last word received via MQTT. Bit mapping is a placeholder pending
            confirmation from engineering.
          </Text>
        </View>

        {/* ── DO: Digital Output (write to PLC via Force ON/OFF) ── */}
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
            Toggling a switch only edits the local word. Press Force ON above to write it to the
            gateway; it overrides the UWP function's Running automation for this word.
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

  // Gateway control row (Force + last word value)
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
