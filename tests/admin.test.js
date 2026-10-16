// 管理画面（PIN・目次・保存バー・入力欄の並び）のテスト
import { describe, it, expect, afterEach } from 'vitest'
import { createHash } from 'node:crypto'
import { loadApp } from './helpers/loadApp.js'

let app
afterEach(() => app?.close())

const isOpen = (win) => win.isAdminOpen()
const pinDialogOpen = (doc) => !doc.getElementById('pin-dialog').hidden
const sha256 = (s) => createHash('sha256').update(s).digest('hex')

// PIN を設定した状態の localStorage を作る（salt + PIN の SHA-256）
const pinStorage = (pin, salt = 'a1b2c3') => ({
  safety_data_v93: JSON.stringify({ adminPin: { hash: sha256(salt + pin), salt, updatedAt: '2026-10-01T00:00:00Z' } }),
})

describe('PIN のハッシュ', () => {
  it('同じ PIN と salt なら同じ値になり、SHA-256(salt + PIN) の16進文字列', async () => {
    app = loadApp()
    const { win } = app
    const a = await win.adminPinHash('1234', 'salt01')
    const b = await win.adminPinHash('1234', 'salt01')
    expect(a).toBe(b)
    expect(a).toBe(sha256('salt011234'))
    expect(await win.adminPinHash('1234', 'salt02')).not.toBe(a)
  })
})

