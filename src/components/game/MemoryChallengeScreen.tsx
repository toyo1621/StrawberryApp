import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { DISTRACTOR_EMOJIS } from '../../constants';
import { FONT_WEIGHT_BOLD, MARU_GOTHIC_FONT } from '../../constants/fonts';
import { describeEmoji, shuffle } from '../../domain/game';
import { getTheme } from '../../theme';

type MemoryChallengeScreenProps = {
  currentScore: number;
  correctAnswer: string;
  bonusPoints: number;
  prompt: string;
  title: string;
  onComplete: (finalScore: number) => void;
  darkMode?: boolean;
};

const MemoryChallengeScreen: React.FC<MemoryChallengeScreenProps> = ({
  currentScore,
  correctAnswer,
  bonusPoints,
  prompt,
  title,
  onComplete,
  darkMode = false,
}) => {
  const [result, setResult] = useState<'correct' | 'incorrect' | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const theme = getTheme(darkMode);
  const options = useMemo(() => {
    const alternatives = shuffle(DISTRACTOR_EMOJIS.filter((emoji) => emoji !== correctAnswer)).slice(0, 3);
    return shuffle([correctAnswer, ...alternatives]);
  }, [correctAnswer]);

  useEffect(() => () => {
    if (timeoutRef.current) {clearTimeout(timeoutRef.current);}
  }, []);

  const handleAnswer = (answer: string) => {
    if (result) {return;}
    const correct = answer === correctAnswer;
    setResult(correct ? 'correct' : 'incorrect');
    timeoutRef.current = setTimeout(() => {
      onComplete(currentScore + (correct ? bonusPoints : 0));
    }, 1_200);
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <View style={[styles.surface, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text accessibilityRole="header" aria-level={1} style={[styles.title, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.prompt, { color: theme.textMuted }]}>{prompt}</Text>
        <Text style={[styles.bonus, { color: theme.focus }]}>正解で +{bonusPoints}点</Text>

        {!result ? (
          <View style={styles.options}>
            {options.map((option, index) => (
              <TouchableOpacity
                key={`${option}-${index}`}
                accessibilityRole="button"
                accessibilityLabel={`選択肢${index + 1}、${describeEmoji(option)}`}
                onPress={() => handleAnswer(option)}
                style={[styles.option, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
              >
                <Text accessible={false} style={styles.optionEmoji}>{option}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View accessibilityLiveRegion="assertive" style={styles.result}>
            <Text style={[styles.resultTitle, { color: result === 'correct' ? theme.success : theme.danger }]}>
              {result === 'correct' ? '正解！' : '残念！'}
            </Text>
            <Text style={[styles.resultText, { color: theme.textMuted }]}>
              {result === 'correct'
                ? `+${bonusPoints}点を獲得しました。`
                : `正解は${describeEmoji(correctAnswer)}でした。`}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  surface: {
    width: '100%',
    maxWidth: 480,
    minHeight: 420,
    borderWidth: 1,
    borderRadius: 8,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: MARU_GOTHIC_FONT,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: FONT_WEIGHT_BOLD,
    textAlign: 'center',
  },
  prompt: {
    marginTop: 10,
    fontFamily: MARU_GOTHIC_FONT,
    fontSize: 17,
    lineHeight: 26,
    textAlign: 'center',
  },
  bonus: {
    marginTop: 8,
    fontFamily: MARU_GOTHIC_FONT,
    fontSize: 15,
    fontWeight: FONT_WEIGHT_BOLD,
  },
  options: {
    width: '100%',
    marginTop: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  option: {
    width: 112,
    height: 96,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionEmoji: { fontSize: 48, lineHeight: 58 },
  result: { minHeight: 180, alignItems: 'center', justifyContent: 'center' },
  resultTitle: {
    fontFamily: MARU_GOTHIC_FONT,
    fontSize: 30,
    lineHeight: 38,
    fontWeight: FONT_WEIGHT_BOLD,
  },
  resultText: {
    marginTop: 8,
    fontFamily: MARU_GOTHIC_FONT,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
});

export default MemoryChallengeScreen;
