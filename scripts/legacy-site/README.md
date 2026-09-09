# スイカ輪ゴムチャレンジ 🍉

以前に共有されたURLから、新しいゲームへ移動するための静的ページです。

- [ゲームを遊ぶ](https://suika-rubber-band.pages.dev/)
- [現在のソースコード](https://github.com/chamazou-code/suika-rubber-band)

このリポジトリのGitHub PagesはActionsからこのディレクトリを配信します。旧 `rubber-band` リポジトリは `redirect` ブランチに同じ内容を配置します。旧 `main` の履歴とタグは保持します。

`redirect.js` が保存済みBEST（1〜70の整数のみ）をフラグメントとして移転先に渡します。転送先はHTML内の固定リンクで、訪問URLから任意の転送先を指定することはできません。JavaScriptが無効ならmeta refreshと手動リンクで移動できます。
