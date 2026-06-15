import { StyleSheet } from 'react-native';

import { AppColors, AppRadii, AppSpacing, layoutPrimitives, surfacePrimitives, textPrimitives } from '@/styles';

export const styles = StyleSheet.create({
  safeArea: layoutPrimitives.screen,
  header: {
    ...layoutPrimitives.headerRow,
    alignItems: 'center',
    paddingHorizontal: AppSpacing.screen,
    paddingTop: AppSpacing.md,
    paddingBottom: AppSpacing.md,
  },
  backBtn: surfacePrimitives.iconButton,
  headerLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: AppColors.text,
  },
  headerGhost: {
    width: 40,
    height: 40,
  },
  scrollContent: {
    padding: AppSpacing.screen,
    paddingBottom: AppSpacing.bottom,
    gap: AppSpacing.xxl,
  },
  heroCard: {
    backgroundColor: AppColors.text,
    borderRadius: AppRadii.hero,
    padding: AppSpacing.screen,
  },
  heroTopRow: {
    ...layoutPrimitives.headerRow,
    alignItems: 'center',
    marginBottom: AppSpacing.section,
  },
  heroBadge: {
    ...layoutPrimitives.centerRow,
    backgroundColor: AppColors.surfaceAccent,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: AppRadii.full,
    gap: AppSpacing.xs,
  },
  heroBadgeText: {
    ...textPrimitives.captionStrong,
    color: AppColors.primary,
  },
  liveChip: {
    ...layoutPrimitives.centerRow,
    gap: AppSpacing.xs,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: AppRadii.full,
    backgroundColor: AppColors.success,
  },
  liveChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D5D9D5',
  },
  heroTitle: {
    color: AppColors.textInverse,
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 31,
    marginBottom: AppSpacing.md,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: AppColors.textInverseSubtle,
  },
  sectionCard: {
    backgroundColor: AppColors.surface,
    borderRadius: AppRadii.xxl,
    padding: AppSpacing.section,
  },
  sectionTitle: {
    ...textPrimitives.sectionTitle,
    marginBottom: AppSpacing.xl,
  },
  fieldBlock: {
    marginBottom: AppSpacing.xl,
  },
  fieldLabel: textPrimitives.label,
  input: {
    ...surfacePrimitives.textInput,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  remarksInput: {
    minHeight: 110,
  },
  summaryCard: {
    backgroundColor: AppColors.surfaceSuccess,
    borderRadius: AppRadii.xxl,
    padding: AppSpacing.section,
  },
  summaryTitle: {
    ...textPrimitives.sectionTitle,
    marginBottom: AppSpacing.xl,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: AppSpacing.lg,
  },
  summaryItem: {
    width: '47%',
    backgroundColor: AppColors.surface,
    borderRadius: AppRadii.lg,
    padding: AppSpacing.xl,
  },
  summaryLabel: {
    ...textPrimitives.label,
    marginBottom: AppSpacing.xs,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '800',
    color: AppColors.text,
  },
  primaryButton: {
    backgroundColor: AppColors.primary,
    borderRadius: AppRadii.hero,
    paddingVertical: AppSpacing.section,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: AppColors.textInverse,
    fontSize: 16,
    fontWeight: '700',
  },
  bottomSpacer: {
    height: 96,
  },
});
