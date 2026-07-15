/* Command Center — client behavior (theme, tabs, read state, relay).
   Rendering is 100% server-side in bin/ccmd; this file only wires interaction.
   bin/ccmd injects, before this: window.CC_MODE = { interactive: true|false }.
   NOTE: never write "</" + "script" here — this file is embedded in a <script>. */
(function () {
  var MODE = window.CC_MODE || { interactive: false };
  var $ = function (s, r) { return (r || document).querySelector(s); };

  /* ---- theme toggle (persistent; overrides the shell theme) ---- */
  var root = document.documentElement, TKEY = 'acc-theme';
  var tt = $('#themeToggle'), ttMoon = $('.tt-moon'), ttSun = $('.tt-sun');
  function effective() { return root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); }
  function themeIcon(t) {
    var dark = t === 'dark';
    if (ttSun) ttSun.style.display = dark ? 'block' : 'none';
    if (ttMoon) ttMoon.style.display = dark ? 'none' : 'block';
  }
  function setTheme(t) {
    root.dataset.theme = t; root.style.colorScheme = t;
    try { localStorage.setItem(TKEY, t); } catch (e) {}
    themeIcon(t);
  }
  var savedTheme = null; try { savedTheme = localStorage.getItem(TKEY); } catch (e) {}
  if (savedTheme) setTheme(savedTheme); else themeIcon(effective());
  if (tt) tt.addEventListener('click', function () { setTheme(effective() === 'dark' ? 'light' : 'dark'); });

  /* ---- tabs (segmented control) ---- */
  var seg = $('#seg'), panels = $('#panels');
  var segBtns = seg ? [].slice.call(seg.querySelectorAll('button')) : [];
  var allPanels = panels ? [].slice.call(panels.querySelectorAll('.panel')) : [];
  function select(id) {
    segBtns.forEach(function (b) {
      var on = b.dataset.tab === id;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1; // roving tabindex
    });
    allPanels.forEach(function (p) {
      var on = p.dataset.tab === id;
      p.classList.toggle('on', on);
      if (on) p.removeAttribute('hidden'); else p.setAttribute('hidden', '');
    });
    var active = seg.querySelector('[aria-selected="true"]');
    if (active) active.scrollIntoView({ block: 'nearest', inline: 'center' });
    try { sessionStorage.setItem('acc-tab', id); } catch (e) {}
  }
  segBtns.forEach(function (b, i) {
    b.addEventListener('click', function () { select(b.dataset.tab); });
    b.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      var n = segBtns[(i + d + segBtns.length) % segBtns.length];
      n.focus(); select(n.dataset.tab);
    });
  });
  document.addEventListener('click', function (e) {
    var j = e.target.closest('[data-jump]');
    if (!j) return;
    select(j.dataset.jump);
    var target = j.dataset.target && document.querySelector('[data-ack="' + j.dataset.target.replace(/"/g, '\\"') + '"]');
    if (target) {
      // Highlight the specific card: scroll + brief flash.
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.remove('hl');
      void target.offsetWidth; /* restart the animation if clicked twice */
      target.classList.add('hl');
      setTimeout(function () { target.classList.remove('hl'); }, 2600);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
  var savedTab = null; try { savedTab = sessionStorage.getItem('acc-tab'); } catch (e) {}
  if (savedTab && segBtns.some(function (b) { return b.dataset.tab === savedTab; })) select(savedTab);

  /* ---- read state ---- */
  var STORE = 'acc-read-v1'; // real store keys (entry:<p>/<b> / signal:<id>)
  /* NOTE: never [].slice.call over a Set (not array-like: returns []). Array.from always. */
  function load() { try { return new Set(JSON.parse(localStorage.getItem(STORE) || '[]')); } catch (e) { return new Set(); } }
  function save(s) { try { localStorage.setItem(STORE, JSON.stringify(Array.from(s))); } catch (e) {} }
  var state = load();
  var relay = $('.relay'), relayBox = $('.relaybox'), relayTa = relayBox ? relayBox.querySelector('textarea') : null;

  function relayLine() { return 'ccmd-read: ' + Array.from(state).join(', '); }
  function apply() {
    document.querySelectorAll('[data-ack]').forEach(function (c) {
      var on = state.has(c.dataset.ack);
      c.classList.toggle('read', on);
      var lab = c.querySelector('.ack .lab');
      if (lab) lab.textContent = on ? 'Read' : 'Mark read';
    });
    if (relay) {
      relay.querySelector('.rn').textContent = state.size;
      relay.classList.toggle('show', state.size > 0);
    }
    if (relayBox) {
      if (state.size === 0) relayBox.classList.remove('show');
      else if (relayBox.classList.contains('show') && relayTa) relayTa.value = relayLine();
    }
  }

  var toastT;
  function toast(m) {
    var t = $('.toast'); if (!t) return;
    t.textContent = m; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('show'); }, 3600);
  }

  function postSeen(pathName, key) {
    if (!MODE.interactive) return;
    try {
      fetch(pathName, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: key }) })
        .catch(function () {});
    } catch (e) {}
  }

  if (relayTa) relayTa.addEventListener('focus', function () { relayTa.select(); });

  document.addEventListener('click', function (e) {
    var a = e.target.closest('.ack');
    if (a) {
      var k = a.dataset.key;
      if (state.has(k)) { state.delete(k); postSeen('/unseen', k); }
      else { state.add(k); postSeen('/seen', k); }
      save(state); apply();
      return;
    }
    if (e.target.closest('.relay .clear')) {
      Array.from(state).forEach(function (k) { postSeen('/unseen', k); });
      state.clear(); save(state); apply();
      return;
    }
    if (e.target.closest('.relay .copy')) {
      if (!state.size || !relayBox || !relayTa) return;
      relayTa.value = relayLine();
      relayBox.classList.add('show');
      relayTa.focus(); relayTa.select();
      toast('Selected. Copy with ⌘C / Ctrl-C and paste it into any agent chat.');
      return;
    }
    if (relayBox && relayBox.classList.contains('show') && !e.target.closest('.relaybox') && !e.target.closest('.relay')) {
      relayBox.classList.remove('show');
    }
  });
  apply();

  /* ---- live updates (only under ccmd serve): poll /hash, never blind-reload ---- */
  if (MODE.interactive && location.protocol !== 'file:') {
    try { history.scrollRestoration = 'manual'; } catch (e) {}
    // restore scroll after a programmatic reload (the active tab restores via sessionStorage above)
    try {
      var sy = sessionStorage.getItem('acc-scroll');
      if (sy != null) { window.scrollTo(0, parseInt(sy, 10) || 0); sessionStorage.removeItem('acc-scroll'); }
    } catch (e) {}
    var POLL = 10000; // ?poll=<ms> tunes the live-update poll interval (min 500)
    try { var q = new URLSearchParams(location.search).get('poll'); if (q) POLL = Math.max(500, parseInt(q, 10) || 10000); } catch (e) {}
    var baseline = null, dirty = false, pill = null;
    function reload() {
      try { sessionStorage.setItem('acc-scroll', String(window.scrollY || window.pageYOffset || 0)); } catch (e) {}
      location.reload();
    }
    function showPill() {
      if (!pill) {
        pill = document.createElement('button');
        pill.type = 'button';
        pill.className = 'updpill';
        pill.setAttribute('aria-live', 'polite');
        pill.innerHTML = '<span class="d"></span>Updates — refresh';
        pill.addEventListener('click', reload);
        document.body.appendChild(pill);
      }
      requestAnimationFrame(function () { pill.classList.add('show'); });
    }
    // A pending update + the tab going hidden → refresh now, so it's fresh when they return.
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && dirty) reload();
    });
    setInterval(function () {
      fetch('/hash', { cache: 'no-store' }).then(function (r) { return r.text(); }).then(function (h) {
        if (baseline === null) { baseline = h; return; }
        if (h === baseline) return;
        dirty = true;
        // Visible → offer a pill (never yank the page out from under an active read/edit).
        // Hidden → just reload quietly.
        if (document.hidden) reload(); else showPill();
      }).catch(function () {});
    }, POLL);
  }
})();
