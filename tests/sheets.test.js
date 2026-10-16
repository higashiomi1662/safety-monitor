// 入力シート（モーダル）の共通動作と、点検・巡視・ヒヤリ報告シートの入力部品のテスト
import { describe, it, expect, afterEach } from 'vitest'
import { loadApp, readIndexHtml } from './helpers/loadApp.js'

let app
afterEach(() => app?.close())

const SHEETS = ['nm-modal', 'insp-modal', 'patrol-modal', 'training-modal', 'improvement-modal', 'roster-modal',
  'excel-panel', 'drive-panel', 'qr-modal', 'legal-pdf-modal']

const isOpen = (doc, id) => doc.getElementById(id).classList.contains('is-open')
const pressEsc = (win) => win.document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

// setInterval の呼び出し（間隔）を記録する
const recordIntervals = (win) => {
  win.__intervals = []
  const orig = win.setInterval.bind(win)
  win.setInterval = (fn, ms, ...rest) => {
    win.__intervals.push(ms)
    return orig(fn, ms, ...rest)
  }
}

// 点検項目つきの設備を用意して詳細を開く
const openInspWith = (win, daily = ['ブレーキ', '異音'], monthly = ['ボルト']) => {
  const D = win.eval('D')
  D.inspections[0].dailyCheckpoints = daily
  D.inspections[0].monthlyCheckpoints = monthly
  win.openInspSelect('daily')
  win.openInspDetail(0)
  return win.document
}

describe('シートの枠', () => {
  it.each(SHEETS)('%s は dialog として名前を持つ', (id) => {
    app = loadApp()
    const el = app.doc.getElementById(id)
    expect(el.classList.contains('sheet')).toBe(true)
    expect(el.getAttribute('role')).toBe('dialog')
    expect(el.getAttribute('aria-modal')).toBe('true')
    const label = app.doc.getElementById(el.getAttribute('aria-labelledby'))
    expect(label).not.toBeNull()
    expect(label.textContent.trim()).not.toBe('')
    // 外枠のインライン style（display 等）は持たない
    expect(el.getAttribute('style') ?? '').toBe('')
  })

  it('CSS は #app-ui の直後の <style id="ui-sheets"> にある', () => {
    app = loadApp()
    const appUi = app.doc.getElementById('app-ui')
    const sheets = app.doc.getElementById('ui-sheets')
    expect(sheets).not.toBeNull()
    expect(sheets.parentElement.tagName).toBe('HEAD')
    expect(appUi.nextElementSibling).toBe(sheets)
  })

  it('モーダルを style.display で直接開閉しない', () => {
    const html = readIndexHtml()
    for (const id of SHEETS) {
      expect(html).not.toMatch(new RegExp(`getElementById\\('${id}'\\)\\.style\\.display`))
    }
  })

  it('各シートに × 閉じるボタンがある', () => {
    app = loadApp()
    for (const id of SHEETS) {
      const btn = app.doc.querySelector(`#${id} .sheet-close`)
      expect(btn, id).not.toBeNull()
      expect(btn.getAttribute('aria-label')).toBe('閉じる')
    }
  })
})

