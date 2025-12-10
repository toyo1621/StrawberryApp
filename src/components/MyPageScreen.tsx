import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, Linking } from 'react-native';
import { savePlayerName, loadPlayerName } from '../services/playerService';
import { fetchPlayerScoreHistory, RankingPeriod } from '../services/rankingService';
import { RankingEntry } from '../types';
import { MARU_GOTHIC_FONT, FONT_WEIGHT_BOLD, FONT_WEIGHT_SEMIBOLD } from '../constants/fonts';

interface MyPageScreenProps {
  onBack: () => void;
  onNameChanged: (name: string) => void;
  onShowSettings?: () => void;
  onShowPrivacyPolicy?: () => void;
  onShowTermsOfService?: () => void;
}

const MyPageScreen: React.FC<MyPageScreenProps> = ({ onBack, onNameChanged, onShowSettings, onShowPrivacyPolicy, onShowTermsOfService }) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [scoreHistory, setScoreHistory] = useState<RankingEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadSavedName();
  }, []);

  const loadSavedName = async () => {
    try {
      const savedName = await loadPlayerName();
      setName(savedName);
    } catch (error) {
      console.error('Failed to load name:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadScoreHistory = async () => {
    if (!name.trim()) {
      Alert.alert('エラー', 'プレイヤー名を入力してください。');
      return;
    }

    setIsLoadingHistory(true);
    try {
      // いちごモードの履歴を取得（他のモードも必要に応じて追加可能）
      const history = await fetchPlayerScoreHistory(name.trim(), 'strawberry_rush');
      setScoreHistory(history);
      setShowHistory(true);
    } catch (error) {
      console.error('Failed to load score history:', error);
      Alert.alert('エラー', 'スコア履歴の読み込みに失敗しました。');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}/${month}/${day} ${hours}:${minutes}`;
  };

  const handleSave = async () => {
    if (name.trim() === '') {
      setError('名前を入力してください！');
      return;
    }
    if (name.length > 12) {
      setError('名前は12文字までです。');
      return;
    }

    try {
      await savePlayerName(name.trim());
      onNameChanged(name.trim());
      Alert.alert('保存完了', '名前を保存しました！');
      onBack();
    } catch (error) {
      console.error('Failed to save name:', error);
      Alert.alert('エラー', '名前の保存に失敗しました。');
    }
  };

  const handleNameChange = (text: string) => {
    setName(text);
    if (error) {
      setError('');
    }
  };

  const handleOpenContactForm = async () => {
    const url = 'https://forms.gle/yqPN2tyeFfXdH4nR9';
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('エラー', 'このURLを開くことができません。');
      }
    } catch (error) {
      console.error('Failed to open URL:', error);
      Alert.alert('エラー', 'URLを開く際にエラーが発生しました。');
    }
  };

  if (isLoading) {
    return (
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.container}>
          <Text style={styles.loadingText}>読み込み中...</Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>マイページ</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>プレイヤー名</Text>
          <TextInput
            value={name}
            onChangeText={handleNameChange}
            placeholder="名前を入力 (12文字まで)"
            maxLength={12}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {error && <Text style={styles.errorText}>{error}</Text>}
          <Text style={styles.hintText}>
            この名前でランキングに記録されます
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>スコア履歴</Text>
          <TouchableOpacity
            onPress={loadScoreHistory}
            style={styles.historyButton}
            disabled={isLoadingHistory || !name.trim()}
          >
            <Text style={styles.historyButtonText}>
              {isLoadingHistory ? '読み込み中...' : 'スコア履歴を表示'}
            </Text>
          </TouchableOpacity>
          {showHistory && scoreHistory.length > 0 && (
            <View style={styles.historyContainer}>
              <Text style={styles.historyTitle}>最高スコア履歴（最新10件）</Text>
              {scoreHistory.slice(0, 10).map((entry, index) => (
                <View key={entry.id} style={styles.historyItem}>
                  <View style={styles.historyItemLeft}>
                    <Text style={styles.historyItemRank}>{index + 1}.</Text>
                    <Text style={styles.historyItemScore}>{entry.score} 個</Text>
                  </View>
                  <Text style={styles.historyItemDate}>{formatDate(entry.createdAt)}</Text>
                </View>
              ))}
            </View>
          )}
          {showHistory && scoreHistory.length === 0 && (
            <View style={styles.historyContainer}>
              <Text style={styles.noHistoryText}>スコア履歴がありません</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>お問い合わせ</Text>
          <Text style={styles.contactDescription}>
            ご意見・ご要望をお聞かせください。より良いアプリにするために活用させていただきます。
          </Text>
          <TouchableOpacity
            onPress={handleOpenContactForm}
            style={styles.contactButton}
          >
            <Text style={styles.contactButtonText}>お問い合わせフォームを開く</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>設定・その他</Text>
          {onShowSettings && (
            <TouchableOpacity
              onPress={onShowSettings}
              style={styles.menuButton}
            >
              <Text style={styles.menuButtonText}>⚙️ 設定</Text>
            </TouchableOpacity>
          )}
          {onShowPrivacyPolicy && (
            <TouchableOpacity
              onPress={onShowPrivacyPolicy}
              style={styles.menuButton}
            >
              <Text style={styles.menuButtonText}>📄 プライバシーポリシー</Text>
            </TouchableOpacity>
          )}
          {onShowTermsOfService && (
            <TouchableOpacity
              onPress={onShowTermsOfService}
              style={styles.menuButton}
            >
              <Text style={styles.menuButtonText}>📋 利用規約</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            onPress={handleSave}
            style={styles.saveButton}
          >
            <Text style={styles.saveButtonText}>保存</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onBack}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>戻る</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
    minHeight: '100%',
  },
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    padding: 24,
    width: '100%',
    maxWidth: 448,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ec4899',
    fontFamily: MARU_GOTHIC_FONT,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: FONT_WEIGHT_BOLD,
    color: '#1f2937',
    marginBottom: 8,
    fontFamily: MARU_GOTHIC_FONT,
  },
  input: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: '#fbcfe8',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 18,
    backgroundColor: '#ffffff',
    fontFamily: MARU_GOTHIC_FONT,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
    fontFamily: MARU_GOTHIC_FONT,
  },
  hintText: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
    fontFamily: MARU_GOTHIC_FONT,
  },
  contactDescription: {
    color: '#4b5563',
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: MARU_GOTHIC_FONT,
  },
  contactButton: {
    width: '100%',
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  contactButtonText: {
    color: '#ffffff',
    fontWeight: FONT_WEIGHT_BOLD,
    fontSize: 16,
    textAlign: 'center',
    fontFamily: MARU_GOTHIC_FONT,
  },
  menuButton: {
    width: '100%',
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  menuButtonText: {
    color: '#374151',
    fontWeight: FONT_WEIGHT_SEMIBOLD,
    fontSize: 16,
    textAlign: 'center',
    fontFamily: MARU_GOTHIC_FONT,
  },
  loadingText: {
    fontSize: 18,
    color: '#6b7280',
    textAlign: 'center',
    fontFamily: MARU_GOTHIC_FONT,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  saveButton: {
    width: '100%',
    backgroundColor: '#ec4899',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  saveButtonText: {
    color: '#ffffff',
    fontWeight: FONT_WEIGHT_BOLD,
    fontSize: 18,
    textAlign: 'center',
    fontFamily: MARU_GOTHIC_FONT,
  },
  backButton: {
    width: '100%',
    backgroundColor: '#e5e7eb',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#374151',
    fontWeight: FONT_WEIGHT_BOLD,
    fontSize: 18,
    textAlign: 'center',
    fontFamily: MARU_GOTHIC_FONT,
  },
  historyButton: {
    width: '100%',
    backgroundColor: '#10b981',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    marginBottom: 8,
  },
  historyButtonText: {
    color: '#ffffff',
    fontWeight: FONT_WEIGHT_BOLD,
    fontSize: 16,
    textAlign: 'center',
    fontFamily: MARU_GOTHIC_FONT,
  },
  historyContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: FONT_WEIGHT_BOLD,
    color: '#374151',
    marginBottom: 8,
    fontFamily: MARU_GOTHIC_FONT,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  historyItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyItemRank: {
    fontSize: 14,
    fontWeight: FONT_WEIGHT_SEMIBOLD,
    color: '#6b7280',
    fontFamily: MARU_GOTHIC_FONT,
  },
  historyItemScore: {
    fontSize: 16,
    fontWeight: FONT_WEIGHT_BOLD,
    color: '#ec4899',
    fontFamily: MARU_GOTHIC_FONT,
  },
  historyItemDate: {
    fontSize: 12,
    color: '#9ca3af',
    fontFamily: MARU_GOTHIC_FONT,
  },
  noHistoryText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    paddingVertical: 16,
    fontFamily: MARU_GOTHIC_FONT,
  },
});

export default MyPageScreen;

