import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FONT_WEIGHT_BOLD, MARU_GOTHIC_FONT } from '../../constants/fonts';
import { getTheme } from '../../theme';

export type InfoSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

type InfoScreenProps = {
  title: string;
  sections: InfoSection[];
  onBack: () => void;
  updatedAt?: string;
  darkMode?: boolean;
};

const InfoScreen: React.FC<InfoScreenProps> = ({
  title,
  sections,
  onBack,
  updatedAt,
  darkMode = false,
}) => {
  const theme = getTheme(darkMode);

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.surface, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="前の画面に戻る"
            hitSlop={8}
            onPress={onBack}
            style={[styles.backIconButton, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
          >
            <Text accessible={false} style={[styles.backIcon, { color: theme.text }]}>‹</Text>
          </TouchableOpacity>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>{title}</Text>
          <View style={styles.headerSpacer} />
        </View>

        {updatedAt && <Text style={[styles.updatedAt, { color: theme.textMuted }]}>最終更新日: {updatedAt}</Text>}

        <View style={styles.content}>
          {sections.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text accessibilityRole="header" style={[styles.sectionTitle, { color: theme.text }]}>{section.title}</Text>
              {section.paragraphs?.map((paragraph) => (
                <Text key={paragraph} style={[styles.body, { color: theme.textMuted }]}>{paragraph}</Text>
              ))}
              {section.bullets?.map((bullet) => (
                <View key={bullet} style={styles.bulletRow}>
                  <Text accessible={false} style={[styles.bulletMark, { color: theme.focus }]}>•</Text>
                  <Text style={[styles.bulletText, { color: theme.textMuted }]}>{bullet}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="前の画面に戻る"
          onPress={onBack}
          style={[styles.backButton, { backgroundColor: theme.focus }]}
        >
          <Text style={styles.backButtonText}>戻る</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  scrollContent: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 16, paddingVertical: 20 },
  surface: {
    width: '100%',
    maxWidth: 680,
    borderWidth: 1,
    borderRadius: 8,
    padding: 20,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backIconButton: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { fontSize: 32, lineHeight: 34 },
  headerSpacer: { width: 44 },
  title: {
    flex: 1,
    fontFamily: MARU_GOTHIC_FONT,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: FONT_WEIGHT_BOLD,
    textAlign: 'center',
  },
  updatedAt: {
    marginTop: 8,
    fontFamily: MARU_GOTHIC_FONT,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  content: { marginTop: 24, gap: 24 },
  section: { gap: 8 },
  sectionTitle: {
    fontFamily: MARU_GOTHIC_FONT,
    fontSize: 18,
    lineHeight: 26,
    fontWeight: FONT_WEIGHT_BOLD,
  },
  body: { fontFamily: MARU_GOTHIC_FONT, fontSize: 14, lineHeight: 23 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', paddingRight: 8 },
  bulletMark: { width: 20, fontSize: 18, lineHeight: 23, fontWeight: FONT_WEIGHT_BOLD },
  bulletText: { flex: 1, fontFamily: MARU_GOTHIC_FONT, fontSize: 14, lineHeight: 23 },
  backButton: {
    minHeight: 48,
    marginTop: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: { color: '#ffffff', fontFamily: MARU_GOTHIC_FONT, fontSize: 16, fontWeight: FONT_WEIGHT_BOLD },
});

export default InfoScreen;
