import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BG_COLOR = '#F6F5F2';
const CARD_BG = '#FFFFFF';
const DARK = '#1A1C1A';
const GREEN = '#10B981';
const ORANGE = '#FF6B35';

const STATUS_CARDS = [
  {
    title: 'Battery Health',
    value: 'Good',
    detail: '92% capacity retained',
    iconFamily: 'feather',
    iconName: 'battery-charging',
    accent: GREEN,
  },
  {
    title: 'Motor Output',
    value: 'Normal',
    detail: 'No active warnings',
    iconFamily: 'material',
    iconName: 'speedometer',
    accent: ORANGE,
  },
  {
    title: 'Connectivity',
    value: 'Online',
    detail: 'Stable Bluetooth link',
    iconFamily: 'feather',
    iconName: 'wifi',
    accent: '#3B82F6',
  },
] as const;

export default function StatusScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>System Status</Text>
          <View style={styles.headerBadge}>
            <Feather name="activity" size={16} color={GREEN} />
            <Text style={styles.headerBadgeText}>Live</Text>
          </View>
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>Vehicle overview</Text>
          <Text style={styles.heroValue}>Everything looks stable</Text>
          <Text style={styles.heroDetail}>
            Last sync completed 2 minutes ago and no urgent issues were detected.
          </Text>
        </View>

        <View style={styles.grid}>
          {STATUS_CARDS.map((card) => {
            return (
              <View key={card.title} style={styles.card}>
                <View style={[styles.iconWrap, { backgroundColor: `${card.accent}18` }]}>
                  {card.iconFamily === 'feather' ? (
                    <Feather name={card.iconName as any} size={18} color={card.accent} />
                  ) : (
                    <MaterialCommunityIcons name={card.iconName as any} size={18} color={card.accent} />
                  )}
                </View>
                <Text style={styles.cardTitle}>{card.title}</Text>
                <Text style={styles.cardValue}>{card.value}</Text>
                <Text style={styles.cardDetail}>{card.detail}</Text>
              </View>
            );
          })}
        </View>

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
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: DARK,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: CARD_BG,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  headerBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: DARK,
  },
  heroCard: {
    backgroundColor: DARK,
    borderRadius: 28,
    padding: 22,
    marginBottom: 18,
  },
  heroLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#A7B0A7',
    marginBottom: 10,
  },
  heroValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 8,
  },
  heroDetail: {
    fontSize: 14,
    lineHeight: 20,
    color: '#D4D7D4',
  },
  grid: {
    gap: 12,
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 24,
    padding: 18,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 13,
    color: '#6B706B',
    fontWeight: '600',
    marginBottom: 6,
  },
  cardValue: {
    fontSize: 22,
    fontWeight: '700',
    color: DARK,
    marginBottom: 6,
  },
  cardDetail: {
    fontSize: 14,
    lineHeight: 20,
    color: '#5D635D',
  },
  bottomSpacer: {
    height: 100,
  },
});
