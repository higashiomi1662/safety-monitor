// 見づらさに直結する既存不具合の回帰テスト
import { describe, it, expect, afterEach, vi } from 'vitest'
import { loadApp } from './helpers/loadApp.js'

let app
afterEach(() => {
  vi.useRealTimers()
  app?.close()
})

const slideIds = (win) => [...win.document.querySelectorAll('#slides > .slide')].map((s) => s.id)
const indexOf = (win, id) => slideIds(win).indexOf(id)
const activeId = (win) => win.document.querySelector('#slides > .slide.active')?.id

describe('言語切替', () => {
  it('2回切り替えても例外が出ず、見出しが日本語に戻る', () => {
    app = loadApp()
    const { win, doc } = app
    const before = [...doc.querySelectorAll('.sl-h1')].map((e) => e.innerHTML)
    expect(() => win.toggleLang()).not.toThrow()
    expect(() => win.toggleLang()).not.toThrow()
    const after = [...doc.querySelectorAll('.sl-h1')].map((e) => e.innerHTML)
    expect(after).toEqual(before)
  })

  it('ベトナム語では組織図の見出しが組織図のまま（ずれない）', () => {
    app = loadApp()
    const { win, doc } = app
    win.toggleLang()
    const label = doc.querySelector('#slide-org .sl-label').textContent
    expect(label).toMatch(/Sơ Đồ Tổ Chức/)
  })
})