describe('PIN ロック', () => {
  it('PIN が未設定なら、そのまま管理画面が開く', () => {
    app = loadApp()
    app.win.openAdmin()
    expect(isOpen(app.win)).toBe(true)
    expect(pinDialogOpen(app.doc)).toBe(false)
  })

  it('PIN が設定されていると、管理画面の前に PIN 入力が出る', () => {
    app = loadApp({ localStorage: pinStorage('2580') })
    const { win, doc } = app
    win.openAdmin()
    expect(isOpen(win)).toBe(false)
    expect(pinDialogOpen(doc)).toBe(true)
    expect(doc.querySelectorAll('#pin-dialog .pin-key').length).toBe(12)
    expect(doc.getElementById('pin-dialog').textContent).toContain('ブラウザを閉じるまで聞きません')
    expect(doc.getElementById('pin-dialog').textContent).toContain('5回まちがえると30秒待ち')
  })

  it('正しい PIN をテンキーで入れると開く', async () => {
    app = loadApp({ localStorage: pinStorage('2580') })
    const { win, doc } = app
    win.openAdmin()
    win.pinKey('2')
    win.pinKey('5')
    win.pinKey('8')
    expect(doc.querySelectorAll('#pin-dialog .pin-dot.is-filled').length).toBe(3)
    const result = await win.pinKey('0')
    expect(result).toBe('ok')
    expect(isOpen(win)).toBe(true)
    expect(pinDialogOpen(doc)).toBe(false)
  })

  it('まちがった PIN では開かない', async () => {
    app = loadApp({ localStorage: pinStorage('2580') })
    const { win, doc } = app
    win.openAdmin()
    expect(await win.submitAdminPin('1111')).toBe('ng')
    expect(isOpen(win)).toBe(false)
    expect(pinDialogOpen(doc)).toBe(true)
    expect(doc.getElementById('pin-dialog-msg').textContent).toContain('ちがいます')
  })

  it('キーボードの数字でも入力できる', async () => {
    app = loadApp({ localStorage: pinStorage('2580') })
    const { win, doc } = app
    win.openAdmin()
    for (const key of ['2', '5', '8']) doc.dispatchEvent(new win.KeyboardEvent('keydown', { key }))
    expect(doc.querySelectorAll('#pin-dialog .pin-dot.is-filled').length).toBe(3)
    doc.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Backspace' }))
    expect(doc.querySelectorAll('#pin-dialog .pin-dot.is-filled').length).toBe(2)
  })

  it('5回続けてまちがえると30秒待ちになり、待ちの間は正しい PIN でも開かない', async () => {
    app = loadApp({ localStorage: pinStorage('2580') })
    const { win, doc } = app
    const t0 = Date.parse('2026-10-17T10:00:00+09:00')
    win.openAdmin()
    for (let i = 0; i < 5; i++) expect(await win.submitAdminPin('0000', t0)).toBe('ng')
    expect(win.adminPinLockRemaining(t0 + 10000)).toBe(20)
    expect(await win.submitAdminPin('2580', t0 + 10000)).toBe('locked')
    expect(isOpen(win)).toBe(false)
    expect(doc.getElementById('pin-dialog-msg').textContent).toMatch(/\d+秒/)
    expect(win.adminPinLockRemaining(t0 + 31000)).toBe(0)
    expect(await win.submitAdminPin('2580', t0 + 31000)).toBe('ok')
    expect(isOpen(win)).toBe(true)
  })

  it('一度正しく入れたら、閉じて開き直しても聞かない', async () => {
    app = loadApp({ localStorage: pinStorage('2580') })
    const { win, doc } = app
    win.openAdmin()
    await win.submitAdminPin('2580')
    win.closeAdmin()
    expect(isOpen(win)).toBe(false)
    win.openAdmin()
    expect(isOpen(win)).toBe(true)
    expect(pinDialogOpen(doc)).toBe(false)
  })

  it('sessionStorage を空にする（ブラウザを閉じる）と、また聞く', async () => {
    app = loadApp({ localStorage: pinStorage('2580') })
    const { win, doc } = app
    win.openAdmin()
    await win.submitAdminPin('2580')
    win.closeAdmin()
    win.sessionStorage.clear()
    win.openAdmin()
    expect(isOpen(win)).toBe(false)
    expect(pinDialogOpen(doc)).toBe(true)
  })

  it('やめるを押すと PIN 入力が閉じ、管理画面も開かない', () => {
    app = loadApp({ localStorage: pinStorage('2580') })
    const { win, doc } = app
    win.openAdmin()
    win.cancelAdminPin()
    expect(pinDialogOpen(doc)).toBe(false)
    expect(isOpen(win)).toBe(false)
  })

  it('requireAdminPin は PIN が通ったときだけ処理を続ける（データの書き出し）', async () => {
    app = loadApp({ localStorage: pinStorage('2580') })
    const { win } = app
    let called = 0
    win.requireAdminPin(() => called++)
    expect(called).toBe(0)
    await win.submitAdminPin('2580')
    expect(called).toBe(1)
    win.requireAdminPin(() => called++)
    expect(called).toBe(2)
  })

  it('Firestore の同期が終わるまでは、PIN 未設定と判断せず開かない', async () => {
    let resolveLoad
    const fsData = { adminPin: { hash: sha256('s9' + '2580'), salt: 's9', updatedAt: '' } }
    app = loadApp({
      beforeParse(win) {
        win.FS = {
          fsLoad: () => new Promise((r) => { resolveLoad = r }),
          fsSave: () => Promise.resolve(),
          fsGetNMReports: () => Promise.resolve([]),
        }
        win.FS_READY = true
      },
    })
    const { win, doc } = app
    win.openAdmin()
    expect(isOpen(win)).toBe(false)
    expect(pinDialogOpen(doc)).toBe(false)
    expect(doc.getElementById('save-toast').textContent).toContain('同期中')
    resolveLoad(fsData)
    await new Promise((r) => setTimeout(r, 0))
    win.openAdmin()
    expect(isOpen(win)).toBe(false)
    expect(pinDialogOpen(doc)).toBe(true)
  })

  it('設定節で PIN を設定・変更・解除できる（変更と解除には現在の PIN が必要）', async () => {
    app = loadApp()
    const { win, doc } = app
    win.openAdmin()
    const sec = doc.getElementById('sec-pin')
    expect(sec.textContent).toContain('誤操作防止')
    expect(sec.textContent).toContain('セキュリティ対策ではありません')
    const set = (id, v) => { doc.getElementById(id).value = v }

    set('apin-new', '1357')
    set('apin-new2', '1357')
    expect(await win.adminPinFormSave()).toBe(true)
    expect(win.D.adminPin.hash).toBe(sha256(win.D.adminPin.salt + '1357'))
    expect(win.D.adminPin.salt).toMatch(/^[0-9a-f]{32}$/)
    expect(win.D.adminPin.updatedAt).toBeTruthy()
    // 保存先は localStorage（= Firestore と同じ D）
    expect(JSON.parse(win.localStorage.getItem('safety_data_v93')).adminPin.hash).toBe(win.D.adminPin.hash)

    // 現在の PIN がちがうと変更できない
    set('apin-cur', '0000')
    set('apin-new', '2468')
    set('apin-new2', '2468')
    expect(await win.adminPinFormSave()).toBe(false)
    expect(win.D.adminPin.hash).toBe(sha256(win.D.adminPin.salt + '1357'))

    set('apin-cur', '1357')
    set('apin-new', '2468')
    set('apin-new2', '2468')
    expect(await win.adminPinFormSave()).toBe(true)
    expect(win.D.adminPin.hash).toBe(sha256(win.D.adminPin.salt + '2468'))

    // 確認欄が一致しないと設定しない
    set('apin-cur', '2468')
    set('apin-new', '1111')
    set('apin-new2', '2222')
    expect(await win.adminPinFormSave()).toBe(false)

    set('apin-cur', '9999')
    expect(await win.adminPinFormClear()).toBe(false)
    set('apin-cur', '2468')
    expect(await win.adminPinFormClear()).toBe(true)
    // Firestore の merge 保存でも消えるよう null を保存する
    expect(win.D.adminPin).toBe(null)
    win.closeAdmin()
    win.sessionStorage.clear()
    win.openAdmin()
    expect(isOpen(win)).toBe(true)
  })
})

