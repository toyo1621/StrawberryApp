import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FONT_WEIGHT_BOLD, MARU_GOTHIC_FONT } from '../../constants/fonts';
import { getTheme } from '../../theme';

type StatusBannerProps = {
  message: string;
  tone?: 'error' | 'success';
  onDismiss?: () => void;
  darkMode?: boolean;
};

const StatusBanner: React.FC<StatusBannerProps> = ({
  message,
  tone = 'error',
  onDismiss,
  darkMode = false,
}) => {
  const theme = getTheme(darkMode);
  const foreground = tone === 'error' ? theme.danger : theme.success;
  const background = tone === 'error' ? theme.dangerBackground : theme.successBackground;

  return (
    <View
      accessibilityLiveRegion={tone === 'error' ? 'assertive' : 'polite'}
      accessibilityRole="alert"
      style={[styles.container, { backgroundColor: background, borderColor: foreground }]}
    >
      <Text style={[styles.message, { color: foreground }]}>{message}</Text>
      {onDismiss && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="通知を閉じる"
          hitSlop={8}
          onPress={onDismiss}
          style={styles.dismissButton}
        >
          <Text style={[styles.dismissText, { color: foreground }]}>×</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 44,
    justifyContent: 'center',
    position: 'relative',
  },
  message: {
    fontFamily: MARU_GOTHIC_FONT,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: FONT_WEIGHT_BOLD,
  },
  dismissButton: {
    position: 'absolute',
    right: 4,
    top: 2,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissText: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: FONT_WEIGHT_BOLD,
  },
});

export default StatusBanner;
