import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MARU_GOTHIC_FONT } from '../../constants/fonts';
import { loadPlayerBlocks, refreshPlayerBlocks, unblockRankingPlayer, type PlayerBlock } from '../../services/moderationService';
import { getTheme } from '../../theme';
import StatusBanner from '../ui/StatusBanner';

const BlockedPlayers = ({ darkMode }: { darkMode: boolean }) => {
  const [blocks, setBlocks] = useState<PlayerBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const theme = getTheme(darkMode);
  useEffect(() => {
    let active = true;
    void refreshPlayerBlocks().then((result) => {if (active) {setBlocks(result);}}).catch(async () => {
      const cached = await loadPlayerBlocks().catch(() => []);
      if (active) {setBlocks(cached); setError('ブロック一覧を更新できませんでした。');}
    }).finally(() => {if (active) {setLoading(false);}});
    return () => {active = false;};
  }, []);
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" aria-level={2} style={[styles.heading, { color: theme.text }]}>ブロックしたプレイヤー</Text>
      {error && <StatusBanner message={error} darkMode={darkMode} />}
      {loading ? <Text style={{ color: theme.textMuted }}>読み込み中</Text>
        : blocks.length === 0 ? <Text style={{ color: theme.textMuted }}>ブロックしているプレイヤーはいません。</Text>
          : blocks.map((block) => (
            <View key={block.id} style={[styles.row, { borderBottomColor: theme.border }]}>
              <Text style={[styles.name, { color: theme.text }]}>{block.playerName}</Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${block.playerName}のブロックを解除`}
                accessibilityState={{ disabled: busy !== null, busy: busy === block.id }} disabled={busy !== null}
                onPress={() => {
                  setBusy(block.id); setError('');
                  void unblockRankingPlayer(block.id).then(setBlocks)
                    .catch(() => setError('ブロックを解除できませんでした。通信状態を確認してください。'))
                    .finally(() => setBusy(null));
                }} style={[styles.button, { borderColor: theme.border }]}>
                <Text style={{ color: theme.text }}>{busy === block.id ? '処理中...' : '解除'}</Text>
              </TouchableOpacity>
            </View>
          ))}
    </View>
  );
};
const styles = StyleSheet.create({
  section: { gap: 12 },
  heading: { fontFamily: MARU_GOTHIC_FONT, fontSize: 16, lineHeight: 24, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 8 },
  name: { flex: 1, fontFamily: MARU_GOTHIC_FONT, fontSize: 14, lineHeight: 22 },
  button: { minWidth: 64, minHeight: 44, padding: 8, borderWidth: 1, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
});
export default BlockedPlayers;
