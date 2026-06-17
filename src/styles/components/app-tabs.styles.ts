import { StyleSheet } from 'react-native';

import { AppColors, AppRadii, AppSpacing } from '@/styles';

export const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    bottom: AppSpacing.screen,
    left: AppSpacing.screen,
    right: AppSpacing.screen,
    alignItems: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 420,
    justifyContent: 'space-around',
    backgroundColor: AppColors.text,
    paddingHorizontal: AppSpacing.md,
    paddingVertical: AppSpacing.sm,
    borderRadius: 40,
  },
  activeTab: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.tabActive,
    borderRadius: AppRadii.tab,
    borderWidth: 1,
    borderColor: AppColors.success,
  },
  inactiveTab: {
    width: 52,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: AppRadii.tab,
  },
});
