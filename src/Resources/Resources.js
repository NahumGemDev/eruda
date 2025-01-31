import Tool from '../DevTools/Tool'
import Settings from '../Settings/Settings'
import $ from 'licia/$'
import escape from 'licia/escape'
import isEmpty from 'licia/isEmpty'
import unique from 'licia/unique'
import each from 'licia/each'
import isStr from 'licia/isStr'
import startWith from 'licia/startWith'
import trim from 'licia/trim'
import orientation from 'licia/orientation'
import sameOrigin from 'licia/sameOrigin'
import ajax from 'licia/ajax'
import MutationObserver from 'licia/MutationObserver'
import toArr from 'licia/toArr'
import concat from 'licia/concat'
import isNull from 'licia/isNull'
import lowerCase from 'licia/lowerCase'
import contain from 'licia/contain'
import filter from 'licia/filter'
import map from 'licia/map'
import { safeStorage, isErudaEl, classPrefix as c } from '../lib/util'
import evalCss from '../lib/evalCss'
import chobitsu from '../lib/chobitsu'
import LunaModal from 'luna-modal'

export default class Resources extends Tool {
  constructor() {
    super()

    this._style = evalCss(require('./Resources.scss'))

    this.name = 'resources'
    this._localStoreData = []
    this._localStoreSearchKeyword = ''
    this._hideErudaSetting = false
    this._sessionStoreData = []
    this._sessionStoreSearchKeyword = ''
    this._cookieData = []
    this._cookieSearchKeyword = ''
    this._scriptData = []
    this._stylesheetData = []
    this._iframeData = []
    this._imageData = []
    this._observeElement = true
  }
  init($el, container) {
    super.init($el)

    this._container = container

    this.refresh()
    this._bindEvent()
    this._initObserver()
    this._initCfg()
  }
  refresh() {
    return this.refreshLocalStorage()
      .refreshSessionStorage()
      .refreshCookie()
      .refreshScript()
      .refreshStylesheet()
      .refreshIframe()
      .refreshImage()
      ._render()
  }
  destroy() {
    super.destroy()

    this._disableObserver()
    evalCss.remove(this._style)
    this._rmCfg()
  }
  refreshScript() {
    let scriptData = []

    $('script').each(function () {
      const src = this.src

      if (src !== '') scriptData.push(src)
    })

    scriptData = unique(scriptData)

    this._scriptData = scriptData

    return this
  }
  refreshStylesheet() {
    let stylesheetData = []

    $('link').each(function () {
      if (this.rel !== 'stylesheet') return

      stylesheetData.push(this.href)
    })

    stylesheetData = unique(stylesheetData)

    this._stylesheetData = stylesheetData

    return this
  }
  refreshIframe() {
    let iframeData = []

    $('iframe').each(function () {
      const $this = $(this)
      const src = $this.attr('src')

      if (src) iframeData.push(src)
    })

    iframeData = unique(iframeData)

    this._iframeData = iframeData

    return this
  }
  refreshLocalStorage() {
    this._refreshStorage('local')

    return this
  }
  refreshSessionStorage() {
    this._refreshStorage('session')

    return this
  }
  _refreshStorage(type) {
    let store = safeStorage(type, false)

    if (!store) return

    const storeData = []

    // Mobile safari is not able to loop through localStorage directly.
    store = JSON.parse(JSON.stringify(store))

    each(store, (val, key) => {
      // According to issue 20, not all values are guaranteed to be string.
      if (!isStr(val)) return

      if (this._hideErudaSetting) {
        if (startWith(key, 'eruda') || key === 'active-eruda') return
      }

      storeData.push({
        key: key,
        val: sliceStr(val, 200),
      })
    })

    this['_' + type + 'StoreData'] = storeData
  }
  refreshCookie() {
    const { cookies } = chobitsu.domain('Network').getCookies()
    const cookieData = map(cookies, ({ name, value }) => ({
      key: name,
      val: value,
    }))

    this._cookieData = cookieData

    return this
  }
  refreshImage() {
    let imageData = []

    const performance = (this._performance =
      window.webkitPerformance || window.performance)
    if (performance && performance.getEntries) {
      const entries = this._performance.getEntries()
      entries.forEach((entry) => {
        if (entry.initiatorType === 'img' || isImg(entry.name)) {
          imageData.push(entry.name)
        }
      })
    } else {
      $('img').each(function () {
        const $this = $(this)
        const src = $this.attr('src')

        if ($this.data('exclude') === 'true') return

        imageData.push(src)
      })
    }

    imageData = unique(imageData)
    imageData.sort()
    this._imageData = imageData

    return this
  }
  show() {
    super.show()
    if (this._observeElement) this._enableObserver()

    return this.refresh()
  }
  hide() {
    this._disableObserver()

    return super.hide()
  }
  _bindEvent() {
    const self = this
    const $el = this._$el
    const container = this._container

    $el
      .on('click', '.eruda-refresh-local-storage', () => {
        container.notify('Refreshed')
        this.refreshLocalStorage()._render()
      })
      .on('click', '.eruda-refresh-session-storage', () => {
        container.notify('Refreshed')
        this.refreshSessionStorage()._render()
      })
      .on('click', '.eruda-refresh-cookie', () => {
        container.notify('Refreshed')
        this.refreshCookie()._render()
      })
      .on('click', '.eruda-refresh-script', () => {
        container.notify('Refreshed')
        this.refreshScript()._render()
      })
      .on('click', '.eruda-refresh-stylesheet', () => {
        container.notify('Refreshed')
        this.refreshStylesheet()._render()
      })
      .on('click', '.eruda-refresh-iframe', () => {
        container.notify('Refreshed')
        this.refreshIframe()._render()
      })
      .on('click', '.eruda-refresh-image', () => {
        container.notify('Refreshed')
        this.refreshImage()._render()
      })
      .on('click', '.eruda-search', function () {
        const $this = $(this)
        const type = $this.data('type')

        LunaModal.prompt('Filter').then((filter) => {
          if (isNull(filter)) return
          filter = trim(filter)
          switch (type) {
            case 'local':
              self._localStoreSearchKeyword = filter
              break
            case 'session':
              self._sessionStoreSearchKeyword = filter
              break
            case 'cookie':
              self._cookieSearchKeyword = filter
              break
          }
          self._render()
        })
      })
      .on('click', '.eruda-delete-storage', function () {
        const $this = $(this)
        const key = $this.data('key')
        const type = $this.data('type')

        if (type === 'local') {
          localStorage.removeItem(key)
          self.refreshLocalStorage()._render()
        } else {
          sessionStorage.removeItem(key)
          self.refreshSessionStorage()._render()
        }
      })
      .on('click', '.eruda-delete-cookie', function () {
        const key = $(this).data('key')

        chobitsu.domain('Network').deleteCookies({ name: key })
        self.refreshCookie()._render()
      })
      .on('click', '.eruda-clear-storage', function () {
        const type = $(this).data('type')

        if (type === 'local') {
          each(self._localStoreData, (val) => localStorage.removeItem(val.key))
          self.refreshLocalStorage()._render()
        } else {
          each(self._sessionStoreData, (val) =>
            sessionStorage.removeItem(val.key)
          )
          self.refreshSessionStorage()._render()
        }
      })
      .on('click', '.eruda-clear-cookie', () => {
        chobitsu.domain('Storage').clearDataForOrigin({
          storageTypes: 'cookies',
        })
        this.refreshCookie()._render()
      })
      .on('click', '.eruda-storage-val', function () {
        const $this = $(this)
        const key = $this.data('key')
        const type = $this.data('type')

        const val =
          type === 'local'
            ? localStorage.getItem(key)
            : sessionStorage.getItem(key)

        try {
          showSources('object', JSON.parse(val))
        } catch (e) {
          showSources('raw', val)
        }
      })
      .on('click', '.eruda-img-link', function () {
        const src = $(this).attr('src')

        showSources('img', src)
      })
      .on('click', '.eruda-css-link', linkFactory('css'))
      .on('click', '.eruda-js-link', linkFactory('js'))
      .on('click', '.eruda-iframe-link', linkFactory('iframe'))

    orientation.on('change', () => this._render())

    function showSources(type, data) {
      const sources = container.get('sources')
      if (!sources) return

      sources.set(type, data)

      container.showTool('sources')

      return true
    }

    function linkFactory(type) {
      return function (e) {
        if (!container.get('sources')) return
        e.preventDefault()

        const url = $(this).attr('href')

        if (type === 'iframe' || !sameOrigin(location.href, url)) {
          showSources('iframe', url)
        } else {
          ajax({
            url,
            success: (data) => {
              showSources(type, data)
            },
            dataType: 'raw',
          })
        }
      }
    }
  }
  _rmCfg() {
    const cfg = this.config

    const settings = this._container.get('settings')

    if (!settings) return

    settings
      .remove(cfg, 'hideErudaSetting')
      .remove(cfg, 'observeElement')
      .remove('Resources')
  }
  _initCfg() {
    const cfg = (this.config = Settings.createCfg('resources', {
      hideErudaSetting: true,
      observeElement: true,
    }))

    if (cfg.get('hideErudaSetting')) this._hideErudaSetting = true
    if (!cfg.get('observeElement')) this._observeElement = false

    cfg.on('change', (key, val) => {
      switch (key) {
        case 'hideErudaSetting':
          this._hideErudaSetting = val
          return
        case 'observeElement':
          this._observeElement = val
          return val ? this._enableObserver() : this._disableObserver()
      }
    })

    const settings = this._container.get('settings')
    settings
      .text('Resources')
      .switch(cfg, 'hideErudaSetting', 'Hide Eruda Setting')
      .switch(cfg, 'observeElement', 'Auto Refresh Elements')
      .separator()
  }
  _render() {
    const scriptData = this._scriptData
    const stylesheetData = this._stylesheetData
    const imageData = this._imageData

    const localStoreSearchKeyword = this._localStoreSearchKeyword
    const sessionStoreSearchKeyword = this._sessionStoreSearchKeyword
    const cookieSearchKeyword = this._cookieSearchKeyword

    function filterData(data, keyword) {
      keyword = lowerCase(keyword)

      if (!keyword) return data

      return filter(data, ({ key, val }) => {
        return (
          contain(lowerCase(key), keyword) || contain(lowerCase(val), keyword)
        )
      })
    }

    const localStoreData = filterData(
      this._localStoreData,
      localStoreSearchKeyword
    )
    let localStoreDataHtml = '<tr><td>Empty</td></tr>'
    if (!isEmpty(localStoreData)) {
      localStoreDataHtml = map(localStoreData, ({ key, val }) => {
        key = escape(key)

        return `<tr>
          <td class="${c('key')}">${key}</td>
          <td class="${c(
            'storage-val'
          )}" data-key="${key}" data-type="local">${escape(val)}</td>
          <td class="${c('control')}">
            <span class="${c(
              'icon-delete delete-storage'
            )}" data-key="${key}" data-type="local"></span>
          </td>
        </tr>`
      }).join('')
    }

    const localStorageHtml = `<div class="${c('section local-storage')}">
      <h2 class="${c('title')}">
        Local Storage
        <div class="${c('btn refresh-local-storage')}">
          <span class="${c('icon-refresh')}"></span>
        </div>
        <div class="${c('btn clear-storage')}" data-type="local">
          <span class="${c('icon-clear')}"></span>
        </div>
        <div class="${c('btn search')}" data-type="local">
          <span class="${c('icon-filter')}"></span>
        </div>
        ${
          localStoreSearchKeyword
            ? `<div class="${c('btn search-keyword')}">${escape(
                localStoreSearchKeyword
              )}</div>`
            : ''
        }
      </h2>
      <div class="${c('content')}">
        <table>
          <tbody>
            ${localStoreDataHtml}
          </tbody>
        </table>
      </div>
    </div>`

    const sessionStoreData = filterData(
      this._sessionStoreData,
      sessionStoreSearchKeyword
    )

    let sessionStoreDataHtml = '<tr><td>Empty</td></tr>'
    if (!isEmpty(sessionStoreData)) {
      sessionStoreDataHtml = map(sessionStoreData, ({ key, val }) => {
        key = escape(key)

        return `<tr>
          <td class="${c('key')}">${key}</td>
          <td class="${c(
            'storage-val'
          )}" data-key="${key}" data-type="session">${escape(val)}</td>
          <td class="${c('control')}">
            <span class="${c(
              'icon-delete delete-storage'
            )}" data-key="${key}" data-type="session"></span>
          </td>
        </tr>`
      }).join('')
    }

    const sessionStorageHtml = `<div class="${c('section session-storage')}">
      <h2 class="${c('title')}">
        Session Storage
        <div class="${c('btn refresh-session-storage')}">
          <span class="${c('icon-refresh')}"></span>
        </div>
        <div class="${c('btn clear-storage')}" data-type="session">
          <span class="${c('icon-clear')}"></span>
        </div>
        <div class="${c('btn search')}" data-type="session">
          <span class="${c('icon-filter')}"></span>
        </div>
        ${
          sessionStoreSearchKeyword
            ? `<div class="${c('btn search-keyword')}">${escape(
                sessionStoreSearchKeyword
              )}</div>`
            : ''
        }
      </h2>
      <div class="${c('content')}">
        <table>
          <tbody>
            ${sessionStoreDataHtml}
          </tbody>
        </table>
      </div>
    </div>`

    const cookieData = filterData(this._cookieData, cookieSearchKeyword)
    const cookieState = getState('cookie', this._cookieData.length)

    let cookieDataHtml = '<tr><td>Empty</td></tr>'
    if (!isEmpty(cookieData)) {
      cookieDataHtml = map(cookieData, ({ key, val }) => {
        key = escape(key)

        return `<tr>
          <td class="${c('key')}">${key}</td>
          <td>${escape(val)}</td>
          <td class="${c('control')}">
            <span class="${c(
              'icon-delete delete-cookie'
            )}" data-key="${key}"></span>
          </td>
        </tr>`
      }).join('')
    }

    const cookieHtml = `<div class="${c('section cookie ' + cookieState)}">
      <h2 class="${c('title')}">
        Cookie
        <div class="${c('btn refresh-cookie')}">
          <span class="${c('icon-refresh')}"></span>
        </div>
        <div class="${c('btn clear-cookie')}">
          <span class="${c('icon-clear')}"></span>
        </div>
        <div class="${c('btn search')}" data-type="cookie">
          <span class="${c('icon-filter')}"></span>
        </div>
        ${
          cookieSearchKeyword
            ? `<div class="${c('btn search-keyword')}">${escape(
                cookieSearchKeyword
              )}</div>`
            : ''
        }
      </h2>
      <div class="${c('content')}">
        <table>
          <tbody>
            ${cookieDataHtml}
          </tbody>
        </table>
      </div>
    </div>`

    const scriptState = getState('script', scriptData.length)
    let scriptDataHtml = '<li>Empty</li>'
    if (!isEmpty(scriptData)) {
      scriptDataHtml = map(scriptData, (script) => {
        script = escape(script)
        return `<li><a href="${script}" target="_blank" class="${c(
          'js-link'
        )}">${script}</a></li>`
      }).join('')
    }

    const scriptHtml = `<div class="${c('section script ' + scriptState)}">
      <h2 class="${c('title')}">
        Script
        <div class="${c('btn refresh-script')}">
          <span class="${c('icon-refresh')}"></span>
        </div>
      </h2>
      <ul class="${c('link-list')}">
        ${scriptDataHtml}
      </ul>
    </div>`

    const stylesheetState = getState('stylesheet', stylesheetData.length)
    let stylesheetDataHtml = '<li>Empty</li>'
    if (!stylesheetData) {
      stylesheetDataHtml = map(stylesheetData, (stylesheet) => {
        stylesheet = escape(stylesheet)
        return ` <li><a href="${stylesheet}" target="_blank" class="${c(
          'css-link'
        )}">${stylesheet}</a></li>`
      }).join('')
    }

    const stylesheetHtml = `<div class="${c(
      'section stylesheet ' + stylesheetState
    )}">
      <h2 class="${c('title')}">
        Stylesheet
        <div class="${c('btn refresh-stylesheet')}">
          <span class="${c('icon-refresh')}"></span>
        </div>
      </h2>
      <ul class="${c('link-list')}">
        ${stylesheetDataHtml}
      </ul>
    </div>`

    let iframeDataHtml = '<li>Empty</li>'
    if (!isEmpty(this._iframeData)) {
      iframeDataHtml = map(this._iframeData, (iframe) => {
        iframe = escape(iframe)
        return `<li><a href="${iframe}" target="_blank" class="${c(
          'iframe-link'
        )}">${iframe}</a></li>`
      }).join('')
    }
    const iframeHtml = `<div class=${c('section iframe')}">
      <h2 class="${c('title')}">
        Iframe
        <div class="${c('btn refresh-iframe')}">
          <span class="${c('icon-refresh')}"></span>
        </div>
      </h2>
      <ul class="${c('link-list')}">
        ${iframeDataHtml}
      </ul>
    </div>`

    const imageState = getState('image', imageData.length)
    let imageDataHtml = '<li>Empty</li>'
    if (!isEmpty(imageData)) {
      imageDataHtml = map(imageData, (image) => {
        return `<li class="${c('image')}">
          <img src="${escape(image)}" data-exclude="true" class="${c(
          'img-link'
        )}"/>
        </li>`
      }).join('')
    }

    const imageHtml = `<div class="${c('section image')}">
      <h2 class="${c('title ' + imageState)}">
        Image
        <div class="${c('btn refresh-image')}">
          <span class="${c('icon-refresh')}"></span>
        </div>
      </h2>
      <ul class="${c('image-list')}">
        ${imageDataHtml}
      </ul>
    </div>`

    this._renderHtml(
      [
        localStorageHtml,
        sessionStorageHtml,
        cookieHtml,
        scriptHtml,
        stylesheetHtml,
        iframeHtml,
        imageHtml,
      ].join('')
    )
  }
  _renderHtml(html) {
    if (html === this._lastHtml) return
    this._lastHtml = html
    this._$el.html(html)
  }
  _initObserver() {
    this._observer = new MutationObserver((mutations) => {
      let needToRender = false
      each(mutations, (mutation) => {
        if (this._handleMutation(mutation)) needToRender = true
      })
      if (needToRender) this._render()
    })
  }
  _handleMutation(mutation) {
    if (isErudaEl(mutation.target)) return

    const checkEl = (el) => {
      const tagName = getLowerCaseTagName(el)
      switch (tagName) {
        case 'script':
          this.refreshScript()
          return true
        case 'img':
          this.refreshImage()
          return true
        case 'link':
          this.refreshStylesheet()
          return true
      }

      return false
    }

    if (mutation.type === 'attributes') {
      if (checkEl(mutation.target)) return true
    } else if (mutation.type === 'childList') {
      if (checkEl(mutation.target)) return true
      let nodes = toArr(mutation.addedNodes)
      nodes = concat(nodes, toArr(mutation.removedNodes))

      for (const node of nodes) {
        if (checkEl(node)) return true
      }
    }

    return false
  }
  _enableObserver() {
    this._observer.observe(document.documentElement, {
      attributes: true,
      childList: true,
      subtree: true,
    })
  }
  _disableObserver() {
    this._observer.disconnect()
  }
}

function getState(type, len) {
  if (len === 0) return ''

  let warn = 0
  let danger = 0

  switch (type) {
    case 'cookie':
      warn = 30
      danger = 60
      break
    case 'script':
      warn = 5
      danger = 10
      break
    case 'stylesheet':
      warn = 4
      danger = 8
      break
    case 'image':
      warn = 50
      danger = 100
      break
  }

  if (len >= danger) return 'danger'
  if (len >= warn) return 'warn'

  return 'ok'
}

function getLowerCaseTagName(el) {
  if (!el.tagName) return ''
  return el.tagName.toLowerCase()
}

const sliceStr = (str, len) =>
  str.length < len ? str : str.slice(0, len) + '...'

const regImg = /\.(jpeg|jpg|gif|png)$/

const isImg = (url) => regImg.test(url)
