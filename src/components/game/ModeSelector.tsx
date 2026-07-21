import React from 'react';
import { StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { FONT_WEIGHT_BOLD, MARU_GOTHIC_FONT } from '../../constants/fonts';
import { GAME_MODE_CONFIG, GAME_MODE_ORDER } from '../../gameConfig';
import { getTheme } from '../../theme';
import { GameMode } from '../../types';

type ModeSelectorProps = {
  value: GameMode;
  onChange: (mode: GameMode) => void;
  darkMode?: boolean;
};

const ModeSelector: React.FC<ModeSelectorProps> = ({ value, onChange, darkMode = false }) => {
  const theme = getTheme(darkMode);
  const { width } = useWindowDimensions();
  const compact = width < 480;

  return (
    <View
      accessibilityLabel="ゲームモード"
      style={styles.content}
    >
      {GAME_MODE_ORDER.map((mode) => {
        const config = GAME_MODE_CONFIG[mode];
        const selected = value === mode;
        const accent = config.accent;
        return (
          <TouchableOpacity
            key={mode}
            accessibilityRole="button"
            accessibilityLabel={`${config.shortLabel}モードを選択`}
            accessibilityState={{ selected }}
            aria-pressed={selected}
            onPress={() => onChange(mode)}
            style={[
              styles.button,
              compact ? styles.buttonCompact : styles.buttonWide,
              {
                backgroundColor: selected ? accent : theme.surfaceMuted,
                borderColor: selected ? accent : theme.border,
              },
            ]}
          >
            <Text accessible={false} style={styles.emoji}>{config.emoji}</Text>
            <Text style={[styles.label, { color: selected ? '#ffffff' : theme.text }]}>
              {config.shortLabel}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  content: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 2,
  },
  button: {
    minHeight: 64,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonCompact: {
    flexBasis: '48%',
    flexGrow: 1,
  },
  buttonWide: {
    flexBasis: 0,
    flexGrow: 1,
  },
  emoji: {
    fontSize: 22,
    lineHeight: 28,
  },
  label: {
    fontFamily: MARU_GOTHIC_FONT,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: FONT_WEIGHT_BOLD,
  },
});

export default ModeSelector;
