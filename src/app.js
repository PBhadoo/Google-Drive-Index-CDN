// Redesigned by telegram.dog/TheFirstSpeedster at https://www.npmjs.com/package/@googledrive/index which was written by someone else, credits are given on Source Page.
// v2.5.3 — Classic Design System

// ============================================================================
// FILE TYPE CONSTANTS - Centralized file extension mappings
// ============================================================================
const FILE_TYPES = {
    video:    ['mp4', 'webm', 'avi', 'mpg', 'mpeg', 'mkv', 'rm', 'rmvb', 'mov', 'wmv', 'asf', 'ts', 'flv', '3gp', 'm4v'],
    audio:    ['mp3', 'flac', 'wav', 'ogg', 'm4a', 'aac', 'wma', 'alac'],
    image:    ['bmp', 'jpg', 'jpeg', 'png', 'gif', 'svg', 'tiff', 'ico'],
    code:     ['php', 'css', 'go', 'java', 'js', 'json', 'txt', 'sh', 'html', 'xml', 'py', 'rb', 'c', 'cpp', 'h', 'hpp'],
    archive:  ['zip', 'rar', 'tar', '7z', 'gz'],
    document: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'],
    markdown: ['md']
};

// Google Workspace mimeType → display info + export formats (mirrors worker.js GDOC_EXPORT_FORMATS)
const GDOC_TYPES = {
    'application/vnd.google-apps.document':     { icon: '<i class="bi bi-file-earmark-text gdi-icon-doc"></i>',    name: 'Google Doc',    formats: [{ label: 'PDF', ext: 'pdf' }, { label: 'DOCX', ext: 'docx' }, { label: 'TXT', ext: 'txt' }] },
    'application/vnd.google-apps.spreadsheet':  { icon: '<i class="bi bi-file-earmark-spreadsheet gdi-icon-doc"></i>', name: 'Google Sheet',  formats: [{ label: 'PDF', ext: 'pdf' }, { label: 'XLSX', ext: 'xlsx' }, { label: 'CSV', ext: 'csv' }] },
    'application/vnd.google-apps.presentation': { icon: '<i class="bi bi-file-earmark-slides gdi-icon-doc"></i>',  name: 'Google Slides', formats: [{ label: 'PDF', ext: 'pdf' }, { label: 'PPTX', ext: 'pptx' }] },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
function isFileType(ext, type) {
    return FILE_TYPES[type] && FILE_TYPES[type].includes(ext?.toLowerCase());
}

/**
 * Return an inline Bootstrap-Icons element for the given file extension.
 */
function getFileIcon(ext) {
    const e = ext?.toLowerCase();
    if (isFileType(e, 'video'))   return '<i class="bi bi-camera-video-fill gdi-icon-video"></i>';
    if (isFileType(e, 'audio'))   return '<i class="bi bi-music-note-beamed gdi-icon-audio"></i>';
    if (isFileType(e, 'image'))   return '<i class="bi bi-image gdi-icon-image"></i>';
    if (isFileType(e, 'archive')) return '<i class="bi bi-file-earmark-zip-fill gdi-icon-archive"></i>';
    if (isFileType(e, 'markdown'))return '<i class="bi bi-markdown-fill gdi-icon-md"></i>';
    if (e === 'pdf')              return '<i class="bi bi-file-earmark-pdf-fill gdi-icon-pdf"></i>';
    if (isFileType(e, 'code'))    return '<i class="bi bi-code-slash gdi-icon-code"></i>';
    return '<i class="bi bi-file-earmark gdi-icon-file"></i>';
}

/**
 * Generate breadcrumb navigation links for file-view pages.
 * Returns an array of <li> elements as a string for .gdi-bc lists.
 */
function generateBreadcrumb(path) {
    const parts = path.split('/');
    let html = '';
    let built = '';
    for (let i = 0; i < parts.length; i++) {
        let part = parts[i];
        built += (i === 0 ? '' : '/') + part;
        const isLast = (i === parts.length - 1);
        let decoded;
        try { decoded = decodeURIComponent(part); } catch (_) { decoded = part; }
        const display = decoded || 'Home';
        const label = display.length > 20 ? display.slice(0, 16) + '…' : display;
        if (isLast) {
            html += `<li class="gdi-bc-cur">${escHtml(label)}</li>`;
        } else {
            html += `<li><a href="${built || '/'}">${escHtml(label)}</a></li><li class="gdi-bc-sep">/</li>`;
        }
    }
    return html;
}

// OS detection
const Os = {
    isWindows: navigator.userAgent.toUpperCase().indexOf('WIN') > -1,
    isMac:     navigator.userAgent.toUpperCase().indexOf('MAC') > -1,
    isMacLike: /(Mac|iPhone|iPod|iPad)/i.test(navigator.userAgent),
    isIos:     /(iPhone|iPod|iPad)/i.test(navigator.userAgent),
    isMobile:  /Android|webOS|iPhone|iPad|iPod|iOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
};

function getDocumentHeight() {
    const D = document;
    return Math.max(
        D.body.scrollHeight, D.documentElement.scrollHeight,
        D.body.offsetHeight, D.documentElement.offsetHeight,
        D.body.clientHeight, D.documentElement.clientHeight
    );
}

function getQueryVariable(variable) {
    const query = window.location.search.substring(1);
    const vars = query.split('&');
    for (let i = 0; i < vars.length; i++) {
        const pair = vars[i].split('=');
        if (pair[0] == variable) return pair.slice(1).join('=');
    }
    return false;
}

// HTML-escape a string for safe injection into innerHTML / template literals.
function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

// ============================================================================
// DEBUG PANEL
// ============================================================================
const GDIDebug = (() => {
    const entries = [];
    let _panelEl = null;

    function _ts() { return new Date().toISOString().slice(11, 23); }

    function _render() {
        if (!_panelEl) _panelEl = document.getElementById('gdi-debug-log');
        if (!_panelEl) return;
        const COLORS = { req: '#da77f2', api: '#69db7c', error: '#ff6b6b', warn: '#ffa94d', info: '#74c0fc' };
        const html = entries.map(e => {
            const color = COLORS[e.type] || '#aaa';
            const dataStr = e.data != null
                ? (typeof e.data === 'string' ? e.data : JSON.stringify(e.data, null, 2))
                : '';
            return `<div class="gdi-dbg-entry">` +
                `<span class="gdi-dbg-ts">${e.ts}</span>` +
                `<span class="gdi-dbg-badge" style="color:${color}">[${e.type.toUpperCase()}]</span>` +
                `<span class="gdi-dbg-msg">${escHtml(e.label)}</span>` +
                (dataStr ? `<pre class="gdi-dbg-pre">${escHtml(dataStr)}</pre>` : '') +
                `</div>`;
        }).join('');
        _panelEl.innerHTML = html || '<span class="gdi-dbg-empty">No entries yet.</span>';
        _panelEl.scrollTop = _panelEl.scrollHeight;
        const badge = document.getElementById('gdi-dbg-count');
        if (badge) badge.textContent = entries.length;
    }

    function log(type, label, data) {
        if (!window.UI?.debug_mode) return;
        entries.push({ ts: _ts(), type, label, data: data !== undefined ? data : null });
        _render();
    }

    function attach() {
        _panelEl = document.getElementById('gdi-debug-log');
        const style = document.createElement('style');
        style.textContent = [
            '.gdi-debug-wrap{width:100%;background:#0d1117;border-top:2px solid #f0883e;font-family:monospace;font-size:12px;}',
            '.gdi-debug-head{display:flex;align-items:center;justify-content:space-between;padding:8px 14px;background:#161b22;cursor:pointer;user-select:none;color:#8b949e;}',
            '.gdi-debug-head:hover{background:#1c2128;}',
            '.gdi-debug-head strong{color:#f0f6fc;display:flex;align-items:center;gap:6px;}',
            '.gdi-dbg-count{background:#1f6feb;color:#fff;border-radius:10px;padding:1px 7px;font-size:11px;margin-left:4px;}',
            '.gdi-debug-actions{display:flex;gap:8px;}',
            '.gdi-debug-actions button{background:none;border:1px solid #30363d;color:#8b949e;border-radius:4px;padding:2px 9px;cursor:pointer;font-size:11px;}',
            '.gdi-debug-actions button:hover{background:#1c2128;color:#f0f6fc;}',
            '#gdi-debug-log{max-height:300px;overflow-y:auto;padding:10px 14px;background:#0d1117;color:#e6edf3;}',
            '#gdi-debug-log.collapsed{display:none;}',
            '.gdi-dbg-entry{padding:3px 0;border-bottom:1px solid #21262d;line-height:1.6;}',
            '.gdi-dbg-ts{color:#484f58;margin-right:6px;}',
            '.gdi-dbg-badge{font-weight:bold;margin-right:6px;}',
            '.gdi-dbg-msg{color:#e6edf3;}',
            '.gdi-dbg-pre{margin:2px 0 2px 20px;padding:4px 8px;background:#161b22;border-left:2px solid #30363d;white-space:pre-wrap;word-break:break-all;color:#8b949e;font-size:11px;}',
            '.gdi-dbg-empty{color:#484f58;}'
        ].join('');
        document.head.appendChild(style);
        if (entries.length > 0) _render();
        log('info', 'Debug attached', {
            path: window.location.pathname,
            search: window.location.search,
            drive: window.current_drive_order,
            version: window.UI?.version,
            model_type: window.MODEL?.root_type
        });
    }

    function clear() {
        entries.length = 0;
        if (_panelEl) _panelEl.innerHTML = '<span class="gdi-dbg-empty">Cleared.</span>';
        const badge = document.getElementById('gdi-dbg-count');
        if (badge) badge.textContent = '0';
    }

    return { log, attach, clear };
})();

// Set up global interceptors when debug_mode is on.
// This runs immediately (before init), so fetch calls during startup are captured.
if (window.UI?.debug_mode) {
    const _origFetch = window.fetch.bind(window);
    window.fetch = async function(input, init) {
        const url = typeof input === 'string' ? input : (input.url || String(input));
        const method = (init?.method || 'GET').toUpperCase();
        let body;
        try { body = init?.body ? JSON.parse(init.body) : undefined; } catch (_) { body = init?.body; }
        GDIDebug.log('req', `\u2192 ${method} ${url}`, body !== undefined ? body : null);
        const t0 = Date.now();
        try {
            const res = await _origFetch(input, init);
            const cloned = res.clone();
            let rb; try { rb = await cloned.json(); } catch (_) { rb = null; }
            GDIDebug.log(res.ok ? 'api' : 'error', `\u2190 ${res.status} ${url} (${Date.now() - t0}ms)`, rb);
            return res;
        } catch (err) {
            GDIDebug.log('error', `\u2717 FETCH FAILED: ${url}`, String(err));
            throw err;
        }
    };

    const _origCE = console.error.bind(console);
    console.error = function(...args) {
        GDIDebug.log('error', args.map(a =>
            a instanceof Error ? (a.stack || a.message) : (typeof a === 'object' ? JSON.stringify(a) : String(a))
        ).join(' '));
        _origCE(...args);
    };

    window.addEventListener('error', e => {
        GDIDebug.log('error', `Uncaught: ${e.message}`, `${e.filename}:${e.lineno}:${e.colno}`);
    });
    window.addEventListener('unhandledrejection', e => {
        GDIDebug.log('error', `UnhandledPromise: ${String(e.reason)}`);
    });
}

// Trim a character from both ends of a string
function trimChar(str, char) {
    if (!char) return str.trim();
    return str.replace(new RegExp('^\\' + char + '+|\\' + char + '+$', 'g'), '');
}

// ============================================================================
// THEME SYSTEM
// ============================================================================
function applyTheme(mode) {
    document.documentElement.setAttribute('data-bs-theme', mode);
    const icon = document.getElementById('theme-icon');
    if (icon) icon.className = mode === 'dark' ? 'bi bi-moon-stars' : 'bi bi-sun';
}

function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-bs-theme') || 'dark';
    const next = cur === 'dark' ? 'light' : 'dark';
    localStorage.setItem('gdi-theme', next);
    applyTheme(next);
}

