import { StyleSheet } from 'react-native';

import {
  AppColors,
  AppRadii,
  AppSpacing,
  layoutPrimitives,
  surfacePrimitives,
  textPrimitives,
} from '@/styles';

export const styles = StyleSheet.create({
  safeArea: layoutPrimitives.screen,
  scrollContent: layoutPrimitives.scrollContent,
  header: {
    ...layoutPrimitives.headerRow,
    alignItems: 'flex-start',
    marginBottom: AppSpacing.section,
  },
  pageTitle: textPrimitives.pageTitle,
  pageSubtitle: {
    fontSize: 14,
    color: AppColors.textSubtle,
  },
  headerBadge: surfacePrimitives.iconButtonLarge,
  searchBar: {
    ...layoutPrimitives.centerRow,
    backgroundColor: AppColors.surface,
    borderRadius: AppRadii.xl,
    paddingHorizontal: AppSpacing.xxl,
    height: 52,
    gap: AppSpacing.md,
    marginBottom: AppSpacing.xxl,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: AppColors.text,
  },
  heroCard: {
    ...surfacePrimitives.darkCard,
    marginBottom: AppSpacing.xxl,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: AppSpacing.md,
    marginBottom: AppSpacing.sm,
  },
  heroBadge: {
    ...layoutPrimitives.centerRow,
    alignSelf: 'flex-start',
    backgroundColor: AppColors.surfaceSuccess,
    paddingHorizontal: 12,
    paddingVertical: AppSpacing.sm,
    borderRadius: AppRadii.full,
    gap: AppSpacing.xs,
  },
  heroBadgeText: {
    ...textPrimitives.captionStrong,
    color: AppColors.success,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: AppColors.textInverse,
    marginBottom: AppSpacing.sm,
  },
  heroText: {
    ...textPrimitives.bodyInverse,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: AppSpacing.lg,
    marginBottom: AppSpacing.section,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: AppColors.surface,
    borderRadius: AppRadii.xl,
    padding: AppSpacing.xxl,
  },
  summaryLabel: {
    ...textPrimitives.label,
    color: AppColors.textSubtle,
    marginBottom: AppSpacing.sm,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '800',
    color: AppColors.text,
  },
  sectionHeader: {
    ...layoutPrimitives.headerRow,
    alignItems: 'center',
    marginBottom: AppSpacing.lg,
  },
  sectionTitle: textPrimitives.sectionTitle,
  sectionAction: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.primary,
  },
  roomCard: {
    backgroundColor: AppColors.surface,
    borderRadius: 26,
    padding: AppSpacing.section,
    marginBottom: AppSpacing.xl,
  },
  roomCardInactive: {
    opacity: 0.72,
  },
  roomTopRow: {
    ...layoutPrimitives.headerRow,
    alignItems: 'center',
    marginBottom: AppSpacing.xl,
  },
  roomIconWrap: {
    width: 44,
    height: 44,
    borderRadius: AppRadii.iconLarge,
    backgroundColor: AppColors.surfaceAccent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricChip: {
    alignItems: 'flex-end',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '800',
    color: AppColors.text,
  },
  metricLabel: {
    ...textPrimitives.label,
    color: AppColors.textSubtle,
  },
  roomTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.text,
    marginBottom: AppSpacing.xxs,
  },
  roomSubtitle: {
    fontSize: 14,
    color: AppColors.textSubtle,
    marginBottom: AppSpacing.sm,
  },
  roomDescription: {
    ...textPrimitives.body,
    marginBottom: AppSpacing.xl,
  },
  metaRow: {
    ...layoutPrimitives.headerRow,
    gap: AppSpacing.md,
    marginBottom: AppSpacing.xl,
  },
  metaItem: {
    ...layoutPrimitives.centerRow,
    gap: AppSpacing.xs,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.textSubtle,
  },
  dotSuccess: {
    width: 8,
    height: 8,
    borderRadius: AppRadii.full,
    backgroundColor: AppColors.success,
  },
  dotWarning: {
    width: 8,
    height: 8,
    borderRadius: AppRadii.full,
    backgroundColor: AppColors.primary,
  },
  dotNeutral: {
    width: 8,
    height: 8,
    borderRadius: AppRadii.full,
    backgroundColor: AppColors.textMuted,
  },
  sourceGrid: {
    gap: AppSpacing.lg,
  },
  sourceCard: {
    backgroundColor: AppColors.backgroundMuted,
    borderRadius: AppRadii.lg,
    padding: AppSpacing.xl,
    gap: AppSpacing.xs,
  },
  sourceHeader: {
    ...layoutPrimitives.centerRow,
    gap: AppSpacing.xs,
    marginBottom: AppSpacing.xs,
  },
  sourceDot: {
    width: 8,
    height: 8,
    borderRadius: AppRadii.full,
  },
  sourceDotPlc: {
    backgroundColor: AppColors.success,
  },
  sourceDotDashboard: {
    backgroundColor: AppColors.primary,
  },
  sourceTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.text,
  },
  sourcePoint: {
    fontSize: 13,
    lineHeight: 18,
    color: AppColors.textMuted,
  },
  roomAction: {
    marginTop: AppSpacing.xl,
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.primary,
  },
  bottomSpacer: layoutPrimitives.bottomSpacer,
});
