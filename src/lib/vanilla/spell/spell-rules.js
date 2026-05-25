/**
 * Korean Spell & Spacing Rules
 * 한국어 자주 나오는 맞춤법/띄어쓰기/외래어/조사·어미 오류 패턴 카탈로그.
 *
 * 데이터 출처: 국립국어원 표준국어대사전 / 외래어 표기법 / 한글 맞춤법
 * (모두 공공도메인·공교육 자료에 근거한 일반 규칙)
 *
 * 각 규칙 객체:
 *   {
 *     id:          고유 ID (영문 kebab-case)
 *     pattern:     RegExp (오류 어형을 매칭)
 *     replacement: string  (올바른 어형)
 *     severity:    'error' | 'warning' | 'info'
 *     category:    'spelling' | 'spacing' | 'foreign' | 'particle'
 *     hint:        사용자에게 보여줄 한국어 설명
 *   }
 *
 * @module spell/spell-rules
 * @version 1.0.0
 */

/**
 * @typedef {Object} SpellRule
 * @property {string} id
 * @property {RegExp} pattern
 * @property {string} replacement
 * @property {'error'|'warning'|'info'} severity
 * @property {'spelling'|'spacing'|'foreign'|'particle'} category
 * @property {string} hint
 */

/** 빠른 한글 단어 경계 헬퍼 — 한글 음절/영문/숫자가 아닌 위치를 단어 경계로 본다. */
const NHB = '(?<![\\uac00-\\ud7a3a-zA-Z0-9])'; // negative look-behind: no hangul/alnum before
const NHA = '(?![\\uac00-\\ud7a3a-zA-Z0-9])'; // negative look-ahead: no hangul/alnum after

/**
 * (A) 받침·맞춤법 (Spelling) — 자주 틀리는 어형 50개+
 * 모두 글로벌 플래그로 컴파일하여 다회 매칭을 지원한다.
 * @type {Array<SpellRule>}
 */
