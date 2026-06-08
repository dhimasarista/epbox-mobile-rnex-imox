import { Tabs, useRouter } from 'expo-router';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import {
  LucidCable,
  LucideActivity,
  LucideHome,
  LucideSettings,
} from '@/components/lucide-tab-icons';

const DARK = '#1A1C1A';
const GREEN = '#10B981';
const MUTED = '#7B7F7B';
const ACTIVE_BG = '#333533';

const TAB_CONFIG = {
  index: LucideHome,
  explore: LucidCable,
  status: LucideActivity,
  settings: LucideSettings,
} as const;

const TAB_PATHS = {
  index: '/',
  explore: '/explore',
  status: '/status',
  settings: '/settings',
} as const;

function CustomTabBar({ state, descriptors, navigation }: any) {
  const router = useRouter();
  const visibleRoutes = state.routes.filter(
    (route: any) => route.name in TAB_CONFIG
  );

  return (
    <View style={styles.tabBarContainer}>
      <View style={styles.tabBar}>
        {visibleRoutes.map((route: any) => {
          const originalIndex = state.routes.findIndex((item: any) => item.key === route.key);
          const isFocused = state.index === originalIndex;
          const Icon = TAB_CONFIG[route.name as keyof typeof TAB_CONFIG];

          if (!Icon) {
            return null;
          }

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              router.navigate(TAB_PATHS[route.name as keyof typeof TAB_PATHS]);
            }
          };

          if (isFocused) {
            return (
              <TouchableOpacity
                key={route.key}
                style={styles.activeTab}
                onPress={onPress}
                accessibilityRole="button"
                accessibilityLabel={descriptors[route.key]?.options?.title ?? route.name}>
                <Icon size={20} color="#FFF" strokeWidth={2.25} />
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={route.key}
              style={styles.inactiveTab}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityLabel={descriptors[route.key]?.options?.title ?? route.name}>
              <Icon size={20} color={MUTED} strokeWidth={2.25} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function AppTabs() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="explore" options={{ title: 'Explore' }} />
      <Tabs.Screen name="status" options={{ title: 'Status' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
      <Tabs.Screen name="station" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: DARK,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 40,
    gap: 10,
  },
  activeTab: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACTIVE_BG,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: GREEN,
  },
  inactiveTab: {
    width: 52,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 26,
  },
});
