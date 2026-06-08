import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BG_COLOR = '#F6F5F2';
const CARD_BG = '#FFFFFF';
const ORANGE = '#FF6B35';
const GREEN = '#10B981';
const DARK = '#1A1C1A';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <View style={styles.titleRow}>
              <Text style={styles.appTitle}>Eloop Pulse</Text>
              <Feather name="chevron-down" size={20} color={DARK} />
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.subtitle}>X1 Pro</Text>
              <View style={styles.dot} />
              <Text style={styles.statusText}>Connected</Text>
            </View>
          </View>
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconBtn}>
              <Ionicons name="notifications-outline" size={22} color={DARK} />
              <View style={styles.notificationDot} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn}>
              <MaterialCommunityIcons name="line-scan" size={22} color={DARK} />
            </TouchableOpacity>
          </View>
        </View>

        {/* E-Bike Card */}
        <View style={styles.bikeCard}>
          <View style={styles.bikeBackground}>
            {/* We use a placeholder image for the bike since we don't have the asset */}
            <Image 
              source={{ uri: 'https://images.unsplash.com/photo-1571188654248-7a89213915f7?auto=format&fit=crop&q=80&w=800' }} 
              style={styles.bikeImage}
              contentFit="cover"
            />
            <View style={styles.unlockButtonOverlay}>
              <TouchableOpacity style={styles.unlockButton}>
                <Text style={styles.unlockText}>Tap to Unlock</Text>
                <View style={styles.unlockIconWrapper}>
                  <Feather name="unlock" size={16} color={ORANGE} />
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Battery Card */}
        <View style={styles.batteryCard}>
          <View>
            <Text style={styles.batteryPercent}>48%</Text>
            <Text style={styles.batteryLabel}>Battery</Text>
          </View>
          <View style={styles.batteryVisualizer}>
            {/* Visualizer bars */}
            <View style={[styles.batteryBar, styles.batteryBarActive]} />
            <View style={[styles.batteryBar, styles.batteryBarActive]} />
            <View style={[styles.batteryBar, styles.batteryBarActive]} />
            <View style={[styles.batteryBar, styles.batteryBarActive]} />
            <View style={[styles.batteryBar, styles.batteryBarActive]} />
            <View style={styles.batteryBar} />
            <View style={styles.batteryBar} />
            <View style={styles.batteryBar} />
            <View style={styles.batteryBar} />
            <View style={styles.batteryBar} />
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.grid}>
          {/* Item 1 */}
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Text style={styles.statTitle}>Total Charging{"\n"}Sessions</Text>
              <View style={styles.statIconContainer}>
                <Feather name="zap" size={14} color={ORANGE} />
              </View>
            </View>
            <Text style={styles.statValue}>15 <Text style={styles.statUnit}>Times</Text></Text>
          </View>

          {/* Item 2 */}
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Text style={styles.statTitle}>Energy{"\n"}Consumption</Text>
              <View style={styles.statIconContainer}>
                <Feather name="activity" size={14} color={ORANGE} />
              </View>
            </View>
            <Text style={styles.statValue}>35 <Text style={styles.statUnit}>kWh</Text></Text>
          </View>

          {/* Item 3 */}
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Text style={styles.statTitle}>Average{"\n"}Charging Time</Text>
              <View style={styles.statIconContainer}>
                <Feather name="clock" size={14} color={ORANGE} />
              </View>
            </View>
            <Text style={styles.statValue}>2h15m</Text>
          </View>

          {/* Item 4 */}
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Text style={styles.statTitle}>Estimated{"\n"}Distance Range</Text>
              <View style={styles.statIconContainer}>
                <Feather name="map-pin" size={14} color={ORANGE} />
              </View>
            </View>
            <Text style={styles.statValue}>108 <Text style={styles.statUnit}>Km</Text></Text>
          </View>
        </View>
        
        {/* Spacer for custom bottom tab */}
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
    paddingTop: 10,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  appTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: DARK,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: GREEN,
  },
  statusText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  headerIcons: {
    flexDirection: 'row',
    gap: 12,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: CARD_BG,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationDot: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ORANGE,
    borderWidth: 1.5,
    borderColor: CARD_BG,
  },
  bikeCard: {
    marginBottom: 16,
    borderRadius: 28,
    backgroundColor: CARD_BG,
    padding: 8,
  },
  bikeBackground: {
    height: 220,
    borderRadius: 24,
    backgroundColor: '#D1E8E2', // Mint green background
    overflow: 'hidden',
  },
  bikeImage: {
    width: '100%',
    height: '100%',
    // we use opacity/tint or mix-blend to approximate the look if we had transparent PNG
  },
  unlockButtonOverlay: {
    position: 'absolute',
    bottom: 12,
    right: 12,
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ORANGE,
    paddingVertical: 10,
    paddingLeft: 16,
    paddingRight: 10,
    borderRadius: 30,
    gap: 8,
  },
  unlockText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  unlockIconWrapper: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  batteryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: DARK,
    padding: 20,
    borderRadius: 28,
    marginBottom: 24,
  },
  batteryPercent: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: '800',
  },
  batteryLabel: {
    color: '#999',
    fontSize: 14,
    fontWeight: '500',
    marginTop: -2,
  },
  batteryVisualizer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 20,
    borderColor: '#333',
    borderWidth: 2,
    gap: 4,
  },
  batteryBar: {
    width: 8,
    height: '100%',
    backgroundColor: '#333',
    borderRadius: 4,
  },
  batteryBarActive: {
    backgroundColor: GREEN,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    backgroundColor: CARD_BG,
    borderRadius: 24,
    padding: 16,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  statTitle: {
    fontSize: 13,
    color: '#222',
    fontWeight: '600',
    lineHeight: 18,
  },
  statIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FEF0EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: DARK,
  },
  statUnit: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  bottomSpacer: {
    height: 100, // accommodate custom bottom tab bar
  }
});
