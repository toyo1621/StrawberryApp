import React from 'react';
import { StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { FONT_WEIGHT_BOLD, FONT_WEIGHT_SEMIBOLD, MARU_GOTHIC_FONT } from '../../constants/fonts';
import { getIslandsForRegion, ISLAND_REGION_OPTIONS } from '../../domain/islands';
import { GAME_MODE_CONFIG } from '../../gameConfig';
import { getTheme } from '../../theme';
import { GameMode, IslandRegion } from '../../types';

type IslandRegionSelectorProps = {
  value: IslandRegion;
  onChange: (region: IslandRegion) => void;
  darkMode?: boolean;
};

const IslandRegionSelector: React.FC<IslandRegionSelectorProps> = ({
  value,
  onChange,
  darkMode = false,
}) => {
  const theme = getTheme(darkMode);
  const { width } = useWindowDimensions();
  const compact = width < 480;
  const accent = GAME_MODE_CONFIG[GameMode.ISLAND].accent;

  return (
    <View style={styles.container} accessibilityLabel="島の出題エリア">
      <Text style={[styles.heading, { color: theme.text }]}>出題エリア</Text>
      <View style={styles.options}>
        {ISLAND_REGION_OPTIONS.map((option) => {
          const selected = value === option.value;
          const islandCount = getIslandsForRegion(option.value).length;

          return (
            <TouchableOpacity
              key={option.value}
              accessibilityRole="button"
              accessibilityLabel={`${option.label}を出題エリアに選択、${islandCount}島`}
              accessibilityState={{ selected }}
              aria-pressed={selected}
              onPress={() => onChange(option.value)}
              style={[
                styles.option,
                compact ? styles.optionCompact : styles.optionWide,
                {
                  backgroundColor: selected ? accent : theme.surfaceMuted,
                  borderColor: selected ? accent : theme.border,
                },
              ]}
            >
              <Text style={[
                styles.label,
                compact && styles.labelCompact,
                { color: selected ? '#ffffff' : theme.text },
              ]}>
                {option.label}
              </Text>
              <Text style={[styles.count, { color: selected ? '#ffffff' : theme.textMuted }]}>
                {islandCount}島
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 8,
  },
  heading: {
    fontFamily: MARU_GOTHIC_FONT,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: FONT_WEIGHT_BOLD,
  },
  options: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCompact: {
    flexBasis: '31%',
    flexGrow: 1,
  },
  optionWide: {
    flexBasis: '31%',
    flexGrow: 1,
  },
  label: {
    fontFamily: MARU_GOTHIC_FONT,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: FONT_WEIGHT_BOLD,
    textAlign: 'center',
  },
  labelCompact: {
    fontSize: 13,
    lineHeight: 18,
  },
  count: {
    fontFamily: MARU_GOTHIC_FONT,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: FONT_WEIGHT_SEMIBOLD,
  },
});

export default IslandRegionSelector;
