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

管理画面で編集中の設定を、一時的にiframeプレビューへ渡します。

```text
Session Storageキー：rocking-train-preview-config-v1
```

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

## アップロードした背景画像について

管理画面からローカル画像をアップロードした場合、画像はData URLとして設定JSON内に埋め込まれます。

そのため、画像ファイルを別途`assets`フォルダへコピーしなくても、JSON Importで背景画像を復元できます。

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
  schemaVersion: 3,
  choiceHoldDurationMs: 2000,
  sceneSequence: [/* シーン設定 */],
  questionSets: [/* 設問設定 */],
};
```

ExportしたJSONの以下の項目を、`DEFAULT_APP_CONFIG`の対応箇所へ反映してください。

- `choiceHoldDurationMs`
- `sceneSequence`
- `questionSets`

これは開発者向けの恒久変更です。通常の演出調整では、管理画面のImportと「ブラウザに保存」を使用してください。

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