describe('ページ表示時の再描画', () => {
  it.each([
    ['slide-legal', 'renderLegalSlide'],
    ['slide-daily', 'renderDailyList'],
    ['slide-training', 'renderTrainingSlide'],
    ['slide-monthly-check', 'renderMonthlyCheck'],
    ['slide-patrol', 'renderPatrolSlide'],
  ])('%s を表示すると %s が呼ばれる', (id, fn) => {
    app = loadApp()
    const { win } = app
    const spy = vi.fn()
    win[fn] = spy
    win.showPage(id)
    expect(spy).toHaveBeenCalled()
  })

  it('教育訓練ページでは法令点検の描画が走らない', () => {
    app = loadApp()
    const { win } = app
    const spy = vi.fn()
    win.renderLegalSlide = spy
    win.showPage('slide-training')
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('掲示モードの開始ページ', () => {
  it('選択肢の値はページIDで、表示名と同じページを指す', () => {
    app = loadApp()
    const { win, doc } = app
    win.openAdmin()
    const opts = [...doc.querySelectorAll('#a-pinpage option')].filter((o) => o.value)
    expect(opts.length).toBeGreaterThan(10)
    for (const o of opts) {
      const meta = win.pageMeta(o.value)
      expect(meta, o.value).toBeTruthy()
      expect(o.textContent).toContain(meta.ja)
    }
  })

  it('旧形式の番号（5=教育訓練、17=熱中症）を正しいページIDに移行する', () => {
    app = loadApp()
    const { win } = app
    expect(win.migratePinPage(5)).toBe('slide-training')
    expect(win.migratePinPage(17)).toBe('slide-heat')
    expect(win.migratePinPage(0)).toBe('')
  })
})

describe('キー操作', () => {
  it('管理画面を開いている間は矢印キーでページが変わらない', () => {
    app = loadApp({ search: '?kiosk=1' })
    const { win, doc } = app
    const before = activeId(win)
    win.openAdmin()
    doc.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight' }))
    expect(activeId(win)).toBe(before)
  })
})

describe('ヒヤリハット報告', () => {
  it('送信完了の後にもう一度開くと、完了画面ではなく入力フォームが出る', () => {
    app = loadApp()
    const { win, doc } = app
    win.openNM()
    doc.getElementById('nm-form-section').style.display = 'none'
    doc.getElementById('nm-success').classList.add('show')
    win.closeNM()
    win.openNM()
    expect(doc.getElementById('nm-success').classList.contains('show')).toBe(false)
    expect(doc.getElementById('nm-form-section').style.display).not.toBe('none')
  })

  it('発生日時の初期値は日本時間の現在時刻', () => {
    app = loadApp({ now: '2026-10-16T23:30:00Z' }) // JST 10/17 08:30
    const { win, doc } = app
    win.openNM()
    expect(doc.getElementById('nm-dt').value).toBe('2026-10-17T08:30')
  })
})

describe('QRコード', () => {
  it('黒い QR を生成し、URL に # 以降を含めない', () => {
    app = loadApp({ hash: '#/records' })
    const { win } = app
    win.openQR()
    const o = win.__qrCalls.at(-1)
    expect(o.colorDark.toLowerCase()).toBe('#000000')
    expect(o.text).not.toContain('#')
  })
})

describe('日付', () => {
  it('localDateStr は日本時間の日付を返す（朝9時前でも当日）', () => {
    app = loadApp()
    const { win } = app
    expect(win.localDateStr(new Date('2026-10-16T22:00:00Z'))).toBe('2026-10-17')
  })
})

describe('白背景に白文字', () => {
  it('月次活動チェックのチェック済み項目は読める色で表示する', () => {
    const now = new Date()
    const mo = now.getMonth() + 1
    const key = `mc_check_${mo}_${now.getFullYear()}`
    app = loadApp({ localStorage: { [key]: JSON.stringify({ 0: true }) } })
    const { win, doc } = app
    win.renderMonthlyCheck()
    expect(doc.getElementById('mc-checklist').innerHTML).not.toMatch(/color:\s*#fff/i)
    expect(doc.getElementById('mc-evidence-list').innerHTML).not.toMatch(/color:\s*#fff/i)
  })
})

describe('HTML の妥当性', () => {
  it('ID が重複していない', () => {
    app = loadApp()
    const ids = [...app.doc.querySelectorAll('[id]')].map((e) => e.id)
    const dup = ids.filter((id, i) => ids.indexOf(id) !== i)
    expect(dup).toEqual([])
  })
})

describe('スライド構成', () => {
  it('固定ページの並びが変わっていない', () => {
    app = loadApp()
    expect(slideIds(app.win).slice(0, 17)).toEqual([
      'slide-policy', 'slide-org', 'slide-goals', 'slide-months', 'slide-monthly-check',
      'slide-training', 'slide-ra', 'slide-legal', 'slide-insp', 'slide-daily', 'slide-monthly',
      'slide-patrol', 'slide-stats', 'slide-nm-analysis', 'slide-accident', 'slide-qual', 'slide-heat',
    ])
    expect(indexOf(app.win, 'slide-heat')).toBe(16)
  })
})

describe('自動送り', () => {
  // setInterval の呼び出し（間隔）を記録する
  const recordIntervals = (win) => {
    win.__intervals = []
    const orig = win.setInterval.bind(win)
    win.setInterval = (fn, ms, ...rest) => {
      win.__intervals.push(ms)
      return orig(fn, ms, ...rest)
    }
  }

  it('通常（アプリ）表示ではページの自動送りタイマーを動かさない', () => {
    app = loadApp({ beforeParse: recordIntervals })
    const slideMs = app.get('D').slidesec * 1000
    expect(app.win.__intervals).not.toContain(slideMs)
  })

  it('掲示モードでは自動送りタイマーを動かす', () => {
    app = loadApp({ search: '?kiosk=1', beforeParse: recordIntervals })
    const slideMs = app.get('D').slidesec * 1000
    expect(app.win.__intervals).toContain(slideMs)
  })

  it('掲示モードで固定中は、入力画面を閉じても自動送りを再開しない', () => {
    app = loadApp({ search: '?kiosk=1', beforeParse: recordIntervals })
    const { win } = app
    const slideMs = app.get('D').slidesec * 1000
    if (!app.get('isPinned')) win.togglePin()
    win.openNM()
    win.__intervals.length = 0
    win.closeNM()
    expect(win.__intervals).not.toContain(slideMs)
  })
})
