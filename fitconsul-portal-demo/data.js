// =============================================================
// デモデータ（すべて架空）
// 実運用では Notion の各データベースから API 経由で取得する。
// 月は「当月を 5」とする相対インデックス（0〜5 = 過去5か月＋当月、6以降 = 翌月以降）。
// =============================================================

// ---- メンバー DB ----
// cost = 原価単価（円/時間：給与・法定福利・諸経費を按分した社内原価）
const MEMBERS = [
  { id: 'm1', name: '山下 健太', role: 'PM', skill: 'プロジェクト管理', cost: 5200 },
  { id: 'm2', name: '中村 綾', role: 'SE', skill: '要件定義・設計', cost: 4200 },
  { id: 'm3', name: '田畑 翔', role: 'PG', skill: 'Java / TypeScript', cost: 3300 },
  { id: 'm4', name: '有村 さくら', role: 'インフラ', skill: 'NW・サーバー構築', cost: 3800 },
  { id: 'm5', name: '西 大輔', role: 'コンサル', skill: 'IT戦略・DX', cost: 5600 },
  { id: 'm6', name: '今村 由衣', role: 'Web', skill: 'Web制作・UI', cost: 3400 },
  { id: 'm7', name: '上野 拓海', role: 'PG', skill: 'Python / API', cost: 3000 },
  { id: 'm8', name: '久保 真司', role: 'セキュリティ', skill: '脆弱性診断', cost: 4800 },
  { id: 'm9', name: '松元 亮', role: 'SE', skill: '金融系保守（客先常駐）', cost: 3600 },
];
const CAPACITY = 160; // 月の標準稼働時間

// ---- 顧客 DB ----
const CLIENTS = [
  { id: 'c1', name: '南州ロジテック株式会社' },
  { id: 'c2', name: '医療法人 錦江会' },
  { id: 'c3', name: '城山建設株式会社' },
  { id: 'c4', name: '天文館リテール株式会社' },
  { id: 'c5', name: 'A市 情報政策課' },
  { id: 'c6', name: '九州みらい信用金庫' },
];

// ---- 案件（プロジェクト）DB ----
// alloc: メンバーごとの月あたり計画工数（h）, months: [開始, 終了]（相対月）
const PROJECTS = [
  { id: 'P1', code: 'PJ-2604', name: '物流管理システム刷新', client: 'c1', type: '受託開発', pm: 'm1', status: '進行中',
    months: [1, 8], budget: 10000000, progress: 70, alloc: { m1: 40, m2: 90, m3: 85, m7: 60 },
    milestones: [['要件定義', 1, true], ['基本設計', 2, true], ['詳細設計', 3, true], ['開発・単体テスト', 6, false], ['結合テスト', 7, false], ['本番リリース', 8, false]] },
  { id: 'P2', code: 'PJ-2606', name: '電子カルテ連携API開発', client: 'c2', type: '受託開発', pm: 'm1', status: '進行中',
    months: [2, 7], budget: 4200000, progress: 58, alloc: { m1: 15, m2: 30, m8: 25, m3: 40, m7: 70 },
    milestones: [['要件定義', 2, true], ['API設計', 3, true], ['実装', 5, false], ['院内検証', 6, false], ['稼働', 7, false]] },
  { id: 'P3', code: 'PJ-2603', name: '本社ネットワーク再構築', client: 'c3', type: 'インフラ構築', pm: 'm4', status: '検収待ち',
    months: [1, 4], budget: 2900000, progress: 95, alloc: { m4: 120, m8: 15 },
    milestones: [['現地調査', 1, true], ['設計', 2, true], ['機器設定・切替', 4, true], ['検収', 5, false]] },
  { id: 'P4', code: 'PJ-2601', name: 'ECサイト保守運用（年間）', client: 'c4', type: '保守運用', pm: 'm6', status: '進行中',
    months: [0, 11], budget: 2600000, progress: 50, alloc: { m6: 40, m7: 10 },
    milestones: [['上期定例報告', 5, false], ['下期定例報告', 11, false]] },
  { id: 'P5', code: 'PJ-2608', name: '情報セキュリティ診断', client: 'c5', type: 'コンサル', pm: 'm8', status: '進行中',
    months: [4, 6], budget: 1300000, progress: 45, alloc: { m8: 50, m5: 10 },
    milestones: [['ヒアリング', 4, true], ['脆弱性診断', 5, false], ['報告会', 6, false]] },
  { id: 'P6', code: 'PJ-2609', name: '基幹システムDX構想策定', client: 'c3', type: 'コンサル', pm: 'm5', status: '提案中',
    months: [4, 5], budget: 0, progress: 0, alloc: { m5: 25, m1: 10 },
    milestones: [['提案書提出', 5, false], ['受注判断', 6, false]] },
  { id: 'P7', code: 'PJ-2602', name: '診療予約Webアプリ開発', client: 'c2', type: '受託開発', pm: 'm6', status: '完了',
    months: [0, 2], budget: 1900000, progress: 100, alloc: { m6: 80, m3: 60 },
    milestones: [['設計', 0, true], ['開発', 1, true], ['リリース', 2, true]] },
  { id: 'P8', code: 'PJ-2512', name: '勘定系保守支援（準委任）', client: 'c6', type: 'SES・準委任', pm: 'm9', status: '進行中',
    months: [0, 11], budget: 7000000, progress: 50, alloc: { m9: 150 },
    milestones: [['契約更新', 8, false]] },
  { id: 'P9', code: 'PJ-2511', name: '販売管理システム改修', client: 'c1', type: '受託開発', pm: 'm1', status: '完了',
    months: [-3, 1], budget: 5200000, progress: 100, alloc: { m1: 30, m2: 100, m4: 50, m7: 90, m8: 40 },
    milestones: [['設計', -3, true], ['開発', -1, true], ['リリース', 1, true]] },
];