export const SPELLING_RULES = [
  // ㅡ읍니다 / ㅡ습니다
  {
    id: 'sp-eupnida',
    pattern: /있읍니다/g,
    replacement: '있습니다',
    severity: 'error',
    category: 'spelling',
    hint: "'있읍니다'는 옛 표기입니다. '있습니다'가 표준입니다.",
  },
  {
    id: 'sp-eupnida2',
    pattern: /없읍니다/g,
    replacement: '없습니다',
    severity: 'error',
    category: 'spelling',
    hint: "'없읍니다'는 옛 표기입니다. '없습니다'가 표준입니다.",
  },
  {
    id: 'sp-eupnida3',
    pattern: /(?<=[가-힣])읍니다/g,
    replacement: '습니다',
    severity: 'error',
    category: 'spelling',
    hint: "'-읍니다'는 옛 표기입니다. '-습니다'로 적습니다.",
  },

  // 되-/돼-
  {
    id: 'sp-doeda',
    pattern: /됬다/g,
    replacement: '됐다',
    severity: 'error',
    category: 'spelling',
    hint: "'됬다'는 잘못된 표기입니다. '됐다(되었다)'가 옳습니다.",
  },
  {
    id: 'sp-doeseo',
    pattern: /됬어/g,
    replacement: '됐어',
    severity: 'error',
    category: 'spelling',
    hint: "'됬어'는 잘못된 표기입니다. '됐어(되었어)'가 옳습니다.",
  },
  {
    id: 'sp-doeyo',
    pattern: /됬어요/g,
    replacement: '됐어요',
    severity: 'error',
    category: 'spelling',
    hint: "'됬어요'는 잘못된 표기입니다. '됐어요(되었어요)'가 옳습니다.",
  },
  {
    id: 'sp-doet',
    pattern: /됫어/g,
    replacement: '됐어',
    severity: 'error',
    category: 'spelling',
    hint: "'됫어'는 잘못된 표기입니다. '됐어'가 옳습니다.",
  },
  {
    id: 'sp-doetda',
    pattern: /됫다/g,
    replacement: '됐다',
    severity: 'error',
    category: 'spelling',
    hint: "'됫다'는 잘못된 표기입니다. '됐다'가 옳습니다.",
  },
  {
    id: 'sp-andoe',
    pattern: /안되/g,
    replacement: '안 돼',
    severity: 'warning',
    category: 'spelling',
    hint: "문장 끝에서는 '안 돼'로 적습니다. (예: 그러면 안 돼.)",
  },

  // 왠/웬
  {
    id: 'sp-waenji',
    pattern: /웬지/g,
    replacement: '왠지',
    severity: 'error',
    category: 'spelling',
    hint: "'왠지(왜인지)'가 옳습니다. '웬지'는 잘못된 표기입니다.",
  },
  {
    id: 'sp-waenil',
    pattern: /왠일/g,
    replacement: '웬일',
    severity: 'error',
    category: 'spelling',
    hint: "'웬일'이 옳습니다. ('어떻게 된 일')",
  },
  {
    id: 'sp-waentteok',
    pattern: /왠떡/g,
    replacement: '웬 떡',
    severity: 'error',
    category: 'spelling',
    hint: "'웬 떡' (어떻게 된 떡)이 옳습니다.",
  },

  // 금새 / 금세
  {
    id: 'sp-geumse',
    pattern: /금새/g,
    replacement: '금세',
    severity: 'error',
    category: 'spelling',
    hint: "'금세(지금 바로)'가 표준입니다.",
  },

  // 구지 / 굳이
  {
    id: 'sp-guji',
    pattern: /구지/g,
    replacement: '굳이',
    severity: 'error',
    category: 'spelling',
    hint: "'굳이'가 옳습니다. ('구지'는 잘못된 표기)",
  },

  // 희안 / 희한
  {
    id: 'sp-huihan',
    pattern: /희안/g,
    replacement: '희한',
    severity: 'error',
    category: 'spelling',
    hint: "'희한하다(드물거나 신기하다)'가 옳습니다.",
  },

  // 오랫만 / 오랜만
  {
    id: 'sp-oraenman',
    pattern: /오랫만/g,
    replacement: '오랜만',
    severity: 'error',
    category: 'spelling',
    hint: "'오랜만'이 표준입니다. (단, '오랫동안'은 'ㅅ'을 적습니다.)",
  },

  // 깍다 / 깎다
  {
    id: 'sp-kkakkda',
    pattern: /깍다/g,
    replacement: '깎다',
    severity: 'error',
    category: 'spelling',
    hint: "'깎다'가 표준입니다.",
  },
  {
    id: 'sp-kkakkeun',
    pattern: /깍은/g,
    replacement: '깎은',
    severity: 'error',
    category: 'spelling',
    hint: "'깎은'이 옳습니다.",
  },

  // 결제 vs 결재 (주의 환기)
  {
    id: 'sp-gyeolje',
    pattern: /결재해\s*주세요/g,
    replacement: '결제해 주세요',
    severity: 'warning',
    category: 'spelling',
    hint: "돈을 치를 때는 '결제(決濟)', 서류 승인은 '결재(決裁)'입니다. 문맥에 맞게 확인하세요.",
  },

  // 어떻해 / 어떡해
  {
    id: 'sp-eotteokae',
    pattern: /어떻해/g,
    replacement: '어떡해',
    severity: 'error',
    category: 'spelling',
    hint: "'어떡해(어떻게 해)'가 옳습니다.",
  },

  // 몇일 / 며칠
  {
    id: 'sp-myeochil',
    pattern: /몇일/g,
    replacement: '며칠',
    severity: 'error',
    category: 'spelling',
    hint: "'며칠'이 표준입니다. ('몇 일'은 잘못된 표기)",
  },

  // 역활 / 역할
  {
    id: 'sp-yeokhal',
    pattern: /역활/g,
    replacement: '역할',
    severity: 'error',
    category: 'spelling',
    hint: "'역할(役割)'이 표준입니다.",
  },

  // 어의없다 / 어이없다
  {
    id: 'sp-eoieopda',
    pattern: /어의없/g,
    replacement: '어이없',
    severity: 'error',
    category: 'spelling',
    hint: "'어이없다'가 표준입니다. ('어의'는 임금의 옷)",
  },

  // 바램 / 바람
  {
    id: 'sp-baram',
    pattern: /바램/g,
    replacement: '바람',
    severity: 'error',
    category: 'spelling',
    hint: "'바라다'의 명사형은 '바람'입니다.",
  },

  // 설레임 / 설렘
  {
    id: 'sp-seollem',
    pattern: /설레임/g,
    replacement: '설렘',
    severity: 'error',
    category: 'spelling',
    hint: "'설렘'이 표준입니다. ('설레이다'는 비표준어)",
  },

  // 일일히 / 일일이
  {
    id: 'sp-ilili',
    pattern: /일일히/g,
    replacement: '일일이',
    severity: 'error',
    category: 'spelling',
    hint: "'일일이'가 표준입니다. (부사 '-이')",
  },

  // 틈틈히 / 틈틈이
  {
    id: 'sp-teumteumi',
    pattern: /틈틈히/g,
    replacement: '틈틈이',
    severity: 'error',
    category: 'spelling',
    hint: "'틈틈이'가 표준입니다.",
  },

  // 곰곰히 / 곰곰이
  {
    id: 'sp-gomgomi',
    pattern: /곰곰히/g,
    replacement: '곰곰이',
    severity: 'error',
    category: 'spelling',
    hint: "'곰곰이'가 표준입니다.",
  },

  // 솔직이 / 솔직히
  {
    id: 'sp-soljikhi',
    pattern: /솔직이/g,
    replacement: '솔직히',
    severity: 'error',
    category: 'spelling',
    hint: "'솔직히'가 표준입니다. ('-하다'가 결합 가능한 어근 → -히)",
  },

  // 꼼꼼이 / 꼼꼼히
  {
    id: 'sp-kkomkkomhi',
    pattern: /꼼꼼이/g,
    replacement: '꼼꼼히',
    severity: 'error',
    category: 'spelling',
    hint: "'꼼꼼히'가 표준입니다.",
  },

  // 가까히 / 가까이
  {
    id: 'sp-gakkai',
    pattern: /가까히/g,
    replacement: '가까이',
    severity: 'error',
    category: 'spelling',
    hint: "'가까이'가 표준입니다.",
  },

  // 뵈요 / 봬요
  {
    id: 'sp-baeyo',
    pattern: /뵈요/g,
    replacement: '봬요',
    severity: 'error',
    category: 'spelling',
    hint: "'봬요(뵈어요)'가 옳습니다.",
  },

  // 나았다 / 낫다
  {
    id: 'sp-nada',
    pattern: /낳았다/g,
    replacement: '나았다',
    severity: 'warning',
    category: 'spelling',
    hint: "병이 회복된 경우 '나았다'입니다. ('낳다'는 출산/결과를 낳다)",
  },

  // 든 / 던 (조건 vs 회상)
  {
    id: 'sp-deon-vs-deun',
    pattern: /어떻튼/g,
    replacement: '어떻든',
    severity: 'error',
    category: 'spelling',
    hint: "'어떻든'이 표준입니다.",
  },

  // 그리고 나서 / 그러고 나서
  {
    id: 'sp-geureogonaseo',
    pattern: /그리고 나서/g,
    replacement: '그러고 나서',
    severity: 'warning',
    category: 'spelling',
    hint: "동작 후 이어짐은 '그러고 나서'가 표준입니다.",
  },

  // 들어나다 / 드러나다
  {
    id: 'sp-deureonada',
    pattern: /들어나다/g,
    replacement: '드러나다',
    severity: 'error',
    category: 'spelling',
    hint: "'드러나다'가 표준입니다.",
  },

  // 한 웅큼 / 한 움큼
  {
    id: 'sp-umkeum',
    pattern: /웅큼/g,
    replacement: '움큼',
    severity: 'error',
    category: 'spelling',
    hint: "'움큼'이 표준입니다.",
  },

  // 베게 / 베개
  {
    id: 'sp-begae',
    pattern: /베게(?![뜨])/g,
    replacement: '베개',
    severity: 'error',
    category: 'spelling',
    hint: "'베개'가 표준입니다.",
  },

  // 닥달 / 닦달
  {
    id: 'sp-dakdal',
    pattern: /닥달/g,
    replacement: '닦달',
    severity: 'error',
    category: 'spelling',
    hint: "'닦달'이 표준입니다.",
  },

  // 깨끗히 → 깨끗이 (실은 particle 카테고리지만 자주 발생)
  {
    id: 'sp-kkaekkeusi',
    pattern: /깨끗히/g,
    replacement: '깨끗이',
    severity: 'error',
    category: 'spelling',
    hint: "'깨끗이'가 표준입니다. (받침 ㅅ 뒤 → -이)",
  },

  // 안되 / 안 돼 + 안 됀
  {
    id: 'sp-andwaeyo',
    pattern: /안되요/g,
    replacement: '안 돼요',
    severity: 'error',
    category: 'spelling',
    hint: "'안 돼요(안 되어요)'가 표준입니다.",
  },

  // 했어용 (구어) — info만
  {
    id: 'sp-hassyo',
    pattern: /했셔요/g,
    replacement: '했어요',
    severity: 'error',
    category: 'spelling',
    hint: "'했어요'가 표준입니다.",
  },

  // 부치다 / 붙이다 (편지)
  {
    id: 'sp-buchida-letter',
    pattern: /편지를 붙이다/g,
    replacement: '편지를 부치다',
    severity: 'warning',
    category: 'spelling',
    hint: "편지·소포는 '부치다', 물건이 들러붙는 것은 '붙이다'입니다.",
  },

  // 며칠전 → 며칠 전
  {
    id: 'sp-myeochiljeon',
    pattern: /며칠전/g,
    replacement: '며칠 전',
    severity: 'warning',
    category: 'spelling',
    hint: "'며칠 전'으로 띄어 씁니다.",
  },

  // 어떡하지 (변형) - 어떻하지
  {
    id: 'sp-eotteokhaji',
    pattern: /어떻하지/g,
    replacement: '어떡하지',
    severity: 'error',
    category: 'spelling',
    hint: "'어떡하지(어떻게 하지)'가 옳습니다.",
  },

  // 도데체 / 도대체
  {
    id: 'sp-dodaeche',
    pattern: /도데체/g,
    replacement: '도대체',
    severity: 'error',
    category: 'spelling',
    hint: "'도대체'가 표준입니다.",
  },

  // 들렸다 / 들렀다
  {
    id: 'sp-deureotda',
    pattern: /들렸다(?=\s|[.!?,])/g,
    replacement: '들렀다',
    severity: 'warning',
    category: 'spelling',
    hint: "잠시 머무른 경우 '들렀다(들르+었+다)'입니다. ('들리다'는 소리가 들리다)",
  },

  // 부수다 / 부시다 - 자주 헷갈림
  {
    id: 'sp-busida-eyes',
    pattern: /눈이 부수/g,
    replacement: '눈이 부시',
    severity: 'error',
    category: 'spelling',
    hint: "빛이 강해서 눈이 따가운 것은 '부시다'입니다.",
  },

  // 메이다 / 매다 (옷·끈)
  {
    id: 'sp-maeda-tie',
    pattern: /끈을 메다/g,
    replacement: '끈을 매다',
    severity: 'warning',
    category: 'spelling',
    hint: "끈·매듭은 '매다', 어깨에 짊어지는 것은 '메다'입니다.",
  },

  // 비로서 / 비로소
  {
    id: 'sp-biroso',
    pattern: /비로서/g,
    replacement: '비로소',
    severity: 'error',
    category: 'spelling',
    hint: "'비로소'가 표준입니다.",
  },

  // 으례 / 으레
  {
    id: 'sp-eure',
    pattern: /으례/g,
    replacement: '으레',
    severity: 'error',
    category: 'spelling',
    hint: "'으레'가 표준입니다.",
  },

  // 단언컨데 / 단언컨대
  {
    id: 'sp-daneonkeondae',
    pattern: /단언컨데/g,
    replacement: '단언컨대',
    severity: 'error',
    category: 'spelling',
    hint: "'단언컨대'가 표준입니다.",
  },

  // 그닥 / 그다지
  {
    id: 'sp-geudaji',
    pattern: /그닥/g,
    replacement: '그다지',
    severity: 'warning',
    category: 'spelling',
    hint: "'그다지'가 표준입니다. ('그닥'은 구어적 축약)",
  },

  // 짜집기 / 짜깁기
  {
    id: 'sp-jjagibgi',
    pattern: /짜집기/g,
    replacement: '짜깁기',
    severity: 'error',
    category: 'spelling',
    hint: "'짜깁기'가 표준입니다.",
  },

  // 임마 / 인마
  {
    id: 'sp-inma',
    pattern: /임마/g,
    replacement: '인마',
    severity: 'warning',
    category: 'spelling',
    hint: "'인마(이놈아)'가 표준입니다.",
  },

  // 안성마춤 / 안성맞춤
  {
    id: 'sp-anseongmatchum',
    pattern: /안성마춤/g,
    replacement: '안성맞춤',
    severity: 'error',
    category: 'spelling',
    hint: "'안성맞춤'이 표준입니다.",
  },

  // 통채로 / 통째로
  {
    id: 'sp-tongjjaero',
    pattern: /통채로/g,
    replacement: '통째로',
    severity: 'error',
    category: 'spelling',
    hint: "'통째로'가 표준입니다.",
  },

  // 며칠동안 → 며칠 동안
  {
    id: 'sp-myeochildongan',
    pattern: /며칠동안/g,
    replacement: '며칠 동안',
    severity: 'warning',
    category: 'spelling',
    hint: "'며칠 동안'으로 띄어 씁니다.",
  },

  // 안성마춤 외에 — 닥치는데로
  {
    id: 'sp-dakchineundaero',
    pattern: /닥치는데로/g,
    replacement: '닥치는 대로',
    severity: 'error',
    category: 'spelling',
    hint: "'닥치는 대로'가 표준입니다.",
  },

  // 어떻해 외 — 케익 / 케이크 (foreign 카테고리지만 자주 발생)
];

