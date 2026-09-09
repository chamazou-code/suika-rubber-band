# RUBBER BAND 🍉

メーターを狙って、輪ゴムを1本。スイカの限界まで巻く、ワンタップのブラウザゲーム。v1.0.0。

## 遊び方

**タップ・クリック・Space** のどれかで開始。その後も同じ操作で輪ゴムを追加します。

- SAFE中央の34%で **PERFECT**。隠しダメージ0。連続成功でコンボ。
- SAFE内の端で **GOOD**。隠しダメージ0.09。
- SAFE外は **MISS**。距離に応じた隠しダメージ1.7〜2.85。MISSでも1本追加。
- 毎回SAFEが移動し、幅は28%から6.5%まで縮小。針は徐々に加速。
- 新しいスイカの耐久値は40〜70の整数からランダム。本数＋隠しダメージが耐久値に達すると破裂。PERFECTだけでも必ず限界が来ます。
- 上部と果肉が上〜後方へ飛び、見守り役の顔に直撃。下部はテーブルに残ります。すべてスイカの果汁・果肉で、血液や怪我の表現はありません。
- リザルトは本数、PERFECT率、BEST。TRY ANOTHERで即再挑戦。保存するのはBESTのみです。

HP・残り耐久・破裂予告は表示しません。1本ごとの0.29秒の演出中は次の入力を受けず、破裂中は操作をロックします。

## 開発・検証

Node.js 22.12以上（`.node-version`：22.22.0）、npm。

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

ブラウザテスト（開発用依存だけで、プレイ時には配信されません）：

```sh
npx playwright install chromium webkit
npm run test:e2e
```

Chromeのプロジェクトはインストール済みGoogle Chromeを使用します。CIではChromiumへ切り替えます。
`node scripts/play-feel.mjs` は実時間のメーター画像から判断して操作するQA用プレイヤーです。内部耐久値にアクセスせず、ゲーム画面にテスト用機能を公開しません。

## Cloudflare Pagesへの公開

GitHubリポジトリをCloudflare Pagesの **Git integration** で接続します。WorkersではなくPagesを選択してください。

| 設定 | 値 |
| --- | --- |
| Repository | `chamazou-code/rubber-band` |
| Production branch | `main` |
| Framework preset | Vite / None |
| Root directory | 空欄（リポジトリ直下） |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Environment variable | `NODE_VERSION=22.22.0` |

1. Cloudflare Dashboard → Workers & Pages → Create application → Pages → Connect to Git。
2. GitHubの `chamazou-code/rubber-band` のみを対象に接続。
3. 上記のビルド設定を入力し、Save and Deploy。
4. 発行された `https://<project>.pages.dev` で開始・破裂・再挑戦を確認。
5. 以後、`git push origin main` で自動ビルド・公開。PRはプレビューになります。

**Git連携を使うので、先にDirect Upload専用プロジェクトを作成しないでください。** Git連携とDirect Uploadの切替には制約があります。

公式資料：[Git連携](https://developers.cloudflare.com/pages/get-started/git-integration/)、[ビルド設定](https://developers.cloudflare.com/pages/configuration/build-configuration/)、[無料プランの上限](https://developers.cloudflare.com/pages/platform/limits/)。

本作はHTML/CSS/JavaScriptの静的配信だけで完結します。Functions、Workers、サーバー、DB、APIキー、ログイン、分析SDK、課金処理は使いません。独自ドメインも不要です。無料Pages枠の範囲で月額固定費0円を目指す構成です。プランの上限はCloudflareの最新条件に従います。

`public/_headers` でCSPとキャッシュ設定を配信します。ランタイムの外部通信、外部フォント、外部画像、外部音声はありません。

## 実装

- `src/game.ts`：純粋な判定・難易度・状態遷移・BEST保存。
- `src/render.ts`：2D Canvasの人物、変形スイカ、上方向への射出、種と果肉、メーター。
- `src/audio.ts`：Web Audio APIによる完全自作のパチン音、判定音、きしみ、破裂、果肉衝突、コミカルな声風の音。
- `src/main.ts`：単一requestAnimationFrame、入力、DOMのイベント単位更新、可視性・破棄の管理。
- `src/style.css`：320pxからデスクトップ・横画面までのレイアウト。

音はユーザーの初回操作で解禁。ミュート可。reduced-motionではシェイク、震え、ポップを止め、粒子数を減らします。タイミング針と上方向の飛翔はゲームの理解に必要な動きとして残します。画面ズームは禁止せず、ゲーム領域のtouch-actionで誤操作を抑えます。

検証の範囲と既知の制約は [docs/QA.md](docs/QA.md)、設計と添付動画の観察は [docs/DESIGN.md](docs/DESIGN.md) を参照。

## 素材

イラストは独自のCanvas図形、SNSカードは独自のSVG、音は独自の合成音。外部素材・有料素材は使用していません。添付参照動画は観察にのみ使用し、ゲームにもリポジトリにも同梱していません。