describe('openSheet / closeSheet', () => {
  it('openNM で .is-open と body.sheet-open が付き、closeNM で外れる', () => {
    app = loadApp()
    const { win, doc } = app
    win.openNM()
    expect(isOpen(doc, 'nm-modal')).toBe(true)
    expect(doc.body.classList.contains('sheet-open')).toBe(true)
    expect(win.isAnySheetOpen()).toBe(true)
    win.closeNM()
    expect(isOpen(doc, 'nm-modal')).toBe(false)
    expect(doc.body.classList.contains('sheet-open')).toBe(false)
    expect(win.isAnySheetOpen()).toBe(false)
  })

  it.each([
    ['openInspSelect', 'closeInspModal', 'insp-modal'],
    ['openPatrolModal', 'closePatrolModal', 'patrol-modal'],
    ['openTrainingModal', 'closeTrainingModal', 'training-modal'],
    ['openRosterModal', 'closeRosterModal', 'roster-modal'],
    ['openExcelExport', 'closeExcelPanel', 'excel-panel'],
    ['openDrivePanel', 'closeDrivePanel', 'drive-panel'],
    ['openQR', 'closeQR', 'qr-modal'],
  ])('%s / %s で %s が開閉する', (open, close, id) => {
    app = loadApp()
    const { win, doc } = app
    win[open]()
    expect(isOpen(doc, id)).toBe(true)
    expect(win.isAnySheetOpen()).toBe(true)
    win[close]()
    expect(isOpen(doc, id)).toBe(false)
    expect(win.isAnySheetOpen()).toBe(false)
  })

  it('改善報告と PDF 閲覧もシートとして開閉する', () => {
    app = loadApp()
    const { win, doc } = app
    const D = win.eval('D')
    D.patrolReports = [{ id: 'p1', date: '2026-10-01', items: [{ category: '通路', item: '物が置かれている', result: 'ng', comment: '' }] }]
    win.openImprovementModal(0, 0)
    expect(isOpen(doc, 'improvement-modal')).toBe(true)
    win.closeImprovementModal()
    expect(isOpen(doc, 'improvement-modal')).toBe(false)

    D.legalInsp = [{ pdfData: 'data:application/pdf;base64,AAAA', pdfName: 'a.pdf' }]
    win.openLegalPdf('a.pdf', 0)
    expect(isOpen(doc, 'legal-pdf-modal')).toBe(true)
    win.closeLegalPdf()
    expect(isOpen(doc, 'legal-pdf-modal')).toBe(false)
  })

  it('Esc で閉じる', () => {
    app = loadApp()
    const { win, doc } = app
    win.openNM()
    expect(isOpen(doc, 'nm-modal')).toBe(true)
    pressEsc(win)
    expect(isOpen(doc, 'nm-modal')).toBe(false)
    expect(doc.body.classList.contains('sheet-open')).toBe(false)
  })

  it('重なっているときは Esc で一番上のシートだけ閉じる', () => {
    app = loadApp()
    const { win, doc } = app
    win.openDrivePanel()
    win.openQR()
    pressEsc(win)
    expect(isOpen(doc, 'qr-modal')).toBe(false)
    expect(isOpen(doc, 'drive-panel')).toBe(true)
    expect(doc.body.classList.contains('sheet-open')).toBe(true)
  })

  it('開くとシート内へフォーカスが移り、閉じると元のボタンに戻る', () => {
    app = loadApp()
    const { win, doc } = app
    const opener = doc.createElement('button')
    opener.textContent = '報告'
    doc.body.appendChild(opener)
    opener.focus()
    win.openNM()
    const modal = doc.getElementById('nm-modal')
    expect(modal.contains(doc.activeElement)).toBe(true)
    win.closeNM()
    expect(doc.activeElement).toBe(opener)
  })

  it('掲示モード：開いている間は自動送りを止め、閉じたら再開する（固定していないとき）', () => {
    app = loadApp({ search: '?kiosk=1', beforeParse: recordIntervals })
    const { win } = app
    const slideMs = app.get('D').slidesec * 1000
    if (app.get('isPinned')) win.togglePin()
    let cleared = 0
    const origClear = win.clearInterval.bind(win)
    win.clearInterval = (t) => { cleared++; return origClear(t) }
    win.openPatrolModal()
    expect(cleared).toBeGreaterThan(0)
    win.__intervals.length = 0
    win.closePatrolModal()
    expect(win.__intervals).toContain(slideMs)
  })

  it('掲示モードで固定中は、シートを閉じても自動送りしない', () => {
    app = loadApp({ search: '?kiosk=1', beforeParse: recordIntervals })
    const { win } = app
    const slideMs = app.get('D').slidesec * 1000
    if (!app.get('isPinned')) win.togglePin()
    win.openInspSelect('daily')
    win.__intervals.length = 0
    win.closeInspModal()
    expect(win.__intervals).not.toContain(slideMs)
  })
})

