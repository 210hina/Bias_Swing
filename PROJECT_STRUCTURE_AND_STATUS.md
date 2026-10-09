# 揺れる電車 Webアプリ：ファイル構造と実装状況

最終更新: 2026-10-09

## 1. プロジェクト概要

「揺れる電車」は、電車内で左右どちらの乗客へ席を譲るかを選ぶ体験型Webプロトタイプです。

現在は以下の2画面で構成されています。

- `index.html`: 体験本体
- `admin.html`: シーン、時間、背景、設問を編集する管理画面

フレームワークやビルドツールは使用しておらず、HTML、CSS、JavaScript ES Modulesだけで動作します。

---

## 2. 現在のファイル構造

```text
RockingTrain_test/
├── index.html                     # 体験本体のHTML
├── app.js                         # 本体の起動と設定読込
├── main.js                        # UI部品、入力処理、SceneManager
├── content.js                     # 本体に表示する日本語文言
├── style.css                      # 本体の画面デザイン
│
├── admin.html                     # 管理画面のHTML
├── admin.js                       # 設定編集、プレビュー、Import / Export
├── admin.css                      # 管理画面のデザイン
├── config-store.js                # 共通設定形式、初期値、保存、旧形式変換
│
├── CONFIG_JSON_GUIDE.md           # JSON設定を本体へ反映する手順書
├── PROJECT_STRUCTURE_AND_STATUS.md # 本書
│
└── assets/
    ├── README.md                  # 画像配置についての旧来の説明
    ├── 01_train_Far_Full.png      # 混雑した車内・遠景
    ├── 02_train_Far_Empty.png     # 空いた車内・遠景
    ├── 03_train_Close_Full.png    # 設問画面・近景
    ├── char_20f.png               # 20代女性
    ├── char_70m.png               # 70代男性
    └── audio/
        └── README.md              # BGM / SEの配置ファイル名
```

### 現在ファイルが用意されていない登録済みアセット

`main.js`の`ASSET_MANIFEST`には登録されていますが、次のファイルは現時点の`assets`フォルダにはありません。

- `assets/bg_train_loop.png`
- `assets/hesitation_effect.gif`

画像がない場合は、登録されているフォールバック表示が使用されます。

`main.js`の`AUDIO_MANIFEST`には次の音源も登録されています。実ファイルは`assets/audio/`へ配置してください。

- `bgm_crowded.mp3`
- `bgm_quiet.mp3`
- `se_input.wav`
- `se_hesitation.wav`
- `se_reveal.mp3`

音源がない場合は無音で進行します。

---

## 3. 起動方法

JavaScript Modulesとブラウザストレージを使用するため、HTMLファイルを直接開かずローカルサーバーから起動します。

```bash
cd /Users/hinam/Desktop/TechBias_prototyping/RockingTrain_test
python3 -m http.server 8000
```

体験本体:

```text
http://localhost:8000/index.html
```

管理画面:

```text
http://localhost:8000/admin.html
```

管理画面と本体は、同じホスト名とポート番号で開く必要があります。

---

## 4. アプリケーション構成

```text
admin.html
    ↓ 編集
admin.js
    ↓ 正規化・保存
config-store.js
    ↓ Local Storage（本番設定）
app.js
    ↑ postMessage（プレビュー設定）
    ↓ 設定を渡す
SceneManager（main.js）
    ↓
背景レイヤー + UIレイヤー
```

### 本体起動時

1. `app.js`が`config-store.js`から保存済み設定を読み込みます。
2. 設定がない場合は`DEFAULT_APP_CONFIG`を使用します。
3. `bootstrapApp()`へ`sceneSequence`、`questionSets`、ホールド時間を渡します。
4. `SceneManager`が設定された順番でシーンを実行します。

### 管理画面プレビュー時

1. 編集中の設定を管理画面から`postMessage`で直接渡します。
2. `index.html?preview=1`をiframeで起動します。
3. 本体から管理画面へ現在のシーン情報を`postMessage`で送ります。
4. 管理画面のタイムラインが実行中シーンをハイライトします。

---

## 5. DOMレイヤー構造

本体のDOMは、背景とUIが分離されています。

```html
<main id="app">
  <div id="background-layer"></div>
  <div id="ui-layer"></div>
</main>
```

### Background Layer

- 画面遷移時も破棄されない固定レイヤーです。
- 2枚の`img`要素を使って背景をクロスフェードします。
- 同じ背景の場合は再読込しません。
- 次の画像をプリロードしてから切り替えます。
- ローカルアップロード画像のData URLにも対応しています。