(function initTheme() {
    const saved = localStorage.getItem('gdi-theme') || 'dark';
    applyTheme(saved);
}());

// Sleep for retry logic (non-blocking, promise-based)
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// INIT — builds the page skeleton into <body>
// ============================================================================
function init() {
    document.siteName = $('title').html();
    const html = `
<div id="nav"></div>
<div id="content" style="padding-top:54px;${UI.fixed_footer ? ' padding-bottom:200px;' : ''}"></div>

<!-- Bootstrap Modal for Search Results -->
<div class="modal fade" id="SearchModel" data-bs-backdrop="static" data-bs-keyboard="false" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="SearchModelLabel">Result</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body" id="modal-body-space"></div>
      <div class="modal-footer" id="modal-body-space-buttons"></div>
    </div>
  </div>
</div>

<div id="gdi-toast-container"></div>

${UI.show_quota ? `<div id="gdi-quota-bar" style="padding:6px 16px;background:rgba(0,0,0,0.18);font-size:12px;color:var(--gdi-text-muted,#aaa);display:none;">
  <span id="gdi-quota-text"></span>
  <div style="height:4px;background:rgba(255,255,255,0.12);border-radius:2px;margin-top:4px;"><div id="gdi-quota-fill" style="height:4px;border-radius:2px;width:0%;background:#4caf50;transition:width 0.4s;"></div></div>
</div>` : ''}
<footer class="gdi-footer"${UI.hide_footer ? ' style="display:none;"' : ''}>
  ${UI.credit ? `<span>Redesigned by <a href="https://www.npmjs.com/package/@googledrive/index" target="_blank">TheFirstSpeedster</a></span> &middot; ` : ''}
  <span>&copy; ${UI.copyright_year} <a href="${UI.company_link}" target="_blank">${UI.company_name}</a></span>
</footer>
${UI.debug_mode ? `
<div class="gdi-debug-wrap" id="gdi-debug-wrap">
  <div class="gdi-debug-head" onclick="document.getElementById('gdi-debug-log').classList.toggle('collapsed')">
    <strong><i class="bi bi-bug-fill" style="color:#f0883e;"></i> GDI Debug <span id="gdi-dbg-count" class="gdi-dbg-count">0</span></strong>
    <div class="gdi-debug-actions">
      <button onclick="event.stopPropagation();GDIDebug.clear()">Clear</button>
      <button onclick="event.stopPropagation();document.getElementById('gdi-debug-log').classList.toggle('collapsed')">Toggle</button>
    </div>
  </div>
  <div id="gdi-debug-log" class="collapsed"></div>
</div>` : ''}`;
    $('body').html(html);
}

// ============================================================================
// RENDER TITLE
// ============================================================================
function title(path) {
    path = decodeURI(path);
    const cur = window.current_drive_order || 0;
    const drive_name = window.drive_names[cur];
    path = path.replace(`/${cur}:`, '');
    const model = window.MODEL;
    if (model.is_search_page)
        $('title').html(`${drive_name} - Search: ${model.q}`);
    else
        $('title').html(`${drive_name} - ${path}`);
}

// ============================================================================
// NAV BAR
// ============================================================================
function nav(path) {
    const model = window.MODEL;
    const cur = window.current_drive_order || 0;
    const drive_name = window.drive_names[cur] || 'Drive';
    const names = window.drive_names;
    const search_text = model.is_search_page ? (model.q || '') : '';

    // Drive switcher dropdown items
    let driveItems = '';
    names.forEach((name, idx) => {
        driveItems += `<li><a class="dropdown-item${idx === cur ? ' active' : ''}" href="/${idx}:/">
          <i class="bi bi-folder2-open"></i> ${name}</a></li>`;
    });

    const logoHtml = UI.logo_image
        ? `<img src="${UI.logo_link_name}" alt="${UI.company_name}" height="28">`
        : `<i class="bi bi-cloud-fill"></i> ${UI.logo_link_name}`;

    const searchBar = (model.root_type < 2) ? `
      <div class="gdi-nav-search">
        <form class="gdi-search-form" method="get" action="/${cur}:search">
          <input class="gdi-search-input" name="q" type="search" placeholder="Search files…" value="${search_text}">
          <button class="gdi-search-btn" type="submit"><i class="bi bi-search"></i></button>
        </form>
      </div>` : '';

    const html = `
<nav class="gdi-nav">
  <div class="gdi-nav-inner">
    <a class="gdi-logo" href="/${cur}:/">${logoHtml}</a>
    <div class="gdi-nav-sep"></div>
    ${searchBar}
    <div class="gdi-nav-actions">
      <div class="dropdown">
        <button class="gdi-nav-btn dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
          <i class="bi bi-grid-3x3-gap-fill"></i>
          <span class="d-none d-md-inline">${drive_name}</span>
        </button>
        <ul class="dropdown-menu dropdown-menu-end">${driveItems}</ul>
      </div>
      <div class="gdi-nav-sep"></div>
      <button id="theme-toggle" class="gdi-nav-btn" onclick="toggleTheme()" title="Toggle theme">
        <i class="bi bi-moon-stars" id="theme-icon"></i>
      </button>
      ${UI.show_logout_button ? `<a class="gdi-nav-btn" href="/logout" title="Logout"><i class="bi bi-box-arrow-right"></i></a>` : ''}
    </div>
  </div>
</nav>`;

    $('#nav').html(html);
    // Re-apply theme icon after injecting nav
    applyTheme(localStorage.getItem('gdi-theme') || 'dark');
}

// ============================================================================
// MAIN ROUTER
// ============================================================================
function render(path) {
    if (path.indexOf('?') >= 0) path = path.substr(0, path.indexOf('?'));
    title(path);
    nav(path);

    const reg = /\/\d+:$/g;
    if (path.includes('/fallback')) {
        window.scroll_status = { event_bound: false, loading_lock: false };
        const can_preview = getQueryVariable('a');
        const id = getQueryVariable('id');
        if (can_preview) return fallback(id, true);
        else return list(null, id, true);
    } else if (window.MODEL.is_search_page) {
        window.scroll_status = { event_bound: false, loading_lock: false };
        render_search_result_list();
    } else if (path.match(reg) || path.slice(-1) == '/') {
        window.scroll_status = { event_bound: false, loading_lock: false };
        list(path);
    } else {
        file(path);
    }
}

