import React, { lazy, Suspense, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { getTheme } from '../../theme';
import type { RankingEntry } from '../../types';
const RankingActionDialog = lazy(() => import('./RankingActionDialog'));

type Props = { entry: RankingEntry; darkMode: boolean; onBlocked: () => void };

const RankingActions = ({ entry, darkMode, onBlocked }: Props) => {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const theme = getTheme(darkMode);
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={`${entry.playerName}の通報・ブロック`}
        accessibilityHint="ランキングの操作メニューを開きます" onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)}
        accessibilityState={{ expanded: open }} onPress={() => setOpen(true)}
        style={styles.iconButton}>
        <Text accessible={false} style={{ fontSize: 24, color: theme.textMuted }}>⋮</Text>
        {hovered && <Text style={[styles.tooltip, { color: theme.surface, backgroundColor: theme.text }]}>通報・ブロック</Text>}
      </Pressable>
      {open && <Suspense fallback={null}><RankingActionDialog entry={entry} darkMode={darkMode}
        onBlocked={onBlocked} onClose={() => setOpen(false)} /></Suspense>}
    </>
  );
};

const styles = StyleSheet.create({
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  tooltip: { position: 'absolute', bottom: 42, right: 0, padding: 6, width: 120, fontSize: 12, borderRadius: 4, zIndex: 1 },
});

export default RankingActions;
