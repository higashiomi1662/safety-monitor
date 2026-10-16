// ページ別のレスポンシブ対応（Step 7）のテスト
import { describe, it, expect, afterEach } from 'vitest'
import { loadApp } from './helpers/loadApp.js'

let app
afterEach(() => app?.close())

const SMALL_FONT = /font-size:\s*(?:[0-9]|1[01])(?:\.\d+)?px/

// ===================== 保有資格 =====================
const qualData = {
  reporters: ['山田 太郎', 'NGUYEN VAN A', '佐藤 花子'],
  qualifications: [
    { name: 'フォークリフト運転技能講習', holderNames: '山田 太郎', expiry: '2027/03/31', status: 'ok' },
    { name: '床上操作式クレーン', holderNames: '山田太郎, 佐藤 花子', expiry: '2026/11/30', status: 'expiring' },
    { name: '有機溶剤作業主任者', holderNames: '佐藤 花子', expiry: '2026/09/30', status: 'expired' },
  ],
  schedules: [{ qual: '玉掛け技能講習', names: 'NGUYEN VAN A', date: '2026/12/10', status: 'planned' }],
}

const setQualData = (win) => {
  win.D.reporters = qualData.reporters
  win.D.qualifications = qualData.qualifications
  win.D.schedules = qualData.schedules
}

describe('buildQualMatrix', () => {
  it('資格×人の表データ（保有・期限状態・予定月）を作る', () => {
    app = loadApp()
    const m = app.win.buildQualMatrix(qualData, '2026-10-17')
    expect(m.people).toEqual(['山田 太郎', 'NGUYEN VAN A', '佐藤 花子'])
    expect(m.rows.map((r) => r.name)).toEqual([
      'フォークリフト運転技能講習',
      '床上操作式クレーン',
      '有機溶剤作業主任者',
      '玉掛け技能講習',
    ])
    const [fork, crane, solvent, sling] = m.rows
    expect(fork.cells[0]).toMatchObject({ kind: 'held', tone: 'ok', label: '保有' })
    expect(fork.cells[1]).toMatchObject({ kind: 'none' })
    // 名前の空白の有無は区別しない
    expect(crane.cells[0]).toMatchObject({ kind: 'held', tone: 'warn', label: '期限 11/30' })
    expect(solvent.cells[2]).toMatchObject({ kind: 'held', tone: 'danger', label: '期限切れ' })
    expect(sling.cells[1]).toMatchObject({ kind: 'planned', tone: 'info', month: 12, near: false, label: '12月 受講予定' })
    expect(crane.status).toBe('expiring')
    expect(sling.status).toBe('none')
  })

  it('30日以内の受講予定は near、受講中は「受講中」', () => {
    app = loadApp()
    const data = {
      ...qualData,
      schedules: [{ qual: '玉掛け技能講習', names: 'NGUYEN VAN A', date: '2026/11/10', status: 'ongoing' }],
    }
    const m = app.win.buildQualMatrix(data, '2026-10-17')
    expect(m.rows[3].cells[1]).toMatchObject({ kind: 'planned', near: true, ongoing: true, label: '11月 受講中' })
  })

  it('人ごと・資格ごとの一覧と、絞り込みの件数を返す', () => {
    app = loadApp()
    const m = app.win.buildQualMatrix(qualData, '2026-10-17')
    expect(m.byPerson.map((p) => [p.name, p.items.length, p.alert, p.planned])).toEqual([
      ['山田 太郎', 2, true, false],
      ['NGUYEN VAN A', 1, false, true],
      ['佐藤 花子', 2, true, false],
    ])
    expect(m.byPerson[1].items[0]).toMatchObject({ qual: '玉掛け技能講習', tone: 'info' })
    expect(m.byQual.map((q) => [q.name, q.holders.length, q.planned.length, q.alert])).toEqual([
      ['フォークリフト運転技能講習', 1, 0, false],
      ['床上操作式クレーン', 2, 0, true],
      ['有機溶剤作業主任者', 1, 0, true],
      ['玉掛け技能講習', 0, 1, false],
    ])
    expect(m.counts).toEqual({ people: 3, alert: 2, planned: 1, quals: 4, qualAlert: 2, qualPlanned: 1 })
  })

  it('従業員や資格が無いときは空の表', () => {
    app = loadApp()
    const m = app.win.buildQualMatrix({ reporters: [], qualifications: [], schedules: [] }, '2026-10-17')
    expect(m.rows).toEqual([])
    expect(m.byPerson).toEqual([])
  })
})

