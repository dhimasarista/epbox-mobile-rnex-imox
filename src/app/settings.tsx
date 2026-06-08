import { Feather } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BG_COLOR = '#F6F5F2';
const CARD_BG = '#FFFFFF';
const DARK = '#1A1C1A';
const GREEN = '#10B981';
const MUTED = '#666B66';
const STORAGE_KEY = 'epbox.connection.settings';

type ConnectionSettings = {
  serverAddress: string;
  port: string;
  clientId: string;
  username: string;
  password: string;
};

const DEFAULT_SETTINGS: ConnectionSettings = {
  serverAddress: '',
  port: '',
  clientId: '',
  username: '',
  password: '',
};

const FORM_FIELDS: {
  key: keyof ConnectionSettings;
  label: string;
  placeholder: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'numeric';
}[] = [
  {
    key: 'serverAddress',
    label: 'Server Address',
    placeholder: 'broker.example.local',
  },
  {
    key: 'port',
    label: 'Port',
    placeholder: '1883',
    keyboardType: 'numeric',
  },
  {
    key: 'clientId',
    label: 'Client ID',
    placeholder: 'epbox-mobile-client',
  },
  {
    key: 'username',
    label: 'Username',
    placeholder: 'operator',
  },
  {
    key: 'password',
    label: 'Password',
    placeholder: 'Enter secret value',
    secureTextEntry: true,
  },
];

async function getStoredSettings() {
  if (Platform.OS === 'web') {
    return globalThis.localStorage?.getItem(STORAGE_KEY) ?? null;
  }

  return SecureStore.getItemAsync(STORAGE_KEY);
}

async function setStoredSettings(value: string) {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(STORAGE_KEY, value);
    return;
  }

  await SecureStore.setItemAsync(STORAGE_KEY, value);
}

export default function SettingsScreen() {
  const [form, setForm] = useState(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Configuration is saved per device.');

  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      try {
        const storedValue = await getStoredSettings();

        if (!storedValue || !isMounted) {
          return;
        }

        const parsed = JSON.parse(storedValue) as Partial<ConnectionSettings>;

        setForm({
          serverAddress: parsed.serverAddress ?? '',
          port: parsed.port ?? '',
          clientId: parsed.clientId ?? '',
          username: parsed.username ?? '',
          password: parsed.password ?? '',
        });
        setStatusMessage('Saved configuration loaded from this device.');
      } catch {
        if (isMounted) {
          setStatusMessage('Unable to read saved configuration.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  const updateField = (key: keyof ConnectionSettings, value: string) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await setStoredSettings(JSON.stringify(form));
      setStatusMessage('Configuration saved successfully on this device.');
      Alert.alert('Saved', 'Connection settings have been stored locally on this device.');
    } catch {
      Alert.alert('Save failed', 'The configuration could not be stored. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Settings</Text>
            <Text style={styles.subtitle}>Configure this device without bundling secrets in the app.</Text>
          </View>
          <View style={styles.headerIcon}>
            <Feather name="settings" size={18} color={DARK} />
          </View>
        </View>

        <View style={styles.formCard}>
          <View style={styles.formCardHeader}>
            <View style={styles.formBadge}>
              <Feather name="shield" size={15} color={GREEN} />
              <Text style={styles.formBadgeText}>Device Configuration</Text>
            </View>
            <Text style={styles.formTitle}>Connection Setup</Text>
            <Text style={styles.formDescription}>
              Each installation can use its own endpoint details while keeping the app package reusable.
            </Text>
          </View>

          {FORM_FIELDS.map((field) => (
            <View key={field.key} style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{field.label}</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading && !isSaving}
                keyboardType={field.keyboardType}
                onChangeText={(value) => updateField(field.key, value)}
                placeholder={field.placeholder}
                placeholderTextColor="#9AA09A"
                secureTextEntry={field.secureTextEntry}
                style={styles.input}
                value={form[field.key]}
              />
            </View>
          ))}

          <View style={styles.statusCard}>
            <Feather name="hard-drive" size={16} color={DARK} />
            <Text style={styles.statusText}>{isLoading ? 'Loading saved configuration...' : statusMessage}</Text>
          </View>

          <Pressable
            disabled={isLoading || isSaving}
            onPress={handleSave}
            style={({ pressed }) => [
              styles.saveButton,
              (pressed || isSaving) && styles.saveButtonPressed,
              (isLoading || isSaving) && styles.saveButtonDisabled,
            ]}>
            <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : 'Save Configuration'}</Text>
          </Pressable>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>EPBOX ENGINEERING</Text>
          <Text style={styles.infoValue}>IMOX 2026</Text>
          <Text style={styles.infoSubtitle}>Firmware version 0.1.0</Text>
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
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: DARK,
    marginBottom: 6,
  },
  subtitle: {
    maxWidth: 250,
    fontSize: 13,
    lineHeight: 18,
    color: MUTED,
  },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: CARD_BG,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formCard: {
    backgroundColor: CARD_BG,
    borderRadius: 28,
    padding: 20,
    gap: 16,
  },
  formCardHeader: {
    gap: 10,
  },
  formBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#EDF8F2',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  formBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: GREEN,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: DARK,
  },
  formDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: MUTED,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: DARK,
  },
  input: {
    height: 54,
    borderRadius: 18,
    backgroundColor: '#F3F5F3',
    paddingHorizontal: 16,
    fontSize: 15,
    color: DARK,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F6F5F2',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  statusText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: MUTED,
  },
  saveButton: {
    height: 54,
    borderRadius: 18,
    backgroundColor: DARK,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonPressed: {
    opacity: 0.92,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  infoCard: {
    backgroundColor: DARK,
    borderRadius: 28,
    padding: 22,
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
