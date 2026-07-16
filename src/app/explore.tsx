import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

import {
  DEFAULT_ACCOMMODATION_ROOM_INPUTS,
  getStoredAccommodationRoomInputs,
} from '@/lib/accommodation-room-demo';
import {
  DEFAULT_PUMP_ROOM_PLC_INPUTS,
  getStoredPumpRoomPlcInputs,
} from '@/lib/pump-room-demo';
import { MONITORED_ROOMS } from '@/lib/room-directory';
import { AppColors } from '@/styles';
import { styles } from '@/styles/screens/explore.styles';

export default function ExploreScreen() {
  const router = useRouter();
  const [pumpInputs, setPumpInputs] = useState(DEFAULT_PUMP_ROOM_PLC_INPUTS);
  const [accommodationInputs, setAccommodationInputs] = useState(DEFAULT_ACCOMMODATION_ROOM_INPUTS);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      async function loadRoomInputs() {
        const [storedPumpRoom, storedAccommodationRoom] = await Promise.all([
          getStoredPumpRoomPlcInputs(),
          getStoredAccommodationRoomInputs(),
        ]);

        if (isMounted) {
          setPumpInputs(storedPumpRoom);
          setAccommodationInputs(storedAccommodationRoom);
        }
      }

      loadRoomInputs();

      return () => {
        isMounted = false;
      };
    }, [])
  );

  const activeRooms = MONITORED_ROOMS.filter((room) => room.active).length;
  const inactiveRooms = MONITORED_ROOMS.length - activeRooms;

  const getRoomMetricValue = (roomId: (typeof MONITORED_ROOMS)[number]['id']) => {
    if (roomId === 'pump-room') {
      return pumpInputs.pressurePump1;
    }

    if (roomId === 'accommodation-room') {
      return accommodationInputs.temperatureValue;
    }

    return 'Standby';
  };

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
            placeholder="Search room or deck"
            placeholderTextColor="#9AA09A"
            style={styles.searchInput}
          />
        </View>

        <View style={styles.heroCard}>
          <View style={styles.headerContainer}>
            <Text style={styles.heroTitle}>Vessel Zones</Text>
            <View style={styles.heroBadge}>
              <MaterialCommunityIcons
                name="transmission-tower"
                size={16}
                color={AppColors.success}
              />
              <Text style={styles.heroBadgeText}>Safe</Text>
            </View>
          </View>

          <Text style={styles.heroText}>Operational overview of all connected zones and safety systems across the vessel</Text>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Active Rooms</Text>
            <Text style={styles.summaryValue}>{activeRooms}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Non-Active Rooms</Text>
            <Text style={styles.summaryValue}>{inactiveRooms}</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Monitored Spaces</Text>
          <Text style={styles.sectionAction}>{MONITORED_ROOMS.length} stations</Text>
        </View>

        {MONITORED_ROOMS.map((room) => (
          <TouchableOpacity
            key={room.id}
            activeOpacity={room.active ? 0.9 : 1}
            disabled={!room.active}
            style={[styles.roomCard, !room.active && styles.roomCardInactive]}
            onPress={() => router.push(room.route)}>
            <View style={styles.roomTopRow}>
              <View style={styles.roomIconWrap}>
                <MaterialCommunityIcons name={room.icon as any} size={20} color={AppColors.primary} />
              </View>
              <View style={styles.metricChip}>
                <Text style={styles.metricValue}>
                  {room.active ? getRoomMetricValue(room.id) : 'Standby'}
                </Text>
                <Text style={styles.metricLabel}>{room.metricLabel}</Text>
              </View>
            </View>

            <Text style={styles.roomTitle}>{room.title}</Text>
            <Text style={styles.roomSubtitle}>{room.roomId}</Text>

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <View style={room.active ? styles.dotSuccess : styles.dotWarning} />
                <Text style={styles.metaText}>{room.status}</Text>
              </View>
              <View style={styles.metaItem}>
                <Feather name="map-pin" size={13} color={AppColors.textSubtle} />
                <Text style={styles.metaText}>{room.deck}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}
