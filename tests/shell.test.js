// アプリシェル（ルーター・タブ・サイドバー・掲示モード・更新）のテスト
import { describe, it, expect, afterEach } from 'vitest'
import { loadApp } from './helpers/loadApp.js'

let app
afterEach(() => app?.close())

const go = (win, hash) => {
  win.location.hash = hash
  win.renderRoute()
}
const visibleHubs = (doc) => [...doc.querySelectorAll('.app-hub')].filter((h) => !h.hidden).map((h) => h.id)

describe('parseRoute', () => {
  it.each([
    ['', { view: 'hub', hub: 'home' }],
    ['#/', { view: 'hub', hub: 'home' }],
    ['#/report', { view: 'hub', hub: 'report' }],
    ['#/records', { view: 'hub', hub: 'records' }],
    ['#/board', { view: 'hub', hub: 'board' }],
    ['#/menu', { view: 'hub', hub: 'menu' }],
    ['#/p/qual', { view: 'page', id: 'slide-qual' }],
    ['#/p/board-2', { view: 'page', id: 'slide-board-2' }],
    ['#/report/nm', { view: 'hub', hub: 'report', action: 'nm' }],
    ['#/unknown', { view: 'hub', hub: 'home' }],
  ])('%s', (hash, expected) => {
    app = loadApp()
    expect(app.win.parseRoute(hash)).toEqual(expected)
  })
})

describe('通常表示（アプリ）', () => {
  it('起動するとホームが表示され、ページ領域は隠れる', () => {
    app = loadApp()
    const { doc } = app
    expect(doc.body.classList.contains('mode-app')).toBe(true)
    expect(visibleHubs(doc)).toEqual(['hub-home'])
    expect(doc.getElementById('display').hidden).toBe(true)
  })

  it('下部タブは5つ（ホーム・報告・記録・掲示・メニュー）', () => {
    app = loadApp({ width: 390 })
    const labels = [...app.doc.querySelectorAll('#app-tabbar .tab')].map((t) => t.textContent.trim())
    expect(labels).toEqual(['ホーム', '報告', '記録', '掲示', 'メニュー'])
  })

  it('タブの移動で表示するハブが変わり、選択中のタブに印が付く', () => {
    app = loadApp()
    const { win, doc } = app
    go(win, '#/records')
    expect(visibleHubs(doc)).toEqual(['hub-records'])
    expect(doc.querySelector('#app-tabbar .tab[aria-current="page"]').textContent.trim()).toBe('記録')
  })

  it('ページを開くと、そのページだけ表示され、戻る先は所属するハブ', () => {
    app = loadApp()
    const { win, doc } = app
    go(win, '#/p/qual')
    expect(visibleHubs(doc)).toEqual([])
    expect(doc.getElementById('display').hidden).toBe(false)
    expect(doc.querySelector('#slides > .slide.active').id).toBe('slide-qual')
    expect(doc.querySelector('#app-header .hdr-back').getAttribute('href')).toBe('#/records')
    expect(doc.querySelector('#app-header .hdr-title').textContent).toContain('保有資格')
  })

  it('goTo は URL（#/p/...）を変えてページに移動する', () => {
    app = loadApp()
    const { win } = app
    const idx = [...win.document.querySelectorAll('#slides > .slide')].findIndex((s) => s.id === 'slide-heat')
    win.goTo(idx)
    expect(win.location.hash).toBe('#/p/heat')
  })

  it('記録ハブには記録ページへのリンクが並ぶ', () => {
    app = loadApp()
    const { win, doc } = app
    go(win, '#/records')
    const hrefs = [...doc.querySelectorAll('#hub-records a.list-row')].map((a) => a.getAttribute('href'))
    expect(hrefs).toEqual(expect.arrayContaining(['#/p/insp', '#/p/daily', '#/p/monthly', '#/p/legal',
      '#/p/patrol', '#/p/training', '#/p/ra', '#/p/nm-analysis', '#/p/qual']))
  })

  it('掲示ハブには自由掲示も並ぶ', () => {
    app = loadApp()
    const { win, doc } = app
    go(win, '#/board')
    const hrefs = [...doc.querySelectorAll('#hub-board a.list-row')].map((a) => a.getAttribute('href'))
    expect(hrefs).toEqual(expect.arrayContaining(['#/p/policy', '#/p/heat', '#/p/board-0']))
  })

  it('ホームに無災害日数・ヒヤリハット報告ボタン・要対応が出る', () => {
    app = loadApp()
    const home = app.doc.getElementById('hub-home')
    expect(home.querySelector('[data-kpi="zero"]')).toBeTruthy()
    expect(home.querySelector('.cta-report')).toBeTruthy()
    expect(home.querySelector('[data-section="actions"]')).toBeTruthy()
  })

  it('言語を切り替えるとタブの表示もベトナム語になる', () => {
    app = loadApp()
    app.win.toggleLang()
    const first = app.doc.querySelector('#app-tabbar .tab').textContent.trim()
    expect(first).toBe('Trang chủ')
  })
})

