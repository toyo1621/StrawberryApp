import React from 'react';
import InfoScreen, { InfoSection } from './info/InfoScreen';

type TermsOfServiceScreenProps = {
  onBack: () => void;
  darkMode?: boolean;
};

const sections: InfoSection[] = [
  {
    title: '1. 適用',
    paragraphs: ['本規約は「いちごつめ！」の利用条件を定めます。本アプリを利用した時点で、本規約に同意したものとみなします。'],
  },
  {
    title: '2. サービス内容',
    paragraphs: ['本アプリは4種類の2択ゲーム、端末内設定、公開ランキングを提供します。ランキングや機能は、保守、障害、仕様変更により一時停止または変更される場合があります。'],
  },
  {
    title: '3. 禁止事項',
    bullets: [
      '自動操作、改ざん、虚偽のプレイ時間などによる不正なスコア送信',
      '他者になりすます名前、個人情報、差別的・攻撃的・違法な内容をプレイヤー名に使用する行為',
      'サービスや第三者の権利を侵害する行為、または運営を妨害する行為',
      '脆弱性を悪用し、データやサービスへ不正にアクセスする行為',
    ],
  },
  {
    title: '4. スコアの取扱い',
    paragraphs: ['明らかに不正、重複、禁止事項に該当すると判断した記録は、事前通知なく非表示または削除する場合があります。プレイヤー名は公開情報として扱われます。'],
  },
  {
    title: '5. 免責と責任',
    paragraphs: ['本アプリは現状有姿で提供します。法令上認められる範囲で、通信障害、端末故障、データ消失などによる間接的損害について責任を負いません。'],
  },
  {
    title: '6. 変更・お問い合わせ',
    paragraphs: ['重要な変更は本画面の更新日で示します。ご質問はマイページのお問い合わせフォームからご連絡ください。'],
  },
];

const TermsOfServiceScreen: React.FC<TermsOfServiceScreenProps> = ({ onBack, darkMode = false }) => (
  <InfoScreen
    title="利用規約"
    updatedAt="2026年7月21日"
    sections={sections}
    onBack={onBack}
    darkMode={darkMode}
  />
);

export default TermsOfServiceScreen;
