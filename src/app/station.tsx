import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppColors } from '@/styles';
import { styles } from '@/styles/screens/station.styles';

const INITIAL_FORM = {
  vesselName: 'MV Sentinel Aurora',
  roomName: 'Fire Pump Room',
  pumpTag: 'FFP-01',
  pumpType: 'Main Fire Pump',
  roomTemperature: '28 C',
  roomHumidity: '68 %',
  suctionPressure: '2.4 bar',
  dischargePressure: '8.7 bar',
  seaWaterLinePressure: '2.1 bar',
  batteryVoltage: '24.8 VDC',
  fuelLevel: '83 %',
  ventilationStatus: 'Normal air flow',
  leakObservation: 'No visible leakage',
  alarmCondition: 'No active alarm',
  remarks: 'Demo values only. These inputs are not connected to the actual pump or live vessel instrumentation.',
};

type FormKey = keyof typeof INITIAL_FORM;

const FIELD_GROUPS: {
  title: string;
  fields: { key: FormKey; label: string; placeholder: string }[];
}[] = [
  {
    title: 'Location Details',
    fields: [
      { key: 'vesselName', label: 'Vessel Name', placeholder: 'Enter vessel name' },
      { key: 'roomName', label: 'Room Name', placeholder: 'Enter room name' },
      { key: 'pumpTag', label: 'Pump Tag', placeholder: 'Enter pump tag' },
      { key: 'pumpType', label: 'Pump Type', placeholder: 'Enter pump type' },
    ],
  },
  {
    title: 'Environmental Conditions',
    fields: [
      { key: 'roomTemperature', label: 'Room Temperature', placeholder: 'Example: 28 C' },
      { key: 'roomHumidity', label: 'Room Humidity', placeholder: 'Example: 68 %' },
      { key: 'ventilationStatus', label: 'Ventilation Status', placeholder: 'Describe ventilation condition' },
      { key: 'alarmCondition', label: 'Alarm Condition', placeholder: 'Describe active alarms' },
    ],
  },
  {
    title: 'Pump Operating References',
    fields: [
      { key: 'suctionPressure', label: 'Suction Pressure', placeholder: 'Example: 2.4 bar' },
      { key: 'dischargePressure', label: 'Discharge Pressure', placeholder: 'Example: 8.7 bar' },
      { key: 'seaWaterLinePressure', label: 'Sea Water Line Pressure', placeholder: 'Example: 2.1 bar' },
      { key: 'batteryVoltage', label: 'Battery Voltage', placeholder: 'Example: 24.8 VDC' },
      { key: 'fuelLevel', label: 'Fuel Level', placeholder: 'Example: 83 %' },
      { key: 'leakObservation', label: 'Leak Observation', placeholder: 'Describe any leakage' },
    ],
  },
];

export default function StationDetailScreen() {
  const router = useRouter();
  const [form, setForm] = useState(INITIAL_FORM);

  const updateField = (key: FormKey, value: string) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={AppColors.text} />
        </TouchableOpacity>
        <Text style={styles.headerLabel}>Pump Room Demo Form</Text>
        <View style={styles.headerGhost} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroBadge}>
              <MaterialCommunityIcons name="fire-hydrant" size={14} color={AppColors.primary} />
              <Text style={styles.heroBadgeText}>Demo Only</Text>
            </View>
            <View style={styles.liveChip}>
              <View style={styles.liveDot} />
              <Text style={styles.liveChipText}>Static Example</Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>Fire Fighting Pump Room Inspection</Text>
          <Text style={styles.heroSubtitle}>
            This mobile page is intended for demonstration only. All values below are fake reference
            inputs and are not connected to an actual vessel pump, PLC, or sensor source.
          </Text>
        </View>

        {FIELD_GROUPS.map((group) => (
          <View key={group.title} style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{group.title}</Text>

            {group.fields.map((field) => (
              <View key={field.key} style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>{field.label}</Text>
                <TextInput
                  value={form[field.key]}
                  onChangeText={(value) => updateField(field.key, value)}
                  placeholder={field.placeholder}
                  placeholderTextColor="#9AA09A"
                  style={styles.input}
                />
              </View>
            ))}
          </View>
        ))}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Inspector Remarks</Text>
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Remarks</Text>
            <TextInput
              value={form.remarks}
              onChangeText={(value) => updateField('remarks', value)}
              placeholder="Add remarks for the demo report"
              placeholderTextColor="#9AA09A"
              style={[styles.input, styles.remarksInput]}
              multiline
              textAlignVertical="top"
            />
          </View>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Suggested Demo Parameters</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Temperature</Text>
              <Text style={styles.summaryValue}>{form.roomTemperature}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Humidity</Text>
              <Text style={styles.summaryValue}>{form.roomHumidity}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Suction</Text>
              <Text style={styles.summaryValue}>{form.suctionPressure}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Discharge</Text>
              <Text style={styles.summaryValue}>{form.dischargePressure}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Save Demo Report</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}
