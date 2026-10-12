# 管理画面からExportした設定JSONを本体へ反映する方法

## 結論：JSONファイルをプロジェクト内へ移動する必要はありません

現在の「揺れる電車」は、プロジェクト内のJSONファイルを直接読み込む構成ではありません。

管理画面からJSONをImportし、**「ブラウザに保存」**を押すことで、設定がブラウザのLocal Storageへ保存されます。本体の`index.html`は、起動時にその保存設定を自動で読み込みます。

したがって、ExportしたJSONを`assets`フォルダやプロジェクト直下へコピーしても、それだけでは本体に反映されません。

---

## 推奨手順：ExportしたJSONを本体へ反映する

### 1. ローカルサーバーを起動する

このプロジェクトのルートディレクトリでローカルサーバーを起動します。

```text
RockingTrain_test/
├── index.html
├── admin.html
├── config-store.js
└── ...
```

例：

```bash
cd /Users/hinam/Desktop/TechBias_prototyping/RockingTrain_test
python3 -m http.server 8000
```

ブラウザでは、HTMLファイルを直接ダブルクリックせず、必ず同じローカルサーバーから管理画面と本体を開いてください。

### 2. 管理画面を開く

```text
http://localhost:8000/admin.html
```

### 3. JSONをImportする

1. 管理画面上部の「JSON Import」を押します。
2. Export済みのJSONファイルを選択します。
3. 読み込まれたシーン、タイマー、背景、設問を確認します。

Importした直後は、まだ本体用の設定として保存されていません。

### 4. 「ブラウザに保存」を押す

管理画面上部の**「ブラウザに保存」**を押してください。

設定は次のLocal Storageキーへ保存されます。

```text
rocking-train-config-v1
```

キー名には互換性維持のため`v1`が含まれていますが、JSON内部の`schemaVersion`は現在の形式へ自動変換されます。

### 5. 本体を再読み込みする

```text
http://localhost:8000/index.html
```

すでに本体を開いていた場合は、ページを再読み込みしてください。保存した以下の設定が反映されます。

- シーンの順番
- 各シーンの表示時間
- シーンIDと動作種別
- タイトルとメッセージ
- 背景画像
- カスタム画像・音声アセット
- Stage構造とランダム分岐
- 選択ホールド時間

---

## 重要：管理画面と本体は同じURLから開く

Local Storageは、URLの組み合わせごとに別の保存領域になります。

次のようにポート番号が異なる場合、設定は共有されません。

```text
管理画面：http://localhost:8000/admin.html
本体　　：http://localhost:3000/index.html
```

正しく共有する例：

```text
管理画面：http://localhost:8000/admin.html
本体　　：http://localhost:8000/index.html
```

`localhost`と`127.0.0.1`も別の保存領域として扱われるため、表記を揃えてください。

---

## 「テスト実行」と「ブラウザに保存」の違い

### テスト実行

管理画面で編集中の設定を`postMessage`でiframeへ直接渡します。アップロード画像を含む大きな設定も、Session Storageの容量制限を受けずに確認できます。

本体の通常起動設定は変更しません。

### ブラウザに保存

通常の`index.html`が起動時に読み込む設定としてLocal Storageへ保存します。

本体へ反映したい場合はこちらを使用してください。

---

## 別のPCや別のブラウザへ設定を移す

Local StorageはPCやブラウザ間では共有されません。次の手順で移行してください。

1. 元の管理画面で「JSON Export」を押す。
2. ダウンロードされたJSONを移行先PCへコピーする。
3. 移行先で同じプロジェクトの`admin.html`を開く。
4. 「JSON Import」でJSONを読み込む。
5. 「ブラウザに保存」を押す。
6. 同じURLの`index.html`を再読み込みする。

---

## アップロードした画像・音声について

管理画面の「アセット管理」でローカル画像・音声を登録した場合、ファイルはData URLとして`customAssets`内に埋め込まれます。

管理画面ではアセットをすべてファイル名で表示・選択します。JSON内では各画面からの参照を維持する内部ID（assetKey）がファイル名から自動生成されますが、管理画面上で入力・編集する必要はありません。

そのため、ファイルを別途`assets`フォルダへコピーしなくても、JSON Importで画像・BGM・SEを復元できます。同じ`assetKey`を背景、人物イラスト、各画面の音響設定から再利用できます。

ただし、大容量画像は次の問題を起こす可能性があります。

- JSONファイルが大きくなる
- Local Storageの容量上限を超える
- Importや保存に時間がかかる

長期運用では、画像を`assets`フォルダへ配置して`ASSET_MANIFEST`へ登録する方法を推奨します。

---

## プロジェクトの初期設定そのものを変更したい場合

Local Storageがないブラウザでも同じ設定を初期表示したい場合は、ExportしたJSONを移動するだけでは反映されません。

初期値は次のファイルに定義されています。

```text
config-store.js
```

編集対象：

```js
export const DEFAULT_APP_CONFIG = {
  schemaVersion: 7,
  customAssets: { images: {}, audio: {} },
  masterBgm: {/* 体験全体のBGM */},
  choiceHoldDurationMs: 2000,
  introduction: { sequence: [/* 導入画面 */] },
  questionScenes: [
    {
      id: 'question_scene_01',
      sequence: [/* この設問シーン固有の画面 */],
      questionSet: {/* Stage設定 */},
    },
  ],
  result: {
    sequence: [/* 結果・終了画面 */],
    diagnosis: {/* 診断文 */},
  },
};
```

ExportしたJSONの以下の項目を、`DEFAULT_APP_CONFIG`の対応箇所へ反映してください。

- `choiceHoldDurationMs`
- `customAssets`
- `masterBgm`
- `introduction`
- `questionScenes`
- `result`

これは開発者向けの恒久変更です。通常の演出調整では、管理画面のImportと「ブラウザに保存」を使用してください。

画面イベント単位の効果音は`sequence`内、BGMはタブ／シーン単位、マスターBGMは設定の最上位に保存されます。

```json
{
  "soundAsset": {
    "se": { "startAssetKey": "", "actionAssetKey": "uploaded_se", "volume": 80 }
  }
}
```

```json
{
  "masterBgm": { "assetKey": "master_music", "loop": true, "volume": 50, "fadeMs": 800 },
  "introduction": {
    "bgm": { "assetKey": "intro_ambience", "loop": true, "volume": 70, "fadeMs": 800 },
    "sequence": []
  }
}
```

時間ではなく矢印キー入力で次へ進める画面イベントには、同じ`sequence`項目内に次の値が保存されます。

```json
{
  "advanceOnInput": true
}
```

`true`の間は`durationMs`による自動遷移を行いません。設問画面（`stage_input`）はこの値に関係なく、選択が確定するまで待機します。

「アセット管理」または各画面イベントから登録した音声ファイル本体はJSONへ埋め込まれます。プルダウンには、実際にアップロード済みの音源だけが表示されます。

---

## 設定を初期状態へ戻す

管理画面で「初期値に戻す」を押したあと、「ブラウザに保存」を押します。

「初期値に戻す」を押しただけではLocal Storageは更新されません。必ず保存操作まで行ってください。

---

## 関連ファイル

| ファイル | 役割 |
| --- | --- |
| `admin.html` | 設定管理画面 |
| `admin.js` | 編集、Import、Export、プレビュー処理 |
| `config-store.js` | 設定形式、初期値、保存、読込、旧形式変換 |
| `app.js` | 本体起動時の設定読込 |
| `main.js` | `sceneSequence`に従った画面遷移 |
| `index.html` | 体験本体 |
