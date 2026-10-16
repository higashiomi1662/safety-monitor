import { describe, it, expect, afterEach } from 'vitest'
import { loadApp, readIndexHtml } from './helpers/loadApp.js'

let app
afterEach(() => app?.close())

describe('起動', () => {
  it('起動時にスクリプトエラーが出ない', () => {
    app = loadApp()
    expect(app.errors.map(String)).toEqual([])
  })

  it('HTML の onclick 等から呼ばれる関数がすべて存在する', () => {
    app = loadApp()
    const html = readIndexHtml()
    const names = new Set()
    const re = /\son(?:click|change|input|submit|keydown)="\s*([A-Za-z_$][\w$]*)\s*\(/g
    let m
    while ((m = re.exec(html))) names.add(m[1])
    const ignore = new Set(['if', 'event', 'this', 'document', 'window', 'return', 'location'])
    const missing = [...names].filter((n) => !ignore.has(n) && typeof app.win[n] !== 'function')
    expect(missing).toEqual([])
  })
})
