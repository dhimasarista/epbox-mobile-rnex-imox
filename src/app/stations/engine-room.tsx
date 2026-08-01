import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppColors } from '@/styles';
import { styles } from '@/styles/screens/engine-room.styles';
import InjectValueRoom from './inject-value';
import PumpRoom from './pump-room';

type EngineRoomTab = 'plc' | 'inject';

const ENGINE_ROOM_TABS = [
  { key: 'plc', label: 'FROM PLC', icon: 'server' },
  { key: 'inject', label: 'Inject Value', icon: 'sliders' },
] as const satisfies readonly {
  key: EngineRoomTab;
  label: string;
  icon: keyof typeof Feather.glyphMap;
}[];

export default function EngineRoom() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<EngineRoomTab>('plc');
  const [simFgsConfirmed, setSimFgsConfirmed] = useState(0);
  const handleFgsWordChange = useCallback((word: number) => setSimFgsConfirmed(word), []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.navigate('/explore')}>
          <Feather name="arrow-left" size={24} color={AppColors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerLabel}>Engine Room</Text>
          <Text style={styles.headerSubLabel}>PLC Status and Inject Controls</Text>
        </View>
        <View style={styles.headerBadge}>
          <MaterialCommunityIcons name="engine-outline" size={20} color={AppColors.primary} />
        </View>
      </View>

      <View style={styles.segmentBar}>
        {ENGINE_ROOM_TABS.map((tab) => {
          const isActive = activeTab === tab.key;

          return (
            <TouchableOpacity
              key={tab.key}
              activeOpacity={0.85}
              onPress={() => setActiveTab(tab.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              style={[styles.segmentButton, isActive && styles.segmentButtonActive]}>
              <Feather
                name={tab.icon}
                size={16}
                color={isActive ? AppColors.textInverse : AppColors.textSubtle}
              />
              <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {activeTab === 'plc' ? (
          <PumpRoom contentOnly fixedTab="plc" />
        ) : (
          <>
            <PumpRoom contentOnly fixedTab="inject" simFgsConfirmed={simFgsConfirmed} />
            <InjectValueRoom contentOnly onFgsWordChange={handleFgsWordChange} />
          </>
        )}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}