describe('保有資格ページ', () => {
  it('表はクラスで色分けし、列幅は CSS 変数で指定する（インラインの色・小さい文字を使わない）', () => {
    app = loadApp({ now: '2026-10-17T09:00:00+09:00' })
    const { win, doc } = app
    setQualData(win)
    win.renderQualSlide()
    const tbl = doc.getElementById('d-cross-table')
    expect(tbl.querySelectorAll('td.qt-held').length).toBe(4)
    expect(tbl.querySelectorAll('td.qt-held.is-expiring').length).toBe(2)
    expect(tbl.querySelectorAll('td.qt-held.is-expired').length).toBe(1)
    expect(tbl.querySelectorAll('td.qt-plan').length).toBe(1)
    expect(tbl.innerHTML).not.toMatch(/background:/)
    expect(tbl.innerHTML).not.toMatch(SMALL_FONT)
    const css = doc.getElementById('ui-pages').textContent
    expect(css).toMatch(/--qual-name-w/)
    expect(css).toMatch(/--qual-col-w/)
  })

  it('スマホ用の「人で見る」カードに保有資格と受講予定の状態ラベルを出す', () => {
    app = loadApp({ width: 390, now: '2026-10-17T09:00:00+09:00' })
    const { win, doc } = app
    setQualData(win)
    win.renderQualSlide()
    const cards = [...doc.querySelectorAll('#qual-cards .qual-card')]
    expect(cards.map((c) => c.querySelector('.qual-card-name').textContent)).toEqual(['山田 太郎', 'NGUYEN VAN A', '佐藤 花子'])
    const chips = (c) => [...c.querySelectorAll('.chip')].map((x) => `${x.className.replace('chip ', '')}:${x.textContent}`)
    expect(chips(cards[0])).toEqual(['tone-ok:保有', 'tone-warn:期限 11/30'])
    expect(chips(cards[1])).toEqual(['tone-info:12月 受講予定'])
    expect(chips(cards[2])).toEqual(['tone-warn:期限 11/30', 'tone-danger:期限切れ'])
    const filters = [...doc.querySelectorAll('#qual-filters button')].map((b) => b.textContent.trim())
    expect(filters).toEqual(['すべて 3人', '期限間近 2', '受講予定 1'])
  })

  it('名前検索と絞り込み（期限間近・受講予定）でカードを絞る', () => {
    app = loadApp({ width: 390, now: '2026-10-17T09:00:00+09:00' })
    const { win, doc } = app
    setQualData(win)
    win.renderQualSlide()
    const names = () => [...doc.querySelectorAll('#qual-cards .qual-card-name')].map((x) => x.textContent)
    win.setQualFilter('alert')
    expect(names()).toEqual(['山田 太郎', '佐藤 花子'])
    expect(doc.querySelector('#qual-filters button[aria-pressed="true"]').textContent).toContain('期限間近')
    win.setQualFilter('planned')
    expect(names()).toEqual(['NGUYEN VAN A'])
    win.setQualFilter('all')
    win.setQualSearch('佐藤')
    expect(names()).toEqual(['佐藤 花子'])
    win.setQualSearch('nguyen')
    expect(names()).toEqual(['NGUYEN VAN A'])
    win.setQualSearch('該当なし')
    expect(names()).toEqual([])
    expect(doc.querySelector('#qual-cards .empty')).not.toBeNull()
  })

  it('「資格で見る」に切り替えると資格ごとに保有者を並べる', () => {
    app = loadApp({ width: 390, now: '2026-10-17T09:00:00+09:00' })
    const { win, doc } = app
    setQualData(win)
    win.renderQualSlide()
    win.setQualMode('qual')
    expect(doc.getElementById('qual-mode-qual').getAttribute('aria-selected')).toBe('true')
    const cards = [...doc.querySelectorAll('#qual-cards .qual-card')]
    expect(cards.map((c) => c.querySelector('.qual-card-name').textContent)).toEqual([
      'フォークリフト運転技能講習',
      '床上操作式クレーン',
      '有機溶剤作業主任者',
      '玉掛け技能講習',
    ])
    const people = [...cards[1].querySelectorAll('li')].map((li) => [...li.children].map((x) => x.textContent).join(' '))
    expect(people).toEqual(['山田 太郎 期限 11/30', '佐藤 花子 期限 11/30'])
    win.setQualFilter('planned')
    expect([...doc.querySelectorAll('#qual-cards .qual-card-name')].map((x) => x.textContent)).toEqual(['玉掛け技能講習'])
  })

  it('スマホではカード、タブレット以上では表を見せる CSS がある', () => {
    app = loadApp()
    const css = app.doc.getElementById('ui-pages').textContent
    expect(css).toMatch(/@media \(max-width:599px\)[\s\S]*body\.mode-app \.qual-mobile/)
    expect(css).toMatch(/body\.mode-kiosk \.qual-mobile|\.qual-mobile\{\s*display:none/)
  })
})

// ===================== 年間安全衛生計画 =====================
const planData = {
  title: '2026年度 安全衛生計画',
  date: '',
  items: [
    // plan / result は 0=1月 の暦月並び（index 9 = 10月）
    { cat: '会議', name: '安全衛生委員会', plan: ['○', '○', '○', '○', '○', '○', '○', '○', '○', '○', '○', '○'], result: ['', '', '', '', '', '', '', '', '', '○', '', ''], note: '' },
    { cat: '教育', name: '雇入れ時教育', plan: ['', '', '', '○', '', '', '', '', '', '', '', ''], result: [], note: '' },
    { cat: '教育', name: '安全衛生月間の行事', plan: ['', '', '', '', '', '', '', '', '', '○', '', ''], result: [], note: '' },
  ],
}

describe('年間安全衛生計画ページ', () => {
  it('分類・実施項目・計画/実績の列に固定用のクラスを付け、今月の列に印を付ける', () => {
    app = loadApp({ now: '2026-10-17T09:00:00+09:00' })
    const { win, doc } = app
    win.D.plan = planData
    win.renderPlan()
    const tbl = doc.getElementById('d-plan')
    expect(tbl.querySelector('thead th.pl-h-cat').textContent).toBe('分類')
    expect(tbl.querySelector('thead th.pl-h-name').textContent).toBe('実施項目')
    expect(tbl.querySelector('thead th.pl-h-kind')).not.toBeNull()
    expect(tbl.querySelector('thead th.pl-mo.cur').textContent).toBe('10')
    const css = doc.getElementById('ui-pages').textContent
    expect(css).toMatch(/body\.mode-app[^{]*\.pl-h-cat[^{]*\{[^}]*position:sticky/)
  })

  it('スマホ用に「今月の計画と実績」カードを作る（暦月で判定）', () => {
    app = loadApp({ width: 390, now: '2026-10-17T09:00:00+09:00' })
    const { win, doc } = app
    win.D.plan = planData
    win.renderPlan()
    const card = doc.getElementById('d-plan-now')
    expect(card.querySelector('.panel-title').textContent).toBe('10月の計画と実績')
    const rows = [...card.querySelectorAll('li')].map((li) => [li.querySelector('strong').textContent, li.querySelector('.chip').textContent])
    expect(rows).toEqual([
      ['安全衛生委員会', '実施済'],
      ['安全衛生月間の行事', '未実施'],
    ])
  })

  it('通常表示では全体表を <details> に入れ、スマホでは閉じた状態にする', () => {
    app = loadApp({ width: 390 })
    const { win, doc } = app
    win.renderPlan()
    const det = doc.querySelector('#slide-months details.plan-details')
    expect(det).not.toBeNull()
    expect(det.querySelector('.plan-wrap')).not.toBeNull()
    expect(det.open).toBe(false)
    expect(det.querySelector('summary').textContent).toContain('年間の計画表')
    // 何度描画しても入れ子にしない
    win.renderPlan()
    expect(doc.querySelectorAll('#slide-months details.plan-details').length).toBe(1)
  })

  it('タブレット以上では <details> を開いておく。掲示モードでは <details> を使わない', () => {
    app = loadApp({ width: 1024 })
    app.win.renderPlan()
    expect(app.doc.querySelector('#slide-months details.plan-details').open).toBe(true)
    app.close()
    app = loadApp({ search: '?kiosk=1' })
    app.win.renderPlan()
    expect(app.doc.querySelector('#slide-months details')).toBeNull()
  })

  it('表示時に今月の列が見える位置まで横にスクロールする', () => {
    app = loadApp({ now: '2026-10-17T09:00:00+09:00' })
    const { win, doc } = app
    win.D.plan = planData
    win.renderPlan()
    const wrap = doc.querySelector('#slide-months .plan-wrap')
    const set = (sel, prop, v) => Object.defineProperty(doc.querySelector(sel), prop, { value: v, configurable: true })
    set('#d-plan th.pl-h-cat', 'offsetWidth', 88)
    set('#d-plan th.pl-h-name', 'offsetWidth', 200)
    set('#d-plan th.pl-h-kind', 'offsetWidth', 52)
    set('#d-plan th.pl-mo.cur', 'offsetLeft', 900)
    set('#d-plan th.pl-mo.cur', 'offsetWidth', 44)
    win.scrollPlanToCurrentMonth()
    // 固定列の幅と 1 か月分の余白を引いた位置
    expect(wrap.scrollLeft).toBe(900 - 88 - 200 - 52 - 44)
  })

  it('計画表の自動スクロールは掲示モードだけで動く', () => {
    app = loadApp()
    let wrap = app.doc.querySelector('#slide-months .plan-wrap')
    app.win.planAutoScrollTick()
    expect(wrap._wait).toBeUndefined()
    app.close()
    app = loadApp({ search: '?kiosk=1' })
    wrap = app.doc.querySelector('#slide-months .plan-wrap')
    app.win.planAutoScrollTick()
    expect(wrap._wait).toBe(16)
  })
})

// ===================== ヒヤリハット分析 =====================
describe('ヒヤリハット分析ページ', () => {
  const reports = [
    { id: 'a', loc: '第一工場', type: '挟まれ', dept: '製造部' },
    { id: 'b', loc: '第二倉庫', type: '転倒', dept: '製造部' },
    { id: 'c', loc: '事務所', type: '挟まれ', dept: '品質管理室' },
  ]
  const bars = (doc, id) =>
    [...doc.querySelectorAll(`#${id} .hbar`)].map((b) => [
      b.querySelector('.hbar-label').textContent,
      Number(b.querySelector('.hbar-val').textContent),
      b.querySelector('.hbar-fill').style.width,
    ])

  it('報告3件から HTML の横棒グラフを作る（棒の数と値が一致）', () => {
    app = loadApp({ localStorage: { nm_reports: JSON.stringify(reports) } })
    const { win, doc } = app
    win.renderNMAnalysis()
    expect(doc.querySelectorAll('#slide-nm-analysis canvas').length).toBe(0)
    const loc = bars(doc, 'chart-loc')
    expect(loc.length).toBe(3)
    expect(loc.map((x) => x[1])).toEqual([1, 1, 1])
    expect(loc.map((x) => x[0]).sort()).toEqual(['事務所', '第一工場', '第二倉庫'])
    expect(loc.every((x) => x[2] === '100%')).toBe(true)
    expect(bars(doc, 'chart-type')).toEqual([
      ['挟まれ', 2, '100%'],
      ['転倒', 1, '50%'],
    ])
    expect(bars(doc, 'chart-dept')).toEqual([
      ['製造部', 2, '100%'],
      ['品質管理室', 1, '50%'],
    ])
    expect(doc.getElementById('nm-nodata-loc').hidden).toBe(true)
    expect(doc.getElementById('chart-loc').hidden).toBe(false)
    expect(doc.getElementById('d-nm-actual').textContent).toBe('3')
  })

  it('報告が無いときは「報告データなし」を出し、棒は出さない', () => {
    app = loadApp()
    const { win, doc } = app
    win.renderNMAnalysis()
    expect(doc.getElementById('nm-nodata-type').hidden).toBe(false)
    expect(doc.getElementById('chart-type').hidden).toBe(true)
    expect(doc.querySelectorAll('#chart-type .hbar').length).toBe(0)
  })

  it('使っていない描画関数と未定義の関数参照が残っていない', () => {
    app = loadApp()
    expect(app.win.drawStackedBar).toBeUndefined()
    const html = app.doc.documentElement.outerHTML
    expect(html).not.toMatch(/showNoData\(/)
  })
})

// ===================== 組織図 =====================
describe('組織図ページ', () => {
  it('階層ごとの行に階層番号を付ける（スマホの縦ツリー用）', () => {
    app = loadApp({ width: 390 })
    const { win, doc } = app
    win.D.orgChart = [
      { level: 0, role: '総括安全衛生管理者', name: '社長' },
      { level: 1, role: '安全管理者', name: 'A' },
      { level: 1, role: '衛生管理者', name: 'B', note: '兼務' },
      { level: 2, role: '職長', name: 'C' },
    ]
    win.renderDisplay()
    const rows = [...doc.querySelectorAll('#d-org-layout .org-row')]
    expect(rows.map((r) => r.dataset.lv)).toEqual(['0', '1', '2'])
    expect(rows.map((r) => r.style.getPropertyValue('--org-lv'))).toEqual(['0', '1', '2'])
    expect(rows[1].querySelectorAll('.org-box').length).toBe(2)
    expect(rows[1].textContent).toContain('兼務')
  })

  it('スマホでは横線を隠し、インデントと左線の縦ツリーにする CSS がある', () => {
    app = loadApp()
    const css = app.doc.getElementById('ui-pages').textContent
    const phone = css.slice(css.indexOf('/* ---------- 組織図'))
    expect(phone).toMatch(/@media \(max-width:599px\)/)
    expect(phone).toMatch(/body\.mode-app #slides \.org-row::before\{\s*display:none/)
    expect(phone).toMatch(/var\(--org-lv/)
    expect(phone).toMatch(/border-left:2px solid/)
  })
})

// ===================== 設備点検・始業前点検・月次点検 =====================
const NOW = '2026-10-16T09:00:00+09:00'
const inspections = () => [
  { name: 'クレーン①', icon: '🏗', prev: '2026/10/01', status: 'ok', dailyCheckpoints: ['a'], monthlyCheckpoints: ['m1', 'm2'],
    lastInspectedDate: '2026-10-16', lastInspType: 'daily', lastDailyCpState: ['ok'], reporter: '山田 太郎', dept: '製造部' },
  { name: 'プレス機', icon: '⚙', prev: '2026/10/01', status: 'warn', comment: '非常停止の反応が遅い', dailyCheckpoints: ['a'],
    monthlyCheckpoints: ['m1'], lastInspectedDate: '2026-10-16', lastInspType: 'daily', lastDailyCpState: ['ng'], reporter: '佐藤 花子' },
  { name: '切断機①', icon: '🔪', prev: '2026/10/15', status: 'ok', dailyCheckpoints: ['a'], monthlyCheckpoints: ['m1'],
    lastInspectedDate: '2026-10-15', lastInspType: 'daily' },
]
const chipOf = (el) => {
  const c = el.querySelector('.chip')
  return c ? `${c.className.replace('chip ', '')}:${c.textContent}` : null
}

describe('設備点検の状況ページ', () => {
  it('カードに状態ラベル・最終点検日と点検者・未実施なら「点検する」ボタンを出す', () => {
    app = loadApp({ now: NOW })
    const { win, doc } = app
    win.D.inspections = inspections()
    win.D.legalInsp = []
    win.renderDisplay()
    const cards = [...doc.querySelectorAll('#d-insp .ic')]
    expect(cards.map(chipOf)).toEqual(['tone-ok:実施済', 'tone-danger:異常あり', 'tone-neutral:未実施'])
    expect(cards[0].querySelector('.ic-last').textContent).toBe('最終点検 10月16日・山田 太郎（製造部）')
    expect(cards[2].querySelector('.ic-last').textContent).toBe('最終点検 10月15日')
    expect(cards[0].querySelector('.ic-action')).toBeNull()
    const btn = cards[2].querySelector('.ic-action')
    expect(btn.textContent).toBe('点検する')
    expect(btn.getAttribute('onclick')).toBe("openInspSelect('daily')")
    // 危険の意味で青（--accent）や黄（--gold）を使わない
    expect(doc.getElementById('d-insp').innerHTML).not.toMatch(/var\(--accent\)|var\(--gold\)|#128A3E/)
  })

  it('カードの列は 1列 → 2列（600px〜）→ 3列（1024px〜）', () => {
    app = loadApp()
    const css = app.doc.getElementById('ui-pages').textContent
    const sec = css.slice(css.indexOf('/* ---------- 点検カード'))
    expect(sec).toMatch(/@media \(min-width:600px\)\{[^}]*\.insp-grid[^}]*repeat\(2,/)
    expect(sec).toMatch(/@media \(min-width:1024px\)\{[^}]*\.insp-grid[^}]*repeat\(3,/)
  })
})

describe('始業前点検ページ', () => {
  it('一覧のカードに状態ラベルと最終点検、未実施には「点検する」ボタン', () => {
    app = loadApp({ now: NOW })
    const { win, doc } = app
    win.D.inspections = inspections()
    win.renderDailyList()
    const items = [...doc.querySelectorAll('#d-daily-list .daily-item')]
    expect(items.map(chipOf)).toEqual(['tone-ok:実施済', 'tone-danger:異常あり', 'tone-neutral:未実施'])
    expect(items[2].querySelector('.daily-item-meta').textContent).toBe('最終点検 10月15日')
    expect(items[2].querySelector('.ic-action').getAttribute('onclick')).toBe("openInspSelect('daily')")
    expect(items[0].querySelector('.ic-action')).toBeNull()
    expect(doc.getElementById('d-daily-abn').style.color).toBe('var(--c-danger)')
    expect(doc.getElementById('d-daily-done').style.color).toBe('var(--c-ok)')
  })
})

describe('月次点検ページ', () => {
  it('進捗バーの色はトークン、カードに状態ラベル、未実施には「点検する」（月次）', () => {
    app = loadApp({ now: NOW })
    const { win, doc } = app
    const list = inspections()
    list[0] = { ...list[0], lastInspectedDate: '2026-10-05', lastInspType: 'monthly', lastMonthlyCpState: ['ok', 'ok'] }
    list[1] = { ...list[1], lastInspectedDate: '2026-10-06', lastInspType: 'monthly', lastMonthlyCpState: ['ng'] }
    win.D.inspections = list
    win.renderMonthlyInsp()
    expect(doc.getElementById('monthly-progress-bar').style.background).toBe('var(--c-warn)')
    const cards = [...doc.querySelectorAll('#d-monthly-insp .mi-card')]
    expect(cards.map(chipOf)).toEqual(['tone-ok:実施済', 'tone-danger:異常あり', 'tone-neutral:未実施'])
    expect(cards[0].querySelector('.mi-meta').textContent).toBe('最終点検 10月5日・山田 太郎（製造部）')
    expect(cards[2].querySelector('.ic-action').getAttribute('onclick')).toBe("openInspSelect('monthly')")
    expect(cards[0].querySelector('.ic-action')).toBeNull()
    expect(win.renderMonthlyInsp.toString()).not.toMatch(/#128A3E|#B45309|#0B63CE/)
    expect(doc.getElementById('d-monthly-insp').innerHTML).not.toMatch(SMALL_FONT)
  })
})

// ===================== 巡視・RA・法令・事故事例・熱中症・無災害・自由掲示 =====================
const patrolReports = [
  { date: '2026-10-01', reporter: '山田 太郎', area: '第一工場', overall: '概ね良好', items: [
    { category: '通路', item: '通路に資材', result: 'ng', resolved: true, improvementDate: '2026-10-03', improvementContent: '撤去した' },
  ] },
  { date: '2026-10-14', reporter: '佐藤 花子', area: '第二倉庫', overall: '要改善あり', items: [
    { category: '通路', item: '通路に資材が置かれている', result: 'ng', resolved: false, comment: '台車' },
    { category: '消火', item: '消火器', result: 'ok' },
  ] },
]
// 通常表示のページに必要なデータを一通り入れて描画する
const renderAllPages = (win) => {
  win.D.patrolReports = patrolReports
  win.D.inspections = inspections()
  win.D.legalInsp = [
    { equipName: 'クレーン①', type: 'yearly', date: '2025-10-01', nextDate: '2026-10-01', result: 'fail', inspector: '外部業者', note: 'ワイヤー交換' },
  ]
  win.D.raItems = [
    { theme: 'レーザー加工 RA', reporter: 'A', deadline: '2026/10/01', step: 2, done: false, doneDate: '' },
    { theme: '溶接 RA', reporter: 'B', deadline: '2026/10/30', step: 1, done: false, doneDate: '' },
    { theme: 'プレス RA', reporter: 'C', deadline: '2026/09/01', step: 5, done: true, doneDate: '2026/08/20' },
  ]
  win.D.heat.reporters = [{ role: '第一報', name: '班長', tel: '090-1234-5678' }, { role: '推進者', name: '', tel: '' }]
  win.D.heat.emergency = [{ label: '救急', name: '消防（救急車）', tel: '119' }, { label: '搬送先', name: '', tel: '' }]
  win.D.heat.areas = [{ name: '溶接エリア', wbgt: '29', temp: '33', humid: '60' }]
  setQualData(win)
  win.renderDisplay()
  win.renderDailyList()
  win.renderMonthlyInsp()
  win.renderPatrolSlide()
  win.renderLegalSlide()
  win.selectLegalEquip('クレーン①')
  win.renderNMAnalysis()
}

describe('熱中症対策ページ', () => {
  it('電話番号は tel: リンクにする（未設定はリンクにしない）', () => {
    app = loadApp()
    const { win, doc } = app
    renderAllPages(win)
    const a1 = doc.querySelector('#d-heat-reporters a[href^="tel:"]')
    expect(a1.getAttribute('href')).toBe('tel:09012345678')
    expect(a1.textContent).toBe('090-1234-5678')
    expect(doc.querySelectorAll('#d-heat-reporters a').length).toBe(1)
    const a2 = doc.querySelector('#d-heat-emergency a[href^="tel:"]')
    expect(a2.getAttribute('href')).toBe('tel:119')
    expect(doc.querySelectorAll('#d-heat-emergency a').length).toBe(1)
    expect(doc.querySelectorAll('#d-heat-emergency .he-t')[1].textContent).toBe('—')
  })
})

describe('事故事例ページ', () => {
  it('事例タブはクラスで状態を表し、選択中は aria-selected', () => {
    app = loadApp()
    const { win, doc } = app
    win.D.accidentCases = [
      { date: '2025/04/01', type: '挟まれ', location: 'A', desc: '事例1', prevention: ['対策1'] },
      { date: '2025/05/01', type: '転倒', location: 'B', desc: '事例2', prevention: ['対策2'] },
    ]
    win.renderDisplay()
    const tabs = [...doc.querySelectorAll('#d-acc-tabs .acc-tab')]
    expect(tabs.length).toBe(2)
    expect(tabs.every((t) => !t.getAttribute('style'))).toBe(true)
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false'])
    win.selectAccCase(1)
    expect(tabs.map((t) => t.classList.contains('is-active'))).toEqual([false, true])
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['false', 'true'])
    expect(doc.getElementById('d-acc-desc').textContent).toBe('事例2')
    const css = doc.getElementById('ui-pages').textContent
    expect(css).toMatch(/body\.mode-app[^{]*\.acc-tab\{[^}]*min-height:var\(--tap\)/)
  })
})

describe('安全巡視ページ', () => {
  it('改善報告ボタンは押しやすい大きさのクラス、状態の色はトークン', () => {
    app = loadApp()
    const { win, doc } = app
    renderAllPages(win)
    const btn = doc.querySelector('#patrol-latest-content .plt-improve-btn')
    expect(btn.getAttribute('onclick')).toBe('openImprovementModal(1,0)')
    expect(btn.getAttribute('style')).toBeNull()
    expect(doc.getElementById('ps-issues').style.color).toBe('var(--c-warn)')
    expect(doc.getElementById('ps-resolved').style.color).toBe('var(--c-ok)')
    const html = doc.getElementById('slide-patrol').innerHTML
    expect(html).not.toMatch(SMALL_FONT)
    expect(html).not.toMatch(/#128A3E|var\(--gold\)/)
    expect([...doc.querySelectorAll('#patrol-hist-list .patrol-issue-tag')].map((t) => t.className)).toEqual([
      'patrol-issue-tag', 'patrol-issue-tag ok',
    ])
  })
})

describe('状態の色の統一（危険＝赤）', () => {
  it('リスクアセスメント・無災害記録・年間目標で青（--accent）や --gold を危険・注意の意味に使わない', () => {
    app = loadApp({ now: '2026-10-16T09:00:00+09:00' })
    const { win, doc } = app
    renderAllPages(win)
    const ra = doc.getElementById('d-ra-list').innerHTML + doc.getElementById('d-ra-overview').innerHTML + doc.getElementById('d-ra-steps').innerHTML
    expect(ra).not.toMatch(/var\(--accent\)|var\(--gold\)|#128A3E/)
    expect(ra).toMatch(/var\(--c-danger\)/) // 期限超過
    expect(ra).toMatch(/var\(--c-warn\)/) // 残り30日以内
    expect(doc.getElementById('d-stats').innerHTML).not.toMatch(/var\(--accent\)|var\(--gold\)|#128A3E/)
    expect(doc.getElementById('d-goals').innerHTML).not.toMatch(/var\(--accent\)|var\(--gold\)|#128A3E/)
  })

  it('法令点検の「不合格・期限超過」を赤にする CSS がある', () => {
    app = loadApp()
    const css = app.doc.getElementById('ui-pages').textContent
    expect(css).toMatch(/\.legal-fail[^{]*\{[^}]*var\(--c-danger\)/)
    expect(css).toMatch(/\.legal-equip-card\.overdue[^{]*\{[^}]*var\(--c-danger\)/)
    expect(css).toMatch(/\.ic-legal-over[^{]*\{[^}]*var\(--c-danger\)/)
  })
})

describe('通常表示で 12px 未満の文字を使わない', () => {
  it('ページの生成 HTML にインラインの font-size:9〜11px が残っていない', () => {
    app = loadApp({ width: 390 })
    const { win, doc } = app
    renderAllPages(win)
    const offenders = [...doc.querySelectorAll('#slides [style]')]
      .filter((el) => !el.closest('.kiosk-only') && SMALL_FONT.test(el.getAttribute('style')))
      .map((el) => `${el.closest('.slide')?.id}: ${el.outerHTML.slice(0, 80)}`)
    expect(offenders).toEqual([])
  })

  it('12px 未満を指定している CSS は、通常表示用の上書きがある', () => {
    app = loadApp({ width: 390 })
    const { win, doc } = app
    renderAllPages(win)
    // px か clamp() の最小値で 12px 未満を指定しているルール
    const smallPx = (v) => {
      const m = /^(?:clamp\()?\s*(\d+(?:\.\d+)?)px/.exec(v || '')
      return m && Number(m[1]) < 12
    }
    const okSize = (v) => /^var\(--fs-(xs|sm|md|lg|xl)\)$/.test(v) || (/^\d+px$/.test(v) && parseInt(v, 10) >= 12)
    const rules = []
    const walk = (list, sheetId) => {
      for (const r of list) {
        if (r.cssRules && r.media) {
          if (!/print/.test(r.media.mediaText)) walk(r.cssRules, sheetId)
        } else if (r.selectorText && r.style) {
          rules.push({ sel: r.selectorText, size: r.style.getPropertyValue('font-size').trim(), sheetId })
        }
      }
    }
    for (const st of doc.querySelectorAll("style")) if (st.sheet) walk(st.sheet.cssRules, st.id)
    const matches = (el, sel) =>
      sel.split(',').some((part) => {
        try {
          return el.matches(part.trim())
        } catch (e) {
          // ::before などの疑似要素を含むセレクタは要素に一致しない
          return e instanceof win.DOMException ? false : Promise.reject(e)
        }
      })
    const overrides = rules.filter((r) => (r.sheetId === 'ui-pages' || r.sheetId === 'app-ui') && /^body\.mode-app/.test(r.sel) && okSize(r.size))
    const offenders = []
    for (const r of rules.filter((x) => smallPx(x.size) && x.sheetId !== 'ui-pages' && x.sheetId !== 'app-ui')) {
      const els = [...doc.querySelectorAll('#slides *')].filter((el) => !el.closest('.kiosk-only, #qual-scroll-hint') && matches(el, r.sel))
      for (const el of els) {
        if (!overrides.some((o) => matches(el, o.sel))) offenders.push(`${r.sel} (${r.size}) → ${el.className || el.tagName}`)
      }
    }
    expect([...new Set(offenders)]).toEqual([])
  })

  it('WBGT の数値の単位（em 指定で小さくなる）も 12px 以上にする', () => {
    app = loadApp()
    const css = app.doc.getElementById('ui-pages').textContent
    expect(css).toMatch(/body\.mode-app #slides \.heat-area \.ha-val small\{[^}]*font-size:var\(--fs-xs\)/)
  })
})
