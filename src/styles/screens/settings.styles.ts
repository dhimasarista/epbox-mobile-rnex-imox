import { StyleSheet } from 'react-native';

import { AppColors, AppRadii, AppSpacing, layoutPrimitives, surfacePrimitives, textPrimitives } from '@/styles';

export const styles = StyleSheet.create({
  safeArea: layoutPrimitives.screen,
  scrollContent: {
    ...layoutPrimitives.scrollContent,
    gap: AppSpacing.xl,
  },
  header: {
    ...layoutPrimitives.headerRow,
    alignItems: 'flex-start',
  },
  title: textPrimitives.screenTitle,
  subtitle: {
    maxWidth: 250,
    fontSize: 13,
    lineHeight: 18,
    color: AppColors.textMuted,
  },
  headerIcon: {
    ...surfacePrimitives.iconButtonLarge,
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  formCard: {
    ...surfacePrimitives.card,
    gap: AppSpacing.xxl,
  },
  formCardHeader: {
    gap: AppSpacing.md,
  },
  formBadge: {
    ...layoutPrimitives.centerRow,
    alignSelf: 'flex-start',
    backgroundColor: AppColors.surfaceSuccess,
    borderRadius: AppRadii.full,
    paddingHorizontal: 12,
    paddingVertical: AppSpacing.sm,
    gap: AppSpacing.xs,
  },
  formBadgeText: {
    ...textPrimitives.captionStrong,
    color: AppColors.success,
  },
  formTitle: textPrimitives.cardTitle,
  formDescription: textPrimitives.body,
  inputGroup: {
    gap: AppSpacing.sm,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.text,
  },
  input: {
    ...surfacePrimitives.textInput,
    height: 54,
  },
  statusCard: {
    ...layoutPrimitives.centerRow,
    backgroundColor: AppColors.canvas,
    borderRadius: AppRadii.md,
    paddingHorizontal: AppSpacing.xl,
    paddingVertical: AppSpacing.lg,
    gap: AppSpacing.md,
  },
  statusText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: AppColors.textMuted,
  },
  saveButton: surfacePrimitives.primaryButton,
  saveButtonPressed: {
    opacity: 0.92,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: textPrimitives.buttonLabel,
  infoCard: {
    backgroundColor: AppColors.text,
    borderRadius: AppRadii.xxl,
    padding: 22,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#B4BAB4',
    marginBottom: AppSpacing.sm,
  },
  infoValue: {
    fontSize: 26,
    fontWeight: '800',
    color: AppColors.textInverse,
    marginBottom: AppSpacing.xxs,
  },
  infoSubtitle: {
    fontSize: 14,
    color: AppColors.textInverseMuted,
  },
  bottomSpacer: layoutPrimitives.bottomSpacer,
});
