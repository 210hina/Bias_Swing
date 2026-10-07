/**
 * 画面に表示する文言をまとめたファイルです。
 * 文言を変更するときは、基本的にこのファイルだけを編集してください。
 */
export const CONTENT = {
  browserTitle: '揺れる電車 / Rocking Train',

  passengers: {
    woman20: {
      label: '20代女性',
    },
    man70: {
      label: '70代男性',
    },
  },

  questionSets: {
    first: {
      label: '設問セット1',
    },
    legacyLabel: '設問セット',
  },

  assetFallbacks: {
    trainBackground: '',
    crowdedTrain: '混雑した電車内',
    emptyTrain: '乗客が降りた電車内',
    closeTrain: '人物に近づいた電車内',
    hesitationEffect: '迷いの演出',
    unspecified: 'アセット未指定',
    unknownPrefix: '未登録アセット: ',
  },

  choices: {
    leftAction: '左側の人に譲る',
    rightAction: '右側の人に譲る',
    selfAction: '自分が座る',
    leftPerson: '左側の人',
    rightPerson: '右側の人',
    self: '自分',
    giveSeatSuffix: 'に譲る',
    leftShort: '左',
    rightShort: '右',
  },

  inputIndicator: {
    ariaLabel: 'キー操作のヒント',
    title: 'デバッグ入力',
    holdHint: '人物ボタンまたは ← / → を2秒間ホールドして確定',
  },

  choicePrompt: {
    ariaLabel: '座席を譲る相手の選択',
  },

  socialStatistics: {
    title: 'ほかの人は、こう選びました',
    description: 'これまでの選択率を見たうえで、もう一度選んでください。',
  },

  hesitation: {
    mode: '脳内モード',
  },

  ticket: {
    ariaLabel: '体験結果の切符',
    brand: 'ROCKING TRAIN',
    title: '選択のきっぷ',
    overallHesitationPrefix: '総合迷い度 ',
    questionSetPrefix: 'SET ',
    stageSeparator: ' / ',
    stagePrefix: 'STAGE ',
    hesitationPrefix: '迷い度 ',
    footer: 'ご乗車ありがとうございます',
  },

  diagnosis: {
    empty: {
      title: '診断データなし',
      message: '選択履歴がまだありません。',
    },
    intuitive: {
      title: '直感派タイプ',
      message: '状況を素早くつかみ、直感的に決断する傾向があります。',
    },
    balanced: {
      title: 'バランス派タイプ',
      message: '直感と慎重さの両方を使い分けて決断する傾向があります。',
    },
    thoughtful: {
      title: '熟考派タイプ',
      message: '背景や影響をじっくり考えてから決断する傾向があります。',
    },
  },

  scenes: {
    attract: {
      title: ' ',
      message: 'つり革を手に取ってください',
      startButton: '体験をはじめる',
    },
    sessionStart: {
      title: ' ',
      message: 'Loading…',
    },
    intro: {
      fullTitle: '電車が揺れています',
      fullMessage: '車内は混雑しています。',
      emptyTitle: '乗客が降りていきます',
      emptyMessage: '車内の様子が変わりました。',
    },
    stage: {
      questionSetPrefix: '左右の人、どちらに席を譲る？',
      titleSeparator: ' ',
      titlePrefix: ' ',
      inputHint: '← 左　・　↓ 自分　・　→ 右',
    },
    // hesitation: {
    //   title: '本当にその選択ですか？',
    //   message: '少しだけ考えてみましょう…',
    // },
    confirm: {
      title: '選択を記録中',
      message: '回答を保存しています。',
    },
    summary: {
      title: 'あなたの選択',
      messagePrefix: '全',
      setCountSuffix: 'セット・全',
      messageSuffix: 'ステージの結果です。',
    },
    end: {
      title: 'ご参加ありがとうございました',
      message: 'まもなく待機画面に戻ります。',
    },
    loading: {
      title: '読み込み中',
    },
  },
};