describe('PC のサイドバー', () => {
  it('メニューボタンで開閉し、状態を端末に保存する', () => {
    app = loadApp({ width: 1366 })
    const { win, doc } = app
    expect(doc.body.classList.contains('sidebar-collapsed')).toBe(false)
    win.toggleSidebar()
    expect(doc.body.classList.contains('sidebar-collapsed')).toBe(true)
    expect(win.localStorage.getItem('sm_sidebar')).toBe('collapsed')
    expect(doc.querySelector('.hdr-menu-toggle').getAttribute('aria-expanded')).toBe('false')
  })

  it('閉じた状態は次に開いたときも保たれる', () => {
    app = loadApp({ width: 1366, localStorage: { sm_sidebar: 'collapsed' } })
    expect(app.doc.body.classList.contains('sidebar-collapsed')).toBe(true)
  })
})

describe('掲示モード', () => {
  it('?kiosk=1 で掲示モードになり、端末に記憶する', () => {
    app = loadApp({ search: '?kiosk=1' })
    const { win, doc } = app
    expect(doc.body.classList.contains('mode-kiosk')).toBe(true)
    expect(doc.getElementById('display').hidden).toBe(false)
    expect(win.localStorage.getItem('sm_mode')).toBe('kiosk')
  })

  it('一度記憶した端末は URL に指定がなくても掲示モード', () => {
    app = loadApp({ localStorage: { sm_mode: 'kiosk' } })
    expect(app.doc.body.classList.contains('mode-kiosk')).toBe(true)
  })

  it('?kiosk=0 で通常表示に戻り、記憶を消す', () => {
    app = loadApp({ search: '?kiosk=0', localStorage: { sm_mode: 'kiosk' } })
    expect(app.doc.body.classList.contains('mode-app')).toBe(true)
    expect(app.win.localStorage.getItem('sm_mode')).toBe(null)
  })
})

describe('バージョンと更新', () => {
  it('ヘッダーの更新ボタンにバージョンを表示する', () => {
    app = loadApp()
    const btn = app.doc.querySelector('#app-header .update-btn')
    expect(btn.textContent).toContain(app.get('APP_VERSION'))
    expect(btn.textContent).toContain('更新')
  })

  it('新しい版を見つけるとボタンの表示が変わる', () => {
    app = loadApp()
    app.win.setUpdateAvailable('v999')
    const btn = app.doc.querySelector('#app-header .update-btn')
    expect(btn.dataset.state).toBe('available')
    expect(btn.textContent).toContain('v999')
  })

  it('キャッシュは消すが、保存済みデータ（localStorage）は消さない', async () => {
    const deleted = []
    app = loadApp({
      localStorage: { safety_data_v93: '{"x":1}', nm_reports: '[]' },
      beforeParse(win) {
        win.caches = {
          keys: async () => ['safety-monitor-v177', 'other'],
          delete: async (k) => {
            deleted.push(k)
            return true
          },
        }
      },
    })
    const n = await app.win.clearAppCaches()
    expect(n).toBe(2)
    expect(deleted).toEqual(['safety-monitor-v177', 'other'])
    expect(app.win.localStorage.getItem('safety_data_v93')).toBe('{"x":1}')
    expect(app.win.localStorage.getItem('nm_reports')).toBe('[]')
  })

  it('isNewerVersion は数字で比べる', () => {
    app = loadApp()
    const { isNewerVersion } = app.win
    expect(isNewerVersion('v179', 'v178')).toBe(true)
    expect(isNewerVersion('v178', 'v178')).toBe(false)
    expect(isNewerVersion('v1000', 'v999')).toBe(true)
    expect(isNewerVersion('v177', 'v178')).toBe(false)
  })
})

describe('版の番号', () => {
  it('index.html・version.json・sw.js の版がそろっている', async () => {
    const { readFileSync } = await import('node:fs')
    app = loadApp()
    const v = app.get('APP_VERSION')
    const json = JSON.parse(readFileSync(new URL('../version.json', import.meta.url), 'utf8'))
    const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8')
    expect(json.version).toBe(v)
    expect(sw).toContain(`const VERSION = '${v}'`)
  })
})
