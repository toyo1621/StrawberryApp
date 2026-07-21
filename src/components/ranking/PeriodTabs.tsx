import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FONT_WEIGHT_BOLD, MARU_GOTHIC_FONT } from '../../constants/fonts';
import { RankingPeriod } from '../../types';
import { getTheme } from '../../theme';

const PERIODS: { value: RankingPeriod; label: string }[] = [
  { value: RankingPeriod.ALL, label: '全体' },
  { value: RankingPeriod.DAILY, label: '日別' },
  { value: RankingPeriod.WEEKLY, label: '週別' },
  { value: RankingPeriod.MONTHLY, label: '月別' },
];

type PeriodTabsProps = {
  value: RankingPeriod;
  onChange: (period: RankingPeriod) => void;
  accent: string;
  darkMode?: boolean;
};

const PeriodTabs: React.FC<PeriodTabsProps> = ({ value, onChange, accent, darkMode = false }) => {
  const theme = getTheme(darkMode);

  return (
    <View accessibilityRole="tablist" style={[styles.container, { borderColor: theme.border }]}>
      {PERIODS.map((period) => {
        const selected = value === period.value;
        return (
          <TouchableOpacity
            key={period.value}
            accessibilityRole="tab"
            accessibilityLabel={`${period.label}ランキング`}
            accessibilityState={{ selected }}
            aria-selected={selected}
            onPress={() => onChange(period.value)}
            style={[
              styles.tab,
              { backgroundColor: selected ? accent : theme.surfaceMuted },
            ]}
          >
            <Text style={[styles.label, { color: selected ? '#ffffff' : theme.text }]}>
              {period.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    minWidth: 64,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  label: {
    fontFamily: MARU_GOTHIC_FONT,
    fontSize: 14,
    fontWeight: FONT_WEIGHT_BOLD,
  },
});

export default PeriodTabs;
