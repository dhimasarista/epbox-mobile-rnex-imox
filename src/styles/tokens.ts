import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const AppColors = {
  canvas: '#F6F5F2',
  surface: '#FFFFFF',
  surfaceMuted: '#F3F5F3',
  surfaceSuccess: '#EDF8F2',
  surfaceAccent: '#FEF0EB',
  surfaceError: '#FDF2F2',
  background: '#F6F5F2',
  backgroundMuted: '#F3F5F3',
  backgroundAccent: '#FEF0EB',
  backgroundError: '#FDF2F2',
  text: '#1A1C1A',
  textMuted: '#5E645E',
  textSubtle: '#6B706B',
  textInverse: '#FFFFFF',
  textInverseMuted: '#D4D7D4',
  textInverseSubtle: '#CDD2CD',
  border: '#E4E8E4',
  borderStrong: '#333333',
  primary: '#FF6B35',
  success: '#10B981',
  info: '#3B82F6',
  tabMuted: '#7B7F7B',
  tabActive: '#333533',
  warning: "#FBBF24",
  error: "#EF4444",
} as const;

export const AppSpacing = {
  xxs: 4,
  xs: 6,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 14,
  xxl: 16,
  section: 18,
  screen: 20,
  hero: 22,
  bottom: 36,
} as const;

export const AppRadii = {
  sm: 12,
  md: 18,
  lg: 20,
  xl: 24,
  xxl: 28,
  hero: 30,
  full: 999,
  icon: 20,
  iconLarge: 22,
  tab: 26,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
