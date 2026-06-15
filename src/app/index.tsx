import { AppColors } from '@/styles';
import { styles } from '@/styles/screens/home.styles';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <View style={styles.titleRow}>
              <Text style={styles.appTitle}>EPBOX-ENGG</Text>
              <Feather name="chevron-down" size={20} color={AppColors.text} />
            </View>
            <View style={styles.statusRow}>
              <View style={styles.dot} />
              <Text style={styles.subtitle}>IMOX 2026</Text>
            </View>
          </View>
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconBtn}>
              <Ionicons name="notifications-outline" size={22} color={AppColors.text} />
              <View style={styles.notificationDot} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn}>
              <MaterialCommunityIcons name="line-scan" size={22} color={AppColors.text} />
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
                    <Feather name="unlock" size={16} color={AppColors.primary} />
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
                <Feather name="zap" size={14} color={AppColors.primary} />
                
              </View>
            </View>
            <Text style={styles.statValue}>15 <Text style={styles.statUnit}>Times</Text></Text>
          </View>

          {/* Item 2 */}
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Text style={styles.statTitle}>Energy{"\n"}Consumption</Text>
              <View style={styles.statIconContainer}>
                <Feather name="activity" size={14} color={AppColors.primary} />
              </View>
            </View>
            <Text style={styles.statValue}>35 <Text style={styles.statUnit}>kWh</Text></Text>
          </View>

          {/* Item 3 */}
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Text style={styles.statTitle}>Average{"\n"}Charging Time</Text>
              <View style={styles.statIconContainer}>
                <Feather name="clock" size={14} color={AppColors.primary} />
              </View>
            </View>
            <Text style={styles.statValue}>2h15m</Text>
          </View>

          {/* Item 4 */}
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Text style={styles.statTitle}>Estimated{"\n"}Distance Range</Text>
              <View style={styles.statIconContainer}>
                <Feather name="map-pin" size={14} color={AppColors.primary} />
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