// ============================================================================
// API REQUESTS
// ============================================================================
function requestListPath(path, params, resultCallback, _unused, retries = 3, fallback = false) {
    const requestData = {
        id:         params['id'] || '',
        type:       'folder',
        password:   params['password'] || '',
        page_token: params['page_token'] || '',
        page_index: params['page_index'] || 0
    };
    const maxRetries = (retries != null && retries >= 0) ? retries : 3;
    $('#update').show();
    document.getElementById('update').innerHTML = `<div class="gdi-alert gdi-alert-info">Connecting…</div>`;
    if (fallback) path = '/0:fallback';

    async function performRequest(remainingRetries) {
        try {
            const r = await fetch(fallback ? '/0:fallback' : path, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData)
            });
            if (!r.ok) throw new Error('Request failed with status ' + r.status);
            const res = await r.json();
            if (res && res.error && res.error.code === 401) {
                $('#update').hide();
                askPassword(path);
            } else if (res && res.data === null) {
                document.getElementById('spinner')?.remove();
                document.getElementById('list').innerHTML = `<div class="gdi-empty"><i class="bi bi-exclamation-circle"></i><p>Server didn't send any data.</p></div>`;
                $('#update').hide();
            } else if (res && res.data) {
                resultCallback(res, path, requestData);
                $('#update').hide();
            }
        } catch (err) {
            if (remainingRetries > 0) {
                document.getElementById('update').innerHTML = `<div class="gdi-alert gdi-alert-info">Retrying… (${remainingRetries} left)</div>`;
                await sleep(2000);
                await performRequest(remainingRetries - 1);
            } else {
                document.getElementById('update').innerHTML = `<div class="gdi-alert gdi-alert-error">Unable to connect. Please try again.</div>`;
                document.getElementById('list').innerHTML = `<div class="gdi-empty"><i class="bi bi-wifi-off"></i><p>${escHtml(String(err))}</p></div>`;
                $('#update').hide();
            }
        }
    }
    performRequest(maxRetries);
}

