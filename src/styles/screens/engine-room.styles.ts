import { StyleSheet } from 'react-native';

import {
  AppColors,
  AppRadii,
  AppSpacing,
  layoutPrimitives,
  surfacePrimitives,
} from '@/styles';

export const styles = StyleSheet.create({
  safeArea: layoutPrimitives.screen,
  header: {
    ...layoutPrimitives.headerRow,
    alignItems: 'center',
    paddingHorizontal: AppSpacing.screen,
    paddingTop: AppSpacing.md,
    paddingBottom: AppSpacing.md,
    gap: AppSpacing.md,
  },
  backBtn: surfacePrimitives.iconButton,
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerLabel: {
    fontSize: 17,
    fontWeight: '800',
    color: AppColors.text,
  },
  headerSubLabel: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '700',
    color: AppColors.textSubtle,
  },
  headerBadge: {
    ...surfacePrimitives.iconButton,
    backgroundColor: AppColors.surfaceAccent,
  },
  segmentBar: {
    flexDirection: 'row',
    gap: AppSpacing.sm,
    paddingHorizontal: AppSpacing.screen,
    paddingBottom: AppSpacing.md,
  },
  segmentButton: {
    flex: 1,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: AppSpacing.xs,
    borderRadius: AppRadii.sm,
    borderWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.surface,
    paddingHorizontal: AppSpacing.sm,
  },
  segmentButtonActive: {
    borderColor: AppColors.primary,
    backgroundColor: AppColors.primary,
  },
  segmentText: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '800',
    color: AppColors.textSubtle,
    textAlign: 'center',
  },
  segmentTextActive: {
    color: AppColors.textInverse,
  },
  scrollContent: {
    padding: AppSpacing.screen,
    paddingBottom: AppSpacing.bottom,
    gap: AppSpacing.xxl,
  },
  bottomSpacer: {
    height: 96,
  },
});
