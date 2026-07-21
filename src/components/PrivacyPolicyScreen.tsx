import React from 'react';
import InfoScreen, { InfoSection } from './info/InfoScreen';

type PrivacyPolicyScreenProps = {
  onBack: () => void;
  darkMode?: boolean;
};

const sections: InfoSection[] = [
  {
    title: '1. 収集・保存する情報',
    paragraphs: ['ランキングへスコアを送信した場合、次の情報を取り扱います。'],
    bullets: [
      '入力したプレイヤー名、スコア、ゲームモード、プレイ時間、送信日時、重複送信を防ぐ投稿ID',
      '不正な連続投稿を抑止するため、IPアドレスとブラウザ情報を秘密値と組み合わせて一方向変換した識別ハッシュ',
      '端末内に保存するプレイヤー名、設定、ランキングキャッシュ、未送信スコア',
    ],
  },
  {
    title: '2. 利用目的',
    bullets: [
      'モード別・期間別ランキングとスコア履歴の提供',
      'オフライン時のプレイ結果をオンライン復帰後に再送するため',
      '重複投稿、機械的な連続投稿、明らかに不正なスコアを抑止するため',
      '障害の調査とサービスの安定運用のため',
    ],
  },
  {
    title: '3. 公開範囲',
    paragraphs: [
      'プレイヤー名、スコア、ゲームモード、記録日時はランキングAPIから公開されます。氏名や連絡先など、公開したくない情報をプレイヤー名に入力しないでください。',
    ],
  },
  {
    title: '4. 保存先と保持期間',
    paragraphs: [
      'ランキングはCloudflare WorkersおよびCloudflare D1で処理・保存します。ランキング記録はサービス提供中または削除依頼へ対応するまで保持します。連続投稿対策の識別ハッシュは最大15分で削除します。端末内データはブラウザまたはアプリのデータを消去すると削除されます。',
    ],
  },
  {
    title: '5. 外部サービス',
    paragraphs: [
      'インフラ提供者としてCloudflareを利用します。お問い合わせを選ぶとGoogleフォームが外部ブラウザで開き、その先ではGoogleのプライバシーポリシーが適用されます。本アプリには広告SDKや行動分析SDKを組み込んでいません。',
    ],
  },
  {
    title: '6. データの削除',
    paragraphs: [
      'ランキング記録の削除を希望する場合は、マイページのお問い合わせフォームから、対象のプレイヤー名、ゲームモード、記録時期をお知らせください。第三者の記録を誤って削除しないため、追加確認をお願いする場合があります。',
    ],
  },
  {
    title: '7. セキュリティとお問い合わせ',
    paragraphs: [
      '通信はHTTPSを使用し、送信元、入力値、投稿頻度をサーバー側で検証します。本ポリシーに関する連絡はマイページのお問い合わせフォームをご利用ください。',
    ],
  },
];

const PrivacyPolicyScreen: React.FC<PrivacyPolicyScreenProps> = ({ onBack, darkMode = false }) => (
  <InfoScreen
    title="プライバシーポリシー"
    updatedAt="2026年7月21日"
    sections={sections}
    onBack={onBack}
    darkMode={darkMode}
  />
);

export default PrivacyPolicyScreen;