function requestSearch(params, resultCallback, retries = 3) {
    const p = {
        q:          params['q'] || null,
        page_token: params['page_token'] || null,
        page_index: params['page_index'] || 0
    };

    async function performRequest(remainingRetries) {
        try {
            const r = await fetch(`/${window.current_drive_order}:search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(p)
            });
            if (!r.ok) throw new Error('Request failed with status ' + r.status);
            const res = await r.json();
            if (res && res.data === null) {
                $('#spinner').remove();
                $('#list').html(`<div class="gdi-empty"><i class="bi bi-search"></i><p>No results found.</p></div>`);
                $('#update').remove();
            } else if (res && res.data) {
                if (resultCallback) resultCallback(res, p);
                $('#update').remove();
            }
        } catch (err) {
            if (remainingRetries > 0) {
                $('#update').html(`<div class="gdi-alert gdi-alert-info">Retrying… (${remainingRetries} left)</div>`);
                await sleep(2000);
                await performRequest(remainingRetries - 1);
            } else {
                $('#update').html(`<div class="gdi-alert gdi-alert-error">Unable to connect after ${retries} attempts.</div>`);
                $('#list').html(`<div class="gdi-empty"><i class="bi bi-wifi-off"></i><p>Connection failed.</p></div>`);
                $('#spinner').remove();
            }
        }
    }

    $('#update').html(`<div class="gdi-alert gdi-alert-info">Searching…</div>`);
    performRequest(retries);
}

// ============================================================================
// FILE LIST VIEW
// ============================================================================
function list(path, id = '', fallback = false) {
    const navfulllink = window.location.pathname;
    const navarray = trimChar(navfulllink, '/').split('/');
    let currentPath = '/';

    // Build breadcrumb
    let bcItems = `<li><a href="/">Home</a></li><li class="gdi-bc-sep">/</li>`;
    if (navarray.length > 1) {
        for (const i in navarray) {
            const pathPart = navarray[i];
            let decodedPart;
            try { decodedPart = decodeURIComponent(pathPart); } catch (_) { decodedPart = pathPart; }
            decodedPart = decodedPart.replace(/\//g, '%2F');
            const label = decodedPart.length > 18 ? decodedPart.slice(0, 14) + '…' : decodedPart;
            currentPath += pathPart + '/';
            if (!label) break;
            const isLast = (Number(i) === navarray.length - 1);
            if (isLast) {
                bcItems += `<li class="gdi-bc-cur">${escHtml(label)}</li>`;
            } else {
                bcItems += `<li><a href="${currentPath}">${escHtml(label)}</a></li><li class="gdi-bc-sep">/</li>`;
            }
        }
    }

    const containerContent = `
<div class="gdi-wrap">
  <div id="update"></div>
  <div id="head_md" class="gdi-panel gdi-markdown" style="display:none;"></div>
  <div id="select_items" class="gdi-select-bar" style="display:none;">
    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
      <input type="checkbox" id="select-all-checkboxes"> Select all
    </label>
    <button id="handle-multiple-items-copy" class="gdi-btn gdi-btn-ghost">
      <i class="bi bi-clipboard"></i> Copy selected
    </button>
  </div>
  <div class="gdi-breadcrumb-wrap">
    <ol class="gdi-bc" id="folderne">${bcItems}</ol>
  </div>
  <div class="gdi-panel">
    <div class="gdi-toolbar">
      <input id="folder-filter" class="gdi-filter-input" type="search" placeholder="Filter files…" autocomplete="off">
    </div>
    <div class="gdi-list-header" id="list-header">
      <span class="gdi-col-name gdi-sort-header" data-sort="name">Name</span>
      <span class="gdi-col-size gdi-sort-header" data-sort="size">Size</span>
      <span class="gdi-col-date gdi-sort-header" data-sort="date">Modified</span>
      <span class="gdi-col-acts"></span>
    </div>
    <div id="list"></div>
    <div id="count" class="gdi-count-bar"></div>
  </div>
  <div id="readme_md" class="gdi-panel gdi-markdown" style="display:none;"></div>
</div>`;

    $('#content').html(containerContent);

    const password = localStorage.getItem('password' + path);

    $('#list').html(`<div class="gdi-spinner-wrap" id="spinner"><div class="gdi-spinner"></div></div>`);
    $('#readme_md').hide().html('');
    $('#head_md').hide().html('');

    function handleSuccessResult(res, path, prevReqParams) {
        $('#list')
            .data('nextPageToken', res['nextPageToken'])
            .data('curPageIndex', res['curPageIndex']);
        $('#spinner').remove();

        if (res['nextPageToken'] === null) {
            $(window).off('scroll');
            window.scroll_status.event_bound = false;
            window.scroll_status.loading_lock = false;
            if (fallback) append_files_to_fallback_list(path, res['data']['files']);
            else          append_files_to_list(path, res['data']['files']);
        } else {
            if (fallback) append_files_to_fallback_list(path, res['data']['files']);
            else          append_files_to_list(path, res['data']['files']);
            if (window.scroll_status.event_bound !== true) {
                $(window).on('scroll', function() {
                    if ($(this).scrollTop() + $(this).height() > getDocumentHeight() - (Os.isMobile ? 130 : 80)) {
                        if (window.scroll_status.loading_lock === true) return;
                        window.scroll_status.loading_lock = true;
                        $(`<div id="spinner" class="gdi-spinner-wrap"><div class="gdi-spinner"></div></div>`).insertBefore('#readme_md');
                        const $list = $('#list');
                        if (fallback) {
                            requestListPath(path, {
                                id, password: prevReqParams['password'],
                                page_token: $list.data('nextPageToken'),
                                page_index: $list.data('curPageIndex') + 1
                            }, handleSuccessResult, null, 5, true);
                        } else {
                            requestListPath(path, {
                                password: prevReqParams['password'],
                                page_token: $list.data('nextPageToken'),
                                page_index: $list.data('curPageIndex') + 1
                            }, handleSuccessResult, null);
                        }
                    }
                });
                window.scroll_status.event_bound = true;
            }
        }
        if (window.scroll_status.loading_lock === true) window.scroll_status.loading_lock = false;
    }

    if (fallback) {
        requestListPath(path, { id, password }, handleSuccessResult, null, 3, true);
    } else {
        requestListPath(path, { password }, handleSuccessResult, null);
    }

    // Bulk copy handler
    const copyBtn = document.getElementById('handle-multiple-items-copy');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const checked = document.querySelectorAll('input.gdi-row-check:checked');
            if (!checked.length) { alert('No items selected!'); return; }
            const data = Array.from(checked).map(c => c.value).join('\n');
            navigator.clipboard.writeText(data).catch(() => {
                const ta = document.createElement('textarea');
                ta.value = data;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            });
            showToast(`${checked.length} link${checked.length > 1 ? 's' : ''} copied`);
        });
    }
}

function askPassword(path) {
    $('#spinner').remove();
    const pw = prompt('This folder is password protected. Enter the password:', '');
    if (pw != null && pw != '') {
        localStorage.setItem('password' + path, pw);
        list(path);
    } else {
        history.go(-1);
    }
}

// ============================================================================
// FOLDER FILTER & COLUMN SORT
// ============================================================================
let _folderFilterBound = false;
function initFolderFilter() {
    const input = document.getElementById('folder-filter');
    if (!input || _folderFilterBound) return;
    _folderFilterBound = true;
    input.addEventListener('input', function() {
        const q = this.value.toLowerCase();
        document.querySelectorAll('#list .gdi-row').forEach(el => {
            const name = (el.dataset.name || el.textContent).toLowerCase();
            el.style.display = (!q || name.includes(q)) ? '' : 'none';
        });
    });
}

let _sortState = { col: null, dir: 1 };
function initColumnSort() {
    const headers = document.querySelectorAll('#list-header .gdi-sort-header');
    headers.forEach(header => {
        header.addEventListener('click', function() {
            const col = this.dataset.sort;
            if (_sortState.col === col) _sortState.dir *= -1;
            else { _sortState.col = col; _sortState.dir = 1; }
            headers.forEach(h => h.classList.remove('asc', 'desc'));
            this.classList.add(_sortState.dir === 1 ? 'asc' : 'desc');
            sessionStorage.setItem('gdi-sort', JSON.stringify(_sortState));
            sortFileList(col, _sortState.dir);
        });
    });
    try {
        const saved = JSON.parse(sessionStorage.getItem('gdi-sort'));
        if (saved && saved.col) _sortState = saved;
    } catch (_) {}
}

function sortFileList(col, dir) {
    const $list = $('#list');
    const items = $list.children('.gdi-row').toArray();
    items.sort((a, b) => {
        if (col === 'size') return dir * ((parseFloat($(a).data('bytes')) || 0) - (parseFloat($(b).data('bytes')) || 0));
        if (col === 'date') return dir * (new Date($(a).data('date')) - new Date($(b).data('date')));
        const av = ($(a).data('name') || '').toLowerCase();
        const bv = ($(b).data('name') || '').toLowerCase();
        return dir * av.localeCompare(bv);
    });
    items.forEach(el => $list.append(el));
}

// ============================================================================
// APPEND FILES TO LIST
// ============================================================================
function append_files_to_list(path, files) {
    const $list = $('#list');
    const is_lastpage_loaded = null === $list.data('nextPageToken');
    const is_firstpage = '0' == $list.data('curPageIndex');

    let html = '';
    let totalsize = 0;
    let is_file = false;

    for (const i in files) {
        const item = files[i];
        const ep = encodeURIComponent(item.name).replace(/\//g, '%2F') + '/';
        const p  = path + ep.replace(/#/g, '%23').replace(/\?/g, '%3F');
        item['modifiedTime'] = utc2delhi(item['modifiedTime']);

        if (item['mimeType'] == 'application/vnd.google-apps.folder') {
            html += `<a href="${p}" class="gdi-row countitems" data-name="${escHtml(item.name.toLowerCase())}" data-date="${item['modifiedTime'] || ''}">
  <span class="gdi-row-icon"><i class="bi bi-folder-fill gdi-icon-folder"></i></span>
  <span class="gdi-row-name">${escHtml(item.name)}</span>
  <span class="gdi-row-size"></span>
  <span class="gdi-row-date">${UI.display_time ? item['modifiedTime'] : ''}</span>
  <span class="gdi-row-acts"></span>
</a>`;
        } else {
            const rawSize = Number(item.size);
            totalsize += rawSize;
            item['size'] = formatFileSize(item['size']);
            is_file = true;
            const ext = item.fileExtension;
            const link = UI.second_domain_for_dl ? UI.downloaddomain + item.link : window.location.origin + item.link;
            const encodedName = encodeURIComponent(item.name);
            let pn = path + encodedName + '?a=view';

            const rawFilePath = path + encodedName;
            if (is_lastpage_loaded && item.name == 'README.md' && UI.render_readme_md) {
                get_file(rawFilePath, item, function(data) {
                    markdown('#readme_md', data);
                    $('img').addClass('img-fluid');
                });
            }
            if (item.name == 'HEAD.md' && UI.render_head_md) {
                get_file(rawFilePath, item, function(data) {
                    markdown('#head_md', data);
                    $('img').addClass('img-fluid');
                });
            }

            const gdocType = GDOC_TYPES[item.mimeType];
            const rowIcon = gdocType ? gdocType.icon : getFileIcon(ext);
            const exportLinks = gdocType && UI.display_download
                ? gdocType.formats.map(f => `<a class="gdi-act-btn" href="${link}&fmt=${f.ext}" title="Export as ${f.label}" download><span style="font-size:10px;font-weight:600;">${f.label}</span></a>`).join('')
                : '';

            html += `<div class="gdi-row countitems size_items" data-name="${escHtml(item.name.toLowerCase())}" data-bytes="${rawSize}" data-date="${item['modifiedTime'] || ''}">
  ${UI.allow_selecting_files ? `<input class="gdi-row-check" type="checkbox" value="${link}">` : ''}
  <span class="gdi-row-icon">${rowIcon}</span>
  <a class="gdi-row-name" href="${pn}" title="${escHtml(item.name)}" data-size="${UI.display_size ? item['size'] : ''}">${escHtml(item.name)}</a>
  <span class="gdi-row-size">${UI.display_size ? item['size'] : ''}</span>
  <span class="gdi-row-date">${UI.display_time ? item['modifiedTime'] : ''}</span>
  <span class="gdi-row-acts">
    ${UI.allow_selecting_files ? `<button class="gdi-act-btn" onclick="copyShareUrl(this.closest('.gdi-row').querySelector('.gdi-row-name').href)" title="Copy link"><i class="bi bi-link-45deg"></i></button>` : ''}
    ${gdocType ? exportLinks : (UI.display_download ? `<a class="gdi-act-btn" href="${link}" title="Download"><i class="bi bi-download"></i></a>` : '')}
  </span>
</div>`;
        }
    }

    if (is_file && UI.allow_selecting_files) {
        document.getElementById('select_items').style.display = 'flex';
    }

    $list.html(($list.data('curPageIndex') == '0' ? '' : $list.html()) + html);
    _folderFilterBound = false;
    initFolderFilter();
    initColumnSort();

    if (is_lastpage_loaded) {
        const total_size  = formatFileSize(totalsize) || '0 Bytes';
        const total_items = $list.find('.countitems').length;
        const total_files = $list.find('.size_items').length;
        const itemText = total_items === 0 ? 'Empty folder' : `${total_items} item${total_items === 1 ? '' : 's'}`;
        const sizeText = total_files > 0 ? ` &middot; ${total_files} file${total_files === 1 ? '' : 's'}, ${total_size}` : '';
        $('#count').addClass('show').html(itemText + sizeText);
    }
}

// ============================================================================
// FALLBACK LIST (same design)
// ============================================================================
function append_files_to_fallback_list(path, files) {
    try {
        const $list = $('#list');
        const is_lastpage_loaded = null === $list.data('nextPageToken');

        let html = '';
        let totalsize = 0;
        let is_file = false;

        for (const i in files) {
            const item = files[i];
            const p = '/fallback?id=' + encodeURIComponent(item.id);
            item['modifiedTime'] = utc2delhi(item['modifiedTime']);

            if (item['mimeType'] == 'application/vnd.google-apps.folder') {
                html += `<a href="${p}" class="gdi-row countitems" data-name="${escHtml(item.name.toLowerCase())}" data-date="${item['modifiedTime'] || ''}">
  <span class="gdi-row-icon"><i class="bi bi-folder-fill gdi-icon-folder"></i></span>
  <span class="gdi-row-name">${escHtml(item.name)}</span>
  <span class="gdi-row-size"></span>
  <span class="gdi-row-date">${UI.display_time ? item['modifiedTime'] : ''}</span>
  <span class="gdi-row-acts"></span>
</a>`;
            } else {
                const rawSize = Number(item.size);
                totalsize += rawSize;
                item['size'] = formatFileSize(item['size']);
                is_file = true;
                const ext = item.fileExtension;
                const link = UI.second_domain_for_dl ? UI.downloaddomain + item.link : window.location.origin + item.link;
                const pn = p + '&a=view';

                if (is_lastpage_loaded && item.name == 'README.md' && UI.render_readme_md) {
                    get_file(p, item, function(data) {
                        markdown('#readme_md', data);
                        $('img').addClass('img-fluid');
                    });
                }
                if (item.name == 'HEAD.md' && UI.render_head_md) {
                    get_file(p, item, function(data) {
                        markdown('#head_md', data);
                        $('img').addClass('img-fluid');
                    });
                }

                html += `<div class="gdi-row countitems size_items" data-name="${escHtml(item.name.toLowerCase())}" data-bytes="${rawSize}" data-date="${item['modifiedTime'] || ''}">
  ${UI.allow_selecting_files ? `<input class="gdi-row-check" type="checkbox" value="${link}">` : ''}
  <span class="gdi-row-icon">${getFileIcon(ext)}</span>
  <a class="gdi-row-name" href="${pn}" title="${escHtml(item.name)}" data-size="${UI.display_size ? item['size'] : ''}">${escHtml(item.name)}</a>
  <span class="gdi-row-size">${UI.display_size ? item['size'] : ''}</span>
  <span class="gdi-row-date">${UI.display_time ? item['modifiedTime'] : ''}</span>
  <span class="gdi-row-acts">
    ${UI.allow_selecting_files ? `<button class="gdi-act-btn" onclick="copyShareUrl(this.closest('.gdi-row').querySelector('.gdi-row-name').href)" title="Copy link"><i class="bi bi-link-45deg"></i></button>` : ''}
    ${UI.display_download ? `<a class="gdi-act-btn" href="${link}" title="Download"><i class="bi bi-download"></i></a>` : ''}
  </span>
</div>`;
            }
        }

        if (is_file && UI.allow_selecting_files) {
            document.getElementById('select_items').style.display = 'flex';
        }

        $list.html(($list.data('curPageIndex') == '0' ? '' : $list.html()) + html);

        if (is_lastpage_loaded) {
            const total_size  = formatFileSize(totalsize) || '0 Bytes';
            const total_items = $list.find('.countitems').length;
            const total_files = $list.find('.size_items').length;
            const itemText = total_items === 0 ? 'Empty folder' : `${total_items} item${total_items === 1 ? '' : 's'}`;
            const sizeText = total_files > 0 ? ` &middot; ${total_files} file${total_files === 1 ? '' : 's'}, ${total_size}` : '';
            $('#count').addClass('show').html(itemText + sizeText);
        }
    } catch (e) { console.error(e); }
}

// ============================================================================
// SEARCH RESULTS
// ============================================================================
function render_search_result_list() {
    const q = window.MODEL.q || '';
    const content = `
<div class="gdi-wrap">
  <div id="update"></div>
  <div class="gdi-search-header">
    Search results for <span class="gdi-search-query">"${escHtml(q)}"</span>
  </div>
  <div id="select_items" class="gdi-select-bar" style="display:none;">
    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
      <input type="checkbox" id="select-all-checkboxes"> Select all
    </label>
    <button id="handle-multiple-items-copy" class="gdi-btn gdi-btn-ghost">
      <i class="bi bi-clipboard"></i> Copy selected
    </button>
  </div>
  <div class="gdi-panel">
    <div id="list"></div>
    <div id="count" class="gdi-count-bar"></div>
  </div>
  <div id="readme_md" style="display:none;"></div>
</div>`;
    $('#content').html(content);
    $('#list').html(`<div class="gdi-spinner-wrap" id="spinner"><div class="gdi-spinner"></div></div>`);

    function searchSuccessCallback(res, prevReqParams) {
        $('#list').data('nextPageToken', res['nextPageToken']).data('curPageIndex', res['curPageIndex']);
        $('#spinner').remove();

        if (res['nextPageToken'] === null) {
            $(window).off('scroll');
            window.scroll_status.event_bound = false;
            window.scroll_status.loading_lock = false;
            append_search_result_to_list(res['data']['files']);
        } else {
            append_search_result_to_list(res['data']['files']);
            if (window.scroll_status.event_bound !== true) {
                $(window).on('scroll', function() {
                    if ($(this).scrollTop() + $(this).height() > getDocumentHeight() - (Os.isMobile ? 130 : 80)) {
                        if (window.scroll_status.loading_lock === true) return;
                        window.scroll_status.loading_lock = true;
                        $(`<div id="spinner" class="gdi-spinner-wrap"><div class="gdi-spinner"></div></div>`).insertBefore('#count');
                        const $list = $('#list');
                        requestSearch({
                            q,
                            page_token: $list.data('nextPageToken'),
                            page_index: $list.data('curPageIndex') + 1
                        }, searchSuccessCallback);
                    }
                });
                window.scroll_status.event_bound = true;
            }
        }
        if (window.scroll_status.loading_lock === true) window.scroll_status.loading_lock = false;
    }

    requestSearch({ q }, searchSuccessCallback);

    const copyBtn = document.getElementById('handle-multiple-items-copy');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const checked = document.querySelectorAll('input.gdi-row-check:checked');
            if (!checked.length) { alert('No items selected!'); return; }
            const data = Array.from(checked).map(c => c.value).join('\n');
            navigator.clipboard.writeText(data).catch(() => {
                const ta = document.createElement('textarea');
                ta.value = data;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            });
            showToast(`${checked.length} link${checked.length > 1 ? 's' : ''} copied`);
        });
    }
}

function append_search_result_to_list(files) {
    try {
        const $list = $('#list');
        const is_lastpage_loaded = null === $list.data('nextPageToken');

        let html = '';
        let totalsize = 0;
        let is_file = false;

        for (const i in files) {
            const item = files[i];
            if (item['size'] == undefined) item['size'] = '';
            item['modifiedTime'] = utc2delhi(item['modifiedTime']);

            const itemRootIdx = (typeof item['rootIdx'] === 'number') ? item['rootIdx'] : -1;
            if (item['mimeType'] == 'application/vnd.google-apps.folder') {
                html += `<a style="cursor:pointer;" onclick="onSearchResultItemClick('${escHtml(item['id'])}', false, ${itemRootIdx})" data-bs-toggle="modal" data-bs-target="#SearchModel"
  class="gdi-row countitems" data-name="${escHtml(item.name.toLowerCase())}" data-date="${item['modifiedTime'] || ''}">
  <span class="gdi-row-icon"><i class="bi bi-folder-fill gdi-icon-folder"></i></span>
  <span class="gdi-row-name">${escHtml(item.name)}</span>
  <span class="gdi-row-size"></span>
  <span class="gdi-row-date">${UI.display_time ? item['modifiedTime'] : ''}</span>
  <span class="gdi-row-acts"></span>
</a>`;
            } else {
                is_file = true;
                const rawSize = Number(item.size);
                totalsize += rawSize;
                item['size'] = formatFileSize(item['size']);
                const ext = item.fileExtension;
                const link = UI.second_domain_for_dl ? UI.downloaddomain + item.link : window.location.origin + item.link;

                html += `<div class="gdi-row countitems size_items" data-name="${escHtml(item.name.toLowerCase())}" data-bytes="${rawSize}" data-date="${item['modifiedTime'] || ''}">
  ${UI.allow_selecting_files ? `<input class="gdi-row-check" type="checkbox" value="${link}">` : ''}
  <span class="gdi-row-icon">${getFileIcon(ext)}</span>
  <span class="gdi-row-name" onclick="onSearchResultItemClick('${escHtml(item['id'])}', true, ${itemRootIdx})" data-bs-toggle="modal" data-bs-target="#SearchModel" style="cursor:pointer;">${escHtml(item.name)}</span>
  <span class="gdi-row-size">${UI.display_size ? item['size'] : ''}</span>
  <span class="gdi-row-date">${UI.display_time ? item['modifiedTime'] : ''}</span>
  <span class="gdi-row-acts">
    ${UI.display_download ? `<a class="gdi-act-btn" href="${link}" title="Download"><i class="bi bi-download"></i></a>` : ''}
  </span>
</div>`;
            }
        }

        if (is_file && UI.allow_selecting_files) {
            document.getElementById('select_items').style.display = 'flex';
        }

        $list.html(($list.data('curPageIndex') == '0' ? '' : $list.html()) + html);

        if (is_lastpage_loaded) {
            const total_size  = formatFileSize(totalsize) || '0 Bytes';
            const total_items = $list.find('.countitems').length;
            const total_files = $list.find('.size_items').length;
            if (total_items === 0) {
                $('#count').addClass('show').html('No results found');
            } else {
                const itemText = `${total_items} result${total_items === 1 ? '' : 's'}`;
                const sizeText = total_files > 0 ? ` &middot; ${total_size}` : '';
                $('#count').addClass('show').html(itemText + sizeText);
            }
        }
    } catch (e) { console.error(e); }
}

// ============================================================================
// SEARCH RESULT CLICK → PATH RESOLUTION
// ============================================================================
// rootIdx values from worker:
//  >= 0  driveId matches roots[rootIdx] — call that drive's id2path directly
//  -1    My Drive file (no driveId) — call drive 0's id2path to walk folder-root chain
//  -2    in a shared drive that is NOT in roots — skip id2path, go straight to fallback
function onSearchResultItemClick(file_id, can_preview, rootIdx) {
    const fallbackUrl = `/fallback?id=${encodeURIComponent(file_id)}${can_preview ? '&a=view' : ''}`;

    function goFallback() {
        const modalEl = document.getElementById('SearchModel');
        const bsModal = modalEl && window.bootstrap?.Modal?.getInstance(modalEl);
        if (bsModal) bsModal.hide();
        window.location.href = fallbackUrl;
    }

    // rootIdx -2: file is in a shared drive not in roots — no point calling id2path
    if (rootIdx === -2) { goFallback(); return; }

    $('#SearchModelLabel').html('Loading…');
    $('#modal-body-space').html(`<div class="gdi-spinner-wrap"><div class="gdi-spinner"></div></div>`);

    // rootIdx >= 0: use that specific drive; -1: drive 0 walks parent chain for folder roots
    const primaryDrive = rootIdx >= 0 ? rootIdx : 0;

    async function tryResolve() {
        try {
            const r = await fetch(`/${primaryDrive}:id2path`, {
                method: 'POST',
                body: JSON.stringify({ id: file_id }),
                headers: { 'Content-Type': 'application/json' }
            });
            if (r.ok) {
                const obj = await r.json();
                if (obj.path) {
                    const href = obj.path.replace(/#/g, '%23').replace(/\?/g, '%3F');
                    $('#SearchModelLabel').html('Open file');
                    $('#modal-body-space').html(`
                      <a class="gdi-btn gdi-btn-primary me-2" href="${href}${can_preview ? '?a=view' : ''}">Open</a>
                      <a class="gdi-btn gdi-btn-ghost" href="${href}${can_preview ? '?a=view' : ''}" target="_blank">Open in new tab</a>`);
                    return;
                }
            }
        } catch (_) {}

        // Parent chain found no configured root — navigate directly to fallback
        goFallback();
    }

    tryResolve();
}

// ============================================================================
// GET FILE CONTENT (for README/HEAD)
// ============================================================================
function get_file(path, file, callback) {
    const key = 'file_path_' + path + file['modifiedTime'];
    const data = localStorage.getItem(key);
    if (data != undefined) return callback(data);
    $.get(path, function(d) {
        localStorage.setItem(key, d);
        callback(d);
    });
}

// ============================================================================
// FALLBACK FILE VIEW
// ============================================================================
async function fallback(id, type) {
    if (type) {
        const cookie_folder_id = await getCookie('root_id') || '';
        $('#content').html(`<div class="gdi-wrap"><div class="gdi-spinner-wrap" style="height:150px;" id="spinner"><div class="gdi-spinner"></div></div></div>`);
        fetch('/0:fallback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
        })
        .then(r => { if (!r.ok) throw new Error('Request failed'); return r.json(); })
        .then(obj => dispatchFileView(obj, cookie_folder_id))
        .catch(err => { $('#content').html(renderErrorCard(err)); });
    } else {
        return list(id, true);
    }
}

// ============================================================================
// FILE VIEW (?a=view)
// ============================================================================
async function file(path) {
    const cookie_folder_id = await getCookie('root_id') || '';
    $('#content').html(`<div class="gdi-wrap"><div class="gdi-spinner-wrap" style="height:150px;" id="spinner"><div class="gdi-spinner"></div></div></div>`);
    fetch('', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
    })
    .then(r => { if (!r.ok) throw new Error('Request failed'); return r.json(); })
    .then(obj => dispatchFileView(obj, cookie_folder_id))
    .catch(err => { $('#content').html(renderErrorCard(err)); });
}

function dispatchFileView(obj, cookie_folder_id) {
    const mimeType = obj.mimeType;
    const ext = obj.fileExtension;
    if (mimeType === 'application/vnd.google-apps.folder') {
        window.location.href = window.location.pathname + '/';
        return;
    }
    if (!ext && !mimeType) return;
    const name         = obj.name;
    const encoded_name = encodeURIComponent(name);
    const size         = formatFileSize(obj.size);
    const url          = UI.second_domain_for_dl ? UI.downloaddomain + obj.link : window.location.origin + obj.link;
    const file_id      = obj.id;

    if (mimeType && GDOC_TYPES[mimeType]) {
        file_workspace(name, size, mimeType, url);
    } else if (FILE_TYPES.video.includes(ext) || (mimeType && mimeType.includes('video'))) {
        const poster = obj.thumbnailLink ? obj.thumbnailLink.replace('s220', 's0') : UI.poster;
        file_video(name, encoded_name, size, poster, url, mimeType, file_id, cookie_folder_id);
    } else if (FILE_TYPES.audio.includes(ext) || (mimeType && mimeType.includes('audio'))) {
        file_audio(name, encoded_name, size, url, file_id, cookie_folder_id);
    } else if (FILE_TYPES.image.includes(ext) || (mimeType && mimeType.includes('image'))) {
        file_image(name, encoded_name, size, url, file_id, cookie_folder_id);
    } else if (ext === 'pdf' || (mimeType && mimeType.includes('pdf'))) {
        file_pdf(name, encoded_name, size, url, file_id, cookie_folder_id);
    } else if (FILE_TYPES.code.includes(ext)) {
        file_code(name, encoded_name, size, obj.size, url, ext, file_id, cookie_folder_id);
    } else {
        file_others(name, encoded_name, size, url, file_id, cookie_folder_id);
    }
}

// ============================================================================
// SHARED UI HELPERS
// ============================================================================
function renderErrorCard(error) {
    return `<div class="gdi-wrap">
  <div class="gdi-viewer">
    <div class="gdi-viewer-card">
      <div class="gdi-file-header">
        <span class="gdi-file-header-icon"><i class="bi bi-exclamation-triangle-fill" style="color:#dc2626;"></i></span>
        <div class="gdi-file-header-info">
          <div class="gdi-file-header-name">Unable to load file</div>
          <div class="gdi-file-header-meta">${escHtml(String(error))}</div>
        </div>
      </div>
      <div class="gdi-viewer-footer">
        <a href="/" class="gdi-btn gdi-btn-primary"><i class="bi bi-house"></i> Home</a>
        <a href="javascript:history.back()" class="gdi-btn gdi-btn-ghost ms-2"><i class="bi bi-arrow-left"></i> Back</a>
      </div>
    </div>
  </div>
</div>`;
}

/**
 * Render the download URL bar + download/open-in-app buttons.
 */
function renderDownloadButtons(url, encoded_name, opts = {}) {
    const url_base64 = btoa(url);
    const mediaItems = opts.showMedia ? `
      <li><a class="dropdown-item" href="iina://weblink?url=${url}"><i class="bi bi-play-circle me-2"></i>IINA</a></li>
      <li><a class="dropdown-item" href="potplayer://${url}"><i class="bi bi-play-circle me-2"></i>PotPlayer</a></li>
      <li><a class="dropdown-item" href="vlc://${url}"><i class="bi bi-play-circle me-2"></i>VLC Mobile</a></li>
      <li><a class="dropdown-item" href="${url}"><i class="bi bi-play-circle me-2"></i>VLC Desktop</a></li>
      <li><a class="dropdown-item" href="nplayer-${url}"><i class="bi bi-play-circle me-2"></i>nPlayer</a></li>
      <li><a class="dropdown-item" href="intent://${url}#Intent;type=video/any;package=is.xyz.mpv;scheme=https;end;"><i class="bi bi-play-circle me-2"></i>mpv Android</a></li>
      <li><a class="dropdown-item" href="mpv://${url_base64}"><i class="bi bi-play-circle me-2"></i>mpv x64</a></li>
      <li><a class="dropdown-item" href="intent:${url}#Intent;package=com.mxtech.videoplayer.ad;S.title=${encoded_name};end"><i class="bi bi-play-circle me-2"></i>MX Player (Free)</a></li>
      <li><a class="dropdown-item" href="intent:${url}#Intent;package=com.mxtech.videoplayer.pro;S.title=${encoded_name};end"><i class="bi bi-play-circle me-2"></i>MX Player (Pro)</a></li>
      <li><hr class="dropdown-divider"></li>` : '';

    return `<div class="gdi-dl-wrap">
  <div class="gdi-dl-url-row">
    <span class="gdi-dl-url-text" id="dlurl" title="${escHtml(url)}">${escHtml(url)}</span>
    <button class="gdi-btn gdi-btn-ghost gdi-btn-icon" type="button" onclick="copyShareUrl(${escHtml(JSON.stringify(url))})" title="Copy URL"><i class="bi bi-clipboard"></i></button>
  </div>
  <div class="gdi-dl-actions">
    <a href="${url}" class="gdi-btn gdi-btn-primary"><i class="bi bi-download"></i> Download</a>
    <div class="dropdown">
      <button type="button" class="gdi-btn gdi-btn-ghost gdi-btn-icon dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false" title="More options"><i class="bi bi-three-dots-vertical"></i></button>
      <ul class="dropdown-menu">
        ${mediaItems}
        <li><a class="dropdown-item" href="intent:${url}#Intent;component=idm.internet.download.manager/idm.internet.download.manager.Downloader;S.title=${encoded_name};end"><i class="bi bi-cloud-download me-2"></i>1DM Free</a></li>
        <li><a class="dropdown-item" href="intent:${url}#Intent;component=idm.internet.download.manager.adm.lite/idm.internet.download.manager.Downloader;S.title=${encoded_name};end"><i class="bi bi-cloud-download me-2"></i>1DM Lite</a></li>
        <li><a class="dropdown-item" href="intent:${url}#Intent;component=idm.internet.download.manager.plus/idm.internet.download.manager.Downloader;S.title=${encoded_name};end"><i class="bi bi-cloud-download me-2"></i>1DM+ Plus</a></li>
      </ul>
    </div>
  </div>
</div>`;
}

// ============================================================================
// COPY + TOAST
// ============================================================================
function copyShareUrl(url) {
    navigator.clipboard.writeText(url)
        .then(() => showToast('Link copied!'))
        .catch(() => {
            const ta = document.createElement('textarea');
            ta.value = url;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            showToast('Link copied!');
        });
}

function showToast(message) {
    let container = document.getElementById('gdi-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'gdi-toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'gdi-toast';
    toast.innerHTML = `<i class="bi bi-check-circle-fill"></i> ${message}`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('gdi-toast-out');
        setTimeout(() => toast.remove(), 200);
    }, 2400);
}

// ============================================================================
// FILE VIEWER — viewer card helper
// ============================================================================
function _viewerBreadcrumb() {
    return generateBreadcrumb(window.location.pathname);
}

function _viewerCard(iconHtml, name, size, bodyHtml, footerHtml) {
    return `<div class="gdi-wrap">
  <div class="gdi-viewer">
    <div class="gdi-breadcrumb-wrap">
      <ol class="gdi-bc">${_viewerBreadcrumb()}</ol>
    </div>
    <div class="gdi-viewer-card">
      <div class="gdi-file-header">
        <span class="gdi-file-header-icon">${iconHtml}</span>
        <div class="gdi-file-header-info">
          <div class="gdi-file-header-name">${escHtml(name)}</div>
          <div class="gdi-file-header-meta">${escHtml(size)}</div>
        </div>
      </div>
      <div class="gdi-viewer-body">${bodyHtml}</div>
      ${footerHtml ? `<div class="gdi-viewer-footer">${footerHtml}</div>` : ''}
    </div>
  </div>
</div>`;
}

// ============================================================================
// FILE VIEWER — Generic
// ============================================================================
function file_others(name, encoded_name, size, url, file_id, cookie_folder_id) {
    const icon = getFileIcon(name.split('.').pop());
    $('#content').html(_viewerCard(
        icon, name, size,
        `<p class="mb-3" style="color:var(--gdi-text-muted);font-size:13px;">No preview available for this file type.</p>`,
        renderDownloadButtons(url, encoded_name)
    ));
}

// ============================================================================
// FILE VIEWER — Google Workspace (Docs / Sheets / Slides)
// ============================================================================
function file_workspace(name, size, mimeType, baseLink) {
    const gdoc = GDOC_TYPES[mimeType];
    const icon = gdoc ? gdoc.icon : '<i class="bi bi-file-earmark-text"></i>';
    const typeName = gdoc ? gdoc.name : 'Workspace File';
    const formats = gdoc ? gdoc.formats : [];

    const btns = formats.map(f =>
        `<a class="btn btn-sm btn-outline-secondary me-2 mb-2" href="${baseLink}&fmt=${f.ext}" download="${escHtml(name)}.${f.ext}">
           <i class="bi bi-download me-1"></i>${f.label}
         </a>`
    ).join('');

    const bodyHtml = `
      <p style="color:var(--gdi-text-muted);font-size:13px;margin-bottom:12px;">
        This is a <strong>${escHtml(typeName)}</strong>. It cannot be previewed here — choose a format to export and download.
      </p>
      <div>${btns}</div>`;

    $('#content').html(_viewerCard(icon, name, size, bodyHtml, ''));
}

// ============================================================================
// FILE VIEWER — Code
// ============================================================================
function file_code(name, encoded_name, size, bytes, url, ext, file_id, cookie_folder_id) {
    const icon = getFileIcon(ext);
    const bodyHtml = `
    <div id="code_spinner"></div>
    <div class="gdi-code-outer" style="display:none;">
      <pre><code id="editor"></code></pre>
    </div>`;

    $('#content').html(_viewerCard(
        icon, name, size,
        bodyHtml,
        renderDownloadButtons(url, encoded_name)
    ));

    if (!UI.second_domain_for_dl) {
        $('#code_spinner').html(`<div class="gdi-spinner-wrap"><div class="gdi-spinner"></div></div>`);
        if (bytes <= 1024 * 1024 * 2) {
            $.get(url, function(data) {
                $('#editor').html($('<div/>').text(data).html());
                $('#code_spinner').remove();
                $('.gdi-code-outer').show();
            });
        } else {
            $('#code_spinner').remove();
            $('.gdi-code-outer').show();
            $('#editor').html(`<span style="color:var(--gdi-text-muted);">File too large to preview (max 2 MB)</span>`);
        }
    }
}

// ============================================================================
// FILE VIEWER — Video
// ============================================================================
function file_video(name, encoded_name, size, poster, url, mimeType, file_id, cookie_folder_id, subtitles) {
    subtitles = subtitles || [];
    const isHLS = url.includes('.m3u8') || mimeType === 'application/x-mpegURL';
    let playerHtml = '';
    let player_js = '';
    let player_css = '';

    if (!UI.disable_player) {
        if (player_config.player === 'plyr') {
            playerHtml = `<video id="player" playsinline controls data-poster="${poster}">
              <source src="${url}" type="${isHLS ? 'application/x-mpegURL' : 'video/mp4'}">
              ${subtitles.map(s => `<track kind="subtitles" src="${escHtml(s.url)}" label="${escHtml(s.label)}" default>`).join('')}
            </video>`;
            player_js  = 'https://cdn.plyr.io/' + player_config.plyr_io_version + '/plyr.polyfilled.js';
            player_css = 'https://cdn.plyr.io/' + player_config.plyr_io_version + '/plyr.css';
        } else if (player_config.player === 'videojs') {
            playerHtml = `<video id="vplayer" poster="${poster}" class="video-js vjs-default-skin vjs-big-play-centered" controls preload="auto" width="100%" height="100%" data-setup='{"fluid":true}'>
              <source src="${url}" type="${isHLS ? 'application/x-mpegURL' : 'video/mp4'}">
              <source src="${url}" type="video/webm">
              ${subtitles.map(s => `<track kind="subtitles" src="${escHtml(s.url)}" label="${escHtml(s.label)}" default>`).join('')}
            </video>`;
            player_js  = 'https://vjs.zencdn.net/' + player_config.videojs_version + '/video.js';
            player_css = 'https://vjs.zencdn.net/' + player_config.videojs_version + '/video-js.css';
        } else if (player_config.player === 'dplayer') {
            playerHtml = `<div id="player-container"></div>`;
            player_js  = 'https://cdn.jsdelivr.net/npm/dplayer/dist/DPlayer.min.js';
            player_css = 'https://cdn.jsdelivr.net/npm/dplayer/dist/DPlayer.min.css';
        } else if (player_config.player === 'jwplayer') {
            playerHtml = `<div id="player"></div>`;
            player_js  = 'https://content.jwplatform.com/libraries/IDzF9Zmk.js';
        }
    }

    const bodyHtml = `<div class="gdi-player-wrap">${playerHtml}</div>`;
    const footerHtml = UI.disable_video_download ? '' : renderDownloadButtons(url, encoded_name, { showMedia: true });

    $('#content').html(_viewerCard(
        '<i class="bi bi-camera-video-fill gdi-icon-video"></i>',
        name, size, bodyHtml, footerHtml
    ));

    if (player_css) {
        const link = document.createElement('link');
        link.rel = 'stylesheet'; link.href = player_css;
        document.head.appendChild(link);
    }
    if (player_js) {
        const script = document.createElement('script');
        script.src = player_js;
        script.onload = function() {
            if (player_config.player === 'plyr') {
                new Plyr('#player', { keyboard: { focused: true, global: true } });
            } else if (player_config.player === 'videojs') {
                const vjs = videojs('vplayer', {
                    playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2],
                    controlBar: { pictureInPictureToggle: true }
                });
                vjs.ready(function() {
                    this.el().addEventListener('keydown', function(e) {
                        if (e.target.tagName === 'INPUT') return;
                        if (e.key === ' ')          { e.preventDefault(); vjs.paused() ? vjs.play() : vjs.pause(); }
                        else if (e.key === 'f')     vjs.isFullscreen() ? vjs.exitFullscreen() : vjs.requestFullscreen();
                        else if (e.key === 'm')     vjs.muted(!vjs.muted());
                        else if (e.key === 'ArrowRight') vjs.currentTime(vjs.currentTime() + 10);
                        else if (e.key === 'ArrowLeft')  vjs.currentTime(Math.max(0, vjs.currentTime() - 10));
                        else if (e.key === 'ArrowUp')    vjs.volume(Math.min(1, vjs.volume() + 0.1));
                        else if (e.key === 'ArrowDown')  vjs.volume(Math.max(0, vjs.volume() - 0.1));
                    });
                });
            } else if (player_config.player === 'dplayer') {
                new DPlayer({
                    container: document.getElementById('player-container'),
                    screenshot: true,
                    video: { url, pic: poster, type: isHLS ? 'hls' : 'auto' },
                    subtitle: subtitles.length ? { url: subtitles[0].url, type: 'webvtt' } : undefined,
                });
            } else if (player_config.player === 'jwplayer') {
                jwplayer('player').setup({
                    file: url, type: mimeType, autostart: false, image: poster,
                    width: '100%', aspectratio: '16:9', title: name,
                    description: 'Powered by Google Drive Index',
                    tracks: subtitles.map(s => ({ file: s.url, kind: 'captions', label: s.label, default: true })),
                    captions: { color: '#f3f378', fontSize: 14, backgroundOpacity: 50, edgeStyle: 'raised' },
                });
            }
        };
        document.head.appendChild(script);
    }
}

// ============================================================================
// FILE VIEWER — Audio
// ============================================================================
function file_audio(name, encoded_name, size, url, file_id, cookie_folder_id, playlist) {
    playlist = playlist || [{ name, url, cover: UI.audioposter }];
    const bodyHtml = UI.disable_player ? '' : '<div id="aplayer-container" style="max-width:680px;margin:0 auto;"></div>';
    const footerHtml = UI.disable_audio_download ? '' : renderDownloadButtons(url, encoded_name, { showMedia: true });

    $('#content').html(_viewerCard(
        '<i class="bi bi-music-note-beamed gdi-icon-audio"></i>',
        name, size, bodyHtml, footerHtml
    ));

    if (UI.disable_player) return;

    const aplCss = document.createElement('link');
    aplCss.rel = 'stylesheet';
    aplCss.href = 'https://cdn.jsdelivr.net/npm/aplayer@1.10.1/dist/APlayer.min.css';
    document.head.appendChild(aplCss);

    const aplJs = document.createElement('script');
    aplJs.src = 'https://cdn.jsdelivr.net/npm/aplayer@1.10.1/dist/APlayer.min.js';
    aplJs.onload = function() {
        window._gdiAPlayer = new APlayer({
            container: document.getElementById('aplayer-container'),
            mini: false, autoplay: false, theme: '#4d9fec',
            loop: 'all', order: 'list', preload: 'auto', volume: 0.7, listFolded: false,
            audio: playlist,
        });
    };
    document.head.appendChild(aplJs);

    if (playlist.length <= 1) {
        const parentPath = window.location.pathname.split('/').slice(0, -1).join('/') + '/';
        requestListPath(parentPath, {}, function(res) {
            if (!res || !res.data || !res.data.files) return;
            const audioFiles = res.data.files.filter(f => FILE_TYPES.audio.includes(f.fileExtension));
            if (audioFiles.length > 1) {
                const fullPlaylist = audioFiles.map(f => ({
                    name: f.name,
                    url:  UI.second_domain_for_dl ? UI.downloaddomain + f.link : window.location.origin + f.link,
                    cover: UI.audioposter,
                }));
                if (window._gdiAPlayer) window._gdiAPlayer.destroy();
                window._gdiAPlayer = new APlayer({
                    container: document.getElementById('aplayer-container'),
                    mini: false, loop: 'all', order: 'list', preload: 'auto', volume: 0.7,
                    audio: fullPlaylist,
                });
                const currentIdx = fullPlaylist.findIndex(f => f.url === url);
                if (currentIdx > 0) window._gdiAPlayer.list.switch(currentIdx);
            }
        }, null);
    }
}

// ============================================================================
// FILE VIEWER — PDF
// ============================================================================
function file_pdf(name, encoded_name, size, url, file_id, cookie_folder_id) {
    const cardHtml = `<div class="gdi-wrap">
  <div class="gdi-viewer">
    <div class="gdi-breadcrumb-wrap"><ol class="gdi-bc">${_viewerBreadcrumb()}</ol></div>
    <div class="gdi-viewer-card">
      <div class="gdi-file-header">
        <span class="gdi-file-header-icon"><i class="bi bi-file-earmark-pdf-fill gdi-icon-pdf"></i></span>
        <div class="gdi-file-header-info">
          <div class="gdi-file-header-name">${escHtml(name)}</div>
          <div class="gdi-file-header-meta">${escHtml(size)}</div>
        </div>
      </div>
      <div class="gdi-viewer-body no-pad">
        <div class="gdi-pdf-controls">
          <button id="pdf-prev" class="gdi-btn gdi-btn-ghost gdi-btn-icon"><i class="bi bi-chevron-left"></i></button>
          <span style="font-size:13px;color:var(--gdi-text-muted);">Page <span id="pdf-page-num">1</span> / <span id="pdf-page-count">?</span></span>
          <button id="pdf-next" class="gdi-btn gdi-btn-ghost gdi-btn-icon"><i class="bi bi-chevron-right"></i></button>
          <input id="pdf-zoom" type="range" min="50" max="200" value="100" style="width:100px;" title="Zoom">
          <span id="pdf-zoom-val">100%</span>
        </div>
        <div style="padding:16px;">
          <div id="pdf-spinner" class="gdi-spinner-wrap"><div class="gdi-spinner"></div></div>
          <canvas id="pdf-canvas" style="max-width:100%;display:block;margin:auto;"></canvas>
        </div>
      </div>
      <div class="gdi-viewer-footer">${renderDownloadButtons(url, encoded_name)}</div>
    </div>
  </div>
</div>`;
    $('#content').html(cardHtml);

    let pdfDoc = null;
    let currentPage = 1;
    let scale = 1.0;

    function initPdfViewer() {
        const canvas = document.getElementById('pdf-canvas');
        const ctx = canvas.getContext('2d');
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

        function renderPage(num) {
            pdfDoc.getPage(num).then(function(page) {
                const viewport = page.getViewport({ scale });
                canvas.height = viewport.height;
                canvas.width  = viewport.width;
                page.render({ canvasContext: ctx, viewport }).promise.then(function() {
                    $('#pdf-spinner').hide();
                });
                document.getElementById('pdf-page-num').textContent = num;
            });
        }

        pdfjsLib.getDocument(url).promise.then(function(pdf) {
            pdfDoc = pdf;
            document.getElementById('pdf-page-count').textContent = pdf.numPages;
            renderPage(currentPage);
        }).catch(function(err) {
            $('#pdf-spinner').html(`<div class="gdi-alert gdi-alert-error">Could not load PDF: ${err.message}</div>`);
        });

        document.getElementById('pdf-prev').addEventListener('click', function() {
            if (currentPage > 1) { currentPage--; renderPage(currentPage); }
        });
        document.getElementById('pdf-next').addEventListener('click', function() {
            if (pdfDoc && currentPage < pdfDoc.numPages) { currentPage++; renderPage(currentPage); }
        });
        document.getElementById('pdf-zoom').addEventListener('input', function() {
            scale = parseInt(this.value) / 100;
            document.getElementById('pdf-zoom-val').textContent = this.value + '%';
            renderPage(currentPage);
        });
    }

    if (typeof pdfjsLib !== 'undefined') {
        initPdfViewer();
    } else {
        const pdfScript = document.createElement('script');
        pdfScript.src = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
        pdfScript.onload = initPdfViewer;
        pdfScript.onerror = function() {
            $('#pdf-spinner').html('<div class="gdi-alert gdi-alert-error">Failed to load PDF viewer.</div>');
        };
        document.head.appendChild(pdfScript);
    }
}

// ============================================================================
// FILE VIEWER — Image
// ============================================================================
function file_image(name, encoded_name, size, url, file_id, cookie_folder_id) {
    const cardHtml = `<div class="gdi-wrap">
  <div class="gdi-viewer">
    <div class="gdi-breadcrumb-wrap"><ol class="gdi-bc">${_viewerBreadcrumb()}</ol></div>
    <div class="gdi-viewer-card">
      <div class="gdi-file-header">
        <span class="gdi-file-header-icon"><i class="bi bi-image gdi-icon-image"></i></span>
        <div class="gdi-file-header-info">
          <div class="gdi-file-header-name">${escHtml(name)}</div>
          <div class="gdi-file-header-meta">${escHtml(size)}</div>
        </div>
      </div>
      <div class="gdi-viewer-body no-pad">
        <div class="gdi-img-wrap">
          <img src="${url}" alt="${escHtml(name)}" loading="lazy">
        </div>
      </div>
      <div class="gdi-viewer-footer">${renderDownloadButtons(url, encoded_name)}</div>
    </div>
  </div>
</div>`;
    $('#content').html(cardHtml);
}

// ============================================================================
// UTILITIES
// ============================================================================
function formatDateTime(utc_datetime) {
    if (!utc_datetime) return '';
    return new Date(utc_datetime).toLocaleString();
}
const utc2delhi = formatDateTime;

function formatFileSize(bytes) {
    const n = Number(bytes);
    if (isNaN(n) || n < 0)     return '';
    if (n >= 1099511627776)    return (n / 1099511627776).toFixed(2) + ' TB';
    if (n >= 1073741824)       return (n / 1073741824).toFixed(2) + ' GB';
    if (n >= 1048576)          return (n / 1048576).toFixed(2) + ' MB';
    if (n >= 1024)             return (n / 1024).toFixed(2) + ' KB';
    if (n > 1)                 return n + ' bytes';
    if (n === 1)               return '1 byte';
    return '0 bytes';
}

function markdown(el, data) {
    const html = marked.parse(data);
    $(el).show().html(html);
}

async function getCookie(name) {
    const nameEQ = name + '=';
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == ' ') c = c.substring(1);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length);
    }
    return null;
}

// Copy file to user's drive
async function copyFile(driveid) {
    try {
        const copystatus = document.getElementById('copystatus');
        copystatus.innerHTML = `<div class="gdi-alert gdi-alert-info">Processing…</div>`;
        const user_folder_id = document.getElementById('user_folder_id').value;
        if (!user_folder_id) {
            copystatus.innerHTML = `<div class="gdi-alert gdi-alert-error">Empty folder ID</div>`;
            return;
        }
        document.getElementById('spinner').style.display = 'block';
        const cookieExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
        document.cookie = `root_id=${user_folder_id}; expires=${cookieExpiry}; path=/; SameSite=Lax`;
        const time = Math.floor(Date.now() / 1000);
        const response = await fetch('/copy', {
            method: 'POST',
            cache: 'no-cache',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `id=${encodeURIComponent(driveid)}&root_id=${user_folder_id}&resourcekey=null&time=${time}`
        });
        if (response.status === 500) {
            copystatus.innerHTML = `<div class="gdi-alert gdi-alert-error">Unable to copy. Make sure you added the service account to your folder.</div>`;
        } else if (response.status === 401) {
            copystatus.innerHTML = `<div class="gdi-alert gdi-alert-error">Unauthorized</div>`;
        } else if (response.ok) {
            const data = await response.json();
            if (data && data.name) {
                const safeId = encodeURIComponent(data.id);
                const link = `https://drive.google.com/file/d/${safeId}/view?usp=share_link`;
                document.getElementById('copyresult').innerHTML = `
                  <input type="text" id="usercopiedfile" class="form-control mb-2" value="${escHtml(link)}" readonly>
                  <a href="${escHtml(link)}" target="_blank" class="gdi-btn gdi-btn-primary">Open copied file</a>`;
            } else if (data && data.error && data.error.message) {
                copystatus.innerHTML = `<div class="gdi-alert gdi-alert-error">${escHtml(data.error.message)}</div>`;
            } else {
                copystatus.innerHTML = `<div class="gdi-alert gdi-alert-error">Unable to copy file.</div>`;
            }
        } else {
            copystatus.innerHTML = `<div class="gdi-alert gdi-alert-error">Copy failed.</div>`;
        }
        document.getElementById('spinner').style.display = 'none';
    } catch (error) {
        document.getElementById('copystatus').innerHTML = `<div class="gdi-alert gdi-alert-error">Error: ${error}</div>`;
        document.getElementById('spinner').style.display = 'none';
    }
}

