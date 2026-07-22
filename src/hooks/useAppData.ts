import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { AppState, Image } from 'react-native';
import { strawberryJuiceImage } from '../assets/images/strawberryJuiceAsset';
import { createEmptyRankings } from '../gameConfig';
import {
  fetchAllRankingsWithStatus,
  syncPendingScores,
  type AllRankingsFetchResult,
} from '../services/rankingService';
import { loadPlayerName } from '../services/playerService';
import {
  loadSettings,
  type AppSettings,
} from '../services/settingsService';
import { GameMode, type RankingsByMode } from '../types';

type AppData = {
  playerName: string;
  setPlayerName: Dispatch<SetStateAction<string>>;
  rankingsByMode: RankingsByMode;
  setRankingsByMode: Dispatch<SetStateAction<RankingsByMode>>;
  isLoading: boolean;
  error: string | null;
  setError: Dispatch<SetStateAction<string | null>>;
  notice: string | null;
  setNotice: Dispatch<SetStateAction<string | null>>;
  settings: AppSettings;
  setSettings: Dispatch<SetStateAction<AppSettings>>;
};

const prefetchStrawberryJuiceImage = (): void => {
  try {
    const assetSource = Image.resolveAssetSource?.(strawberryJuiceImage);
    if (assetSource?.uri) {
      Image.prefetch(assetSource.uri).catch(() => undefined);
    }
  } catch (error) {
    console.warn('Failed to preload the strawberry effect image.', error);
  }
};

export const useAppData = (): AppData => {
  const [playerName, setPlayerName] = useState('');
  const [rankingsByMode, setRankingsByMode] = useState<RankingsByMode>(createEmptyRankings);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>({
    darkMode: false,
    hapticsEnabled: true,
  });
  const resumeSyncInFlightRef = useRef(false);

  useEffect(() => {
    const loadData = async (): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        prefetchStrawberryJuiceImage();
        const [rankingsResult, nameResult, settingsResult, syncResult] = await Promise.allSettled([
          fetchAllRankingsWithStatus(),
          loadPlayerName(),
          loadSettings(),
          syncPendingScores(),
        ]);
        const errors: string[] = [];
        const notices: string[] = [];

        let rankingState: AllRankingsFetchResult = rankingsResult.status === 'fulfilled'
          ? rankingsResult.value
          : {
              rankings: createEmptyRankings(),
              staleModes: [],
              failedModes: [...Object.values(GameMode)],
            };
        if (rankingsResult.status === 'rejected') {
          console.error('Failed to load rankings:', rankingsResult.reason);
          errors.push('ランキングを読み込めませんでした。オフラインでプレイできます。');
        }

        if (nameResult.status === 'fulfilled') {
          setPlayerName(nameResult.value);
        } else {
          console.error('Failed to load the player name:', nameResult.reason);
          errors.push('保存済みのプレイヤー名を読み込めませんでした。');
        }

        if (settingsResult.status === 'fulfilled') {
          setSettings(settingsResult.value);
        } else {
          console.error('Failed to load settings:', settingsResult.reason);
          errors.push('設定を読み込めなかったため初期設定を使用します。');
        }

        if (syncResult.status === 'fulfilled') {
          if (syncResult.value.synced > 0) {
            notices.push(`${syncResult.value.synced}件のオフラインスコアをランキングへ同期しました。`);
            try {
              rankingState = await fetchAllRankingsWithStatus();
            } catch (refreshError) {
              console.error('Failed to refresh rankings after sync:', refreshError);
              errors.push('同期後のランキング更新に失敗しました。');
            }
          }
          if (syncResult.value.discarded > 0) {
            errors.push(`${syncResult.value.discarded}件の保存待ちスコアは無効だったため送信できませんでした。`);
          }
        } else {
          console.error('Failed to sync pending scores:', syncResult.reason);
          errors.push('保存待ちスコアを同期できませんでした。次回起動時に再試行します。');
        }

        setRankingsByMode(rankingState.rankings);
        if (rankingState.staleModes.length > 0) {
          notices.push('通信できないモードは端末に保存したランキングを表示しています。');
        }
        if (rankingState.failedModes.length > 0) {
          errors.push('一部モードのランキングを読み込めませんでした。ゲームはプレイできます。');
        }
        setNotice(notices.length > 0 ? notices.join('\n') : null);
        setError(errors.length > 0 ? errors.join('\n') : null);
      } catch (loadError) {
        console.error('Failed to load data:', loadError);
        setError('ランキングの読み込みに失敗しました。オフラインでプレイできます。');
      } finally {
        setIsLoading(false);
      }
    };

    void loadData();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextState) => {
      if (nextState !== 'active' || resumeSyncInFlightRef.current) {
        return;
      }
      resumeSyncInFlightRef.current = true;
      try {
        const result = await syncPendingScores();
        if (result.synced > 0) {
          const refreshed = await fetchAllRankingsWithStatus();
          setRankingsByMode(refreshed.rankings);
          setNotice(`${result.synced}件の保存待ちスコアをランキングへ同期しました。`);
        }
        if (result.discarded > 0) {
          setError(`${result.discarded}件の期限切れスコアを送信待ちから除外しました。`);
        }
      } catch (resumeError) {
        console.warn('Failed to sync pending scores after returning to the app.', resumeError);
      } finally {
        resumeSyncInFlightRef.current = false;
      }
    });
    return () => subscription.remove();
  }, []);

  return {
    playerName,
    setPlayerName,
    rankingsByMode,
    setRankingsByMode,
    isLoading,
    error,
    setError,
    notice,
    setNotice,
    settings,
    setSettings,
  };
};