### UI Layer

- シーンごとのタイトル、字幕、設問、結果UIを表示します。
- シーン遷移時は、このレイヤーの中身だけが差し替わります。

---

## 6. 設定データ

共通設定は`config-store.js`の`DEFAULT_APP_CONFIG`で定義されています。

現在のスキーマバージョン:

```text
schemaVersion: 4
```

概略構造:

```js
{
  schemaVersion: 4,
  choiceHoldDurationMs: 2000,
  introduction: {
    sequence: [/* 導入画面 */]
  },
  questionScenes: [
    {
      id: 'question_scene_01',
      label: 'シーン 1',
      sequence: [/* このシーン固有の画面遷移 */],
      questionSet: {
        id: 'priority_seat_01',
        stages: []
      }
    }
  ],
  result: {
    sequence: [/* 結果・終了画面 */],
    diagnosis: {/* 診断文 */}
  }
}
```

管理時はイントロ、設問シーン群、結果に分割されています。実行時に`buildRuntimeConfig()`が全グループを一本の`sceneSequence`と`questionSets`へ変換します。

### `label`と画面表示文言の違い

- `label`: 管理画面と管理タイムラインだけで使用するシーン名
- `title`: 本体画面へ表示するタイトル
- `message`: 本体画面へ表示する本文

`label`は本体およびiframe内の体験画面には表示されません。

---

## 7. 動的シーンシーケンス

本体は固定された画面順ではなく、`sceneSequence`の配列順で動作します。

### シーンの動作種別

| `behavior` | 動作 |
| --- | --- |
| `timed` | 指定時間だけ演出画面を表示して次へ進む |
| `stage_input` | 次のStageを表示し、選択またはタイムアウトを待つ |
| `summary` | 記録した回答から総合結果を表示する |
| `end` | 終了画面を表示し、時間経過後に待機画面へ戻る |

`id`は任意の名前へ変更できます。入力や結果表示の機能は`id`ではなく`behavior`で判定します。

### 初期状態のシーン順

待機画面`ATTRACT`は`sceneSequence`の外側に常駐しています。

| 順番 | シーンID | 動作 | 初期時間 | 背景 |
| --- | --- | --- | ---: | --- |
| 1 | `SESSION_START` | 通常演出 | 400ms | `01_train_Far_Full.png` |
| 2 | `SCENE_INTRO_FULL` | 通常演出 | 2000ms | `01_train_Far_Full.png` |
| 3 | `SCENE_INTRO_EMPTY` | 通常演出 | 2000ms | `02_train_Far_Empty.png` |
| 4 | `SCENE_1_STAGE_1_INPUT` | 次の設問 | 12000ms | `03_train_Close_Full.png` |
| 5 | `SCENE_1_STAGE_2_INPUT` | 次の設問 | 12000ms | `03_train_Close_Full.png` |
| 6 | `SESSION_SUMMARY` | 総合結果 | 4000ms | `02_train_Far_Empty.png` |
| 7 | `SESSION_END` | 終了 | 4000ms | `02_train_Far_Empty.png` |

### 通常演出の字幕表示

`behavior: "timed"`の文字は、背景を妨げない小さな字幕として画面上部へ表示されます。

- `title`: 上段
- `message`: タイトル直下
- 半透明の暗色背景とぼかしを使用

設問、総合結果、終了画面は通常の中央レイアウトを使用します。

---

## 8. 設問セットとStage構造

現在の初期設定は1つのQuestionSetに2つのStageを持ちます。

```text
QuestionSet 1
├── Stage 1：文字のみ
└── Stage 2：提示タイプを選択
    ├── 2α：文字 + イラスト
    └── 2β：文字 + 他者の選択率
```

### Stage 1

- `infoLevel: "text_only"`
- 左: 20代女性
- 右: 70代男性
- 人物イラストは表示しません。

### Stage 2α

- `infoLevel: "text_and_illustration"`
- 左: `char_20f.png`
- 右: `char_70m.png`
- 左右それぞれ管理画面からPNG／JPEG／WebP／GIFをアップロードできます。
- アップロード画像は`imageSrc`としてJSONとブラウザ保存に含まれ、既存`assetKey`より優先して表示されます。

### Stage 2β

- `infoLevel: "text_and_stats"`
- 選択する前に他者の選択率を表示します。
- 左右の割合は管理画面から編集でき、未入力時は左45%、右55%です。
- 統計を見た状態で左右を再選択します。

### 提示タイプ設定