describe('目次（左ナビ）', () => {
  it('節から自動で作られ、5つのグループに分かれる', () => {
    app = loadApp()
    const { win, doc } = app
    win.openAdmin()
    const groups = [...doc.querySelectorAll('#adm-toc .adm-toc-glabel')].map((g) => g.textContent.trim())
    expect(groups).toEqual(['掲示内容', '点検・記録', '実績数値', 'データ', '設定'])
    const links = doc.querySelectorAll('#adm-toc .adm-toc-link')
    expect(links.length).toBe(doc.querySelectorAll('#admin .adm-section').length)
    const targets = [...links].map((l) => l.dataset.sec)
    for (const id of ['sec-basic', 'sec-goals', 'sec-ra', 'sec-docs', 'sec-backup', 'sec-pin']) expect(targets).toContain(id)
  })

  it('目次を押すと、開いている節は閉じずに開いたまま（トグルしない）', () => {
    app = loadApp()
    const { win, doc } = app
    win.openAdmin()
    const body = doc.getElementById('sec-basic')
    expect(body.classList.contains('hidden')).toBe(false)
    win.openAdmSection('sec-basic')
    win.openAdmSection('sec-basic')
    expect(body.classList.contains('hidden')).toBe(false)
    // 閉じている節は開く
    expect(doc.getElementById('sec-ra').classList.contains('hidden')).toBe(true)
    doc.querySelector('#adm-toc .adm-toc-link[data-sec="sec-ra"]').click()
    expect(doc.getElementById('sec-ra').classList.contains('hidden')).toBe(false)
    expect(doc.querySelector('#adm-toc .adm-toc-link[data-sec="sec-ra"]').getAttribute('aria-current')).toBe('true')
  })

  it('スマホでは一覧から節を選ぶとその節だけを表示し、「一覧」で戻る', () => {
    app = loadApp({ width: 390 })
    const { win, doc } = app
    win.openAdmin()
    const admin = doc.getElementById('admin')
    expect(admin.classList.contains('is-detail')).toBe(false)
    win.openAdmSection('sec-heat')
    expect(admin.classList.contains('is-detail')).toBe(true)
    expect(doc.getElementById('sec-heat').closest('.adm-section').classList.contains('is-current')).toBe(true)
    expect(doc.getElementById('sec-basic').closest('.adm-section').classList.contains('is-current')).toBe(false)
    win.admBackToList()
    expect(admin.classList.contains('is-detail')).toBe(false)
  })
})

describe('ヘッダーと書き出しボタン', () => {
  it('ヘッダーは「管理画面」と「閉じる」だけで、バックアップ類は「データ」グループの節にある', () => {
    app = loadApp()
    const { doc } = app
    const hdr = doc.querySelector('#admin .adm-hdr')
    expect(hdr.querySelector('h1').textContent.trim()).toBe('管理画面')
    expect(hdr.querySelectorAll('button').length).toBe(1)
    expect(hdr.querySelector('button').getAttribute('onclick')).toBe('closeAdmin()')
    const sec = doc.getElementById('sec-backup')
    const onclicks = [...sec.querySelectorAll('[onclick]')].map((b) => b.getAttribute('onclick'))
    expect(onclicks).toEqual(expect.arrayContaining(['exportData()', 'openDrivePanel()', 'openExcelExport()']))
    expect(sec.querySelector('input[type="file"]').getAttribute('onchange')).toBe('importData(event)')
  })
})

