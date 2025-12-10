import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { MARU_GOTHIC_FONT, FONT_WEIGHT_BOLD, FONT_WEIGHT_SEMIBOLD } from '../constants/fonts';

interface TermsOfServiceScreenProps {
  onBack: () => void;
}

const TermsOfServiceScreen: React.FC<TermsOfServiceScreenProps> = ({ onBack }) => {
  return (
    <ScrollView 
      style={styles.scrollView} 
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>利用規約</Text>
        </View>

        <View style={styles.content}>
          <Text style={styles.lastUpdated}>最終更新日: 2024年8月15日</Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. 利用規約の同意</Text>
            <Text style={styles.sectionText}>
              本アプリを利用することにより、本利用規約に同意したものとみなされます。
              本規約に同意できない場合は、アプリの利用を中止してください。
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. アプリの利用</Text>
            <Text style={styles.sectionText}>
              本アプリは、個人の娯楽目的でのみ利用できます。
              以下の行為は禁止されています：
            </Text>
            <Text style={styles.bulletPoint}>
              • 不正な方法でスコアを操作する行為
            </Text>
            <Text style={styles.bulletPoint}>
              • 他のユーザーに迷惑をかける行為
            </Text>
            <Text style={styles.bulletPoint}>
              • アプリの動作を妨害する行為
            </Text>
            <Text style={styles.bulletPoint}>
              • 不適切なプレイヤー名の使用
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. 知的財産権</Text>
            <Text style={styles.sectionText}>
              本アプリのコンテンツ、デザイン、プログラムコードなどの知的財産権は、
              開発者に帰属します。無断で複製、転載、改変することは禁止されています。
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. 免責事項</Text>
            <Text style={styles.sectionText}>
              本アプリの利用により生じた損害について、開発者は一切の責任を負いません。
              アプリの動作保証やデータの完全性についても保証いたしません。
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>5. サービスの変更・終了</Text>
            <Text style={styles.sectionText}>
              開発者は、事前の通知なく、本アプリの内容を変更したり、
              サービスの提供を終了することができるものとします。
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>6. 規約の変更</Text>
            <Text style={styles.sectionText}>
              本規約は、開発者の判断により変更される場合があります。
              変更後の規約は、アプリ内に表示された時点で効力を生じます。
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>7. お問い合わせ</Text>
            <Text style={styles.sectionText}>
              本規約に関するご質問やご意見は、
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

export default TermsOfServiceScreen;
