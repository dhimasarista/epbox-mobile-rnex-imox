import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  buildPumpRoomDashboard,
  DEFAULT_PUMP_ROOM_PLC_INPUTS,
  getStoredPumpRoomPlcInputs,
  PUMP_ROOM_PLC_FIELDS,
  setStoredPumpRoomPlcInputs,
  type PumpRoomPlcInputKey,
} from '@/lib/pump-room-demo';
import { AppColors } from '@/styles';
import { styles } from '@/styles/screens/station.styles';

export default function StationDetailScreen() {
  const router = useRouter();
  const [form, setForm] = useState(DEFAULT_PUMP_ROOM_PLC_INPUTS);
  const [statusMessage, setStatusMessage] = useState('Configuration ready.');

  useEffect(() => {
    let isMounted = true;

    async function loadValues() {
      const stored = await getStoredPumpRoomPlcInputs();

      if (isMounted) {
        setForm(stored);
      }
    }

    loadValues();

    return () => {
      isMounted = false;
    };
  }, []);

  const dashboardPreview = useMemo(() => buildPumpRoomDashboard(form), [form]);

  const updateField = (key: PumpRoomPlcInputKey, value: string) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSave = async () => {
    await setStoredPumpRoomPlcInputs(form);
    setStatusMessage('Configuration applied.');
  };

  const handleBack = () => {
    router.navigate('/explore');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
          <Feather name="arrow-left" size={24} color={AppColors.text} />
        </TouchableOpacity>
        <Text style={styles.headerLabel}>Pump Room</Text>
        <View style={styles.headerGhost} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroBadge}>
              <MaterialCommunityIcons name="fire-hydrant" size={14} color={AppColors.primary} />
              <Text style={styles.heroBadgeText}>Pump Room Active</Text>
            </View>
            <View style={styles.liveChip}>
              <View style={[styles.liveDot, styles.plcDot]} />
              <Text style={styles.liveChipText}>Calibration Source</Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>Operational Parameters</Text>
          <Text style={styles.heroSubtitle}>
            Calibrate pump pressure and discharge flow for live monitoring.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Sensor Calibration</Text>
            <View style={styles.sectionBadge}>
              <View style={[styles.inlineDot, styles.plcDot]} />
            </View>
          </View>

          <Text style={styles.sectionDescription}>
            Adjust pressure transmitter and discharge flow references.
          </Text>

          {PUMP_ROOM_PLC_FIELDS.map((field) => (
            <View key={field.key} style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>{field.label}</Text>
              <TextInput
                value={form[field.key]}
                onChangeText={(value) => updateField(field.key, value)}
                placeholder={field.placeholder}
                placeholderTextColor="#9AA09A"
                style={styles.input}
                keyboardType="numeric"
              />
            </View>
          ))}
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.summaryTitle}>Live Dashboard View</Text>
            <View style={styles.sectionBadge}>
              <View style={[styles.inlineDot, styles.dashboardDot]} />
            </View>
          </View>

          <Text style={styles.sectionDescription}>
            Operational status mirrored from the current room configuration.
          </Text>

          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Temperature Zone</Text>
              <Text style={styles.summaryValue}>{dashboardPreview.temperatureZone}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Current Status</Text>
              <Text style={styles.summaryValue}>{dashboardPreview.currentStatus}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Ampere Status</Text>
              <Text style={styles.summaryValue}>{dashboardPreview.ampereStatus}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Pressure Pump 1</Text>
              <Text style={styles.summaryValue}>{dashboardPreview.pressurePump1}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Pressure Pump 2</Text>
              <Text style={styles.summaryValue}>{dashboardPreview.pressurePump2}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Flow Rate Discharge</Text>
              <Text style={styles.summaryValue}>{dashboardPreview.dischargeFlowRate}</Text>
            </View>
          </View>
        </View>

        <View style={styles.statusCard}>
          <Feather name="check-circle" size={16} color={AppColors.text} />
          <Text style={styles.statusText}>{statusMessage}</Text>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={handleSave}>
          <Text style={styles.primaryButtonText}>Apply Configuration</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}
