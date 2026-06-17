import { StyleSheet } from 'react-native';

import { AppColors, AppRadii, AppSpacing, layoutPrimitives, surfacePrimitives, textPrimitives } from '@/styles';

export const styles = StyleSheet.create({
  safeArea: layoutPrimitives.screen,
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: AppSpacing.screen,
    paddingVertical: AppSpacing.hero,
    gap: AppSpacing.section,
    backgroundColor: AppColors.canvas,
  },
  heroCard: {
    backgroundColor: AppColors.text,
    borderRadius: AppRadii.hero,
    padding: AppSpacing.hero,
    gap: AppSpacing.sm,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#AFC4B8',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: AppColors.textInverse,
  },
  subtitle: {
    ...textPrimitives.bodyInverse,
    color: '#D3DBD5',
  },
  formCard: {
    ...surfacePrimitives.card,
    gap: AppSpacing.xxl,
  },
  fieldGroup: {
    gap: AppSpacing.sm,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.text,
  },
  input: {
    ...surfacePrimitives.textInput,
    height: 54,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  noteCard: {
    backgroundColor: AppColors.surfaceSuccess,
    borderRadius: AppRadii.md,
    padding: AppSpacing.xl,
    gap: AppSpacing.xs,
  },
  noteTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.text,
  },
  noteText: {
    ...textPrimitives.body,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#C2410C',
  },
  loginButton: surfacePrimitives.primaryButton,
  loginButtonPressed: {
    opacity: 0.92,
  },
  loginButtonText: textPrimitives.buttonLabel,
});
