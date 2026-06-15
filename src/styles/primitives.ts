import type { TextStyle, ViewStyle } from 'react-native';

import { AppColors, AppRadii, AppSpacing, BottomTabInset } from '@/styles/tokens';

export const layoutPrimitives = {
  screen: {
    flex: 1,
    backgroundColor: AppColors.canvas,
  } satisfies ViewStyle,
  scrollContent: {
    paddingHorizontal: AppSpacing.screen,
    paddingTop: AppSpacing.lg,
    paddingBottom: AppSpacing.bottom,
  } satisfies ViewStyle,
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  } satisfies ViewStyle,
  centerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  } satisfies ViewStyle,
  bottomSpacer: {
    height: BottomTabInset + AppSpacing.screen,
  } satisfies ViewStyle,
} as const;

export const surfacePrimitives = {
  card: {
    backgroundColor: AppColors.surface,
    borderRadius: AppRadii.xxl,
    padding: AppSpacing.screen,
  } satisfies ViewStyle,
  darkCard: {
    backgroundColor: AppColors.text,
    borderRadius: AppRadii.xxl,
    padding: AppSpacing.screen,
  } satisfies ViewStyle,
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: AppRadii.icon,
    backgroundColor: AppColors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  } satisfies ViewStyle,
  iconButtonLarge: {
    width: 44,
    height: 44,
    borderRadius: AppRadii.iconLarge,
    backgroundColor: AppColors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  } satisfies ViewStyle,
  primaryButton: {
    minHeight: 54,
    borderRadius: AppRadii.md,
    backgroundColor: AppColors.text,
    justifyContent: 'center',
    alignItems: 'center',
  } satisfies ViewStyle,
  textInput: {
    borderRadius: AppRadii.md,
    backgroundColor: AppColors.surfaceMuted,
    paddingHorizontal: AppSpacing.xxl,
    paddingVertical: AppSpacing.xl,
    fontSize: 15,
    color: AppColors.text,
  } satisfies TextStyle,
} as const;

export const textPrimitives = {
  screenTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: AppColors.text,
  } satisfies TextStyle,
  pageTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: AppColors.text,
  } satisfies TextStyle,
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: AppColors.text,
  } satisfies TextStyle,
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: AppColors.text,
  } satisfies TextStyle,
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: AppColors.textMuted,
  } satisfies TextStyle,
  bodyInverse: {
    fontSize: 14,
    lineHeight: 20,
    color: AppColors.textInverseMuted,
  } satisfies TextStyle,
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.textMuted,
  } satisfies TextStyle,
  captionStrong: {
    fontSize: 12,
    fontWeight: '700',
  } satisfies TextStyle,
  buttonLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: AppColors.textInverse,
  } satisfies TextStyle,
} as const;
