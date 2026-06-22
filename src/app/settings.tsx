import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  DEFAULT_MQTT_CONNECTION_SETTINGS,
  getMqttRuntimeTransportLabel,
  getStoredMqttSettingsValue,
  type MqttConnectionSettings,
  setStoredMqttSettings,
} from '@/lib/mqtt-settings';
import { useMqtt } from '@/providers/mqtt-provider';
import { useAuth } from '@/providers/auth-provider';
import { AppColors } from '@/styles';
import { styles } from '@/styles/screens/settings.styles';

const FORM_FIELDS: {
  key: keyof MqttConnectionSettings;
  label: string;
  placeholder: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'numeric';
}[] = [
  {
    key: 'serverAddress',
    label: 'Broker Host / URL',
    placeholder: 'ws://192.168.16.20:8084/mqtt or broker.example.local',
  },
  {
    key: 'port',
    label: 'Port',
    placeholder: '8084',
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

export default function SettingsScreen() {
  const { signOut } = useAuth();
  const { refreshSettings } = useMqtt();
  const [form, setForm] = useState(DEFAULT_MQTT_CONNECTION_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('MQTT configuration is saved per device.');

  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      try {
        const storedValue = await getStoredMqttSettingsValue();

        if (!storedValue || !isMounted) {
          return;
        }

        const parsed = JSON.parse(storedValue) as Partial<MqttConnectionSettings>;

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

  const updateField = (key: keyof MqttConnectionSettings, value: string) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await setStoredMqttSettings(form);
      await refreshSettings();
      setStatusMessage('MQTT configuration saved successfully on this device.');
      Alert.alert('Saved', 'MQTT connection settings have been stored locally on this device.');
    } catch {
      Alert.alert('Save failed', 'The configuration could not be stored. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
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
            <Text style={styles.subtitle}>Configure MQTT access without bundling secrets in the app.</Text>
          </View>
          <View style={styles.headerIcon}>
            <Feather name="settings" size={18} color={AppColors.text} />
          </View>
        </View>

        <View style={styles.formCard}>
          <View style={styles.formCardHeader}>
            <View style={styles.formBadge}>
              <Feather name="shield" size={15} color={AppColors.success} />
              <Text style={styles.formBadgeText}>MQTT Configuration</Text>
            </View>
            <Text style={styles.formTitle}>Broker Setup</Text>
            <Text style={styles.formDescription}>
              Save broker host or URL. For Android preview, prefer the full {getMqttRuntimeTransportLabel('ws')} URL including path, for example `ws://host:port/mqtt`. Standalone build switches to {getMqttRuntimeTransportLabel('tcp')} when no protocol is written.
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
            <Text style={styles.statusText}>
              {isLoading ? 'Loading saved MQTT configuration...' : statusMessage}
            </Text>
          </View>

          <Pressable
            disabled={isLoading || isSaving}
            onPress={handleSave}
            style={({ pressed }) => [
              styles.saveButton,
              (pressed || isSaving) && styles.saveButtonPressed,
              (isLoading || isSaving) && styles.saveButtonDisabled,
            ]}>
            <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : 'Save MQTT Configuration'}</Text>
          </Pressable>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>EPBOX ENGINEERING</Text>
          <Text style={styles.infoValue}>IMOX 2026</Text>
          <Text style={styles.infoSubtitle}>Firmware version 0.1.0</Text>
        </View>

        <Pressable onPress={handleSignOut} style={({ pressed }) => [styles.logoutButton, pressed && styles.logoutButtonPressed]}>
          <Text style={styles.logoutButtonText}>Sign Out</Text>
        </Pressable>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}
