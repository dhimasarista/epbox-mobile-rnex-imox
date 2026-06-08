import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BG_COLOR = '#F6F5F2';
const CARD_BG = '#FFFFFF';
const DARK = '#1A1C1A';

const SETTINGS_ITEMS = [
  {
    title: 'Notifications',
    subtitle: 'Charging alerts and device reminders',
    iconFamily: 'feather',
    iconName: 'bell',
  },
  {
    title: 'Privacy',
    subtitle: 'Access control and security preferences',
    iconFamily: 'feather',
    iconName: 'lock',
  },
  {
    title: 'Appearance',
    subtitle: 'Theme, accents, and display options',
    iconFamily: 'material',
    iconName: 'palette-outline',
  },
] as const;

export default function SettingsScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
          <View style={styles.headerIcon}>
            <Feather name="settings" size={18} color={DARK} />
          </View>
        </View>

        {SETTINGS_ITEMS.map((item) => {
          return (
            <View key={item.title} style={styles.row}>
              <View style={styles.leadingIcon}>
                {item.iconFamily === 'feather' ? (
                  <Feather name={item.iconName as any} size={18} color={DARK} />
                ) : (
                  <MaterialCommunityIcons name={item.iconName as any} size={18} color={DARK} />
                )}
              </View>
              <View style={styles.textWrap}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowSubtitle}>{item.subtitle}</Text>
              </View>
            </View>
          );
        })}

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Bike Profile</Text>
          <Text style={styles.infoValue}>X1 Pro</Text>
          <Text style={styles.infoSubtitle}>Firmware version 2.14.8</Text>
        </View>

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
    paddingTop: 12,
    paddingBottom: 36,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: DARK,
  },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: CARD_BG,
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 24,
    padding: 16,
    gap: 14,
  },
  leadingIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EEF1EE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textWrap: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: DARK,
    marginBottom: 4,
  },
  rowSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: '#666B66',
  },
  infoCard: {
    backgroundColor: DARK,
    borderRadius: 28,
    padding: 22,
    marginTop: 8,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#B4BAB4',
    marginBottom: 8,
  },
  infoValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 4,
  },
  infoSubtitle: {
    fontSize: 14,
    color: '#D4D7D4',
  },
  bottomSpacer: {
    height: 100,
  },
});
