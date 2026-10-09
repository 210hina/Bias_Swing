# Audio assets

管理画面のBGM / SEドロップダウンは、次のファイルを参照します。

| assetKey | ファイル | 用途 |
| --- | --- | --- |
| `bgm_crowded` | `bgm_crowded.mp3` | 混雑した車内の環境音 |
| `bgm_quiet` | `bgm_quiet.mp3` | 空いた車内の環境音 |
| `se_input` | `se_input.wav` | 選択・決定音 |
| `se_hesitation` | `se_hesitation.wav` | 迷い演出音 |
| `se_reveal` | `se_reveal.mp3` | 結果発表ジングル |

音源ファイルはこのディレクトリへ、上記ファイル名で配置してください。未配置または読込失敗時は無音のまま進行し、アプリ本体は停止しません。

