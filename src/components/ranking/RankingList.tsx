import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { FONT_WEIGHT_BOLD, MARU_GOTHIC_FONT } from '../../constants/fonts';
import { getTheme } from '../../theme';
import { RankingEntry } from '../../types';

type RankingListProps = {
  entries: RankingEntry[];
  unit: string;
  accent: string;
  loading?: boolean;
  limit?: number;
  highlightedEntryId?: string | null;
  darkMode?: boolean;
};

const RankingList: React.FC<RankingListProps> = ({
  entries,
  unit,
  accent,
  loading = false,
  limit = 10,
  highlightedEntryId,
  darkMode = false,
}) => {
  const theme = getTheme(darkMode);

  if (loading) {
    return (
      <View style={styles.stateContainer}>
        <ActivityIndicator accessibilityLabel="ランキングを読み込み中" color={accent} />
        <Text accessibilityLiveRegion="polite" style={[styles.stateText, { color: theme.textMuted }]}>
          ランキングを読み込み中
        </Text>
      </View>
    );
  }

  if (entries.length === 0) {
    return (
      <View style={styles.stateContainer}>
        <Text style={[styles.stateText, { color: theme.textMuted }]}>まだランキングがありません。</Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {entries.slice(0, limit).map((entry, index) => {
        const highlighted = Boolean(highlightedEntryId) && entry.id === highlightedEntryId;
        const rank = index + 1;
        return (
          <View
            key={entry.id}
            accessible
            accessibilityLabel={`${rank}位、${entry.playerName}、${entry.score}${unit}`}
            style={[
              styles.row,
              { borderBottomColor: theme.border },
              highlighted && { backgroundColor: darkMode ? '#3f3142' : '#fff1f5' },
            ]}
          >
            <View style={styles.nameGroup}>
              <Text style={[styles.rank, { color: rank <= 3 ? accent : theme.textMuted }]}>
                {rank <= 3 ? ['1st', '2nd', '3rd'][rank - 1] : `${rank}`}
              </Text>
              <Text numberOfLines={1} style={[styles.name, { color: theme.text }]}>{entry.playerName}</Text>
            </View>
            <Text style={[styles.score, { color: accent }]}>{entry.score} {unit}</Text>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  list: {
    width: '100%',
  },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  nameGroup: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rank: {
    width: 30,
    fontFamily: MARU_GOTHIC_FONT,
    fontSize: 13,
    fontWeight: FONT_WEIGHT_BOLD,
  },
  name: {
    flex: 1,
    fontFamily: MARU_GOTHIC_FONT,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: FONT_WEIGHT_BOLD,
  },
  score: {
    marginLeft: 12,
    fontFamily: MARU_GOTHIC_FONT,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: FONT_WEIGHT_BOLD,
  },
  stateContainer: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  stateText: {
    fontFamily: MARU_GOTHIC_FONT,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});

export default RankingList;