/**
 * (B) 띄어쓰기 (Spacing) — 보수적 규칙 20개+
 * 의존명사·보조용언 자주 붙여 쓰는 패턴을 잡는다.
 * @type {Array<SpellRule>}
 */
export const SPACING_RULES = [
  // 의존명사 '수'
  {
    id: 'sp-halsuitda',
    pattern: /할수있/g,
    replacement: '할 수 있',
    severity: 'warning',
    category: 'spacing',
    hint: "의존명사 '수'는 띄어 씁니다. → '할 수 있다'",
  },
  {
    id: 'sp-halsueopda',
    pattern: /할수없/g,
    replacement: '할 수 없',
    severity: 'warning',
    category: 'spacing',
    hint: "'할 수 없다'로 띄어 씁니다.",
  },
  {
    id: 'sp-gansuitda',
    pattern: /갈수있/g,
    replacement: '갈 수 있',
    severity: 'warning',
    category: 'spacing',
    hint: "의존명사 '수'는 띄어 씁니다.",
  },
  {
    id: 'sp-haneungeot',
    pattern: /하는것/g,
    replacement: '하는 것',
    severity: 'warning',
    category: 'spacing',
    hint: "의존명사 '것'은 띄어 씁니다.",
  },
  {
    id: 'sp-meogeulgeot',
    pattern: /먹을것/g,
    replacement: '먹을 것',
    severity: 'warning',
    category: 'spacing',
    hint: "'먹을 것'으로 띄어 씁니다.",
  },
  {
    id: 'sp-igeot',
    pattern: /이것은/g,
    replacement: '이것은',
    severity: 'info',
    category: 'spacing',
    hint: "'이것/그것/저것'은 한 단어(붙여 씀).",
  },
  // 의존명사 '뿐'
  {
    id: 'sp-halppun',
    pattern: /할뿐/g,
    replacement: '할 뿐',
    severity: 'warning',
    category: 'spacing',
    hint: "용언 뒤 '뿐'은 의존명사이므로 띄어 씁니다.",
  },
  // 의존명사 '듯'
  {
    id: 'sp-haldeut',
    pattern: /할듯/g,
    replacement: '할 듯',
    severity: 'warning',
    category: 'spacing',
    hint: "'할 듯'으로 띄어 씁니다.",
  },
  // 의존명사 '만큼'
  {
    id: 'sp-halmankeum',
    pattern: /할만큼/g,
    replacement: '할 만큼',
    severity: 'warning',
    category: 'spacing',
    hint: "'할 만큼'으로 띄어 씁니다.",
  },
  // 의존명사 '대로'
  {
    id: 'sp-haneundaero',
    pattern: /하는대로/g,
    replacement: '하는 대로',
    severity: 'warning',
    category: 'spacing',
    hint: "'하는 대로'로 띄어 씁니다.",
  },
  // 의존명사 '때문에'
  {
    id: 'sp-ttaemune',
    pattern: /이때문에/g,
    replacement: '이 때문에',
    severity: 'warning',
    category: 'spacing',
    hint: "'이 때문에'로 띄어 씁니다.",
  },
  // 보조용언 '있다'
  {
    id: 'sp-ikgoitda',
    pattern: /읽고있/g,
    replacement: '읽고 있',
    severity: 'info',
    category: 'spacing',
    hint: "보조용언 '있다'는 띄어 쓰는 것이 원칙입니다.",
  },
  {
    id: 'sp-mokgoitda',
    pattern: /먹고있/g,
    replacement: '먹고 있',
    severity: 'info',
    category: 'spacing',
    hint: "보조용언 '있다'는 띄어 쓰는 것이 원칙입니다.",
  },
  {
    id: 'sp-bogoitda',
    pattern: /보고있/g,
    replacement: '보고 있',
    severity: 'info',
    category: 'spacing',
    hint: "보조용언 '있다'는 띄어 쓰는 것이 원칙입니다.",
  },
  // 보조용언 '주다'
  {
    id: 'sp-haejuda',
    pattern: /해주세요/g,
    replacement: '해 주세요',
    severity: 'info',
    category: 'spacing',
    hint: "보조용언 '주다'는 띄어 쓰는 것이 원칙입니다.",
  },
  // 보조용언 '버리다'
  {
    id: 'sp-haebeoryeotda',
    pattern: /해버렸/g,
    replacement: '해 버렸',
    severity: 'info',
    category: 'spacing',
    hint: "보조용언 '버리다'는 띄어 쓰는 것이 원칙입니다.",
  },
  // 의존명사 '지' (시간 경과)
  {
    id: 'sp-handeunji',
    pattern: /한지\s*(\d+)/g,
    replacement: '한 지 $1',
    severity: 'warning',
    category: 'spacing',
    hint: "시간 경과의 '지'는 의존명사이므로 띄어 씁니다.",
  },
  // 단위명사 — 한 개, 두 명
  {
    id: 'sp-hangae',
    pattern: /한개/g,
    replacement: '한 개',
    severity: 'warning',
    category: 'spacing',
    hint: "단위 명사는 띄어 씁니다.",
  },
  {
    id: 'sp-dumyeong',
    pattern: /두명/g,
    replacement: '두 명',
    severity: 'warning',
    category: 'spacing',
    hint: "단위 명사는 띄어 씁니다.",
  },
  {
    id: 'sp-segwon',
    pattern: /세권/g,
    replacement: '세 권',
    severity: 'warning',
    category: 'spacing',
    hint: "단위 명사는 띄어 씁니다.",
  },
  // 의존명사 '바'
  {
    id: 'sp-halbada',
    pattern: /할바/g,
    replacement: '할 바',
    severity: 'warning',
    category: 'spacing',
    hint: "의존명사 '바'는 띄어 씁니다.",
  },
  // 의존명사 '나름'
  {
    id: 'sp-jenareum',
    pattern: /제나름대로/g,
    replacement: '제 나름대로',
    severity: 'warning',
    category: 'spacing',
    hint: "'제 나름대로'로 띄어 씁니다.",
  },
];

