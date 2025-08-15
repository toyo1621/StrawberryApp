import React from 'react';

interface RulesScreenProps {
  onBack: () => void;
}

const RulesScreen: React.FC<RulesScreenProps> = ({ onBack }) => {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 text-left animate-pop-in max-h-[80vh] overflow-y-auto">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-extrabold text-pink-500 mb-2">🍓 ゲームルール</h1>
      </div>

      <div className="space-y-4 text-sm">
        <section>
          <h2 className="text-lg font-bold text-gray-800 mb-2">📋 基本ルール</h2>
          <ul className="space-y-1 text-gray-700 ml-4">
            <li>• <strong>制限時間</strong>: 30.0秒（0.1秒単位で表示）</li>
            <li>• <strong>目標</strong>: 2つの選択肢からいちごを素早く選ぶ</li>
            <li>• <strong>得点</strong>: 正解1回につき1点</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-800 mb-2">✨ 特別アイテム</h2>
          <ul className="space-y-1 text-gray-700 ml-4">
            <li>• <strong>🍰 ショートケーキ</strong>: 3点獲得 + 1秒時間回復（出現確率3%）</li>
            <li>• <strong>🎂 ホールケーキ</strong>: 5点獲得 + 5秒時間回復（出現確率1%）</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-800 mb-2">⚠️ ペナルティ</h2>
          <ul className="space-y-1 text-gray-700 ml-4">
            <li>• <strong>間違い</strong>: 残り時間が3.0秒減少</li>
            <li>• <strong>連続正解リセット</strong>: 間違えると連続正解カウントが0にリセット</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-800 mb-2">🎁 ボーナス機能</h2>
          <ul className="space-y-1 text-gray-700 ml-4">
            <li>• <strong>連続正解ボーナス</strong>: 2回以上連続で正解すると、毎回0.5秒の時間ボーナス</li>
            <li>• <strong>記憶チャレンジ</strong>: ゲーム終了後に記憶ゲームが発生
              <ul className="ml-4 mt-1 space-y-1">
                <li>- 最後に出たいちご以外の果物を当てる（+2点）</li>
                <li>- 最初に出たいちご以外の果物を当てる（+2点）</li>
              </ul>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-800 mb-2">🏆 ランキング</h2>
          <ul className="space-y-1 text-gray-700 ml-4">
            <li>• <strong>記録方法</strong>: データベースに永続保存</li>
            <li>• <strong>表示</strong>: 上位10位まで表示</li>
            <li>• <strong>各プレイヤーの最高スコアのみ記録</strong></li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-800 mb-2">🎮 操作方法</h2>
          <ul className="space-y-1 text-gray-700 ml-4">
            <li>• <strong>選択</strong>: 左右のボタンをタップ/クリック</li>
            <li>• <strong>フィードバック</strong>: 正解時は緑の輪、間違い時は赤の輪と振動エフェクト</li>
            <li>• <strong>タイマー</strong>: 残り10秒以下で赤色に変化</li>
          </ul>
        </section>

        <div className="bg-pink-50 rounded-lg p-4 mt-6">
          <p className="text-sm text-gray-600 text-center">
            💡 <strong>コツ</strong>: 連続正解を狙って時間ボーナスを活用し、記憶チャレンジでさらに高得点を目指そう！
          </p>
        </div>
      </div>

      <div className="mt-6 text-center">
        <button
          onClick={onBack}
          className="bg-pink-500 text-white font-bold py-3 px-8 rounded-lg text-lg shadow-md hover:bg-pink-600 active:scale-95 transform transition-all duration-150"
        >
          戻る
        </button>
      </div>
    </div>
  );
};

export default RulesScreen;