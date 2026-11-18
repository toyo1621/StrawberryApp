import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MARU_GOTHIC_FONT } from '../../constants/fonts';
import { blockRankingPlayer, REPORT_REASONS, reportRankingName, type ReportReason } from '../../services/moderationService';
import { hasRankingsApi } from '../../services/rankingsApiClient';
import { getTheme } from '../../theme';
import type { RankingEntry } from '../../types';
import StatusBanner from '../ui/StatusBanner';

type Props = { entry: RankingEntry; darkMode: boolean; onBlocked: () => void; onClose: () => void };

const RankingActionDialog = ({ entry, darkMode, onBlocked, onClose }: Props) => {
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState<ReportReason>('offensive');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const theme = getTheme(darkMode);
  const close = () => {if (!busy) {onClose();}};
  const submit = async (action: 'report' | 'block') => {
    if (busy) {return;}
    setBusy(true);
    setError('');
    try {
      if (action === 'report') {
        await reportRankingName(entry.id, reason);
        setMessage('通報を受け付けました。運営が確認します。');
        setReporting(false);
      } else {
        await blockRankingPlayer(entry.id);
        onClose();
        onBlocked();
      }
    } catch {
      setError(hasRankingsApi()
        ? '処理を完了できませんでした。通信状態を確認して、もう一度お試しください。'
        : '通報・ブロックにはオンラインランキングへの接続が必要です。');
    } finally {setBusy(false);}
  };
  const actionButton = (label: string, onPress: () => void) => (
    <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: busy, busy }} disabled={busy}
      onPress={onPress} style={[styles.action, { borderColor: theme.border, opacity: busy ? 0.6 : 1 }]}>
      <Text style={[styles.text, { color: theme.text }]}>{label}</Text>
    </TouchableOpacity>
  );
  return (
    <Modal visible transparent animationType="none" onRequestClose={close} accessibilityLabel="ランキングの操作">
      <View style={styles.backdrop}>
        <View style={[styles.dialog, { backgroundColor: theme.surface }]}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <Text accessibilityRole="header" aria-level={2} style={[styles.title, { color: theme.text }]}>{reporting ? '名前を通報' : 'ランキングの操作'}</Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="ランキングの操作を閉じる" disabled={busy} onPress={close} style={styles.iconButton}>
                <Text accessible={false} style={{ fontSize: 24, color: theme.text }}>×</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.text, { color: theme.text }]}>{entry.playerName}</Text>
            {message && <StatusBanner message={message} tone="success" darkMode={darkMode} />}
            {error && <StatusBanner message={error} darkMode={darkMode} />}
            {reporting ? (
              <>
                {REPORT_REASONS.map((item) => (
                  <TouchableOpacity key={item.value} accessibilityRole="radio" accessibilityLabel={item.label}
                    aria-checked={reason === item.value}
                    accessibilityState={{ checked: reason === item.value, disabled: busy }} disabled={busy}
                    onPress={() => setReason(item.value)} style={[styles.action, { borderColor: reason === item.value ? theme.focus : theme.border }]}>
                    <Text accessible={false} style={[styles.text, { color: theme.text }]}>{reason === item.value ? '◉' : '○'} {item.label}</Text>
                  </TouchableOpacity>
                ))}
                {actionButton(busy ? '送信中...' : '通報を送信', () => {void submit('report');})}
                {actionButton('戻る', () => setReporting(false))}
              </>
            ) : (
              <>
                {actionButton('名前を通報', () => setReporting(true))}
                {actionButton('このプレイヤーをブロック', () => {void submit('block');})}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  dialog: { width: '100%', maxWidth: 480, maxHeight: '90%', borderRadius: 8 },
  content: { padding: 20, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { flex: 1, fontFamily: MARU_GOTHIC_FONT, fontSize: 20, lineHeight: 28, fontWeight: '700' },
  text: { fontFamily: MARU_GOTHIC_FONT, fontSize: 15, lineHeight: 23, flexShrink: 1 },
  action: { minHeight: 48, borderWidth: 1, borderRadius: 6, padding: 12, justifyContent: 'center' },
});
export default RankingActionDialog;
