import { StyleSheet } from 'react-native';

import {
  AppColors,
  AppRadii,
  AppSpacing,
  layoutPrimitives,
  surfacePrimitives,
  textPrimitives,
} from '@/styles';

export type SignalTone = 'normal' | 'warning' | 'danger';

export function getSignalPalette(tone: SignalTone) {
  if (tone === 'danger') {
    return {
      surface: AppColors.surfaceError,
      border: '#F4B7B7',
      accent: AppColors.error,
      text: AppColors.error,
      track: '#F1D4D4',
    };
  }

  if (tone === 'warning') {
    return {
      surface: '#FFF7E0',
      border: '#F2D17A',
      accent: AppColors.warning,
      text: '#A16207',
      track: '#F3E6B5',
    };
  }

  return {
    surface: AppColors.surfaceSuccess,
    border: '#9BD7B6',
    accent: AppColors.success,
    text: AppColors.success,
    track: '#CBE9D8',
  };
}

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
  plcDot: {
    backgroundColor: AppColors.success,
  },
  liveChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D5D9D5',
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
  fieldBlock: {
    marginBottom: AppSpacing.xl,
  },
  fieldHeaderRow: {
    ...layoutPrimitives.headerRow,
    alignItems: 'center',
    gap: AppSpacing.lg,
    marginBottom: AppSpacing.sm,
  },
  fieldLabel: textPrimitives.label,
  pressureSlider: {
    height: 34,
  },
  signalValueChip: {
    ...layoutPrimitives.centerRow,
    gap: AppSpacing.xs,
    paddingHorizontal: AppSpacing.md,
    paddingVertical: AppSpacing.xs,
    borderRadius: AppRadii.full,
    borderWidth: 1,
  },
  signalValueDot: {
    width: 8,
    height: 8,
    borderRadius: AppRadii.full,
  },
  signalValueText: {
    fontSize: 12,
    fontWeight: '800',
  },
  signalSliderShell: {
    borderRadius: AppRadii.lg,
    borderWidth: 1,
    paddingHorizontal: AppSpacing.md,
    paddingTop: AppSpacing.sm,
    paddingBottom: AppSpacing.md,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  signalSliderShellNormal: {
    backgroundColor: AppColors.surfaceSuccess,
    borderColor: '#9BD7B6',
  },
  signalSliderShellWarning: {
    backgroundColor: '#FFF9E8',
    borderColor: '#F2D17A',
  },
  signalSliderShellDanger: {
    backgroundColor: AppColors.surfaceError,
    borderColor: '#F4B7B7',
  },
  signalBandsRow: {
    flexDirection: 'row',
    gap: AppSpacing.xs,
    marginTop: AppSpacing.xs,
  },
  signalBand: {
    flex: 1,
    height: 6,
    borderRadius: AppRadii.full,
    opacity: 0.25,
  },
  signalBandNormal: {
    backgroundColor: AppColors.success,
  },
  signalBandWarning: {
    backgroundColor: AppColors.warning,
  },
  signalBandDanger: {
    backgroundColor: AppColors.error,
  },
  signalBandActive: {
    height: 8,
    opacity: 1,
  },
  signalStateBadge: {
    paddingHorizontal: AppSpacing.md,
    paddingVertical: AppSpacing.xxs,
    borderRadius: AppRadii.full,
    borderWidth: 1,
  },
  sliderRangeRow: {
    ...layoutPrimitives.centerRow,
    justifyContent: 'space-between',
    gap: AppSpacing.sm,
    marginTop: AppSpacing.xs,
  },
  sliderRangeText: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.textSubtle,
  },
  signalStateText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  stepperButtonDisabled: {
    opacity: 0.45,
  },
  dashboardFieldBlock: {
    marginBottom: AppSpacing.xl,
  },
  dashboardControlCard: {
    backgroundColor: AppColors.surface,
    borderRadius: AppRadii.lg,
    borderWidth: 1,
    borderColor: '#F5D3C5',
    padding: AppSpacing.xl,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  dashboardControlHeader: {
    ...layoutPrimitives.headerRow,
    alignItems: 'center',
    gap: AppSpacing.md,
    marginBottom: AppSpacing.md,
  },
  dashboardValueChip: {
    paddingHorizontal: AppSpacing.md,
    paddingVertical: AppSpacing.xs,
    borderRadius: AppRadii.full,
    backgroundColor: AppColors.surfaceAccent,
  },
  dashboardValueChipStable: {
    backgroundColor: AppColors.surfaceSuccess,
  },
  dashboardValueChipWarning: {
    backgroundColor: '#FFF4DB',
  },
  dashboardValueChipDanger: {
    backgroundColor: AppColors.surfaceError,
  },
  dashboardValueChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: AppColors.primary,
  },
  dashboardValueChipTextStable: {
    color: AppColors.success,
  },
  dashboardValueChipTextWarning: {
    color: '#B7791F',
  },
  dashboardValueChipTextDanger: {
    color: AppColors.error,
  },
  dashboardControlHint: {
    marginTop: AppSpacing.md,
    fontSize: 12,
    lineHeight: 17,
    color: AppColors.textSubtle,
    textAlign: 'center',
  },
  alarmSectionHeader: {
    ...layoutPrimitives.headerRow,
    alignItems: 'flex-start',
    gap: AppSpacing.md,
    marginBottom: AppSpacing.lg,
  },
  alarmSectionSubtitle: {
    marginTop: AppSpacing.xs,
    fontSize: 12,
    lineHeight: 17,
    color: AppColors.textSubtle,
  },
  alarmSummaryRow: {
    flexDirection: 'row',
    gap: AppSpacing.md,
    marginBottom: AppSpacing.lg,
  },
  alarmMetaRow: {
    flexDirection: 'row',
    gap: AppSpacing.md,
    marginBottom: AppSpacing.lg,
  },
  alarmSummaryChip: {
    flex: 1,
    borderRadius: AppRadii.md,
    borderWidth: 1,
    paddingHorizontal: AppSpacing.md,
    paddingVertical: AppSpacing.md,
    gap: AppSpacing.xs,
  },
  alarmSummaryLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: AppColors.textSubtle,
  },
  alarmSummaryValue: {
    fontSize: 14,
    fontWeight: '800',
    color: AppColors.text,
  },
  alarmOutputList: {
    borderRadius: AppRadii.lg,
    borderWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.surfaceMuted,
    overflow: 'hidden',
  },
  alarmNoticeCard: {
    marginTop: AppSpacing.lg,
    borderRadius: AppRadii.lg,
    borderWidth: 1,
    borderColor: '#F2D17A',
    backgroundColor: '#FFF7E0',
    paddingHorizontal: AppSpacing.md,
    paddingVertical: AppSpacing.md,
    gap: AppSpacing.xs,
  },
  alarmNoticeTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#A16207',
  },
  alarmNoticeText: {
    fontSize: 12,
    lineHeight: 17,
    color: '#A16207',
  },
  alarmOutputRow: {
    ...layoutPrimitives.centerRow,
    gap: AppSpacing.md,
    minHeight: 46,
    paddingHorizontal: AppSpacing.md,
    paddingVertical: AppSpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border,
  },
  alarmOutputRowActive: {
    backgroundColor: '#FFF8F4',
  },
  alarmOutputDot: {
    width: 10,
    height: 10,
    borderRadius: AppRadii.full,
  },
  alarmOutputLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.text,
  },
  alarmCommandGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: AppSpacing.md,
    marginTop: AppSpacing.section,
  },
  alarmCommandButton: {
    minHeight: 48,
    minWidth: '48%',
    flexGrow: 1,
    borderRadius: AppRadii.md,
    paddingHorizontal: AppSpacing.md,
    paddingVertical: AppSpacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  alarmCommandButtonPrimary: {
    backgroundColor: AppColors.text,
    borderColor: AppColors.text,
  },
  alarmCommandButtonSecondary: {
    backgroundColor: AppColors.surface,
    borderColor: '#F5D3C5',
  },
  alarmCommandButtonDisabled: {
    opacity: 0.45,
  },
  alarmCommandButtonText: {
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  alarmCommandButtonTextPrimary: {
    color: AppColors.textInverse,
  },
  alarmCommandButtonTextSecondary: {
    color: AppColors.primary,
  },
  dashboardToggleRow: {
    ...layoutPrimitives.centerRow,
    justifyContent: 'space-between',
    minHeight: 52,
    gap: AppSpacing.lg,
  },
  dashboardToggleValue: {
    marginTop: AppSpacing.xs,
    fontSize: 16,
    fontWeight: '800',
    color: AppColors.text,
  },
  alarmToggle: {
    position: 'relative',
    width: 118,
    height: 46,
    borderRadius: AppRadii.full,
    padding: 4,
    borderWidth: 1,
    justifyContent: 'center',
  },
  alarmToggleInactive: {
    backgroundColor: AppColors.surfaceMuted,
    borderColor: AppColors.border,
  },
  alarmToggleActive: {
    backgroundColor: AppColors.surfaceError,
    borderColor: '#F8B4B4',
  },
  alarmToggleThumb: {
    position: 'absolute',
    top: 4,
    width: 52,
    height: 36,
    borderRadius: AppRadii.full,
    backgroundColor: AppColors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  alarmToggleThumbInactive: {
    left: 4,
  },
  alarmToggleThumbActive: {
    left: 62,
  },
  dashboardStepperRow: {
    ...layoutPrimitives.centerRow,
    gap: AppSpacing.sm,
  },
  dashboardStepperButton: {
    width: 48,
    height: 56,
    borderRadius: AppRadii.md,
    backgroundColor: AppColors.surfaceMuted,
    borderWidth: 1,
    borderColor: AppColors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dashboardReadoutShell: {
    ...layoutPrimitives.centerRow,
    flex: 1,
    minHeight: 56,
    borderRadius: AppRadii.md,
    backgroundColor: '#FFF8F4',
    borderWidth: 1,
    borderColor: '#F5D3C5',
    paddingLeft: AppSpacing.xxl,
    paddingRight: AppSpacing.xl,
  },
  dashboardReadoutValue: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: AppColors.text,
  },
  dashboardReadoutUnit: {
    fontSize: 13,
    fontWeight: '800',
    color: AppColors.primary,
  },
  statusSegmentRow: {
    flexDirection: 'row',
    gap: AppSpacing.sm,
    marginTop: AppSpacing.sm,
  },
  statusSegmentButton: {
    flex: 1,
    minHeight: 110,
    borderRadius: AppRadii.lg,
    backgroundColor: AppColors.surface,
    borderWidth: 1,
    borderColor: AppColors.border,
    paddingHorizontal: AppSpacing.md,
    paddingVertical: AppSpacing.md,
  },
  statusSegmentButtonActive: {
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  statusSegmentTopRow: {
    ...layoutPrimitives.headerRow,
    alignItems: 'center',
    marginBottom: AppSpacing.md,
  },
  statusSegmentLamp: {
    width: 10,
    height: 10,
    borderRadius: AppRadii.full,
    opacity: 0.45,
  },
  statusSegmentLampActive: {
    opacity: 1,
  },
  statusSegmentCode: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: AppColors.textSubtle,
  },
  statusSegmentCap: {
    width: 48,
    height: 48,
    borderRadius: AppRadii.full,
    backgroundColor: AppColors.surfaceMuted,
    borderWidth: 1,
    borderColor: AppColors.border,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: AppSpacing.md,
  },
  statusSegmentCapActive: {
    backgroundColor: AppColors.surface,
  },
  statusSegmentText: {
    fontSize: 12,
    fontWeight: '800',
    color: AppColors.text,
    textAlign: 'center',
  },
  statusSegmentTextActive: {
    color: AppColors.text,
  },
  dashboardPressureSlider: {
    height: 34,
  },
  summaryCard: {
    backgroundColor: AppColors.surfaceAccent,
    borderRadius: AppRadii.xxl,
    padding: AppSpacing.section,
  },
  bottomSpacer: {
    height: 96,
  },
});