- シーンごとに2α固定、2β固定、ランダム分岐を選べます。
- ランダム分岐ではセッション開始時に`Math.random()`で2αまたは2βを選びます。
- ランダム分岐の確率は各50%です。
- Stage 1の回答内容は分岐確率へ影響しません。
- QuestionSetが複数ある場合、各ランダムStageを独立して抽選します。

---

## 9. 現在の画面遷移

```text
ATTRACT（待機）
  ↓ 操作
sceneSequence[0]
  ↓ durationMs
sceneSequence[1]
  ↓
...
  ↓
stage_input
  ↓ 選択または無操作タイムアウト
次のsceneSequence項目
  ↓
summary
  ↓
end
  ↓ durationMs
ATTRACT
```

選択後の「みんなの選択」結果画面は削除されています。

- 選択後は回答をメモリへ記録します。
- 直後に次のシーンへ進みます。
- 旧`STAGE_REVEAL`は現在の実行経路に存在しません。

`stage_input`シーン1件につき、QuestionSet内の次のStageを1件消費します。

---

## 10. 入力処理

入力は`emitChoice()`を中心とした抽象化層を通ります。

### キーボード

| キー | 選択 | 確定方法 |
| --- | --- | --- |
| `←` | 左側の乗客 | 初期値2秒ホールド |
| `→` | 右側の乗客 | 初期値2秒ホールド |
| `↓` | 自分が座る | 即時確定 |

### 画面操作

- 中央の左右の人物ボタンをホールドします。
- ホールド中はボタン内の色ゲージが増加します。
- 指を離す、ポインターが外れる、キャンセルされるとゲージが戻ります。

### 入力の拡張性

入力ソースは`start()`と`stop()`を持つインターフェースで登録します。

将来WebSocketや`bridge.py`からのtiltイベントを接続する場合も、最終的に`emitChoice('left' | 'right' | 'self')`を呼べば、SceneManager本体の変更は不要です。

---

## 11. 迷い度と回答履歴

### 応答時間

`stage_input`開始時刻から`CHOICE_MADE`までを計測します。

### 迷い度

- 応答時間を入力受付時間に対する割合へ変換します。
- 0〜100%へ制限します。
- 無操作タイムアウトは100%です。

### 記録内容

- QuestionSet ID
- QuestionSet番号
- Stage番号
- 左／右／自分の選択
- 入力またはタイムアウト
- 応答時間
- 迷い度
- Stage 2の分岐ID
- 左右の表示ラベル

履歴は現在、1セッション中のメモリに保持されます。セッション開始時にリセットされます。

---

## 12. UIコンポーネント実装状況

| コンポーネント | 状況 | 用途 |
| --- | --- | --- |
| `MediaAsset` | 実装済み | 画像、動画、GIFとフォールバック表示 |
| `ChoicePrompt` | 実装済み | 情報レベルごとの選択肢表示 |
| `SocialStatistics` | 実装済み | Stage 2βの選択前統計 |
| `InputIndicator` | 削除済み | 本編からキー操作案内を撤去 |
| `TicketMock` | 実装済み | 総合結果の切符風UI |
| `HesitationEffect` | コンポーネントのみ残存 | 現在の遷移では使用しない |

`ResultReveal`と選択後の統計表示UIは削除済みです。

---

## 13. 背景・アセット管理

アセット定義は`main.js`の`ASSET_MANIFEST`にあります。

| assetKey | ファイル | 用途 |
| --- | --- | --- |
| `bg_train_loop` | `bg_train_loop.png` | 待機画面。現在ファイル未配置 |
| `train_far_full` | `01_train_Far_Full.png` | 混雑した車内 |
| `train_far_empty` | `02_train_Far_Empty.png` | 空いた車内 |
| `train_close_full` | `03_train_Close_Full.png` | 設問中の車内 |
| `char_20f` | `char_20f.png` | 20代女性 |
| `char_70m` | `char_70m.png` | 70代男性 |
| `hesitation_effect` | `hesitation_effect.gif` | 現在未使用・ファイル未配置 |

### 管理画面からの背景アップロード

- PNG、JPEG、WebP、GIFを選択できます。
- 画像はData URLとして設定へ埋め込みます。
- JSON Export / Importでも画像を維持できます。
- 登録済み背景を選び直すと、アップロード画像は解除されます。
- 大容量画像はLocal Storageの容量上限に注意が必要です。

---

## 14. 管理画面の実装状況

### タブ構成

- イントロダクション
- シーン1〜N（横スクロール対応）
- 結果・サマリー
- 10シーン以上を追加可能

### 各シーンタブ

