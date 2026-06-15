import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppColors } from '@/styles';
import { styles } from '@/styles/screens/status.styles';

const STATUS_CARDS = [
  {
    title: 'Battery Health',
    value: 'Good',
    detail: '92% capacity retained',
    iconFamily: 'feather',
    iconName: 'battery-charging',
    accent: AppColors.success,
  },
  {
    title: 'Motor Output',
    value: 'Normal',
    detail: 'No active warnings',
    iconFamily: 'material',
    iconName: 'speedometer',
    accent: AppColors.primary,
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
            <Feather name="activity" size={16} color={AppColors.success} />
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
