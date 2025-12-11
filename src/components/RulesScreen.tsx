import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { MARU_GOTHIC_FONT, FONT_WEIGHT_BOLD, FONT_WEIGHT_SEMIBOLD } from '../constants/fonts';

interface RulesScreenProps {
  onBack: () => void;
}

const RulesScreen: React.FC<RulesScreenProps> = ({ onBack }) => {
  return (
    <ScrollView 
      style={styles.scrollView} 
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>🍓 ゲームルール</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📋 基本ルール</Text>
            <View style={styles.sectionContent}>
              <Text style={[styles.bulletPoint, { marginBottom: 4 }]}>
                • <Text style={styles.bold}>制限時間</Text>: 30.0秒（0.1秒単位で表示）
              </Text>
              <Text style={[styles.bulletPoint, { marginBottom: 4 }]}>
                • <Text style={styles.bold}>目標</Text>: 2つの選択肢からいちごを素早く選ぶ
              </Text>
              <Text style={styles.bulletPoint}>
                • <Text style={styles.bold}>得点</Text>: 正解1回につき1点
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>✨ 特別アイテム</Text>
            <View style={styles.sectionContent}>
              <Text style={[styles.bulletPoint, { marginBottom: 4 }]}>
                • <Text style={styles.bold}>🍰 ショートケーキ</Text>: 3点獲得 + 2秒時間回復（通常時: 出現確率3%）
              </Text>
              <Text style={styles.bulletPoint}>
                • <Text style={styles.bold}>🎂 ホールケーキ</Text>: 5点獲得 + 5秒時間回復（通常時: 出現確率1%）
              </Text>
              <Text style={[styles.bulletPoint, { marginTop: 4, fontSize: 12, color: '#6b7280' }]}>
                ※ フィーバーモード中は出現確率が10倍になります
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚠️ ペナルティ</Text>
            <View style={styles.sectionContent}>
              <Text style={[styles.bulletPoint, { marginBottom: 4 }]}>
                • <Text style={styles.bold}>間違い</Text>: 残り時間が3.0秒減少
              </Text>
              <Text style={[styles.bulletPoint, { marginBottom: 4 }]}>
                • <Text style={styles.bold}>連続正解リセット</Text>: 間違えると連続正解カウントが0にリセット
              </Text>
              <Text style={styles.bulletPoint}>
                • <Text style={styles.bold}>🍓 いちごジュース</Text>: 間違えた瞬間に画面全体にいちごジュースが表示され、3秒かけて透明になる（イライラ要素）
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🎁 ボーナス機能</Text>
            <View style={styles.sectionContent}>
              <Text style={[styles.bulletPoint, { marginBottom: 4 }]}>
                • <Text style={styles.bold}>連続正解ボーナス</Text>: 2回以上連続で正解すると、毎回0.5秒の時間ボーナス
              </Text>
              <Text style={[styles.bulletPoint, { marginBottom: 4 }]}>
                • <Text style={styles.bold}>✨ フィーバーモード</Text>: 残り10秒以下になると「特別アイテム出現率10倍」が発動
              </Text>
              <View style={styles.subSection}>
                <Text style={[styles.bulletPoint, { marginBottom: 4 }]}>
                  - ショートケーキとホールケーキの出現確率が10倍になる
                </Text>
                <Text style={styles.bulletPoint}>
                  - フィーバーモード中は画面下に「✨ 特別アイテム出現率10倍 ✨」と表示される
                </Text>
              </View>
              <Text style={[styles.bulletPoint, { marginTop: 8, marginBottom: 4 }]}>
                • <Text style={styles.bold}>記憶チャレンジ</Text>: ゲーム終了後に記憶ゲームが発生
              </Text>
              <View style={styles.subSection}>
                <Text style={[styles.bulletPoint, { marginBottom: 4 }]}>
                  - 最後に出たいちご以外の果物を当てる（+2点）
                </Text>
                <Text style={styles.bulletPoint}>
                  - 最初に出たいちご以外の果物を当てる（+10点）
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🏆 ランキング</Text>
            <View style={styles.sectionContent}>
              <Text style={[styles.bulletPoint, { marginBottom: 4 }]}>
                • <Text style={styles.bold}>記録方法</Text>: データベースに永続保存
              </Text>
              <Text style={[styles.bulletPoint, { marginBottom: 4 }]}>
                • <Text style={styles.bold}>表示</Text>: 上位10位まで表示
              </Text>
              <Text style={styles.bulletPoint}>
                • <Text style={styles.bold}>各プレイヤーの最高スコアのみ記録</Text>
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🎮 操作方法</Text>
            <View style={styles.sectionContent}>
              <Text style={[styles.bulletPoint, { marginBottom: 4 }]}>
                • <Text style={styles.bold}>選択</Text>: 左右のボタンをタップ/クリック
              </Text>
              <Text style={[styles.bulletPoint, { marginBottom: 4 }]}>
                • <Text style={styles.bold}>フィードバック</Text>: 正解時は緑の輪、間違い時は赤の輪と振動エフェクト
              </Text>
              <Text style={styles.bulletPoint}>
                • <Text style={styles.bold}>タイマー</Text>: 残り10秒以下で赤色に変化
              </Text>
            </View>
          </View>

          <View style={styles.tipBox}>
            <Text style={styles.tipText}>
              💡 <Text style={styles.bold}>コツ</Text>: 連続正解を狙って時間ボーナスを活用し、記憶チャレンジでさらに高得点を目指そう！
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
    fontSize: 32,
    fontWeight: '800',
    color: '#ec4899',
    marginBottom: 8,
    fontFamily: MARU_GOTHIC_FONT,
  },
  content: {
  },
  section: {
    marginBottom: 16,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: FONT_WEIGHT_BOLD,
    color: '#1f2937',
    marginBottom: 8,
    fontFamily: MARU_GOTHIC_FONT,
  },
  sectionContent: {
    marginLeft: 16,
  },
  subSection: {
    marginLeft: 16,
    marginTop: 4,
  },
  bulletPoint: {
    color: '#374151',
    fontSize: 14,
    fontFamily: MARU_GOTHIC_FONT,
  },
  bold: {
    fontWeight: FONT_WEIGHT_BOLD,
    fontFamily: MARU_GOTHIC_FONT,
  },
  tipBox: {
    backgroundColor: '#fdf2f8',
    borderRadius: 8,
    padding: 16,
    marginTop: 24,
  },
  tipText: {
    fontSize: 14,
    color: '#4b5563',
    textAlign: 'center',
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

export default RulesScreen;