/**
 * (C) 외래어 표기 (Foreign) — 외래어 표기법 위반 25개+
 * @type {Array<SpellRule>}
 */
export const FOREIGN_RULES = [
  { id: 'fr-chocolit', pattern: /초콜렛/g, replacement: '초콜릿', severity: 'error', category: 'foreign', hint: "외래어 표기법: 'chocolate' → '초콜릿'." },
  { id: 'fr-message', pattern: /메세지/g, replacement: '메시지', severity: 'error', category: 'foreign', hint: "외래어 표기법: 'message' → '메시지'." },
  { id: 'fr-leadership', pattern: /리더쉽/g, replacement: '리더십', severity: 'error', category: 'foreign', hint: "외래어 표기법: 'leadership' → '리더십'." },
  { id: 'fr-accessory', pattern: /악세사리/g, replacement: '액세서리', severity: 'error', category: 'foreign', hint: "외래어 표기법: 'accessory' → '액세서리'." },
  { id: 'fr-contents', pattern: /컨텐츠/g, replacement: '콘텐츠', severity: 'error', category: 'foreign', hint: "외래어 표기법: 'contents' → '콘텐츠'." },
  { id: 'fr-workshop', pattern: /워크샵/g, replacement: '워크숍', severity: 'error', category: 'foreign', hint: "외래어 표기법: 'workshop' → '워크숍'." },
  { id: 'fr-flash', pattern: /후레쉬/g, replacement: '플래시', severity: 'error', category: 'foreign', hint: "외래어 표기법: 'flash' → '플래시'." },
  { id: 'fr-flash2', pattern: /플래쉬/g, replacement: '플래시', severity: 'error', category: 'foreign', hint: "외래어 표기법: 'flash' → '플래시'." },
  { id: 'fr-cushion', pattern: /쿠숀/g, replacement: '쿠션', severity: 'error', category: 'foreign', hint: "외래어 표기법: 'cushion' → '쿠션'." },
  { id: 'fr-sausage', pattern: /소세지/g, replacement: '소시지', severity: 'error', category: 'foreign', hint: "외래어 표기법: 'sausage' → '소시지'." },
  { id: 'fr-cake', pattern: /케익/g, replacement: '케이크', severity: 'error', category: 'foreign', hint: "외래어 표기법: 'cake' → '케이크'." },
  { id: 'fr-juice', pattern: /쥬스/g, replacement: '주스', severity: 'error', category: 'foreign', hint: "외래어 표기법: 'juice' → '주스'." },
  { id: 'fr-television', pattern: /테레비/g, replacement: '텔레비전', severity: 'warning', category: 'foreign', hint: "외래어 표기법: 'television' → '텔레비전' (혹은 'TV')." },
  { id: 'fr-radio', pattern: /라듸오/g, replacement: '라디오', severity: 'error', category: 'foreign', hint: "외래어 표기법: 'radio' → '라디오'." },
  { id: 'fr-buffet', pattern: /부페/g, replacement: '뷔페', severity: 'error', category: 'foreign', hint: "외래어 표기법: 'buffet' → '뷔페'." },
  { id: 'fr-yogurt', pattern: /요구르트/g, replacement: '요거트', severity: 'info', category: 'foreign', hint: "'요구르트'와 '요거트' 모두 인정되나 표기법 권장은 'yogurt'→'요거트'." },
  { id: 'fr-fighting', pattern: /화이팅/g, replacement: '파이팅', severity: 'warning', category: 'foreign', hint: "외래어 표기법: 'fighting' → '파이팅'." },
  { id: 'fr-coffee-shop', pattern: /커피숖/g, replacement: '커피숍', severity: 'error', category: 'foreign', hint: "외래어 표기법: 'coffee shop' → '커피숍'." },
  { id: 'fr-supermarket', pattern: /수퍼마켓/g, replacement: '슈퍼마켓', severity: 'error', category: 'foreign', hint: "외래어 표기법: 'supermarket' → '슈퍼마켓'." },
  { id: 'fr-shrimp', pattern: /쉬림프/g, replacement: '슈림프', severity: 'warning', category: 'foreign', hint: "외래어 표기법: 'shrimp' → '슈림프'." },
  { id: 'fr-ambulance', pattern: /앰뷸런스/g, replacement: '구급차', severity: 'info', category: 'foreign', hint: "공공언어 권장: 'ambulance' → '구급차'." },
  { id: 'fr-robot', pattern: /로보트/g, replacement: '로봇', severity: 'error', category: 'foreign', hint: "외래어 표기법: 'robot' → '로봇'." },
  { id: 'fr-window', pattern: /윈도우즈/g, replacement: '윈도', severity: 'warning', category: 'foreign', hint: "외래어 표기법: 'Windows' → '윈도'." },
  { id: 'fr-aircon', pattern: /에어콘/g, replacement: '에어컨', severity: 'error', category: 'foreign', hint: "외래어 표기법: 'aircon' → '에어컨'." },
  { id: 'fr-pamphlet', pattern: /팜플렛/g, replacement: '팸플릿', severity: 'error', category: 'foreign', hint: "외래어 표기법: 'pamphlet' → '팸플릿'." },
  { id: 'fr-vinyl', pattern: /비니루/g, replacement: '비닐', severity: 'error', category: 'foreign', hint: "외래어 표기법: 'vinyl' → '비닐'." },
  { id: 'fr-jumper', pattern: /점퍼/g, replacement: '점퍼', severity: 'info', category: 'foreign', hint: "'점퍼'가 표준입니다 ('잠바'는 비표준)." },
  { id: 'fr-jumper2', pattern: /잠바/g, replacement: '점퍼', severity: 'warning', category: 'foreign', hint: "외래어 표기법: 'jumper' → '점퍼' (현행 표기법)." },
  { id: 'fr-tunnel', pattern: /터늘/g, replacement: '터널', severity: 'error', category: 'foreign', hint: "외래어 표기법: 'tunnel' → '터널'." },
];

