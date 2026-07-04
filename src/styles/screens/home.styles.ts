import { StyleSheet } from 'react-native';

import { AppColors, AppRadii, AppSpacing, layoutPrimitives, surfacePrimitives } from '@/styles';

const BANNER_BASE_WIDTH = 412;
const BANNER_BASE_HEIGHT = 915;
const BANNER_BASE_SIZE = 147;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function getBannerHeight(screenWidth: number, screenHeight: number) {
  const widthScale = screenWidth / BANNER_BASE_WIDTH;
  const heightScale = screenHeight / BANNER_BASE_HEIGHT;
  const blendedScale = widthScale * 0.7 + heightScale * 0.3;

  return Math.round(BANNER_BASE_SIZE * clamp(blendedScale, 0.82, 1.15));
}

export const styles = StyleSheet.create({
  safeArea: layoutPrimitives.screen,
  scrollContent: {
    ...layoutPrimitives.scrollContent,
    paddingTop: AppSpacing.md,
  },
  header: {
    ...layoutPrimitives.headerRow,
    alignItems: 'center',
    marginBottom: 24,
  },
  titleRow: {
    ...layoutPrimitives.centerRow,
    gap: AppSpacing.xs,
  },
  appTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: AppColors.text,
  },
  statusRow: {
    ...layoutPrimitives.centerRow,
    gap: AppSpacing.xs,
    marginTop: AppSpacing.xxs,
  },
  subtitle: {
    fontSize: 14,
    color: AppColors.textMuted,
    fontWeight: '500',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: AppRadii.full,
    backgroundColor: AppColors.success,
  },
  statusText: {
    fontSize: 14,
    color: AppColors.textMuted,
    fontWeight: '500',
  },
  headerIcons: {
    ...layoutPrimitives.centerRow,
    gap: AppSpacing.lg,
  },
  iconBtn: surfacePrimitives.iconButton,
  notificationDot: {
    position: 'absolute',
    top: AppSpacing.md,
    right: AppSpacing.lg,
    width: 8,
    height: 8,
    borderRadius: AppRadii.full,
    backgroundColor: AppColors.primary,
    borderWidth: 1.5,
    borderColor: AppColors.surface,
  },
  bannerCard: {
    marginBottom: AppSpacing.xxl,
    borderRadius: AppRadii.xxl,
    backgroundColor: AppColors.surface,
    padding: 8,
  },
  bannerBackground: {
    borderRadius: AppRadii.xl,
    backgroundColor: '#D1E8E2',
    overflow: 'hidden',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  unlockButtonOverlay: {
    position: 'absolute',
    bottom: AppSpacing.lg,
    right: AppSpacing.lg,
  },
  unlockButton: {
    ...layoutPrimitives.centerRow,
    backgroundColor: AppColors.primary,
    paddingVertical: AppSpacing.md,
    paddingLeft: AppSpacing.xxl,
    paddingRight: AppSpacing.md,
    borderRadius: AppRadii.hero,
    gap: AppSpacing.sm,
  },
  unlockText: {
    color: AppColors.textInverse,
    fontSize: 14,
    fontWeight: '600',
  },
  unlockIconWrapper: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: AppColors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  batteryCard: {
    ...layoutPrimitives.centerRow,
    justifyContent: 'space-between',
    backgroundColor: AppColors.text,
    padding: AppSpacing.screen,
    borderRadius: AppRadii.xxl,
    marginBottom: 24,
  },
  batteryPercent: {
    color: AppColors.textInverse,
    fontSize: 32,
    fontWeight: '800',
  },
  batteryLabel: {
    color: '#999999',
    fontSize: 14,
    fontWeight: '500',
    marginTop: -2,
  },
  batteryVisualizer: {
    ...layoutPrimitives.centerRow,
    height: 40,
    paddingHorizontal: AppSpacing.sm,
    paddingVertical: AppSpacing.xs,
    borderRadius: AppRadii.lg,
    borderColor: AppColors.borderStrong,
    borderWidth: 2,
    gap: AppSpacing.xxs,
  },
  batteryBar: {
    width: 8,
    height: '100%',
    backgroundColor: AppColors.borderStrong,
    borderRadius: 4,
  },
  batteryBarActive: {
    backgroundColor: AppColors.success,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: AppSpacing.lg,
    justifyContent: 'space-between',
  },
  dashboardHeader: {
    marginBottom: AppSpacing.xxl,
    gap: AppSpacing.xs,
  },
  dashboardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: AppColors.text,
  },
  dashboardSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: AppColors.textMuted,
  },
  statCard: {
    width: '48%',
    backgroundColor: AppColors.surface,
    borderRadius: AppRadii.xl,
    padding: AppSpacing.xxl,
  },
  statHeader: {
    ...layoutPrimitives.headerRow,
    alignItems: 'flex-start',
    marginBottom: AppSpacing.screen,
  },
  statTitle: {
    fontSize: 13,
    color: '#222222',
    fontWeight: '600',
    lineHeight: 18,
  },
  statIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: AppColors.surfaceAccent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: AppColors.text,
  },
  statUnit: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.textMuted,
  },
  localZoneToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.sm,
  },
  localZoneStatusDot: {
    width: 8,
    height: 8,
    borderRadius: AppRadii.full,
  },
  localZonePill: {
    width: 44,
    height: 26,
    borderRadius: AppRadii.full,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  localZoneThumb: {
    width: 20,
    height: 20,
    borderRadius: AppRadii.full,
    backgroundColor: AppColors.textInverse,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  zoneSwitchCard: {
    width: '48%',
    backgroundColor: AppColors.surface,
    borderRadius: AppRadii.xl,
    padding: AppSpacing.xxl,
  },
  zoneSwitchHeader: {
    ...layoutPrimitives.headerRow,
    alignItems: 'flex-start',
    marginBottom: AppSpacing.sm,
  },
  zoneSwitchTitle: {
    fontSize: 13,
    color: '#222222',
    fontWeight: '600',
    lineHeight: 18,
    flex: 1,
  },
  zoneSwitchStatusDot: {
    width: 8,
    height: 8,
    borderRadius: AppRadii.full,
    marginTop: 4,
  },
  zoneSwitchStateLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.text,
    marginBottom: AppSpacing.md,
  },
  zoneSwitchBtnRow: {
    ...layoutPrimitives.centerRow,
    gap: AppSpacing.sm,
  },
  zoneSwitchBtn: {
    flex: 1,
    paddingVertical: AppSpacing.sm,
    borderRadius: AppRadii.lg,
    alignItems: 'center',
    backgroundColor: AppColors.surfaceAccent,
  },
  zoneSwitchBtnActive: {
    backgroundColor: AppColors.primary,
  },
  zoneSwitchBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.textMuted,
  },
  zoneSwitchBtnTextActive: {
    color: AppColors.textInverse,
  },
  bottomSpacer: layoutPrimitives.bottomSpacer,
});
