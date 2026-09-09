# スイカ輪ゴムチャレンジ 🍉 — RUBBER BAND

メーターを狙って、輪ゴムを1本。スイカの限界まで巻く、ワンタップのブラウザゲーム。v1.2.2。

**公開URL：[スイカ輪ゴムチャレンジ 🍉](https://suika-rubber-band.pages.dev/)**

[GitHubリポジトリ](https://github.com/chamazou-code/suika-rubber-band)

Cloudflare PagesのGit連携で公開。`main` へのpushでビルド・公開が自動実行されます。GitHub Actionsでは単体・ブラウザテストを実行します。

v1.2.1で公開先と開発リポジトリを `suika-rubber-band` へ移動。GitHub Pagesの `/suika-rubber-band/` はActionsから、以前の `/rubber-band/` は旧リポジトリの `redirect` ブランチから、Cloudflareへの転送ページを配信します。テンプレートは `scripts/legacy-site/`。旧 `main` の履歴・タグを残します。Cloudflareへのドメイン移転では、旧URLの転送ページがBESTだけをURLフラグメントで渡し、新サイトが引き継ぎます。既存の高いBESTは上書きせず、取り込み後はフラグメントを取り除きます。ストレージが使えなくてもゲームは開けます。

## 遊び方

**タップ・クリック・Space** のどれかで開始。その後も同じ操作で輪ゴムを追加します。

- SAFE中央の34%で **PERFECT**。隠しダメージ0。連続成功でコンボ。
- SAFE内の端で **GOOD**。隠しダメージ0.09。
- SAFE外は **MISS**。距離に応じた隠しダメージ1.7〜2.85。MISSでも1本追加。
- 毎回SAFEが移動し、幅は28%から6.5%まで縮小。針は徐々に加速。
- 新しいスイカの耐久値は40〜70の整数からランダム。本数＋隠しダメージが耐久値に達すると破裂。PERFECTだけでも必ず限界が来ます。
- 上部がまず上へ飛び、果肉付きの破片に分かれます。下部は欠けた皮と砕けた果肉を見せてテーブルに残り、輪ゴムも解放されて飛散します。人物は登場しません。すべてスイカの果汁・果肉で、血液や怪我の表現はありません。
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

# 公開URLに同じE2Eを実行
GAME_URL=https://suika-rubber-band.pages.dev/ npm run test:e2e
```

Chromeのプロジェクトはインストール済みGoogle Chromeを使用します。CIではChromiumへ切り替えます。
`node scripts/play-feel.mjs` は実時間のメーター画像から判断して操作するQA用プレイヤーです。内部耐久値にアクセスせず、ゲーム画面にテスト用機能を公開しません。

## Cloudflare Pagesへの公開

GitHubリポジトリをCloudflare Pagesの **Git integration** で接続します。WorkersではなくPagesを選択してください。

| 設定 | 値 |
| --- | --- |
| Project name | `suika-rubber-band` |
| Repository | `chamazou-code/suika-rubber-band` |
| Production branch | `main` |
| Framework preset | Vite / None |
| Root directory | 空欄（リポジトリ直下） |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Environment variable | `NODE_VERSION=22.22.0` |

1. Cloudflare Dashboard → Workers & Pages → Create application → Pages → Connect to Git。
2. GitHubの `chamazou-code/suika-rubber-band` のみを対象に接続。
3. 上記のビルド設定を入力し、Save and Deploy。
4. `https://suika-rubber-band.pages.dev/` で開始・破裂・再挑戦を確認。
5. 以後、`git push origin main` で自動ビルド・公開。PRはプレビューになります。

**Git連携を使うので、先にDirect Upload専用プロジェクトを作成しないでください。** Git連携とDirect Uploadの切替には制約があります。

公式資料：[Git連携](https://developers.cloudflare.com/pages/get-started/git-integration/)、[ビルド設定](https://developers.cloudflare.com/pages/configuration/build-configuration/)、[無料プランの上限](https://developers.cloudflare.com/pages/platform/limits/)。

本作はHTML/CSS/JavaScriptの静的配信だけで完結します。Functions、Workers、サーバー、DB、APIキー、ログイン、分析SDK、課金処理は使いません。独自ドメインも不要です。無料Pages枠の範囲で月額固定費0円を目指す構成です。プランの上限はCloudflareの最新条件に従います。

`public/_headers` でCSPとキャッシュ設定を配信します。フォントも同梱して配信し、プレイ中に外部サービスへ通信しません。

## 実装

- `src/game.ts`：純粋な判定・難易度・状態遷移・BEST保存。
- `src/render.ts`：Three.jsの固定俯瞰カメラ、照明、木のテーブル、描画とGPUリソースの管理。
- `src/visual/`：スイカの変形メッシュ、皮・木目・果肉の自作テクスチャ、3D輪ゴムと破片。
- `src/meter.ts`：半円の2D Canvasメーター。3Dとは独立して更新。
- `src/audio.ts` / `src/music.ts`：Web Audio APIによる自作の木琴風BGM、パチン音、判定音、きしみ、破裂、果汁の飛散音。
- `src/main.ts`：単一requestAnimationFrame、入力、DOMのイベント単位更新、可視性・破棄の管理。
- `src/style.css`：320pxからデスクトップ・横画面までのレイアウト。

音はユーザーの初回操作で解禁。右上の音ボタンでBGM・効果音をまとめてON／OFF。背景へ移ると停止し、戻ると再開します。BGMは108 BPMの8小節を初回に合成してループ再生し、毎フレームの音声生成や音楽用タイマーは使いません。きしみ・破裂中はBGMを小さくして効果音を前に出します。

iPhoneでは、タイミング判定は指を触れた瞬間、音の解禁は指を離した `touchend` 内で行います。Audio Session APIがあるSafariでは `playback` を指定し、端末のメディア音量で再生。ミュートや背景移動時に設定を戻します。再生許可が得られなければ「SOUND ON」と表示せず、音ボタンから再試行できます。根拠：[ユーザー操作による制限](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/User_activation)、[WebKitの消音モードとAudio Session](https://bugs.webkit.org/show_bug.cgi?id=237322)。実機スピーカー・旧iOSの挙動は未確認です。

reduced-motionではシェイク、震え、ポップを止め、粒子数を減らします。タイミング針と上方向の飛翔はゲームの理解に必要な動きとして残します。ダブルタップ拡大はtouch-actionと単指touchendの既定動作抑止で防ぎ、2本指のピンチ拡大は残します。

検証の範囲と既知の制約は [docs/QA.md](docs/QA.md)、設計と添付動画の観察は [docs/DESIGN.md](docs/DESIGN.md) を参照。

## 3Dと負荷対策

PerspectiveCameraで約36度の俯瞰。皮の縞・艶・凹凸と温かい照明で立体感を作り、中央だけを局所的にくびれさせます。破裂後の断面は凹凸のある三角形メッシュで、皮の欠けと果肉の窪みを表現します。解放された下半分は0.7秒でくびれが戻り、切り口が広がって少し沈みます。底の接地点は動かしません。1/120秒刻みの軽い物理計算で、破片と輪ゴムに重力・回転・床への反発・摩擦を適用します。輪ゴムは解放されると縮み、果肉より弾みます。輪ゴムと粒子はInstancedMesh。輪ゴムは最大70本、飛散粒子は最大100個、果汁跡は最大20個です。

スマホの3D解像度はDPR最大1.5、PCは最大1.75。負荷が続くと解像度を下げ、必要時は3D更新だけを約30fpsに制限します。待機中の3D再描画、重いポストプロセス、外部モデル・HDR画像は不要です。テクスチャは最大1024px、初回に一度生成し、破裂用シェーダーも開始前に準備します。

WebGL2が必要です。利用できない場合は説明と再読み込みボタンを表示します。一時的な描画コンテキスト喪失中はゲームを止め、復帰時に照明の反射マップも再生成して同じラウンドを続行します。

`GAME_URL=http://127.0.0.1:5173 node scripts/profile-scene.mjs` で開発サーバーの描画回数・GPUリソース数・5ラウンド後の解放を確認できます。`scripts/social.mjs` は実際のゲーム画面からSNSカードを生成します。

## 素材

3D形状と皮・果肉・木目は独自のプログラム生成、SNSカードはゲーム画面のキャプチャ、音は独自の合成音。有料素材は使用していません。添付参照動画は観察にのみ使用し、ゲームにもリポジトリにも同梱していません。

英数字は [Outfit](https://github.com/google/fonts/tree/main/ofl/outfit)（Copyright 2021 The Outfit Project Authors、SIL Open Font License 1.1）。Latin文字を中心にサブセット化した約20KBのWOFF2を同梱し、外部フォントCDNには接続しません。[ライセンス全文](public/fonts/OFL-Outfit.txt)。日本語は端末のシステムフォントです。

Three.jsはMITライセンス。使用条件を同梱しています：[ライセンス全文](public/licenses/Three-MIT.txt)。画像生成APIや有料素材は使用していません。
