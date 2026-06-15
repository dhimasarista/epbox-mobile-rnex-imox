import { Feather } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppColors } from '@/styles';
import { styles } from '@/styles/screens/settings.styles';
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
            <Feather name="settings" size={18} color={AppColors.text} />
          </View>
        </View>

        <View style={styles.formCard}>
          <View style={styles.formCardHeader}>
            <View style={styles.formBadge}>
              <Feather name="shield" size={15} color={AppColors.success} />
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
            <Feather name="hard-drive" size={16} color={AppColors.text} />
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
