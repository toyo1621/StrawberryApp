import {
  GameMode,
  IslandRegion,
  RankingPeriod,
  type RankingEntry,
} from '../types';
import {
  fetchRankingsForModeWithStatus,
  saveScoreForMode,
  type RankingGameSession,
} from './rankingService';

export type GameResultOutcome = {
  entry: RankingEntry;
  rankings: RankingEntry[] | null;
  notice: string;
  warning: string | null;
};

type SaveGameResultOptions = {
  gameMode: GameMode;
  islandRegion: IslandRegion;
  playerName: string;
  score: number;
  durationMs: number;
  gameSession: RankingGameSession | null;
  onlineRankingsEnabled: boolean;
};

export const saveGameResult = async ({
  gameMode,
  islandRegion,
  playerName,
  score,
  durationMs,
  gameSession,
  onlineRankingsEnabled,
}: SaveGameResultOptions): Promise<GameResultOutcome> => {
  const rankingRegion = gameMode === GameMode.ISLAND ? islandRegion : IslandRegion.ALL;
  const result = await saveScoreForMode(gameMode, playerName, score, {
    durationMs,
    islandRegion: rankingRegion,
    gameSession,
  });
  const notices: string[] = [];
  const warnings: string[] = [];

  if (result.queuedForSync) {
    notices.push('通信できなかったため端末に保存しました。次回オンライン時に自動で同期します。');
  } else if (!result.verifiedForRanking) {
    notices.push(onlineRankingsEnabled
      ? 'オフラインで開始したため、スコアは端末履歴だけに保存しました。'
      : 'オンラインランキングはオフです。スコアを端末履歴に保存しました。');
  } else {
    notices.push('ランキングにスコアを保存しました。');
  }

  let rankings: RankingEntry[] | null = null;
  if (result.verifiedForRanking) {
    try {
      const refreshed = await fetchRankingsForModeWithStatus(
        gameMode,
        RankingPeriod.ALL,
        rankingRegion,
        { requireFresh: true },
      );
      rankings = refreshed.entries;
      if (refreshed.stale) {
        notices.push('通信できないため端末に保存したランキングを表示しています。');
      }
    } catch (refreshError) {
      console.warn('The score was saved, but the leaderboard refresh failed.', refreshError);
      warnings.push('スコアは保存しましたが、ランキング表示を更新できませんでした。');
    }
  }

  if (result.droppedPendingScores > 0) {
    warnings.push('端末の保存待ち上限を超えたため、最も古いスコアを送信待ちから除外しました。');
  }

  return {
    entry: result.entry,
    rankings,
    notice: notices.join('\n'),
    warning: warnings.length > 0 ? warnings.join('\n') : null,
  };
};
