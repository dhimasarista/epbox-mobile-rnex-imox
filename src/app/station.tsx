import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BG_COLOR = '#F6F5F2';
const CARD_BG = '#FFFFFF';
const ORANGE = '#FF6B35';
const GREEN = '#10B981';
const DARK = '#1A1C1A';

export default function StationDetailScreen() {
  const router = useRouter();
  const [selectedPort, setSelectedPort] = useState('typeA');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={DARK} />
        </TouchableOpacity>
        <Text style={styles.headerLabel}>Albuquerque, NM 87102</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.detailCard}>
          <TouchableOpacity style={styles.directionBtn}>
            <Text style={styles.directionBtnText}>Get Direction</Text>
          </TouchableOpacity>

          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Green Pedal Charging{"\n"}Hub Station</Text>
              <View style={styles.ratingRow}>
                <Feather name="star" size={16} color="#FBBF24" />
                <Text style={styles.ratingText}>4.9</Text>
                <Text style={styles.reviewsText}>(59 Reviews)</Text>
              </View>
            </View>
            <View style={styles.priceContainer}>
              <View style={styles.iconWrapper}>
                <Feather name="dollar-sign" size={16} color={ORANGE} />
              </View>
              <Text style={styles.priceText}>$10.10</Text>
              <Text style={styles.perKwhText}>Per kWh</Text>
            </View>
          </View>

          <View style={styles.portSectionHeader}>
            <Text style={styles.sectionTitle}>Charging Connector Ports</Text>
            <View style={styles.statusDots}>
              <View style={styles.activeDot} />
              <View style={styles.inactiveDot} />
            </View>
          </View>

          <View style={styles.portsRow}>
            {/* Type A */}
            <TouchableOpacity 
              style={[styles.portCard, selectedPort === 'typeA' && styles.portCardSelected]}
              onPress={() => setSelectedPort('typeA')}
            >
              <View style={[styles.availabilityBadge, { backgroundColor: '#D1FAE5' }]}>
                <MaterialCommunityIcons name="power-plug" size={12} color={GREEN} />
                <Text style={[styles.availabilityText, { color: GREEN }]}>Available</Text>
              </View>
              <View style={styles.portImageWrapper}>
                {/* Placeholder plug icon */}
                <MaterialCommunityIcons name="power-socket-eu" size={60} color={DARK} />
              </View>
              <Text style={styles.portCode}>IEC 60320 C13</Text>
              <Text style={styles.portType}>Type A</Text>
              <View style={styles.powerRow}>
                <Feather name="zap" size={12} color={DARK} />
                <Text style={styles.powerText}>1.5 kW</Text>
              </View>
            </TouchableOpacity>

            {/* Type C */}
            <TouchableOpacity 
              style={[styles.portCard, selectedPort === 'typeC' && styles.portCardSelected]}
              onPress={() => setSelectedPort('typeC')}
            >
              <View style={[styles.availabilityBadge, { backgroundColor: '#DBEAFE' }]}>
                <MaterialCommunityIcons name="power-plug" size={12} color="#3B82F6" />
                <Text style={[styles.availabilityText, { color: '#3B82F6' }]}>In Use</Text>
              </View>
              <View style={styles.portImageWrapper}>
                {/* Placeholder plug icon */}
                <MaterialCommunityIcons name="power-plug-outline" size={60} color={DARK} />
              </View>
              <Text style={styles.portCode}>SAE J1772</Text>
              <Text style={styles.portType}>Type C</Text>
              <View style={styles.powerRow}>
                <Feather name="zap" size={12} color={DARK} />
                <Text style={styles.powerText}>3.3 kW</Text>
              </View>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.startBtn}>
            <Text style={styles.startBtnText}>Start Charging</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BG_COLOR,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: CARD_BG,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  scrollContent: {
    padding: 20,
  },
  detailCard: {
    backgroundColor: CARD_BG,
    borderRadius: 30,
    padding: 20,
    paddingTop: 24,
  },
  directionBtn: {
    backgroundColor: ORANGE,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 24,
  },
  directionBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 30,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: DARK,
    lineHeight: 30,
    marginBottom: 12,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '700',
    color: DARK,
  },
  reviewsText: {
    fontSize: 14,
    color: '#666',
  },
  priceContainer: {
    alignItems: 'center',
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FEF0EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceText: {
    fontSize: 20,
    fontWeight: '800',
    color: DARK,
  },
  perKwhText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  portSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: DARK,
  },
  statusDots: {
    flexDirection: 'row',
    gap: 6,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: GREEN,
  },
  inactiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
  },
  portsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  portCard: {
    flex: 1,
    backgroundColor: BG_COLOR,
    borderRadius: 24,
    padding: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  portCardSelected: {
    borderColor: ORANGE,
  },
  availabilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    marginBottom: 8,
  },
  availabilityText: {
    fontSize: 10,
    fontWeight: '700',
  },
  portImageWrapper: {
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  portCode: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
  },
  portType: {
    fontSize: 16,
    fontWeight: '700',
    color: DARK,
    marginBottom: 6,
  },
  powerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  powerText: {
    fontSize: 12,
    color: DARK,
    fontWeight: '500',
  },
  startBtn: {
    backgroundColor: DARK,
    borderRadius: 30,
    paddingVertical: 18,
    alignItems: 'center',
  },
  startBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  }
});