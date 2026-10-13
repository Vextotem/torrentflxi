// TorrentFlxi browser script: player on demand, my list, trailers, torrent list with filters, subtitles.
(() => {
  'use strict';
  const T = (window.TFX && window.TFX.t) || {};
  const t = key => T[key] || key;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  // ----- player: the iframe loads only when the viewer presses play (no torrent starts for page views) -----
  for (const box of $$('.player[data-embed]')) {
    const start = () => {
      if (box.querySelector('iframe')) return;
      const frame = document.createElement('iframe');
      frame.src = box.dataset.embed;
      frame.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
      frame.allowFullscreen = true;
      frame.referrerPolicy = 'origin';
      frame.title = 'Player';
      box.textContent = '';
      box.appendChild(frame);
    };
    box.addEventListener('click', start);
    if (location.hash === '#watch' && box.closest('#watch')) start();
  }
  for (const link of $$('a[href="#watch"]')) {
    link.addEventListener('click', () => setTimeout(() => $('#watch .player')?.click(), 50));
  }

  // ----- trailer -----
  for (const button of $$('[data-trailer]')) {
    button.addEventListener('click', () => {
      const modal = document.createElement('div');
      modal.className = 'trailer-modal';
      modal.setAttribute('role', 'dialog');
      modal.innerHTML = `<button class="btn" type="button" aria-label="Close">✕</button><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(button.dataset.trailer)}?autoplay=1&rel=0" allow="autoplay; fullscreen; encrypted-media" allowfullscreen title="Trailer"></iframe>`;
      const close = () => { modal.remove(); document.removeEventListener('keydown', onKey); };
      const onKey = event => { if (event.key === 'Escape') close(); };
      modal.addEventListener('click', event => { if (event.target === modal || event.target.closest('button')) close(); });
      document.addEventListener('keydown', onKey);
      document.body.appendChild(modal);
    });
  }

  // ----- my list (stored in this browser only) -----
  const LIST_KEY = 'tfx.list';
  const readList = () => { try { return JSON.parse(localStorage.getItem(LIST_KEY) || '[]'); } catch { return []; } };
  const writeList = list => { try { localStorage.setItem(LIST_KEY, JSON.stringify(list.slice(0, 500))); } catch {} };
  const listKey = item => `${item.type}:${item.id}`;
  for (const button of $$('[data-mylist]')) {
    let item;
    try { item = JSON.parse(button.dataset.mylist); } catch { continue; }
    const paint = () => {
      const has = readList().some(entry => listKey(entry) === listKey(item));
      button.textContent = has ? `✓ ${t('inList')}` : `＋ ${t('addToList')}`;
      button.setAttribute('aria-pressed', String(has));
    };
    button.addEventListener('click', () => {
      const list = readList();
      const at = list.findIndex(entry => listKey(entry) === listKey(item));
      if (at >= 0) list.splice(at, 1); else list.unshift(item);
      writeList(list);
      paint();
    });
    paint();
  }
  const listBox = $('#mylist');
  if (listBox) {
    const list = readList();
    $('#mylist-empty').hidden = list.length > 0;
    listBox.innerHTML = list.map(item => `<a class="card" href="${esc(item.url)}"><div class="poster">${item.poster ? `<img src="${esc(item.poster)}" alt="" loading="lazy">` : `<span class="noposter">${esc(item.title)}</span>`}</div><span class="card-title">${esc(item.title)}</span><span class="card-meta">${esc(item.year || '')}${item.year ? ' · ' : ''}${esc(item.type === 'movie' ? t('moviesLabel') : t('tvLabel'))}</span></a>`).join('');
  }

  // ----- torrents -----
  const box = $('#torrents');
  if (box) {
    const listEl = $('.tlist', box);
    const countEl = $('.count', box);
    const state = { items: [], quality: '' };
    const formatBytes = n => {
      if (!(n > 0)) return '';
      const units = ['B', 'KB', 'MB', 'GB', 'TB'];
      let i = 0;
      while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
      return `${n >= 100 || i < 2 ? Math.round(n) : n.toFixed(n >= 10 ? 1 : 2)} ${units[i]}`;
    };
    const ago = iso => {
      const ms = Date.now() - Date.parse(iso || '');
      if (!(ms > 0)) return '';
      const days = Math.floor(ms / 864e5);
      if (days < 1) return '<1d';
      if (days < 31) return `${days}d`;
      if (days < 365) return `${Math.floor(days / 30)}mo`;
      return `${Math.floor(days / 365)}y`;
    };
    const value = name => {
      const el = $(`[data-filter="${name}"]`, box);
      if (!el) return '';
      return el.type === 'checkbox' ? el.checked : el.value.trim();
    };
    const matchesLang = (item, lang) => {
      if (!lang) return true;
      const langs = item.languages || [];
      if (lang === 'multi') return langs.includes('multi') || langs.includes('dual');
      // Most English releases don't say their language.
      if (lang === 'en') return !langs.length || langs.includes('en') || langs.includes('multi') || langs.includes('dual');
      return langs.includes(lang);
    };
    const filtered = () => {
      const text = value('text').toLowerCase();
      const minSeeders = Number(value('minSeeders')) || 0;
      const maxSize = Number(value('maxSize')) || 0;
      const items = state.items.filter(item =>
        (!state.quality || item.quality === state.quality)
        && (!text || item.title.toLowerCase().includes(text))
        && (!value('source') || item.source === value('source'))
        && (!value('codec') || item.codec === value('codec'))
        && (!value('audio') || (item.audio || []).includes(value('audio')))
        && matchesLang(item, value('lang'))
        && (!minSeeders || (item.seeders ?? 0) >= minSeeders)
        && (!maxSize || !item.size || item.size <= maxSize * 1024 ** 3)
        && (!value('hdr') || item.hdr || item.dolbyVision)
        && (!value('subs') || item.subtitles)
        && (!value('hideCam') || !item.cam));
      const sort = value('sort');
      const by = {
        seeders: (a, b) => (b.seeders ?? -1) - (a.seeders ?? -1),
        'size-desc': (a, b) => (b.size || 0) - (a.size || 0),
        'size-asc': (a, b) => (a.size || Infinity) - (b.size || Infinity),
        newest: (a, b) => (Date.parse(b.published || 0) || 0) - (Date.parse(a.published || 0) || 0),
        score: (a, b) => b.score - a.score || (b.seeders ?? -1) - (a.seeders ?? -1)
      }[sort] || ((a, b) => b.score - a.score);
      return items.sort(by);
    };
    const groupOf = item => (item.quality === '2160p' ? t('group4k') : item.quality === '1080p' ? '1080p' : item.quality === '720p' ? '720p' : t('groupSd'));
    const rowHtml = item => {
      const tags = [
        item.quality ? `<span class="tag q">${esc(item.quality === '2160p' ? '4K' : item.quality)}</span>` : '',
        item.source ? `<span class="tag${item.cam ? ' cam' : ''}">${esc(item.source)}</span>` : '',
        item.codec ? `<span class="tag">${esc(item.codec)}${item.tenBit ? ' 10-bit' : ''}</span>` : '',
        item.dolbyVision ? '<span class="tag hdr">Dolby Vision</span>' : '',
        item.hdr ? '<span class="tag hdr">HDR</span>' : '',
        ...(item.audio || []).map(a => `<span class="tag">${esc(a)}</span>`),
        item.channels ? `<span class="tag">${esc(item.channels)}</span>` : '',
        ...(item.languages || []).map(l => `<span class="tag lang">${esc(l.toUpperCase())}</span>`),
        item.subtitles ? `<span class="tag lang">${esc(t('subtitles'))}</span>` : '',
        item.coverage && !['movie', 'episode'].includes(item.coverage) ? `<span class="tag">${esc(t('pack'))}</span>` : ''
      ].join('');
      const score = Number(item.score) || 0;
      return `<div class="trow">
  <div>
    <div class="ttitle">${esc(item.title)}</div>
    <div class="ttags">${tags}</div>
    <div class="tstats">
      ${item.seeders !== null && item.seeders !== undefined ? `<span class="seed">▲ ${esc(item.seeders)} ${esc(t('seeders'))}</span>` : ''}
      ${item.leechers !== null && item.leechers !== undefined ? `<span>▼ ${esc(item.leechers)} ${esc(t('leechers'))}</span>` : ''}
      ${item.size ? `<span>${esc(formatBytes(item.size))}</span>` : ''}
      ${item.indexer ? `<span>${esc(item.indexer)}</span>` : ''}
      ${item.published ? `<span>${esc(ago(item.published))}</span>` : ''}
    </div>
  </div>
  <div class="tside">
    <span class="score ${score >= 70 ? 'hi' : score >= 45 ? 'mid' : 'lo'}" title="${esc(t('score'))}">${score}</span>
    <div class="tactions">
      <a class="btn small primary" href="${esc(item.magnet || '#')}" data-ref="${esc(item.ref)}" data-action="magnet">🧲 ${esc(t('magnet'))}</a>
      <button class="btn small" type="button" data-ref="${esc(item.ref)}" data-action="copy">${esc(t('copyMagnet'))}</button>
      ${item.torrentFile ? `<a class="btn small" href="/api/torrent/${encodeURIComponent(item.ref)}" rel="nofollow">⤓ ${esc(t('download'))}</a>` : ''}
    </div>
  </div>
</div>`;
    };
    const render = () => {
      const items = filtered();
      countEl.textContent = state.items.length ? `· ${items.length} / ${state.items.length} ${t('results')}` : '';
      if (!items.length) {
        listEl.innerHTML = `<p class="muted">${esc(t('noTorrents'))}</p>`;
        return;
      }
      const groups = new Map();
      for (const item of items) {
        const g = groupOf(item);
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g).push(item);
      }
      const order = [t('group4k'), '1080p', '720p', t('groupSd')];
      listEl.innerHTML = order.filter(g => groups.has(g)).map(g =>
        `<h3 class="tgroup">${esc(g)} (${groups.get(g).length})</h3>${groups.get(g).slice(0, 200).map(rowHtml).join('')}`).join('');
    };
    const byRef = ref => state.items.find(item => item.ref === ref);
    const magnetFor = async item => {
      if (item.magnet) return item.magnet;
      const response = await fetch(`/api/magnet/${encodeURIComponent(item.ref)}`);
      const data = await response.json().catch(() => ({}));
      if (data.magnet) item.magnet = data.magnet;
      return item.magnet || null;
    };
    listEl.addEventListener('click', async event => {
      const el = event.target.closest('[data-action]');
      if (!el) return;
      const item = byRef(el.dataset.ref);
      if (!item) return;
      if (el.dataset.action === 'magnet' && item.magnet) return; // normal link
      event.preventDefault();
      const magnet = await magnetFor(item);
      if (!magnet) { el.disabled = true; return; }
      if (el.dataset.action === 'magnet') { location.href = magnet; return; }
      try {
        await navigator.clipboard.writeText(magnet);
      } catch {
        const area = document.createElement('textarea');
        area.value = magnet;
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        area.remove();
      }
      const old = el.textContent;
      el.textContent = `✓ ${t('copied')}`;
      setTimeout(() => { el.textContent = old; }, 1600);
    });
    for (const button of $$('.seg[data-filter="quality"] button', box)) {
      button.addEventListener('click', () => {
        state.quality = button.dataset.value;
        for (const other of $$('.seg[data-filter="quality"] button', box)) other.setAttribute('aria-pressed', String(other === button));
        render();
      });
    }
    for (const input of $$('[data-filter]:not(.seg)', box)) input.addEventListener(input.tagName === 'INPUT' && input.type !== 'checkbox' ? 'input' : 'change', render);
    fetch(box.dataset.api)
      .then(response => response.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        state.items = Array.isArray(data.items) ? data.items : [];
        render();
      })
      .catch(error => { listEl.innerHTML = `<p class="muted">${esc(error.message || t('noTorrents'))}</p>`; });
  }

  // ----- subtitles -----
  const subs = $('#subtitles');
  if (subs) {
    const target = $('.sublist', subs);
    fetch(subs.dataset.api)
      .then(response => response.json())
      .then(data => {
        const items = Array.isArray(data.items) ? data.items : [];
        target.innerHTML = items.length
          ? items.map(item => `<a class="chip" href="${esc(item.url)}" download rel="nofollow">⤓ ${esc(item.label)}</a>`).join('')
          : `<p class="muted">${esc(t('noSubtitles'))}</p>`;
      })
      .catch(() => { target.innerHTML = `<p class="muted">${esc(t('noSubtitles'))}</p>`; });
  }
})();
