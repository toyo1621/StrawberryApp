import React from 'react';
import { RankingEntry, GameMode } from '../types';

interface GameOverScreenProps {
  ranking: RankingEntry[];
  gameMode: GameMode;
  currentPlayer: { name: string; score: number };
  onRestart: () => void;
}

const GameOverScreen: React.FC<GameOverScreenProps> = ({ ranking, gameMode, currentPlayer, onRestart }) => {
  // Find the current player's rank
  const playerRank = ranking.findIndex(entry => 
    entry.playerName === currentPlayer.name && entry.score === currentPlayer.score
  ) + 1;

  const isStrawberryMode = gameMode === GameMode.STRAWBERRY;
  const unit = isStrawberryMode ? '個' : '問';
  const modeColor = isStrawberryMode ? 'pink' : 'blue';

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8 text-center animate-pop-in">
      <h1 className="text-5xl font-extrabold text-pink-500 mb-2">タイムアップ！</h1>
      <p className="text-xl text-gray-700 mb-6">
        {currentPlayer.name}さんのスコアは <span className="font-bold text-3xl text-red-500">{currentPlayer.score}</span> {unit}でした！
      </p>

      {playerRank > 0 && (
        <p className="text-lg font-bold text-yellow-600 mb-4">
          🎉 第{playerRank}位にランクイン！ 🎉
        </p>
      )}

      <div className={`bg-${modeColor}-50 rounded-lg p-4 mb-8`}>
        <h2 className={`text-2xl font-bold text-${modeColor}-600 mb-4`}>
          {isStrawberryMode ? 'いちごモード' : '島モード'} ランキング
        </h2>
        <ul className="space-y-2 max-h-80 overflow-y-auto pr-2">
          {ranking.length > 0 ? (
             ranking.slice(0, 30).map((entry, index) => (
              <li key={entry.id} className={`flex justify-between items-center p-3 rounded-lg text-lg ${
                entry.playerName === currentPlayer.name && entry.score === currentPlayer.score 
                  ? 'bg-yellow-200 ring-2 ring-yellow-400' 
                  : 'bg-white'
              }`}>
                <span className="font-bold text-gray-700">{index + 1}. {entry.playerName}</span>
                <span className={`font-bold text-${modeColor}-500`}>{entry.score} {unit}</span>
              </li>
            ))
          ) : (
            <p className="text-gray-500">まだランキングがありません。</p>
          )}
        </ul>
      </div>

      <button
        onClick={onRestart}
        className="w-full bg-red-500 text-white font-bold py-4 px-6 rounded-lg text-xl shadow-md hover:bg-red-600 active:scale-95 transform transition-all duration-150"
      >
        もう一度プレイ
      </button>
    </div>
  );
};

export default GameOverScreen;