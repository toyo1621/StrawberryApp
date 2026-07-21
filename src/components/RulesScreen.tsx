import React from 'react';
import InfoScreen, { InfoSection } from './info/InfoScreen';

type RulesScreenProps = {
  onBack: () => void;
  darkMode?: boolean;
};

const sections: InfoSection[] = [
  {
    title: '基本ルール',
    bullets: [
      '制限時間は30秒。表示された2つの選択肢から正解を選びます。',
      '正解は1点。間違えると残り時間が3秒減ります。',
    ],
  },
  {
    title: 'いちごモード',
    bullets: [
      'いちごを選びます。ショートケーキは3点と2秒、ホールケーキは5点と5秒のボーナスです。',
      '2連続正解から正解ごとに0.5秒回復します。残り10秒以下では特別問題が出やすくなります。',
      '終了後は、ゲーム中に出た果物を答える2段階の記憶チャレンジがあります。',
    ],
  },
  {
    title: '島・国旗・色モード',
    bullets: [
      '島モードは島の形から正しい有人離島名を選びます。正解で0.3秒、ゴールデン島は3点に加えてさらに1秒回復します。',
      '国旗モードは国名に合う国旗を選びます。正解すると1秒回復します。',
      '色モードは色見本に合う伝統色・慣用色の名前を選びます。正解すると1秒回復します。',
    ],
  },
  {
    title: 'ランキング',
    bullets: [
      'プレイヤー名ごとの最高スコアを、全体・日別・週別・月別で表示します。期間の区切りは日本時間です。',
      '通信できない場合もプレイでき、スコアは端末に保存されて次回オンライン時に再送されます。',
      'プレイヤー名は公開されます。個人情報を入力しないでください。',
    ],
  },
  {
    title: '操作とアクセシビリティ',
    bullets: [
      '選択肢はタップ、クリック、キーボード、スクリーンリーダーで操作できます。',
      '振動は設定で無効にできます。端末の「視差効果を減らす」設定が有効な場合は大きな演出を短縮します。',
    ],
  },
];

const RulesScreen: React.FC<RulesScreenProps> = ({ onBack, darkMode = false }) => (
  <InfoScreen title="ゲームルール" sections={sections} onBack={onBack} darkMode={darkMode} />
);

export default RulesScreen;