// Checkbox select-all via event delegation (single listener, no MutationObserver needed)
document.addEventListener('change', function(e) {
    if (e.target && e.target.id === 'select-all-checkboxes') {
        const checkboxes = document.querySelectorAll('input.gdi-row-check');
        checkboxes.forEach(cb => { cb.checked = e.target.checked; });
    }
});

// Pop-state for back/forward navigation
window.onpopstate = function() {
    render(window.location.pathname);
};

// ============================================================================
// QUOTA DISPLAY
// ============================================================================
function fetchQuota() {
    const cur = window.current_drive_order || 0;
    fetch(`/${cur}:quota`)
        .then(r => { if (!r.ok) throw new Error('quota fetch failed'); return r.json(); })
        .then(data => {
            const q = data.storageQuota;
            if (!q) return;
            const used = Number(q.usage || 0);
            const total = Number(q.limit || 0);
            const bar = document.getElementById('gdi-quota-bar');
            const text = document.getElementById('gdi-quota-text');
            const fill = document.getElementById('gdi-quota-fill');
            if (!bar || !text || !fill) return;
            const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
            const color = pct > 90 ? '#f44336' : pct > 70 ? '#ff9800' : '#4caf50';
            text.textContent = total > 0
                ? `${formatFileSize(used)} used of ${formatFileSize(total)} (${pct.toFixed(1)}%)`
                : `${formatFileSize(used)} used`;
            fill.style.width = pct + '%';
            fill.style.background = color;
            bar.style.display = 'block';
        })
        .catch(() => {});
}

// ============================================================================
// ENTRY POINT
// ============================================================================
$(function() {
    init();
    if (window.UI?.debug_mode) GDIDebug.attach();
    if (window.UI?.show_quota) fetchQuota();
    if (new URLSearchParams(window.location.search).get('embed') === '1') {
        document.body.classList.add('embed-mode');
    }
    render(window.location.pathname);
});
