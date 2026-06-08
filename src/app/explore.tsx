import React from 'react';
import { View, StyleSheet, Text, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';

const BG_COLOR = '#F6F5F2';
const CARD_BG = '#FFFFFF';
const DARK = '#1A1C1A';

export default function StationScreen() {
  const router = useRouter();
  
  const stations = [
    {
      id: '1',
      name: 'Blue Volt Charging Hub Station',
      address: '123 Main St, Albuquerque, NM 87102',
      rating: '4.9',
      reviews: '59',
      distance: '1.3 Km',
      image: 'https://images.unsplash.com/photo-1571188654248-7a89213915f7?auto=format&fit=crop&q=80&w=300',
    },
    {
      id: '2',
      name: 'Pedal Boost Power Hub Station',
      address: '456 Elm St, Santa Fe, NM 87501',
      rating: '4.5',
      reviews: '42',
      distance: '0.9 Km',
      image: 'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?auto=format&fit=crop&q=80&w=300',
    },
    {
      id: '3',
      name: 'Cycle Charge Oasis',
      address: '789 Oak St, Roswell, NM 88201',
      rating: '4.8',
      reviews: '128',
      distance: '2.5 Km',
      image: 'https://images.unsplash.com/photo-1563283253-abdfa49db23c?auto=format&fit=crop&q=80&w=300',
    }
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Search Header */}
      <View style={styles.header}>
        <View style={styles.searchBar}>
          <Feather name="search" size={20} color="#777" />
          <TextInput 
            placeholder="Search station" 
            style={styles.searchInput}
            placeholderTextColor="#999"
          />
          <TouchableOpacity>
            <Feather name="sliders" size={20} color="#777" />
          </TouchableOpacity>
        </View>
        <View style={styles.toggleGroup}>
          <TouchableOpacity style={[styles.toggleBtn, styles.toggleBtnActive]}>
            <Feather name="map" size={18} color={DARK} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.toggleBtn}>
            <Feather name="list" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {stations.map((station) => (
          <TouchableOpacity 
            key={station.id} 
            style={styles.stationCard}
            onPress={() => router.push('/station')}
          >
            <View style={styles.cardLayout}>
              <View style={styles.imageContainer}>
                <Image source={{ uri: station.image }} style={styles.stationImage} />
                <View style={styles.distanceBadge}>
                  <Feather name="map-pin" size={10} color="#FFF" />
                  <Text style={styles.distanceText}>{station.distance}</Text>
                </View>
              </View>
              <View style={styles.detailsContainer}>
                <Text style={styles.stationName} numberOfLines={2}>{station.name}</Text>
                <Text style={styles.stationAddress} numberOfLines={2}>{station.address}</Text>
                <View style={styles.ratingRow}>
                  <Feather name="star" size={14} color="#FBBF24" style={styles.starFilled} />
                  <Text style={styles.ratingText}>{station.rating}</Text>
                  <Text style={styles.reviewsText}>({station.reviews} Reviews)</Text>
                  
                  <TouchableOpacity style={styles.heartBtn}>
                    <Feather name="heart" size={16} color="#777" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ))}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    gap: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 30,
    paddingHorizontal: 16,
    height: 50,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: DARK,
  },
  toggleGroup: {
    flexDirection: 'row',
    backgroundColor: DARK,
    borderRadius: 30,
    padding: 4,
    height: 50,
    alignItems: 'center',
  },
  toggleBtn: {
    width: 44,
    height: 42,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: CARD_BG,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  stationCard: {
    backgroundColor: CARD_BG,
    borderRadius: 24,
    padding: 12,
    marginBottom: 16,
  },
  cardLayout: {
    flexDirection: 'row',
    gap: 16,
  },
  imageContainer: {
    width: 100,
    height: 100,
    borderRadius: 16,
    overflow: 'hidden',
  },
  stationImage: {
    width: '100%',
    height: '100%',
  },
  distanceBadge: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  distanceText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
  },
  detailsContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  stationName: {
    color: DARK,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 4,
  },
  stationAddress: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 10,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  starFilled: {
    color: '#FBBF24',
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '700',
    color: DARK,
  },
  reviewsText: {
    fontSize: 13,
    color: '#666',
  },
  heartBtn: {
    marginLeft: 'auto',
    padding: 4,
  },
  bottomSpacer: {
    height: 100,
  }
});
