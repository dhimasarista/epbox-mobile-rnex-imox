import { AppColors } from '@/styles';
import { styles } from '@/styles/screens/explore.styles';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const ROOMS = [
  {
    id: 'pump-room',
    title: 'Pump Room',
    roomId: 'PR-001',
    deck: 'Lower Deck',
    status: 'Warning',
    metric: '28 C',
    metricLabel: 'Room Temp',
    icon: 'fire-hydrant',
  },
  {
    id: 'accommodation-room',
    title: 'Accommodation Room',
    roomId: 'AR-001',
    deck: 'Safety Deck',
    status: 'Safe',
    metric: '2.9 bar',
    metricLabel: 'Line Pressure',
    icon: 'home-variant',
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
            <Text style={styles.pageSubtitle}>MV Southern Maori</Text>
          </View>
          <View style={styles.headerBadge}>
            <Feather name="sliders" size={18} color={AppColors.text} />
          </View>
        </View>

        <View style={styles.searchBar}>
          <Feather name="search" size={18} color={AppColors.tabMuted} />
          <TextInput
            placeholder="Search room, deck, or vessel"
            placeholderTextColor="#9AA09A"
            style={styles.searchInput}
          />
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroBadge}>
            <MaterialCommunityIcons name="shield-check-outline" size={16} color={AppColors.success} />
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
            <Text style={styles.summaryLabel}>Source</Text>
            <Text style={styles.summaryValue}>CG UWP 4.0</Text>
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
            onPress={() => router.navigate('/station')}>
            <View style={styles.roomTopRow}>
              <View style={styles.roomIconWrap}>
                <MaterialCommunityIcons name={room.icon as any} size={20} color={AppColors.primary} />
              </View>
              <View style={styles.metricChip}>
                <Text style={styles.metricValue}>{room.metric}</Text>
                <Text style={styles.metricLabel}>{room.metricLabel}</Text>
              </View>
            </View>

            <Text style={styles.roomTitle}>{room.title}</Text>
            <Text style={styles.roomSubtitle}>{room.roomId}</Text>

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <View style={
                  room.status === 'Safe'
                    ? styles.dotSuccess
                    : room.status === 'Warning'
                      ? styles.dotWarning
                      : styles.dotNeutral // Tambahkan gaya untuk status lain agar tidak crash
                } />
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
