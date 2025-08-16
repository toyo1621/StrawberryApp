import React, { useState } from 'react';
import { RankingEntry, GameMode } from '../types';

interface StartScreenProps {
  onStart: (name: string, mode: GameMode) => void;
  ranking: RankingEntry[];
  islandRanking: RankingEntry[];
  isLoading?: boolean;
  onShowRules: () => void;
}

const StartScreen = ({ onStart, ranking, islandRanking, isLoading, onShowRules }: StartScreenProps) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [selectedMode, setSelectedMode] = useState<GameMode>(GameMode.STRAWBERRY);

  const handleSubmit = (e: React.FormEvent, mode: GameMode) => {
    e.preventDefault();
    if (name.trim() === '') {
      setError('名前を入力してください！');
      return;
    }
    if (name.length > 12) {
      setError('名前は12文字までです。');
      return;
    }
    onStart(name, mode);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    if (error) {
      setError('');
    }
  };

  const currentRanking = selectedMode === GameMode.STRAWBERRY ? ranking : islandRanking;

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8 text-center animate-pop-in">
      <div className="flex justify-center items-center mb-4">
        <h1 className="text-4xl font-extrabold text-pink-500 mr-3">
          {selectedMode === GameMode.STRAWBERRY ? 'いちごつめ！' : '島つめ！'}
        </h1>
        <span className="text-5xl" role="img" aria-label={selectedMode === GameMode.STRAWBERRY ? "strawberry" : "island"}>
          {selectedMode === GameMode.STRAWBERRY ? '🍓' : '🏝️'}
        </span>
      </div>
      <p className="text-gray-600 mb-6">
        {selectedMode === GameMode.STRAWBERRY 
          ? '時間内にいちごをたくさんつめよう！' 
          : '時間内に島をたくさん当てよう！'
        }
      </p>
      <p className="text-sm text-blue-600 mb-4 font-medium">8/15 ランキングリセット 2ndシーズンへ</p>
      
      {/* ゲームモード選択 */}
      <div className="mb-6">
        <p className="text-lg font-bold text-gray-700 mb-3">ゲームモード選択</p>
        <div className="flex justify-center space-x-4">
          <button
            onClick={() => setSelectedMode(GameMode.STRAWBERRY)}
            className={`px-6 py-3 rounded-lg font-bold transition-all duration-200 ${
              selectedMode === GameMode.STRAWBERRY
                ? 'bg-pink-500 text-white shadow-lg'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            🍓 いちごモード
          </button>
          <button
            onClick={() => setSelectedMode(GameMode.ISLAND)}
            className={`px-6 py-3 rounded-lg font-bold transition-all duration-200 ${
              selectedMode === GameMode.ISLAND
                ? 'bg-blue-500 text-white shadow-lg'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            🏝️ 島モード
          </button>
        </div>
      </div>
      
      {/* ルールボタン */}
      <div className="mb-4">
        <button
          onClick={onShowRules}
          className="bg-blue-500 text-white font-bold py-2 px-6 rounded-lg text-sm shadow-md hover:bg-blue-600 active:scale-95 transform transition-all duration-150"
        >
          📖 ルールはこちら
        </button>
      </div>
      
      {/* ランキング表示 */}
      <div className={`${selectedMode === GameMode.STRAWBERRY ? 'bg-pink-50' : 'bg-blue-50'} rounded-lg p-4 mb-6`}>
        <h2 className={`text-xl font-bold ${selectedMode === GameMode.STRAWBERRY ? 'text-pink-600' : 'text-blue-600'} mb-3`}>
          🏆 {selectedMode === GameMode.STRAWBERRY ? 'いちごモード' : '島モード'} ランキング
        </h2>
        {isLoading ? (
          <p className="text-gray-500">読み込み中...</p>
        ) : currentRanking.length > 0 ? (
          <ul className="space-y-1">
            {currentRanking.slice(0, 10).map((entry, index) => (
              <li key={entry.id} className="flex justify-between items-center p-2 bg-white rounded text-sm">
                <span className="font-bold text-gray-700">{index + 1}. {entry.playerName}</span>
                <span className={`font-bold ${selectedMode === GameMode.STRAWBERRY ? 'text-pink-500' : 'text-blue-500'}`}>
                  {entry.score} {selectedMode === GameMode.STRAWBERRY ? '個' : '問'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">まだランキングがありません。</p>
        )}
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <input
            type="text"
            value={name}
            onChange={handleNameChange}
            placeholder="名前を入力 (12文字まで)"
            maxLength={12}
            className="w-full px-4 py-3 border-2 border-pink-200 rounded-lg text-center text-lg focus:outline-none focus:ring-2 focus:ring-pink-400"
          />
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </div>
        <button
          type="submit"
          onClick={(e) => handleSubmit(e, selectedMode)}
          className={`w-full ${selectedMode === GameMode.STRAWBERRY ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'} text-white font-bold py-4 px-6 rounded-lg text-xl shadow-md active:scale-95 transform transition-all duration-150`}
        >
          ゲーム開始！
        </button>
      </form>
    </div>
  );
};

export default StartScreen;