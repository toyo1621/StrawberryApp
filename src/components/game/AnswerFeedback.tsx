import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FONT_WEIGHT_BOLD, MARU_GOTHIC_FONT } from '../../constants/fonts';
import { GAME_MODE_CONFIG } from '../../gameConfig';
import { ticksToSeconds } from '../../gameRules';
import { GameMode } from '../../types';

type AnswerFeedbackProps = {
  mode: GameMode;
  feedbackType: 'correct' | 'incorrect' | null;
  encouragementMessage: string;
  penaltyTicks: number;
  darkMode: boolean;
};

const AnswerFeedback: React.FC<AnswerFeedbackProps> = ({
  mode,
  feedbackType,
  encouragementMessage,
  penaltyTicks,
  darkMode,
}) => {
  const config = GAME_MODE_CONFIG[mode];

  return (
    <View style={styles.container}>
      {feedbackType === 'incorrect' ? (
        <Text accessibilityLiveRegion="assertive" style={[styles.message, { color: darkMode ? '#fecaca' : '#b91c1c' }]}>
          不正解。残り時間が{ticksToSeconds(penaltyTicks)}秒減りました。
        </Text>
      ) : feedbackType === 'correct' && encouragementMessage ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.message, { color: darkMode ? config.accentDark : config.accent }]}
        >
          {encouragementMessage}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    minHeight: 44,
    width: '100%',
  },
  message: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: FONT_WEIGHT_BOLD,
    fontFamily: MARU_GOTHIC_FONT,
    textAlign: 'center',
  },
});

export default AnswerFeedback;
