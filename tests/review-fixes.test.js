// コードレビューで見つかった不具合の回帰テスト
import { describe, it, expect, afterEach, vi } from 'vitest'
import { loadApp } from './helpers/loadApp.js'

let app
afterEach(() => app?.close())

const recordIntervals = (win) => {
  win.__intervals = []
  const orig = win.setInterval.bind(win)
  win.setInterval = (fn, ms, ...rest) => {
    win.__intervals.push(ms)
    return orig(fn, ms, ...rest)
  }
}

describe('QRコードのURL', () => {
  it('?kiosk=1 や ?v= を含めず、アプリの入口 URL だけにする（読み取ったスマホが掲示モードにならない）', () => {
    app = loadApp({ search: '?kiosk=1&v=v178', hash: '#/records' })
    app.win.openQR()
    expect(app.win.__qrCalls.at(-1).text).toBe('https://example.test/safety-monitor/')
  })
})

describe('掲示モードで管理画面を開いている間', () => {
  it('自動送りを止め、閉じたら再開する', () => {
    app = loadApp({ search: '?kiosk=1', beforeParse: recordIntervals })
    const { win } = app
    const slideMs = app.get('D').slidesec * 1000
    win.openAdmin()
    expect(win.eval('timer')).toBeTruthy()
    // 開いた後に新しい自動送りタイマーが作られていないこと・既存は止まっていること
    win.__intervals.length = 0
    const before = win.eval('cur')
    win.goTo(before) // 何もしない操作
    expect(win.__intervals).not.toContain(slideMs)
    win.closeAdmin()
    expect(win.__intervals).toContain(slideMs)
  })

  it('新しい版があっても、管理画面や入力画面を開いている間は自動で読み込み直さない', () => {
    app = loadApp({ search: '?kiosk=1' })
    const { win } = app
    const spy = vi.fn()
    win.applyUpdate = spy
    win.setUpdateAvailable('v999')
    win.openAdmin()
    win.showPage('slide-org')
    expect(spy).not.toHaveBeenCalled()
    win.closeAdmin()
    win.showPage('slide-goals')
    expect(spy).toHaveBeenCalled()
  })
})

describe('PIN', () => {
  it('PIN 設定済みで暗号機能が使えない環境では、PIN なしで開かない（安全側に倒す）', async () => {
    app = loadApp()
    const { win } = app
    await win.setAdminPin('1234')
    win.sessionStorage.clear()
    Object.defineProperty(win, 'crypto', { value: {}, configurable: true })
    const cb = vi.fn()
    win.requireAdminPin(cb)
    expect(cb).not.toHaveBeenCalled()
  })

  it('Firebase の読み込み前（window.FS がまだ無い）でも、同期が終わるまでは PIN 未設定と判断しない', () => {
    app = loadApp({ beforeParse: (win) => { win.FS_MAIN_LOADED = false } })
    const { win } = app
    const cb = vi.fn()
    win.requireAdminPin(cb)
    expect(cb).not.toHaveBeenCalled()
  })

  it('Firebase が読み込めないまま一定時間たったら、同期待ちをやめる', () => {
    app = loadApp({ beforeParse: (win) => { win.FS_MAIN_LOADED = false } })
    const { win } = app
    win.adminPinGiveUpSync()
    const cb = vi.fn()
    win.requireAdminPin(cb)
    expect(cb).toHaveBeenCalled()
  })
})

describe('更新の無限くり返し防止', () => {
  it('同じ版への自動切り替えは1回だけ（2回目はボタンで知らせるだけ）', async () => {
    app = loadApp({
      sessionStorage: { sm_update_tried: 'v999' },
      beforeParse(win) {
        win.fetch = async () => ({ ok: true, json: async () => ({ version: 'v999' }) })
      },
    })
    const { win } = app
    const spy = vi.fn()
    win.applyUpdate = spy
    await win.checkForUpdate({ auto: true })
    expect(spy).not.toHaveBeenCalled()
    expect(win.document.querySelector('#app-header .update-btn').dataset.state).toBe('available')
  })
})

describe('表示のエスケープ', () => {
  it('ヒヤリ報告の内容に HTML が含まれていても、管理画面の受信箱でタグとして解釈しない', () => {
    const reports = [{ id: 1, dt: '2026-10-16T10:00', loc: '<img src=x onerror=alert(1)>', name: '<b>x</b>', dept: '"d"', type: '転倒・つまずき', desc: '<script>bad()</script>', comment: '<i>c</i>', photos: [] }]
    app = loadApp({ localStorage: { nm_reports: JSON.stringify(reports) } })
    const { win, doc } = app
    win.refreshNMReports?.()
    win.renderAdmin()
    const box = doc.getElementById('nm-report-list')
    expect(box.querySelector('img[src="x"]')).toBe(null)
    expect(box.querySelector('script')).toBe(null)
    expect(box.querySelector('b')).toBe(null)
    expect(box.textContent).toContain('<img src=x onerror=alert(1)>')
  })

  it('名簿の名前に " が含まれていても選択肢が壊れない', () => {
    app = loadApp()
    const { win, doc } = app
    win.eval('D').reporters = ['山田 "太郎"']
    win.openNM()
    const opt = [...doc.querySelectorAll('#nm-name option')].find((o) => o.textContent.includes('山田'))
    expect(opt.value).toBe('山田 "太郎"')
  })
})

describe('掲示モードの終了', () => {
  it('終了後の URL に ?kiosk= を残さない', () => {
    app = loadApp({ search: '?kiosk=1' })
    expect(app.win.kioskExitUrl()).toBe('/safety-monitor/#/')
  })
})