// ---- 受注 DB ----（status: 見積中 / 受注確定 / 納品・検収 / 請求済 / 入金済）
// bill: 請求（予定）月, prob: 見積時の確度(%)
const ORDERS = [
  { id: 'O00', no: 'JU-0398', project: 'P9', title: '販売管理システム改修 一式', amount: 7400000, status: '入金済', bill: 1 },
  { id: 'O01', no: 'JU-0412', project: 'P7', title: '診療予約Webアプリ 着手金', amount: 1000000, status: '入金済', bill: 0 },
  { id: 'O02', no: 'JU-0431', project: 'P7', title: '診療予約Webアプリ 残金', amount: 1800000, status: '入金済', bill: 2 },
  { id: 'O03', no: 'JU-0440', project: 'P1', title: '物流システム 一次（要件定義〜設計）', amount: 4800000, status: '請求済', bill: 4 },
  { id: 'O04', no: 'JU-0441', project: 'P1', title: '物流システム 二次（開発〜リリース）', amount: 8000000, status: '受注確定', bill: 8 },
  { id: 'O05', no: 'JU-0452', project: 'P2', title: 'カルテ連携API 着手金30%', amount: 1920000, status: '入金済', bill: 2 },
  { id: 'O06', no: 'JU-0453', project: 'P2', title: 'カルテ連携API 残金', amount: 4480000, status: '受注確定', bill: 7 },
  { id: 'O07', no: 'JU-0438', project: 'P3', title: 'ネットワーク再構築 一式', amount: 3900000, status: '納品・検収', bill: 5 },
  { id: 'O08', no: 'JU-0460', project: 'P5', title: 'セキュリティ診断 一式', amount: 2200000, status: '受注確定', bill: 6 },
  { id: 'O09', no: 'MI-0071', project: 'P6', title: '基幹システムDX構想策定', amount: 8000000, status: '見積中', bill: 7, prob: 60 },
  { id: 'O10', no: 'MI-0074', project: null, client: 'c4', title: '会員アプリ改修（新規引合い）', amount: 1500000, status: '見積中', bill: 8, prob: 40 },
];
// 月額契約（保守・準委任）は毎月の受注レコードとして自動生成する
const RECURRING = [
  { project: 'P4', label: 'EC保守', amount: 380000 },
  { project: 'P8', label: '勘定系保守支援', amount: 800000 },
];

// ---- 発注 DB ----（status: 発注予定 / 発注済 / 納品済 / 支払済）
const PURCHASES = [
  { id: 'H01', no: 'HA-0118', vendor: '株式会社ネクストワークス', project: 'P1', title: '画面実装支援（2名×1.5か月）', amount: 900000, status: '納品済', month: 4 },
  { id: 'H02', no: 'HA-0121', vendor: 'フリーランス 岩切 氏', project: 'P2', title: 'HL7/FHIR 実装支援', amount: 650000, status: '発注済', month: 5 },
  { id: 'H03', no: 'HA-0109', vendor: 'クラウドベース合同会社', project: 'P7', title: 'UIデザイン制作', amount: 200000, status: '支払済', month: 1 },
  { id: 'H04', no: 'HA-0114', vendor: '株式会社南九州ネットワーク', project: 'P3', title: 'L3スイッチ・無線AP 一式', amount: 780000, status: '支払済', month: 3 },
  { id: 'H05', no: 'HA-0124', vendor: '株式会社ネクストワークス', project: 'P1', title: '結合テスト支援', amount: 600000, status: '発注予定', month: 6 },
];

// ---- お知らせ ----
const NEWS = [
  { title: '今月の工数締めは月末最終営業日 17:00 です', cat: '総務', important: true },
  { title: '新規案件「基幹システムDX構想策定」提案レビューを実施します', cat: '営業' },
  { title: 'セキュリティ研修（全員受講）の案内', cat: '研修' },
];
