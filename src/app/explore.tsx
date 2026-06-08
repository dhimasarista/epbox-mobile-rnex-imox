import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BG_COLOR = '#F6F5F2';
const CARD_BG = '#FFFFFF';
const ORANGE = '#FF6B35';
const GREEN = '#10B981';
const DARK = '#1A1C1A';

const ROOMS = [
  {
    id: 'pump-room',
    title: 'Fire Pump Room',
    vessel: 'MV Sentinel Aurora',
    deck: 'Lower Deck',
    status: 'Ready for demo input',
    metric: '28 C',
    metricLabel: 'Room Temp',
    icon: 'fire-hydrant',
  },
  {
    id: 'foam-station',
    title: 'Foam Pump Station',
    vessel: 'MV Sentinel Aurora',
    deck: 'Safety Deck',
    status: 'Manual review pending',
    metric: '2.9 bar',
    metricLabel: 'Line Pressure',
    icon: 'fire-circle',
  },
  {
    id: 'sprinkler-room',
    title: 'Sprinkler Valve Room',
    vessel: 'MV Sentinel Aurora',
    deck: 'Main Deck',
    status: 'Normal standby',
    metric: '67 %',
    metricLabel: 'Humidity',
    icon: 'valve',
  },
] as const;

export default function ExploreScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.pageTitle}>Explore</Text>
            <Text style={styles.pageSubtitle}>oke gas</Text>
          </View>
          <View style={styles.headerBadge}>
            <Feather name="sliders" size={18} color={DARK} />
          </View>
        </View>

        <View style={styles.searchBar}>
          <Feather name="search" size={18} color="#7B7F7B" />
          <TextInput
            placeholder="Search room, deck, or vessel"
            placeholderTextColor="#9AA09A"
            style={styles.searchInput}
          />
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroBadge}>
            <MaterialCommunityIcons name="shield-check-outline" size={16} color={GREEN} />
            <Text style={styles.heroBadgeText}>Fire Safety Demo</Text>
          </View>
          <Text style={styles.heroTitle}>Room Selection</Text>
          <Text style={styles.heroText}>
            Use this page to open a room profile, then enter fake operational values for presentation,
            training, or UI demonstration.
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Active Rooms</Text>
            <Text style={styles.summaryValue}>03</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Demo Source</Text>
            <Text style={styles.summaryValue}>Manual</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Monitored Spaces</Text>
          <Text style={styles.sectionAction}>View all</Text>
        </View>

        {ROOMS.map((room) => (
          <TouchableOpacity
            key={room.id}
            style={styles.roomCard}
            onPress={() => router.push('/station')}>
            <View style={styles.roomTopRow}>
              <View style={styles.roomIconWrap}>
                <MaterialCommunityIcons name={room.icon as any} size={20} color={ORANGE} />
              </View>
              <View style={styles.metricChip}>
                <Text style={styles.metricValue}>{room.metric}</Text>
                <Text style={styles.metricLabel}>{room.metricLabel}</Text>
              </View>
            </View>

            <Text style={styles.roomTitle}>{room.title}</Text>
            <Text style={styles.roomSubtitle}>{room.vessel}</Text>

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Feather name="map-pin" size={13} color="#6B706B" />
                <Text style={styles.metaText}>{room.deck}</Text>
              </View>
              <View style={styles.metaItem}>
                <View style={styles.statusDot} />
                <Text style={styles.metaText}>{room.status}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BG_COLOR,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: DARK,
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 14,
    color: '#6B706B',
  },
  headerBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: CARD_BG,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 24,
    paddingHorizontal: 16,
    height: 52,
    gap: 10,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: DARK,
  },
  heroCard: {
    backgroundColor: DARK,
    borderRadius: 28,
    padding: 20,
    marginBottom: 16,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#EDF8F2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    gap: 6,
    marginBottom: 14,
  },
  heroBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: GREEN,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 8,
  },
  heroText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#D4D7D4',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 18,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderRadius: 24,
    padding: 16,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B706B',
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '800',
    color: DARK,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: DARK,
  },
  sectionAction: {
    fontSize: 13,
    fontWeight: '600',
    color: ORANGE,
  },
  roomCard: {
    backgroundColor: CARD_BG,
    borderRadius: 26,
    padding: 18,
    marginBottom: 14,
  },
  roomTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  roomIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEF0EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricChip: {
    alignItems: 'flex-end',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '800',
    color: DARK,
  },
  metricLabel: {
    fontSize: 12,
    color: '#6B706B',
    fontWeight: '600',
  },
  roomTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: DARK,
    marginBottom: 4,
  },
  roomSubtitle: {
    fontSize: 14,
    color: '#6B706B',
    marginBottom: 14,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B706B',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: GREEN,
  },
  bottomSpacer: {
    height: 100,
  },
});
