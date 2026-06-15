import { StyleSheet } from 'react-native';

import { AppColors, AppRadii, AppSpacing, layoutPrimitives, textPrimitives } from '@/styles';

export const styles = StyleSheet.create({
  safeArea: layoutPrimitives.screen,
  scrollContent: layoutPrimitives.scrollContent,
  header: {
    ...layoutPrimitives.headerRow,
    alignItems: 'center',
    marginBottom: AppSpacing.screen,
  },
  title: textPrimitives.screenTitle,
  headerBadge: {
    ...layoutPrimitives.centerRow,
    gap: AppSpacing.xs,
    backgroundColor: AppColors.surface,
    paddingHorizontal: 12,
    paddingVertical: AppSpacing.sm,
    borderRadius: AppRadii.full,
  },
  headerBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.text,
  },
  heroCard: {
    backgroundColor: AppColors.text,
    borderRadius: AppRadii.xxl,
    padding: AppSpacing.hero,
    marginBottom: AppSpacing.section,
  },
  heroLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#A7B0A7',
    marginBottom: AppSpacing.md,
  },
  heroValue: {
    fontSize: 26,
    fontWeight: '800',
    color: AppColors.textInverse,
    marginBottom: AppSpacing.sm,
  },
  heroDetail: textPrimitives.bodyInverse,
  grid: {
    gap: AppSpacing.lg,
  },
  card: {
    backgroundColor: AppColors.surface,
    borderRadius: AppRadii.xl,
    padding: AppSpacing.section,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: AppSpacing.xl,
  },
  cardTitle: {
    fontSize: 13,
    color: AppColors.textSubtle,
    fontWeight: '600',
    marginBottom: AppSpacing.xs,
  },
  cardValue: {
    fontSize: 22,
    fontWeight: '700',
    color: AppColors.text,
    marginBottom: AppSpacing.xs,
  },
  cardDetail: {
    ...textPrimitives.body,
    color: '#5D635D',
  },
  bottomSpacer: layoutPrimitives.bottomSpacer,
});
