import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { MARU_GOTHIC_FONT, FONT_WEIGHT_BOLD, FONT_WEIGHT_SEMIBOLD } from '../constants/fonts';

interface PrivacyPolicyScreenProps {
  onBack: () => void;
}

const PrivacyPolicyScreen: React.FC<PrivacyPolicyScreenProps> = ({ onBack }) => {
  return (
    <ScrollView 
      style={styles.scrollView} 
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>プライバシーポリシー</Text>
        </View>

        <View style={styles.content}>
          <Text style={styles.lastUpdated}>最終更新日: 2024年8月15日</Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. 収集する情報</Text>
            <Text style={styles.sectionText}>
              本アプリでは、以下の情報を収集・保存します：
            </Text>
            <Text style={styles.bulletPoint}>
              • プレイヤー名（ユーザーが入力した名前）
            </Text>
            <Text style={styles.bulletPoint}>
              • ゲームスコア（各ゲームモードでの最高スコア）
            </Text>
            <Text style={styles.bulletPoint}>
              • スコア記録日時
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. 情報の利用目的</Text>
            <Text style={styles.sectionText}>
              収集した情報は、以下の目的でのみ使用されます：
            </Text>
            <Text style={styles.bulletPoint}>
              • ランキング機能の提供
            </Text>
            <Text style={styles.bulletPoint}>
              • ゲーム体験の向上
            </Text>
            <Text style={styles.bulletPoint}>
              • アプリの改善・開発
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. データの保存・管理</Text>
            <Text style={styles.sectionText}>
              スコアデータはSupabase（クラウドデータベースサービス）に保存されます。
              データは適切なセキュリティ対策の下で管理されています。
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. 第三者への提供</Text>
            <Text style={styles.sectionText}>
              本アプリは、ユーザーの個人情報を第三者に提供することはありません。
              ただし、法令に基づく要請がある場合を除きます。
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>5. データの削除</Text>
            <Text style={styles.sectionText}>
              ランキングから自分のデータを削除したい場合は、
              開発者へのお問い合わせからご連絡ください。
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>6. お問い合わせ</Text>
            <Text style={styles.sectionText}>
              プライバシーポリシーに関するご質問やご意見は、
              開発者へのお問い合わせからご連絡ください。
            </Text>
          </View>
        </View>

        <View style={styles.backButtonContainer}>
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
    paddingVertical: 24,
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
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: FONT_WEIGHT_BOLD,
    color: '#ec4899',
    marginBottom: 8,
    fontFamily: MARU_GOTHIC_FONT,
  },
  content: {
    marginBottom: 24,
  },
  lastUpdated: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 24,
    textAlign: 'center',
    fontFamily: MARU_GOTHIC_FONT,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: FONT_WEIGHT_BOLD,
    color: '#1f2937',
    marginBottom: 12,
    fontFamily: MARU_GOTHIC_FONT,
  },
  sectionText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
    marginBottom: 8,
    fontFamily: MARU_GOTHIC_FONT,
  },
  bulletPoint: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
    marginBottom: 4,
    marginLeft: 8,
    fontFamily: MARU_GOTHIC_FONT,
  },
  backButtonContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  backButton: {
    backgroundColor: '#ec4899',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  backButtonText: {
    color: '#ffffff',
    fontWeight: FONT_WEIGHT_BOLD,
    fontSize: 18,
    fontFamily: MARU_GOTHIC_FONT,
  },
});

export default PrivacyPolicyScreen;
