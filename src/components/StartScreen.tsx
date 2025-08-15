import React, { useState } from 'react';
import { RankingEntry } from '../types';

interface StartScreenProps {
  onStart: (name: string) => void;
  ranking: RankingEntry[];
  isLoading?: boolean;
  onShowRules: () => void;
}

const StartScreen = ({ onStart, ranking, isLoading, onShowRules }: StartScreenProps) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() === '') {
      setError('名前を入力してください！');
      return;
    }
    if (name.length > 12) {
      setError('名前は12文字までです。');
      return;
    }
    onStart(name);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    if (error) {
      setError('');
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8 text-center animate-pop-in">
      <div className="flex justify-center items-center mb-4">
        <h1 className="text-4xl font-extrabold text-pink-500 mr-3">いちごつめ！</h1>
        <span className="text-5xl" role="img" aria-label="strawberry">🍓</span>
      </div>
      <p className="text-gray-600 mb-6">時間内にいちごをたくさんつめよう！</p>
      <p className="text-sm text-blue-600 mb-4 font-medium">8/15 ランキングリセット 2ndシーズンへ</p>
      
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
      <div className="bg-pink-50 rounded-lg p-4 mb-6">
        <h2 className="text-xl font-bold text-pink-600 mb-3">🏆 ランキング</h2>
        {isLoading ? (
          <p className="text-gray-500">読み込み中...</p>
        ) : ranking.length > 0 ? (
          <ul className="space-y-1">
            {ranking.slice(0, 10).map((entry, index) => (
              <li key={entry.id} className="flex justify-between items-center p-2 bg-white rounded text-sm">
                <span className="font-bold text-gray-700">{index + 1}. {entry.playerName}</span>
                <span className="font-bold text-pink-500">{entry.score} 個</span>
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
          className="w-full bg-red-500 text-white font-bold py-4 px-6 rounded-lg text-xl shadow-md hover:bg-red-600 active:scale-95 transform transition-all duration-150"
        >
          ゲーム開始！
        </button>
      </form>
    </div>
  );
};

export default StartScreen;