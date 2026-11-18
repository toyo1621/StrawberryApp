import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { FONT_WEIGHT_BOLD, MARU_GOTHIC_FONT } from '../../constants/fonts';
import { getTheme } from '../../theme';
import { RankingEntry } from '../../types';
import { loadPlayerBlocks } from '../../services/moderationService';
import { useModerationRevision } from '../../hooks/useModerationRevision';
import RankingActions from './RankingActions';
import StatusBanner from '../ui/StatusBanner';

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
  const revision = useModerationRevision();
  const [blockedIds, setBlockedIds] = useState<Set<string> | null>(null);
  const [notice, setNotice] = useState('');
  const [preferenceError, setPreferenceError] = useState('');
  useEffect(() => {
    let active = true;
    void loadPlayerBlocks().then((blocks) => {
      if (active) {setBlockedIds(new Set(blocks.map((block) => block.rankingId))); setPreferenceError('');}
    }).catch(() => {
      if (active) {setBlockedIds(null); setPreferenceError('ブロック設定を読み込めないため、他のプレイヤーを表示できません。');}
    });
    return () => {active = false;};
  }, [revision]);
  const visibleEntries = entries.filter((entry) => entry.isCurrentPlayer
    || (blockedIds !== null && !blockedIds.has(entry.id)));

  if (loading || (blockedIds === null && !preferenceError)) {
    return (
      <View style={styles.stateContainer}>
        <ActivityIndicator accessibilityLabel="ランキングを読み込み中" color={accent} />
        <Text accessibilityLiveRegion="polite" style={[styles.stateText, { color: theme.textMuted }]}>
          ランキングを読み込み中
        </Text>
      </View>
    );
  }

  if (visibleEntries.length === 0) {
    return (
      <View style={styles.stateContainer}>
        <Text style={[styles.stateText, { color: theme.textMuted }]}>まだランキングがありません。</Text>
        {notice && <StatusBanner message={notice} darkMode={darkMode} />}
        {preferenceError && <StatusBanner message={preferenceError} darkMode={darkMode} />}
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {notice && <StatusBanner message={notice} tone="info" darkMode={darkMode} />}
      {preferenceError && <StatusBanner message={preferenceError} darkMode={darkMode} />}
      {visibleEntries.slice(0, limit).map((entry, index) => {
        const highlighted = entry.isCurrentPlayer
          || (Boolean(highlightedEntryId) && entry.id === highlightedEntryId);
        const rank = entry.publicRank ?? index + 1;
        return (
          <View
            key={entry.id}
            style={[
              styles.row,
              { borderBottomColor: theme.border },
              highlighted && { backgroundColor: darkMode ? '#3f3142' : '#fff1f5' },
            ]}
          >
            <View accessible accessibilityLabel={`${rank}位、${entry.playerName}、${entry.score}${unit}${entry.isCurrentPlayer ? '、あなたの記録' : ''}`} style={styles.entryContent}>
              <View style={styles.nameGroup}>
                <Text style={[styles.rank, { color: rank <= 3 ? accent : theme.textMuted }]}>
                  {rank <= 3 ? ['1st', '2nd', '3rd'][rank - 1] : `${rank}`}
                </Text>
                <Text numberOfLines={1} style={[styles.name, { color: theme.text }]}>{entry.playerName}</Text>
                {entry.isCurrentPlayer && (
                  <Text style={[styles.currentPlayerLabel, { color: accent, borderColor: accent }]}>あなた</Text>
                )}
              </View>
              <Text style={[styles.score, { color: accent }]}>{entry.score} {unit}</Text>
            </View>
            {!highlighted && <RankingActions entry={entry} darkMode={darkMode} onBlocked={() => {
              setBlockedIds((current) => new Set([...(current ?? []), entry.id]));
              setNotice('プレイヤーをブロックしました。設定から解除できます。');
            }} />}
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
  entryContent: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' },
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
  currentPlayerLabel: {
    flexShrink: 0,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    fontFamily: MARU_GOTHIC_FONT,
    fontSize: 11,
    lineHeight: 14,
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
