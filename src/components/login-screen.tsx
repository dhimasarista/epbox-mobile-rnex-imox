import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/providers/auth-provider';
import { styles } from '@/styles/screens/login.styles';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, demoCredentials } = useAuth();
  const [userId, setUserId] = useState<string>(demoCredentials.id);
  const [password, setPassword] = useState<string>(demoCredentials.password);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSignIn = async () => {
    try {
      setIsSubmitting(true);
      setErrorMessage('');

      const isSuccess = await signIn(userId, password);

      if (!isSuccess) {
        setErrorMessage('ID atau password belum cocok dengan credential hardcoded saat ini.');
        return;
      }

      router.replace('/');
    } catch {
      Alert.alert('Login gagal', 'Session tidak bisa disimpan di perangkat ini.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.container}>
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>EPBOX ENGINEERING</Text>
          <Text style={styles.title}>Login Access</Text>
          <Text style={styles.subtitle}>
            Access to the application protected with an ID and password for security purposes.
          </Text>
        </View>

        <View style={styles.formCard}>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>User ID</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isSubmitting}
              onChangeText={setUserId}
              placeholder="Masukkan user ID"
              placeholderTextColor="#9AA09A"
              style={styles.input}
              value={userId}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Password</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isSubmitting}
              onChangeText={setPassword}
              placeholder="Masukkan password"
              placeholderTextColor="#9AA09A"
              secureTextEntry
              style={styles.input}
              value={password}
            />
          </View>
          {/* <View style={styles.noteCard}>
            <Text style={styles.noteTitle}>Current Demo Credentials</Text>
            <Text style={styles.noteText}>Untuk sekarang credential hardcoded masih kosong untuk ID dan password.</Text>
          </View> */}

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <Pressable
            disabled={isSubmitting}
            onPress={handleSignIn}
            style={({ pressed }) => [
              styles.loginButton,
              (pressed || isSubmitting) && styles.loginButtonPressed,
            ]}>
            <Text style={styles.loginButtonText}>{isSubmitting ? 'Signing in...' : 'Sign In'}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
