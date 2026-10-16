// ホーム画面の集計（純粋関数）のテスト
import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { loadApp } from './helpers/loadApp.js'

let app
beforeAll(() => {
  app = loadApp()
})
afterAll(() => app?.close())

const today = '2026-10-16'

describe('computeDailyStatus', () => {
  it('今日の始業前点検の実施数・異常数・実施率を数える', () => {
    const insp = [
      { name: 'A', dailyCheckpoints: ['x'], lastInspectedDate: today, lastInspType: 'daily', lastDailyCpState: ['ok'] },
      { name: 'B', dailyCheckpoints: ['x'], lastInspectedDate: today, lastInspType: 'daily', lastDailyCpState: ['ng'] },
      { name: 'C', dailyCheckpoints: ['x'], lastInspectedDate: '2026-10-15', lastInspType: 'daily' },
      { name: 'D', dailyCheckpoints: [] },
    ]
    const st = app.win.computeDailyStatus(insp, today)
    expect(st.total).toBe(3)
    expect(st.done).toBe(2)
    expect(st.abn).toBe(1)
    expect(st.undone).toBe(1)
    expect(st.rate).toBe(67)
  })
})

describe('rateLevel', () => {
  it('しきい値で正常・注意・危険を返す', () => {
    const { rateLevel } = app.win
    expect(rateLevel(100, 100, 50)).toBe('ok')
    expect(rateLevel(50, 100, 50)).toBe('warn')
    expect(rateLevel(49, 100, 50)).toBe('danger')
  })
})

describe('collectActionItems', () => {
  const data = {
    inspections: [
      { name: 'プレス機', status: 'warn', comment: '非常停止の反応が遅い' },
      { name: 'クレーン①', status: 'ok' },
    ],
    raItems: [
      { theme: 'レーザー加工エリア', deadline: '2026-10-10', done: false },
      { theme: '溶接エリア', deadline: '2026-10-01', done: true },
      { theme: '組立エリア', deadline: '2026-12-01', done: false },
    ],
    patrolReports: [
      { date: '2026-10-14', area: '第二倉庫', items: [
        { item: '通路に資材', result: 'ng', resolved: false },
        { item: '消火器', result: 'ng', resolved: true },
        { item: '照明', result: 'ok' },
      ] },
    ],
    qualifications: [
      { name: '床上操作式クレーン', status: 'expiring', expiry: '2026/11/30', holderNames: 'A,B' },
      { name: '玉掛け', status: 'ok' },
      { name: '有機溶剤', status: 'expired', expiry: '2026/09/30', holderNames: 'C' },
    ],
    legalInsp: [
      { equipName: 'フォークリフト①', date: '2025-10-01', nextDate: '2026-10-01' },
    ],
  }

  it('異常・期限切れ・未改善・期限間近を集め、危険を先に並べる', () => {
    const items = app.win.collectActionItems(data, today)
    const summary = items.map((x) => `${x.tone}:${x.label}:${x.title}`)
    expect(summary).toEqual([
      'danger:異常:プレス機',
      'danger:期限切れ:リスクアセスメント',
      'danger:期限切れ:資格の有効期限',
      'danger:期限切れ:法令点検',
      'warn:未改善:安全巡視の指摘',
      'warn:期限間近:資格の有効期限',
    ])
    expect(items[0].page).toBe('slide-insp')
    expect(items.find((x) => x.label === '未改善').detail).toContain('通路に資材')
  })

  it('対応が必要なものが無ければ空', () => {
    expect(app.win.collectActionItems({}, today)).toEqual([])
  })
})

describe('currentMonthPlan', () => {
  it('今月の計画項目と実施状況を返す', () => {
    const plan = {
      items: [
        { name: '安全衛生月間', plan: ['', '', '', '', '', '', '○', '', '', '', '', ''], result: ['', '', '', '', '', '', '○', '', '', '', '', ''] },
        { name: '標語・ポスター', plan: ['', '', '', '', '', '', '○', '', '', '', '', ''], result: Array(12).fill('') },
        { name: '年末安全点検', plan: ['', '', '', '', '', '', '', '○', '', '', '', ''], result: Array(12).fill('') },
      ],
    }
    // 10月 = 年度の 7 番目（index 6）
    const list = app.win.currentMonthPlan({ plan }, new Date(2026, 9, 16))
    expect(list).toEqual([
      { name: '安全衛生月間', done: true },
      { name: '標語・ポスター', done: false },
    ])
  })
})
