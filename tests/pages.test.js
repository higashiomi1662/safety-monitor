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