- 設問シーンの追加、削除
- 画面イベントと設問設定を同じカード内で一括管理
- 選択中画面イベントの直後への追加
- 画面イベント名の直接編集
- ドラッグ＆ドロップによる画面イベントの並び替え、削除
- シーンID編集
- 動作種別編集
- 表示時間のスライダー／数値編集
- 登録済み背景画像の選択
- ローカル背景画像のアップロード
- タイトル／本文編集
- 選択ホールド時間編集
- 開始時BGM、ループ、音量、クロスフェード時間
- 開始時SE、選択・アクション時SE、SE音量

選択中のカードはオレンジ色の枠で表示されます。

### 設問・提示情報の編集

- 動作種別が`stage_input`の画面イベントを選ぶと、そのカード内に設問設定を表示
- 文字のみ／2α（イラスト）／2β（他者の選択率）／ランダム分岐をイベントごとに選択
- 左右の乗客ラベル編集
- 左右の`assetKey`編集
- 2αの左右イラストのアップロード、サムネイル確認、解除
- 2βの左右選択率を編集
- 画面イベントの削除・動作種別変更・並び替えに設問データが追従

### Live Simulator

- iframeプレビュー
- 別ウィンドウプレビュー
- 編集中設定の一時適用
- 実行中シーンのタイムライン表示
- 選択中画面イベントからテスト
- イントロから全体テスト
- プレビュー音声のON／OFF

### Import / Export

- JSON Export
- JSON Import
- Local Storage保存
- 初期設定への復帰
- schemaVersion 1〜3から4への旧形式変換

---

## 15. 文言を編集する場所

共通の日本語文言は`content.js`へ集約されています。

主な項目:

- ブラウザタイトル
- 乗客名
- 待機画面
- 導入画面
- 設問文
- 入力案内
- 結果画面
- 診断文
- 切符UI

動的シーン固有の文字は、管理画面の次の項目で編集します。

- 表示タイトル
- メッセージ本文

シーンカード上部の名前は管理用で、本体には表示されません。

---

## 16. 設定の保存場所

### 通常設定

```text
Local Storage: rocking-train-config-v1
```

### プレビュー設定

通常の管理画面プレビューでは、設定とアップロード画像を`postMessage`でiframe／別ウィンドウへ直接送信します。`rocking-train-preview-config-v1`は、管理画面から切り離してプレビューURLを開いた場合の互換フォールバックとして残しています。

キー名の`v1`は互換性維持のため残しています。内部データの現在の`schemaVersion`は4です。

JSON反映の具体的な手順は`CONFIG_JSON_GUIDE.md`を参照してください。

---

## 17. 現時点の未実装・注意事項

### 未実装

- 実データによる選択統計
- サーバーへの回答送信
- WebSocket / `bridge.py`との実接続
- 感熱プリンターへの実印刷
- 管理設定のサーバー保存
- Stage 2分岐確率の管理画面編集
- 自動E2Eブラウザテスト環境

### 現在は固定またはモック

- 他者の選択率の初期値は左45%、右55%
- Stage 2α／2βの確率は50%ずつ
- タイムアウト時のデフォルト選択は`self`

### 運用上の注意

- 管理画面では`stage_input`画面イベント数と内部Stage数を自動同期します。
- `end`シーンより後ろへ置いたシーンは実行されません。
- Local Storageはブラウザ、ホスト名、ポート番号ごとに別管理です。
- Data URL画像が大きいとLocal Storage上限を超える可能性があります。
- ブラウザの自動再生制限により、BGM / SEは最初のクリックまたはキー操作後に有効になります。
- 音源ファイル未配置時はコンソールへ警告を出し、無音で進行します。
- `assets/README.md`には旧`STAGE_REVEAL`などの記述が一部残っています。本書の内容が現在の実装です。

### 互換コード

`main.js`には、外部連携との互換性のため旧固定タイマー用の定数と処理が一部残っています。

通常の`app.js`起動では、`sceneSequence`による動的実行経路が使用されます。

---

## 18. 確認済み項目

- 全JavaScriptファイルの構文確認
- 設定JSONの正規化
- schemaVersion 1〜3から4への移行
- 10設問シーンの正規化とランタイム展開
- 任意の設問シーンタブからのプレビュー開始
- 動的シーンの追加順実行
- シーンごとの表示時間
- シーンごとの背景切り替え
- アップロード背景画像の復元
- 管理用ラベルが本体へ表示されないこと
- Stage 2α／2βの両分岐
- Stage 1からStage 2への直接遷移
- Stage 2から総合結果への直接遷移
- 終了画面から待機画面への復帰
- 上部字幕表示
