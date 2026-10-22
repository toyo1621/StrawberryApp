import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

export const writeStorePages = async (directory) => {
  const policy = JSON.parse(await readFile(new URL('../src/content/privacyPolicy.json', import.meta.url), 'utf8'));
  const contactUrl = new URL(policy.contactUrl);
  if (contactUrl.protocol !== 'https:') {
    throw new Error('The support URL must use HTTPS.');
  }
  const contact = `<a href="${escapeHtml(contactUrl.href)}" rel="noreferrer">お問い合わせフォーム</a>`;
  const document = (title, content) => `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
  <meta name="referrer" content="no-referrer">
  <title>${escapeHtml(title)} | つめチャレ！</title>
  <link rel="icon" href="./favicon.ico">
  <style>
    :root{color-scheme:light dark;font-family:system-ui,sans-serif;line-height:1.8;color:#1f2937;background:#fff}
    body{margin:0}main{max-width:48rem;margin:auto;padding:24px 20px 48px;overflow-wrap:anywhere}
    nav{display:flex;align-items:center;gap:12px;flex-wrap:wrap}nav img{width:40px;height:40px}
    h1{font-size:26px;line-height:1.5;margin:24px 0 12px}h2{font-size:20px;line-height:1.5;margin:32px 0 12px}
    p,ul{margin:12px 0}ul{padding-left:24px}a{color:#9d174d;text-underline-offset:3px}
    a:focus-visible{outline:3px solid #9d174d;outline-offset:4px}nav a,footer a{display:inline-block;padding:8px 0}
    footer{border-top:1px solid #cbd5e1;margin-top:32px;padding-top:16px}
    @media(prefers-color-scheme:dark){:root{color:#f3f4f6;background:#111827}a{color:#f9a8d4}}
  </style>
</head>
<body><main>
  <nav aria-label="関連ページ"><img src="./favicon.ico" alt=""><a href="./">つめチャレ！</a></nav>
  <h1>${escapeHtml(title)}</h1>
  ${content}
  <footer><a href="./privacy.html">プライバシーポリシー</a> / <a href="./support.html">サポート</a></footer>
</main></body></html>
`;
  const sections = policy.sections.map((section) => `<section>
    <h2>${escapeHtml(section.title)}</h2>
    ${(section.paragraphs ?? []).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('\n')}
    ${section.bullets ? `<ul>${section.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join('')}</ul>` : ''}
  </section>`).join('\n');
  await writeFile(join(directory, 'privacy.html'), document(policy.title,
    `<p>最終更新日: ${escapeHtml(policy.updatedAt)}</p>${sections}<p>${contact}</p>`));
  await writeFile(join(directory, 'support.html'), document('サポート', `
    <p>「つめチャレ！」のお問い合わせ窓口です。開発・運営: toyo1621。</p>
    <h2>不具合・ランキング・プライバシーに関するお問い合わせ</h2>
    <p>${contact}</p>
    <p>ゲームモード、島の地域、発生時刻、端末・OS、問題の状況をお知らせください。不適切なプレイヤー名の報告には、名前・モード・スコアを添えてください。パスワードや端末の秘密トークンを送る必要はありません。</p>
    <h2>自分のデータを削除する</h2>
    <p>アプリのマイページにある「プレイヤーデータを削除」から、この端末で登録した公開スコアと端末内データを削除できます。端末を紛失した場合や旧記録の削除は、お問い合わせフォームでご相談ください。</p>
    <h2>通信できない場合</h2>
    <p>オフラインでもプレイできます。結果が公開ランキングに反映されない場合は、表示された保存状態と発生時刻をお知らせください。</p>
  `));
};
