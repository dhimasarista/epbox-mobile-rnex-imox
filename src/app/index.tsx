import { useFocusEffect } from 'expo-router';
import { useNetworkSignal } from '@/hooks/use-network-signal';
import { AppColors } from '@/styles';
import { getBannerHeight, styles } from '@/styles/screens/home.styles';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import { useCallback, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const { width, height } = useWindowDimensions();
  const bannerHeight = getBannerHeight(width, height);
  const [isSignalPollingEnabled, setIsSignalPollingEnabled] = useState(true);
  const signal = useNetworkSignal({
    enabled: isSignalPollingEnabled,
    refreshIntervalMs: 2000,
  });

  useFocusEffect(
    useCallback(() => {
      setIsSignalPollingEnabled(true);

      return () => {
        setIsSignalPollingEnabled(false);
      };
    }, [])
  );

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

        {/* vessel Card */}
        <View style={styles.bannerCard}>
          <View style={[styles.bannerBackground, { height: bannerHeight }]}>
            <LottieView
              source={require('../../assets/animations/Vessel.json')}
              style={styles.bannerImage}
              autoPlay
              loop
            />
            {/* <View style={styles.unlockButtonOverlay}>
              <TouchableOpacity style={styles.unlockButton}>
                  <Text style={styles.unlockText}>Tap to Unlock</Text>
                  <View style={styles.unlockIconWrapper}>
                    <Feather name="unlock" size={16} color={AppColors.primary} />
                </View>
              </TouchableOpacity>
            </View> */}
          </View>
        </View>

        {/* Battery Card */}
        <View style={styles.batteryCard}>
          <View>
            <Text style={styles.batteryPercent}>{signal.value}</Text>
            <Text style={styles.batteryLabel}>{signal.label}</Text>
          </View>
          <View style={styles.batteryVisualizer}>
            {Array.from({ length: signal.totalBars }, (_, index) => {
              const isActive = index < signal.activeBars;

              return (
                <View
                  key={`signal-bar-${index}`}
                  style={[styles.batteryBar, isActive && styles.batteryBarActive]}
                />
              );
            })}
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.grid}>
          {/* Item 1 */}
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Text style={styles.statTitle}>Active Data{"\n"}Streams</Text>
              <View style={styles.statIconContainer}>
                <Feather name="zap" size={14} color={AppColors.primary} />
                
              </View>
            </View>
            <Text style={styles.statValue}>7 <Text style={styles.statUnit}>Topics</Text></Text>
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
              <Text style={styles.statTitle}>Response{"\n"}Time</Text>
              <View style={styles.statIconContainer}>
                <Feather name="clock" size={14} color={AppColors.primary} />
              </View>
            </View>
            <Text style={styles.statValue}>248 <Text style={styles.statUnit}>ms</Text></Text>
          </View>

          {/* Item 4 */}
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Text style={styles.statTitle}>Distance{"\n"}to Device</Text>
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
