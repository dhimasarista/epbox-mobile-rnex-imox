import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { ActivityIndicator, View, useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import LoginScreen from '@/components/login-screen';
import { useAuth, AuthProvider } from '@/providers/auth-provider';
import { AppColors } from '@/styles';

function RootContent() {
  const colorScheme = useColorScheme();

  const { isAuthenticated, isLoading } = useAuth();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {isLoading ? (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: AppColors.canvas,
          }}>
          <ActivityIndicator size="large" color={AppColors.primary} />
        </View>
      ) : isAuthenticated ? (
        <>
          <AnimatedSplashOverlay />
          <AppTabs />
        </>
      ) : (
        <LoginScreen />
      )}
    </ThemeProvider>
  );
}

export default function TabLayout() {
  return (
    <AuthProvider>
      <RootContent />
    </AuthProvider>
  );
}