/**
 * (D) 조사·어미 (Particle) — 8개+
 * @type {Array<SpellRule>}
 */
export const PARTICLE_RULES = [
  // 깨끗히 → 깨끗이 (이미 spelling 에도 있음 — 여기엔 부사 변환 패턴)
  {
    id: 'pt-iljjikhi',
    pattern: /일찍히/g,
    replacement: '일찍이',
    severity: 'error',
    category: 'particle',
    hint: "'일찍이'가 표준입니다. (받침 ㄱ 뒤의 부사형 → '-이')",
  },
  {
    id: 'pt-mani',
    pattern: /많히/g,
    replacement: '많이',
    severity: 'error',
    category: 'particle',
    hint: "'많이'가 표준입니다. ('-하다'가 결합하지 않는 어근 → '-이')",
  },
  // ~로서 / ~로써
  {
    id: 'pt-roseo',
    pattern: /선생님으로써/g,
    replacement: '선생님으로서',
    severity: 'warning',
    category: 'particle',
    hint: "자격·신분은 '-(으)로서', 수단·도구는 '-(으)로써'.",
  },
  {
    id: 'pt-rosseo-tool',
    pattern: /칼으로서/g,
    replacement: '칼로써',
    severity: 'warning',
    category: 'particle',
    hint: "도구·수단은 '-(으)로써'를 씁니다.",
  },
  // 데 / 대 (전언)
  {
    id: 'pt-haet-dae',
    pattern: new RegExp(`${NHB}한대요${NHA}`, 'g'),
    replacement: '한대요',
    severity: 'info',
    category: 'particle',
    hint: "전언(전달)은 '-대요(-다고 해요)', 직접 경험은 '-데요(-더라)'.",
  },
  // 의 / 에
  {
    id: 'pt-ehage',
    pattern: /에게있/g,
    replacement: '에게 있',
    severity: 'warning',
    category: 'particle',
    hint: "조사 뒤 보조용언은 띄어 씁니다.",
  },
  // ㄹ게 / ㄹ께
  {
    id: 'pt-rge',
    pattern: /할께/g,
    replacement: '할게',
    severity: 'error',
    category: 'particle',
    hint: "약속·의지의 어미 '-(으)ㄹ게'는 된소리로 적지 않습니다.",
  },
  {
    id: 'pt-galge',
    pattern: /갈께/g,
    replacement: '갈게',
    severity: 'error',
    category: 'particle',
    hint: "'갈게(약속)'가 표준입니다.",
  },
  // ㄹ걸 / ㄹ껄
  {
    id: 'pt-rgeol',
    pattern: /할껄/g,
    replacement: '할걸',
    severity: 'error',
    category: 'particle',
    hint: "후회·추측의 어미 '-(으)ㄹ걸'은 된소리로 적지 않습니다.",
  },
  // ㄹ는지 / ㄹ런지
  {
    id: 'pt-runji',
    pattern: /할런지/g,
    replacement: '할는지',
    severity: 'warning',
    category: 'particle',
    hint: "'-(으)ㄹ는지'가 표준입니다.",
  },
];