describe('保存バー', () => {
  it('入力すると「未保存の変更があります」が出て、保存すると消える', () => {
    app = loadApp()
    const { win, doc } = app
    win.openAdmin()
    const bar = doc.getElementById('adm-savebar')
    expect(bar.classList.contains('is-dirty')).toBe(false)
    const el = doc.getElementById('a-coname')
    el.value = '新しい会社名'
    el.dispatchEvent(new win.Event('input', { bubbles: true }))
    expect(bar.classList.contains('is-dirty')).toBe(true)
    expect(bar.textContent).toContain('未保存の変更があります')
    win.saveAll()
    expect(bar.classList.contains('is-dirty')).toBe(false)
    expect(win.D.coname).toBe('新しい会社名')
  })

  it('「変更を取り消す」で保存前の内容に戻る（行の追加も戻る）', () => {
    app = loadApp()
    const { win, doc } = app
    win.openAdmin()
    const before = doc.getElementById('a-coname').value
    const rows = win.D.orgChart.length
    const el = doc.getElementById('a-coname')
    el.value = 'まちがい'
    el.dispatchEvent(new win.Event('input', { bubbles: true }))
    doc.querySelector('#sec-org button[onclick="addOrgRow()"]').click()
    expect(win.D.orgChart.length).toBe(rows + 1)
    expect(doc.getElementById('adm-savebar').classList.contains('is-dirty')).toBe(true)
    win.admDiscardChanges()
    expect(doc.getElementById('a-coname').value).toBe(before)
    expect(win.D.orgChart.length).toBe(rows)
    expect(doc.getElementById('adm-savebar').classList.contains('is-dirty')).toBe(false)
  })

  it('未保存のまま閉じるときは確認し、やめれば閉じない', () => {
    app = loadApp()
    const { win, doc } = app
    win.openAdmin()
    const el = doc.getElementById('a-title')
    el.value = 'x'
    el.dispatchEvent(new win.Event('input', { bubbles: true }))
    let asked = 0
    win.confirm = () => { asked++; return false }
    win.closeAdmin()
    expect(asked).toBe(1)
    expect(isOpen(win)).toBe(true)
    win.confirm = () => true
    win.closeAdmin()
    expect(isOpen(win)).toBe(false)
  })

  it('変更がなければ確認せずに閉じる', () => {
    app = loadApp()
    const { win } = app
    win.openAdmin()
    let asked = 0
    win.confirm = () => { asked++; return true }
    win.closeAdmin()
    expect(asked).toBe(0)
    expect(isOpen(win)).toBe(false)
  })
})

describe('入力欄の並び', () => {
  it('管理画面の中に grid-template-columns のインライン指定が残っていない', () => {
    app = loadApp()
    const { win, doc } = app
    win.D.legalInsp = [{ equipName: '', type: 'yearly', date: '', nextDate: '', inspector: '', result: 'pass', note: '' }]
    win.D.raItems = [{ theme: 'テスト', reporter: '', deadline: '', step: 1, done: false, doneDate: '' }]
    win.openAdmin()
    const inline = [...doc.querySelectorAll('#admin [style]')].filter((el) => /grid-template-columns/.test(el.getAttribute('style')))
    expect(inline.map((el) => el.outerHTML.slice(0, 80))).toEqual([])
    expect(doc.querySelectorAll('#admin .adm-grid').length).toBeGreaterThan(10)
  })

  it('保存の結果は変わらない（資格・組織図・法令点検の値を読み取れる）', () => {
    app = loadApp()
    const { win, doc } = app
    win.D.legalInsp = [{ equipName: '', type: 'yearly', date: '2026-01-10', nextDate: '', inspector: '業者A', result: 'pass', note: '' }]
    win.openAdmin()
    doc.getElementById('ql-name-0').value = '資格X'
    doc.getElementById('org-role-0').value = '役職Y'
    doc.getElementById('li-inspector-0').value = '業者B'
    win.saveAll()
    expect(win.D.qualifications[0].name).toBe('資格X')
    expect(win.D.orgChart[0].role).toBe('役職Y')
    expect(win.D.legalInsp[0].inspector).toBe('業者B')
    expect(win.D.legalInsp[0].date).toBe('2026-01-10')
  })
})

