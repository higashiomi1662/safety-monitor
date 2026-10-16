// index.html を jsdom で読み込み、グローバル関数をテストできるようにするヘルパー
// type="module" の Firebase と CDN スクリプトは実行されないため、常にオフライン経路で動く
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { webcrypto } from 'node:crypto'
import { JSDOM, VirtualConsole } from 'jsdom'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
let cachedHtml = null

export const readIndexHtml = () => {
  if (cachedHtml === null) cachedHtml = readFileSync(resolve(ROOT, 'index.html'), 'utf8')
  return cachedHtml
}

/**
 * アプリを読み込む
 * @param {object} opts
 * @param {number} [opts.width] matchMedia 判定に使う画面幅
 * @param {string} [opts.hash] 初期 URL のハッシュ
 * @param {string} [opts.search] 初期 URL のクエリ
 * @param {Record<string,string>} [opts.localStorage] 事前に入れておく localStorage
 * @param {Record<string,string>} [opts.sessionStorage] 事前に入れておく sessionStorage
 * @param {(win: any) => void} [opts.beforeParse] 追加の前処理
 */
export const loadApp = (opts = {}) => {
  const errors = []
  const virtualConsole = new VirtualConsole()
  virtualConsole.on('jsdomError', (e) => errors.push(e))
  const width = opts.width ?? 1366
  const url = `https://example.test/safety-monitor/${opts.search ?? ''}${opts.hash ?? ''}`

  const dom = new JSDOM(readIndexHtml(), {
    url,
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(win) {
      win.innerWidth = width
      win.matchMedia = (q) => {
        const max = /max-width:\s*(\d+)px/.exec(q)
        const min = /min-width:\s*(\d+)px/.exec(q)
        let matches = true
        if (max) matches = matches && width <= Number(max[1])
        if (min) matches = matches && width >= Number(min[1])
        return {
          matches,
          media: q,
          addEventListener() {},
          removeEventListener() {},
          addListener() {},
          removeListener() {},
        }
      }
      win.HTMLCanvasElement.prototype.getContext = () => null
      win.alert = () => {}
      win.confirm = () => true
      win.prompt = () => null
      win.scrollTo = () => {}
      win.Element.prototype.scrollIntoView = function () {}
      if (!win.crypto || !win.crypto.subtle) {
        Object.defineProperty(win, 'crypto', { value: webcrypto, configurable: true })
      }
      win.__qrCalls = []
      win.QRCode = function (el, o) {
        win.__qrCalls.push(o)
      }
      win.QRCode.CorrectLevel = { L: 1, M: 0, Q: 3, H: 2 }
      win.fetch = () => Promise.reject(new Error('offline'))
      for (const [k, v] of Object.entries(opts.localStorage ?? {})) win.localStorage.setItem(k, v)
      for (const [k, v] of Object.entries(opts.sessionStorage ?? {})) win.sessionStorage.setItem(k, v)
      win.addEventListener('error', (e) => errors.push(e.error ?? e.message))
      opts.beforeParse?.(win)
    },
  })
  const win = dom.window
  return {
    dom,
    win,
    doc: win.document,
    errors,
    /** トップレベルの const/let を参照する */
    get: (name) => win.eval(name),
    close: () => win.close(),
  }
}