// 핫패스 최적화 — 모든 규칙을 모듈 로드 시 한 번만 평탄화.
// getAllRules 가 매 호출마다 4 배열을 spread 하던 비용 제거.
const ALL_RULES = Object.freeze([
  ...SPELLING_RULES,
  ...SPACING_RULES,
  ...FOREIGN_RULES,
  ...PARTICLE_RULES,
]);
const RULES_BY_ID = new Map(ALL_RULES.map(r => [r.id, r]));

/**
 * 모든 규칙을 단일 배열로 반환 (불변).
 * @returns {ReadonlyArray<SpellRule>}
 */
export function getAllRules() {
  return ALL_RULES;
}

/**
 * 카테고리별 규칙 수 통계.
 * @returns {{ spelling:number, spacing:number, foreign:number, particle:number, total:number }}
 */
export function getRuleStats() {
  return {
    spelling: SPELLING_RULES.length,
    spacing: SPACING_RULES.length,
    foreign: FOREIGN_RULES.length,
    particle: PARTICLE_RULES.length,
    total: getAllRules().length,
  };
}

/**
 * 카테고리로 규칙 묶음 조회.
 * @param {'spelling'|'spacing'|'foreign'|'particle'} category
 * @returns {Array<SpellRule>}
 */
export function getRulesByCategory(category) {
  switch (category) {
    case 'spelling':
      return SPELLING_RULES.slice();
    case 'spacing':
      return SPACING_RULES.slice();
    case 'foreign':
      return FOREIGN_RULES.slice();
    case 'particle':
      return PARTICLE_RULES.slice();
    default:
      return [];
  }
}

/**
 * ID로 규칙 단건 조회. O(1) Map lookup.
 * @param {string} id
 * @returns {SpellRule | null}
 */
export function findRuleById(id) {
  return RULES_BY_ID.get(id) || null;
}

export default {
  SPELLING_RULES,
  SPACING_RULES,
  FOREIGN_RULES,
  PARTICLE_RULES,
  getAllRules,
  getRuleStats,
  getRulesByCategory,
  findRuleById,
};
