import React, { type ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FONT_WEIGHT_BOLD, FONT_WEIGHT_SEMIBOLD, MARU_GOTHIC_FONT } from '../../constants/fonts';
import { GAME_MODE_CONFIG } from '../../gameConfig';
import { ticksToSeconds } from '../../gameRules';
import { getTheme } from '../../theme';
import { GameMode } from '../../types';

type GameFrameProps = {
  mode: GameMode;
  score: number;
  timeLeft: number;
  initialTimeTicks: number;
  dangerThresholdTicks: number;
  darkMode: boolean;
  onBackToHome?: () => void;
  context?: ReactNode;
  specialBarColor?: string;
  children: ReactNode;
};

const GameFrame: React.FC<GameFrameProps> = ({
  mode,
  score,
  timeLeft,
  initialTimeTicks,
  dangerThresholdTicks,
  darkMode,
  onBackToHome,
  context,
  specialBarColor,
  children,
}) => {
  const theme = getTheme(darkMode);
  const config = GAME_MODE_CONFIG[mode];
  const displayTime = (timeLeft / 10).toFixed(1);
  const cappedTimeTicks = Math.min(timeLeft, initialTimeTicks);
  const progress = Math.max(0, Math.min(100, (timeLeft / initialTimeTicks) * 100));
  const progressColor = specialBarColor
    ?? (timeLeft <= dangerThresholdTicks ? '#dc2626' : darkMode ? config.accentDark : config.accent);

  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {onBackToHome && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="ゲームをやめてホームに戻る"
          onPress={onBackToHome}
          style={[
            styles.homeButton,
            { backgroundColor: config.tint, borderColor: config.accent },
            darkMode && { backgroundColor: config.tintDark, borderColor: config.accentDark },
          ]}
        >
          <Text style={[styles.homeButtonText, { color: darkMode ? config.accentDark : config.accent }]}>ゲームをやめる</Text>
        </TouchableOpacity>
      )}
      {context}
      <View style={styles.header}>
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.scoreText, { color: darkMode ? config.accentDark : config.accent }]}
        >
          スコア: {score}
        </Text>
        <Text accessibilityLabel={`残り時間${displayTime}秒`} style={[styles.timeText, { color: theme.text }]}>時間: {displayTime}</Text>
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="残り時間"
        aria-valuemin={0}
        aria-valuemax={ticksToSeconds(initialTimeTicks)}
        aria-valuenow={ticksToSeconds(cappedTimeTicks)}
        aria-valuetext={`残り${displayTime}秒`}
        accessibilityValue={{
          min: 0,
          max: ticksToSeconds(initialTimeTicks),
          now: ticksToSeconds(cappedTimeTicks),
          text: `残り${displayTime}秒`,
        }}
        style={[styles.timeBarContainer, { backgroundColor: theme.border }]}
      >
        <View style={[styles.timeBar, { backgroundColor: progressColor, width: `${progress}%` }]} />
      </View>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    padding: 24,
    width: '100%',
    maxWidth: 448,
    alignSelf: 'center',
    margin: 16,
    justifyContent: 'center',
    position: 'relative',
  },
  homeButton: {
    alignSelf: 'flex-end',
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginBottom: 4,
    borderWidth: 1,
    justifyContent: 'center',
  },
  homeButtonText: {
    fontSize: 14,
    fontWeight: FONT_WEIGHT_SEMIBOLD,
    fontFamily: MARU_GOTHIC_FONT,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  scoreText: {
    fontSize: 24,
    fontWeight: FONT_WEIGHT_BOLD,
    fontFamily: MARU_GOTHIC_FONT,
  },
  timeText: {
    fontSize: 24,
    fontWeight: FONT_WEIGHT_BOLD,
    fontFamily: MARU_GOTHIC_FONT,
  },
  timeBarContainer: {
    width: '100%',
    borderRadius: 999,
    height: 16,
    marginBottom: 24,
    overflow: 'hidden',
  },
  timeBar: {
    height: '100%',
    borderRadius: 999,
  },
});

export default GameFrame;