describe('設備点検シート', () => {
  it('設備選択は 1 行 1 ボタンで、状態を chip で表す（色の直書きなし）', () => {
    app = loadApp()
    const { win, doc } = app
    win.openInspSelect('daily')
    const list = doc.getElementById('insp-select-list')
    const rows = list.querySelectorAll('button.sheet-list-row')
    expect(rows.length).toBe(win.eval('D').inspections.length)
    expect(rows[0].querySelector('.chip')).not.toBeNull()
    expect(list.innerHTML).not.toMatch(/#128A3E|#B45309|#0B63CE/i)
  })

  it('点検項目のボタンに aria-pressed が付き、押すと切り替わる', () => {
    app = loadApp()
    const { win } = app
    const doc = openInspWith(win)
    const ok = doc.getElementById('daily-cpok-0')
    const ng = doc.getElementById('daily-cpng-0')
    expect(ok.getAttribute('aria-pressed')).toBe('false')
    expect(ng.getAttribute('aria-pressed')).toBe('false')
    ok.click()
    expect(ok.getAttribute('aria-pressed')).toBe('true')
    expect(ng.getAttribute('aria-pressed')).toBe('false')
    ng.click()
    expect(ok.getAttribute('aria-pressed')).toBe('false')
    expect(ng.getAttribute('aria-pressed')).toBe('true')
  })

  it('異常を選ぶとコメント欄が出て、行に印が付く', () => {
    app = loadApp()
    const { win } = app
    const doc = openInspWith(win)
    expect(doc.getElementById('insp-abn-section').classList.contains('show')).toBe(false)
    doc.getElementById('daily-cpng-1').click()
    expect(doc.getElementById('insp-abn-section').classList.contains('show')).toBe(true)
    expect(doc.getElementById('insp-cp-daily-row-1').classList.contains('is-ng')).toBe(true)
    doc.getElementById('daily-cpok-1').click()
    expect(doc.getElementById('insp-abn-section').classList.contains('show')).toBe(false)
    expect(doc.getElementById('insp-cp-daily-row-1').classList.contains('is-ng')).toBe(false)
  })

  it('始業前／月次はタブで切り替え、aria-selected で示す', () => {
    app = loadApp()
    const { win } = app
    const doc = openInspWith(win)
    const tabD = doc.getElementById('insp-tab-daily')
    const tabM = doc.getElementById('insp-tab-monthly')
    expect(tabD.getAttribute('role')).toBe('tab')
    expect(tabD.getAttribute('aria-selected')).toBe('true')
    win.switchInspTab('monthly')
    expect(tabD.getAttribute('aria-selected')).toBe('false')
    expect(tabM.getAttribute('aria-selected')).toBe('true')
    expect(tabM.getAttribute('style') ?? '').not.toMatch(/background/)
  })

  it('3S チェックのボタンも aria-pressed で切り替わり、開き直すと戻る', () => {
    app = loadApp()
    const { win } = app
    const doc = openInspWith(win)
    const ng = doc.getElementById('3sng-0')
    ng.click()
    expect(ng.getAttribute('aria-pressed')).toBe('true')
    win.openInspDetail(0)
    expect(doc.getElementById('3sng-0').getAttribute('aria-pressed')).toBe('false')
  })

  it('詳細を開くと詳細の見出し、戻ると設備選択の見出しへフォーカスが移る', () => {
    app = loadApp()
    const { win } = app
    const doc = openInspWith(win)
    expect(doc.activeElement.id).toBe('insp-detail-title')
    expect(doc.getElementById('insp-modal').getAttribute('aria-labelledby')).toBe('insp-detail-title')
    win.backToInspSelect()
    expect(doc.activeElement.id).toBe('insp-sheet-title')
    expect(doc.getElementById('insp-modal').getAttribute('aria-labelledby')).toBe('insp-sheet-title')
  })

  it('進み具合（選んだ項目数）をヘッダーに出す', () => {
    app = loadApp()
    const { win } = app
    const doc = openInspWith(win, ['a', 'b', 'c'])
    expect(doc.getElementById('insp-progress').textContent).toBe('0 / 3 項目')
    doc.getElementById('daily-cpok-0').click()
    expect(doc.getElementById('insp-progress').textContent).toBe('1 / 3 項目')
  })

  it('保存内容（点検履歴）は従来どおり', () => {
    app = loadApp()
    const { win } = app
    const doc = openInspWith(win, ['ブレーキ'])
    doc.getElementById('daily-cpok-0').click()
    win.submitInsp()
    const hist = win.eval('D').inspectionHistory.at(-1)
    expect(hist.inspType).toBe('始業前点検')
    expect(hist.items).toEqual([{ label: 'ブレーキ', result: '正常' }])
  })
})

describe('安全巡視シート', () => {
  it('各項目は 良好／指摘／対象外 の 3 ボタンで aria-pressed を持つ', () => {
    app = loadApp()
    const { win, doc } = app
    win.openPatrolModal()
    const row = doc.getElementById('pcp-0')
    const btns = row.querySelectorAll('.patrol-cp-btn')
    expect(btns.length).toBe(3)
    expect([...btns].map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true'])
    btns[1].click()
    expect([...btns].map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false'])
    expect(doc.getElementById('pcp-comment-0').style.display).toBe('block')
  })

  it('保存内容は従来どおり（指摘とコメント）', () => {
    app = loadApp()
    const { win, doc } = app
    win.openPatrolModal()
    doc.querySelector('#pcp-0 .patrol-cp-btn-ng').click()
    doc.querySelector('#pcp-comment-0 input').value = '箱が置いてある'
    win.savePatrol()
    const rep = win.eval('D').patrolReports.at(-1)
    expect(rep.items[0]).toMatchObject({ result: 'ng', comment: '箱が置いてある' })
    expect(rep.items[1].result).toBe('na')
  })

  it('日付・担当者の 2 列はインライン grid ではなくクラスで組む', () => {
    app = loadApp()
    const grid = app.doc.querySelector('#patrol-modal .sheet-grid-2')
    expect(grid).not.toBeNull()
    expect(grid.querySelector('#patrol-date')).not.toBeNull()
    expect(app.doc.querySelector('#patrol-modal [style*="grid-template-columns"]')).toBeNull()
  })
})

describe('ヒヤリハット報告シート', () => {
  it('危険の種類ボタンを押すと select#nm-type の値が変わる', () => {
    app = loadApp()
    const { win, doc } = app
    win.openNM()
    const sel = doc.getElementById('nm-type')
    const btns = doc.querySelectorAll('#nm-type-btns button')
    expect(btns.length).toBe(sel.options.length - 1)
    btns[1].click()
    expect(sel.value).toBe(sel.options[2].value)
    expect(btns[1].getAttribute('aria-pressed')).toBe('true')
    expect(btns[0].getAttribute('aria-pressed')).toBe('false')
  })

  it('select を変えるとボタンの選択も合う。開き直すと未選択に戻る', () => {
    app = loadApp()
    const { win, doc } = app
    win.openNM()
    const sel = doc.getElementById('nm-type')
    sel.selectedIndex = 3
    sel.dispatchEvent(new win.Event('change', { bubbles: true }))
    const btns = doc.querySelectorAll('#nm-type-btns button')
    expect(btns[2].getAttribute('aria-pressed')).toBe('true')
    win.closeNM()
    win.openNM()
    expect([...doc.querySelectorAll('#nm-type-btns button')].every((b) => b.getAttribute('aria-pressed') === 'false')).toBe(true)
  })

  it('写真は「写真を撮る」「アルバムから」の 2 ボタン', () => {
    app = loadApp()
    const labels = [...app.doc.querySelectorAll('#nm-modal .photo-btn')].map((b) => b.textContent.trim())
    expect(labels).toEqual(['写真を撮る', 'アルバムから'])
  })

  it('送信すると報告データは従来の形で保存される', async () => {
    app = loadApp()
    const { win, doc } = app
    win.openNM()
    doc.querySelectorAll('#nm-type-btns button')[0].click()
    doc.getElementById('nm-desc').value = '油で滑りそうになった'
    await win.submitNM()
    const reports = win.getNMReports()
    const r = reports.at(-1)
    expect(r.type).toBe(doc.getElementById('nm-type').options[1].value)
    expect(r.name).toBe('匿名')
    expect(Object.keys(r)).toEqual(expect.arrayContaining(['dt', 'loc', 'name', 'dept', 'type', 'desc', 'comment', 'photos', 'photoUrls', 'submittedAt']))
  })
})

describe('言語切り替え', () => {
  it('ベトナム語にしても、他のシートの保存ボタン・戻るボタンの文字を書き換えない', () => {
    app = loadApp()
    const { win, doc } = app
    const imp = doc.querySelector('#improvement-modal [onclick="saveImprovement()"]').textContent
    const tr = doc.getElementById('tr-save-btn').textContent
    win.toggleLang()
    expect(doc.querySelector('#improvement-modal [onclick="saveImprovement()"]').textContent).toBe(imp)
    expect(doc.getElementById('tr-save-btn').textContent).toBe(tr)
    expect(doc.getElementById('nm-submit-btn').textContent).toContain('Gửi')
  })
})
