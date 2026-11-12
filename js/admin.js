(function () {
  'use strict';

  var B = window.BJJ;
  var DRAFT_KEY = 'bjjDraft';   // 편집 중인 내용 (이 브라우저에만 보관)
  var GH_KEY = 'bjjGh';         // GitHub 연결 정보
  var OPT_KEY = 'bjjOpts';      // 저장 옵션

  var deployed = B.normalize(window.BJJ_DATA);   // 사이트에 배포된 목록
  var state = B.normalize(window.BJJ_DATA);      // 편집 중인 목록 { site, sections }
  var dirty = false;
  var busy = false;
  var open = {};
  var undoStack = [];
  var pending = null;        // 입력칸에 들어갈 때 찍어 두는 되돌리기용 사본
  var focusTarget = null;    // 새로 추가한 기술 (그 줄의 이름 칸에 커서를 둔다)
  var persistTimer = null;
  var opts = { download: false };

  function $(id) { return document.getElementById(id); }

  // ---------- 작은 도우미 ----------
  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }

  function btn(text, cls, onClick, title) {
    var b = h('button', { type: 'button', class: 'btn ' + (cls || ''), text: text });
    if (title) { b.title = title; b.setAttribute('aria-label', title); }
    b.addEventListener('click', onClick);
    return b;
  }

  function textInput(value, placeholder, onInput, multiline) {
    var el = h(multiline ? 'textarea' : 'input', multiline ? { rows: '2' } : { type: 'text' });
    if (placeholder) { el.placeholder = placeholder; el.setAttribute('aria-label', placeholder); }
    el.value = value;
    el.addEventListener('input', function () { onInput(el.value, el); edited(); });
    return el;
  }

  function field(label, value, onInput, multiline) {
    return h('label', { class: 'field' }, [h('span', { text: label }), textInput(value, '', onInput, multiline)]);
  }

  function setStatus(text, warn) {
    $('status').textContent = text || '';
    $('status').className = 'status' + (warn ? ' dirty' : '');
  }

  function store(kind) { try { return window[kind]; } catch (e) { return null; } }

  // ---------- 변경 추적 / 되돌리기 / 자동 보관 ----------
  function persistNow() {
    clearTimeout(persistTimer);
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ dirty: dirty, data: state })); } catch (e) {}
  }

  function refresh() {
    $('save').classList.toggle('pending', dirty);
    $('undo').disabled = undoStack.length === 0;
    updateStat();
  }

  function touch() {
    dirty = true;
    setStatus('저장하지 않은 변경이 있습니다.', true);
    refresh();
    clearTimeout(persistTimer);
    persistTimer = setTimeout(persistNow, 300);
  }

  function snapshot() {
    undoStack.push(JSON.stringify(state));
    if (undoStack.length > 50) undoStack.shift();
  }

  // 입력칸을 고쳤을 때: 그 칸에 들어가기 전 상태를 되돌리기 목록에 넣는다
  function edited() {
    if (pending) { undoStack.push(pending); pending = null; }
    touch();
  }

  // 추가, 삭제, 순서 변경 같은 구조 변경
  function change(fn) {
    snapshot();
    pending = null;
    fn();
    touch();
    renderAll();
  }

  function undo() {
    if (!undoStack.length) return;
    state = B.normalize(JSON.parse(undoStack.pop()));
    pending = null;
    touch();
    renderAll();
    setStatus('한 단계 되돌렸습니다.', true);
  }

  function move(arr, i, d) {
    var j = i + d;
    if (j < 0 || j >= arr.length) return;
    change(function () { var t = arr[i]; arr[i] = arr[j]; arr[j] = t; });
  }

  function removeAt(arr, i, what) {
    change(function () { arr.splice(i, 1); });
    setStatus(what + ' 삭제했습니다. [실행 취소]로 되돌릴 수 있습니다.', true);
  }

  // ---------- 기술 목록 ----------
  function filtering() { return !!$('filter-q').value.trim() || $('filter-missing').checked; }

  function matches(g, it) {
    if ($('filter-missing').checked && B.isHttp(it.video)) return false;
    var q = $('filter-q').value.trim().toLowerCase();
    if (!q) return true;
    return [g.name, it.ko, it.en, it.video].some(function (v) { return v.toLowerCase().indexOf(q) > -1; });
  }

  function updateStat() {
    var total = 0, custom = 0;
    state.sections.forEach(function (s) {
      s.groups.forEach(function (g) {
        g.items.forEach(function (it) { total += 1; if (B.isHttp(it.video)) custom += 1; });
      });
    });
    $('stat').textContent = '기술 ' + total + '개 · 영상 지정 ' + custom + '개 · 미지정 ' + (total - custom) + '개 (미지정은 유튜브 검색으로 연결)';
  }

  function renderList() {
    var root = $('editor');
    var f = filtering();
    root.textContent = '';
    state.sections.forEach(function (sec, si) {
      var node = sectionNode(sec, si, f);
      if (node) root.appendChild(node);
    });
    if (f && !root.firstChild) root.appendChild(h('p', { class: 'empty', text: '조건에 맞는 기술이 없습니다.' }));
    if (!f) {
      root.appendChild(h('div', { class: 'actions' }, [
        btn('+ 섹션 추가', '', function () {
          change(function () {
            var s = { id: B.uid(), title: '새 섹션', desc: '', groups: [{ name: '새 그룹', note: '', items: [] }] };
            state.sections.push(s);
            open[s.id] = true;
          });
        })
      ]));
    }
    updateStat();
  }

  function sectionNode(sec, si, f) {
    var countSpan = h('span', { class: 'c' });
    function count() {
      var total = 0, custom = 0;
      sec.groups.forEach(function (g) {
        g.items.forEach(function (it) { total += 1; if (B.isHttp(it.video)) custom += 1; });
      });
      countSpan.textContent = '영상 ' + custom + ' / ' + total;
    }
    count();
    var groups = sec.groups.map(function (g, gi) { return groupNode(sec, g, gi, f, count); }).filter(Boolean);
    if (f && !groups.length) return null;

    var titleSpan = h('span', { class: 't', text: sec.title || '(제목 없음)' });
    var det = h('details', { class: 'sec' }, [h('summary', null, [titleSpan, countSpan])]);
    det.open = f || !!open[sec.id];
    det.addEventListener('toggle', function () { if (!filtering()) open[sec.id] = det.open; });

    var body = h('div', { class: 'sec-body' });
    if (!f) {
      body.appendChild(h('div', { class: 'fields' }, [
        field('섹션 제목', sec.title, function (v) { sec.title = v; titleSpan.textContent = v || '(제목 없음)'; }),
        field('섹션 설명', sec.desc, function (v) { sec.desc = v; })
      ]));
      body.appendChild(h('div', { class: 'actions' }, [
        btn('↑ 위로', 'sm', function () { move(state.sections, si, -1); }),
        btn('↓ 아래로', 'sm', function () { move(state.sections, si, 1); }),
        btn('섹션 삭제', 'sm danger', function () { removeAt(state.sections, si, '"' + (sec.title || '섹션') + '" 섹션을'); })
      ]));
    }
    groups.forEach(function (n) { body.appendChild(n); });
    if (!f) {
      body.appendChild(h('div', { class: 'actions' }, [
        btn('+ 그룹 추가', '', function () {
          change(function () { sec.groups.push({ name: '새 그룹', note: '', items: [] }); open[sec.id] = true; });
        })
      ]));
    }
    det.appendChild(body);
    return det;
  }

  function groupNode(sec, g, gi, f, count) {
    var rows = g.items.map(function (it, ii) {
      return matches(g, it) ? itemRow(g, it, ii, f, count) : null;
    }).filter(Boolean);
    if (f && !rows.length) return null;

    var box = h('div', { class: 'grp' });
    if (f) {
      box.appendChild(h('div', { class: 'grp-name', text: g.name || '(이름 없는 그룹)' }));
    } else {
      box.appendChild(h('div', { class: 'fields' }, [
        field('그룹 이름', g.name, function (v) { g.name = v; }),
        field('그룹 메모 (선택, 공개 페이지에 안내문으로 보임)', g.note, function (v) { g.note = v; }, true)
      ]));
      box.appendChild(h('div', { class: 'actions' }, [
        btn('↑', 'sm', function () { move(sec.groups, gi, -1); }, '그룹을 위로'),
        btn('↓', 'sm', function () { move(sec.groups, gi, 1); }, '그룹을 아래로'),
        btn('그룹 삭제', 'sm danger', function () { removeAt(sec.groups, gi, '"' + (g.name || '그룹') + '" 그룹을'); })
      ]));
    }
    if (rows.length) {
      box.appendChild(h('div', { class: 'itemhead' }, [
        h('span', { text: '영상' }), h('span', { text: '기술 이름' }),
        h('span', { text: '영상 주소 (비우면 유튜브 검색)' }), h('span', { text: '영어 검색어' }), h('span')
      ]));
    }
    rows.forEach(function (r) { box.appendChild(r); });
    if (!f) {
      box.appendChild(h('div', { class: 'actions' }, [
        btn('+ 기술 추가', 'sm', function () {
          change(function () {
            var it = { ko: '', en: '', video: '' };
            g.items.push(it);
            focusTarget = it;
            open[sec.id] = true;
          });
        })
      ]));
    }
    return box;
  }

  function itemRow(g, it, ii, f, count) {
    var thumb = h('span', { class: 'thumb' });
    var find = h('a', { class: 'btn sm', target: '_blank', rel: 'noopener noreferrer', text: '찾기', title: '유튜브에서 이 기술 영상 찾기' });

    function draw() {
      thumb.textContent = '';
      var id = B.youtubeId(it.video);
      if (id) {
        var a = h('a', { href: it.video, target: '_blank', rel: 'noopener noreferrer', title: '지정한 영상 열기' }, [
          h('img', { src: 'https://i.ytimg.com/vi/' + id + '/default.jpg', alt: '지정한 영상 열기', width: '60', height: '45', loading: 'lazy' })
        ]);
        thumb.appendChild(a);
      } else if (B.isHttp(it.video)) {
        thumb.appendChild(h('a', { class: 'btn sm', href: it.video, target: '_blank', rel: 'noopener noreferrer', text: '열기' }));
      } else {
        thumb.appendChild(h('span', { class: 'none', text: '검색' }));
      }
      find.href = B.searchUrl(it, 'ko', state.site);
    }

    var ko = textInput(it.ko, '기술 이름', function (v) { it.ko = v; draw(); });
    var video = textInput(it.video, '영상 주소 붙여넣기', function (v, el) {
      it.video = v.trim();
      el.classList.toggle('invalid', it.video !== '' && !B.isHttp(it.video));
      draw();
      count();
    });
    video.setAttribute('inputmode', 'url');
    video.classList.toggle('invalid', it.video !== '' && !B.isHttp(it.video));
    var en = textInput(it.en, '영어 검색어', function (v) { it.en = v; });
    draw();

    if (it === focusTarget) {
      focusTarget = null;
      setTimeout(function () { ko.focus(); }, 0);
    }

    return h('div', { class: 'itemrow' }, [
      thumb, ko, video, en,
      h('div', { class: 'ops' }, [
        find,
        f ? null : btn('↑', 'sm', function () { move(g.items, ii, -1); }, '위로'),
        f ? null : btn('↓', 'sm', function () { move(g.items, ii, 1); }, '아래로'),
        btn('✕', 'sm danger', function () { removeAt(g.items, ii, '"' + (it.ko || '기술') + '"을(를)'); }, '삭제')
      ])
    ]);
  }

  // ---------- 사이트 문구 ----------
  function renderSite() {
    var s = state.site;
    var root = $('site-form');
    root.textContent = '';

    var scoreBox = h('div', { class: 'scores' });
    s.scores.forEach(function (sc, i) {
      scoreBox.appendChild(h('div', { class: 'scorerow' }, [
        textInput(sc.point, '점수 (예: 2점)', function (v) { sc.point = v; }),
        textInput(sc.label, '내용 (예: 테이크다운 · 스윕)', function (v) { sc.label = v; }),
        btn('✕', 'sm danger', function () { removeAt(s.scores, i, '점수 칸을'); }, '삭제')
      ]));
    });

    root.appendChild(h('section', { class: 'card' }, [
      h('h2', { text: '머리말' }),
      h('div', { class: 'fields' }, [
        field('작은 머리글', s.eyebrow, function (v) { s.eyebrow = v; }),
        field('제목', s.title, function (v) { s.title = v; })
      ]),
      h('div', { class: 'fields' }, [field('소개 문구', s.lede, function (v) { s.lede = v; }, true)])
    ]));
    root.appendChild(h('section', { class: 'card' }, [
      h('h2', { text: '점수표' }),
      scoreBox,
      h('div', { class: 'actions' }, [
        btn('+ 점수 칸 추가', 'sm', function () { change(function () { s.scores.push({ point: '', label: '' }); }); })
      ])
    ]));
    root.appendChild(h('section', { class: 'card' }, [
      h('h2', { text: '유튜브 검색어' }),
      h('p', { class: 'hint', text: '영상 주소가 없는 기술은 "기술 이름 + 아래 단어"로 유튜브를 검색합니다.' }),
      h('div', { class: 'fields' }, [
        field('한국어 검색에 붙일 단어', s.koSuffix, function (v) { s.koSuffix = v; }),
        field('English 검색에 붙일 단어', s.enSuffix, function (v) { s.enSuffix = v; })
      ])
    ]));
    root.appendChild(h('section', { class: 'card' }, [
      h('h2', { text: '맨 아래 안내 문구' }),
      h('div', { class: 'fields' }, [field('안내 문구', s.footer, function (v) { s.footer = v; }, true)])
    ]));
  }

  function renderAll() {
    renderList();
    renderSite();
    refresh();
  }

  // ---------- 저장할 내용 만들기 / 검사 ----------
  function clean() {
    var s = state.site;
    return {
      site: {
        eyebrow: s.eyebrow.trim(), title: s.title.trim(), lede: s.lede.trim(),
        scores: s.scores.map(function (x) { return { point: x.point.trim(), label: x.label.trim() }; })
          .filter(function (x) { return x.point || x.label; }),
        footer: s.footer.trim(), koSuffix: s.koSuffix.trim(), enSuffix: s.enSuffix.trim()
      },
      sections: state.sections.map(function (sec) {
        return {
          id: sec.id, title: sec.title.trim(), desc: sec.desc.trim(),
          groups: sec.groups.map(function (g) {
            return {
              name: g.name.trim(), note: g.note.trim(),
              items: g.items.map(function (it) {
                return { ko: it.ko.trim(), en: it.en.trim(), video: it.video.trim() };
              }).filter(function (it) { return it.ko || it.en || it.video; })   // 완전히 빈 줄은 버린다
            };
          })
        };
      })
    };
  }

  function validate(out) {
    if (!out.site.title) return '[사이트 문구]의 제목이 비어 있습니다.';
    for (var si = 0; si < out.sections.length; si++) {
      var s = out.sections[si];
      if (!s.title) return (si + 1) + '번째 섹션의 제목이 비어 있습니다.';
      for (var gi = 0; gi < s.groups.length; gi++) {
        var g = s.groups[gi];
        if (!g.name) return '"' + s.title + '"의 ' + (gi + 1) + '번째 그룹 이름이 비어 있습니다.';
        for (var ii = 0; ii < g.items.length; ii++) {
          var it = g.items[ii];
          var where = '"' + s.title + '" > "' + g.name + '" > ' + (ii + 1) + '번째 기술: ';
          if (!it.ko) return where + '이름이 비어 있습니다.';
          if (it.video && !B.isHttp(it.video)) return where + '영상 주소는 http:// 또는 https://로 시작해야 합니다.';
        }
      }
    }
    return null;
  }

  function buildText(out) {
    return '// 사이트 내용. 관리자 페이지(admin.html)에서 저장하면 자동으로 갱신됩니다.\n' +
      '// video: 영상 주소 (비우면 유튜브 검색으로 연결)\n' +
      'window.BJJ_DATA = ' + JSON.stringify(out, null, 1) + ';\n';
  }

  // data.js 본문(또는 JSON)에서 내용을 꺼낸다. 예전 형식(섹션 배열)도 읽는다.
  function parseText(text) {
    var t = String(text).replace(/^﻿/, '');
    var i = t.indexOf('window.BJJ_DATA');
    if (i > -1) t = t.slice(t.indexOf('=', i) + 1);
    var v = JSON.parse(t.trim().replace(/;\s*$/, ''));
    if (!Array.isArray(v) && !(v && Array.isArray(v.sections))) throw new Error('목록을 찾지 못했습니다.');
    return B.normalize(v);
  }

  function downloadText(text) {
    var blob = new Blob([text], { type: 'text/javascript;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'data.js';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  // ---------- GitHub 연결 ----------
  var gh = {};
  ['owner', 'repo', 'branch', 'path', 'token', 'remember'].forEach(function (k) { gh[k] = $('gh-' + k); });

  function readJson(kind, key) {
    try { var st = store(kind); var raw = st && st.getItem(key); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }

  // github.io 주소에서 저장소 주인과 이름을 미리 채운다 (예: 계정.github.io/저장소/)
  function guessRepo() {
    var m = /^([^.]+)\.github\.io$/i.exec(location.hostname);
    var seg = location.pathname.split('/').filter(Boolean)[0];
    return { owner: m ? m[1] : '', repo: m && seg && !/\.html?$/i.test(seg) ? seg : '' };
  }

  function ghConfig() {
    return {
      owner: gh.owner.value.trim(),
      repo: gh.repo.value.trim(),
      branch: gh.branch.value.trim() || 'main',
      path: gh.path.value.trim().replace(/^\/+/, '') || 'data.js',
      token: gh.token.value.trim()
    };
  }

  function ghReady(c) { return !!(c.owner && c.repo && c.token); }

  function refreshGh() {
    var ok = ghReady(ghConfig());
    $('gh-state').textContent = ok ? '연결 정보 있음' : '설정 필요';
    $('gh-state').className = 'badge ' + (ok ? 'ok' : 'warn');
    $('gh-dot').className = 'dot ' + (ok ? 'ok' : 'warn');
    $('gh-dot').title = ok ? 'GitHub 연결 정보 있음' : 'GitHub 연결 필요';
    $('save-mode').textContent = ok
      ? '[저장]을 누르면 GitHub 저장소의 data.js가 자동으로 업데이트되고, 1~2분 뒤 공개 페이지에 반영됩니다.'
      : 'GitHub 연결이 없어서, [저장]을 누르면 data.js 파일을 내려받습니다. 받은 파일을 저장소의 data.js와 교체해야 반영됩니다. 아래에서 연결해 두면 자동으로 반영됩니다.';
  }

  function saveGh() {
    var json = JSON.stringify(ghConfig());
    try { localStorage.removeItem(GH_KEY); } catch (e) {}
    try { sessionStorage.removeItem(GH_KEY); } catch (e) {}
    try { (gh.remember.checked ? localStorage : sessionStorage).setItem(GH_KEY, json); } catch (e) {}
    refreshGh();
  }

  function initGh() {
    var session = readJson('sessionStorage', GH_KEY);
    var saved = readJson('localStorage', GH_KEY) || session || {};
    var guess = guessRepo();
    gh.owner.value = saved.owner || guess.owner;
    gh.repo.value = saved.repo || guess.repo;
    gh.branch.value = saved.branch || 'main';
    gh.path.value = saved.path || 'data.js';
    gh.token.value = saved.token || '';
    gh.remember.checked = !session || !!readJson('localStorage', GH_KEY);
    refreshGh();
  }

  function ghUrl(c) {
    return 'https://api.github.com/repos/' + encodeURIComponent(c.owner) + '/' + encodeURIComponent(c.repo) +
      '/contents/' + c.path.split('/').map(encodeURIComponent).join('/');
  }

  function ghHeaders(c, extra) {
    var hd = { 'Accept': 'application/vnd.github+json', 'Authorization': 'Bearer ' + c.token, 'X-GitHub-Api-Version': '2022-11-28' };
    Object.keys(extra || {}).forEach(function (k) { hd[k] = extra[k]; });
    return hd;
  }

  function ghError(res) {
    if (res.status === 401) return '토큰이 올바르지 않거나 만료되었습니다. [저장 설정]에서 토큰을 다시 확인해 주세요.';
    if (res.status === 403) return '이 토큰에 쓰기 권한이 없습니다. 토큰의 Contents 권한이 Read and write인지 확인해 주세요.';
    if (res.status === 404) return '저장소나 파일을 찾지 못했습니다. 저장소 주인/이름/브랜치/경로와, 토큰이 이 저장소를 선택했는지 확인해 주세요.';
    if (res.status === 409 || res.status === 422) return '저장소의 파일이 그 사이에 바뀌었습니다. 다시 한 번 저장해 주세요.';
    return 'GitHub 요청이 실패했습니다. (' + res.status + ')';
  }

  function errText(e) {
    return e && e.message && !/Failed to fetch|NetworkError|Load failed/i.test(e.message)
      ? e.message : '네트워크 오류로 GitHub에 연결하지 못했습니다. 접속 환경을 확인해 주세요.';
  }

  function toBase64(text) {
    var bytes = new TextEncoder().encode(text);
    var bin = '';
    for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }

  function fromBase64(b64) {
    var bin = atob(String(b64).replace(/\s/g, ''));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  }

  function getRemote(c) {
    return fetch(ghUrl(c) + '?ref=' + encodeURIComponent(c.branch) + '&_=' + Date.now(), { headers: ghHeaders(c), cache: 'no-store' });
  }

  function setBusy(v) {
    busy = v;
    ['save', 'pull', 'discard', 'gh-test'].forEach(function (id) { $(id).disabled = v; });
  }

  function clock() {
    var t = new Date();
    return String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0');
  }

  // ---------- 저장 ----------
  function save() {
    if (busy) return;
    var out = clean();
    var problem = validate(out);
    if (problem) { setStatus(problem, true); return; }
    var text = buildText(out);
    var c = ghConfig();

    // GitHub 연결이 없으면 파일로 내려받는다
    if (!ghReady(c)) {
      downloadText(text);
      state = B.normalize(out);
      persistNow();
      renderAll();
      setStatus('data.js를 내려받았습니다. GitHub 연결이 없어 자동 반영되지는 않았습니다. 저장소의 data.js를 이 파일로 교체하거나, [저장 설정]에서 GitHub를 연결해 주세요.', true);
      return;
    }

    saveGh();
    setBusy(true);
    setStatus('저장하는 중...');

    function attempt(retry) {
      return getRemote(c).then(function (res) {
        if (res.status === 404) return null;          // 파일이 아직 없으면 새로 만든다
        if (!res.ok) throw new Error(ghError(res));
        return res.json();
      }).then(function (remote) {
        var body = { message: '관리자 페이지에서 내용 수정', content: toBase64(text), branch: c.branch };
        if (remote && remote.sha) body.sha = remote.sha;
        return fetch(ghUrl(c), { method: 'PUT', headers: ghHeaders(c, { 'Content-Type': 'application/json' }), body: JSON.stringify(body) });
      }).then(function (res) {
        if ((res.status === 409 || res.status === 422) && retry) return attempt(false);
        if (!res.ok) throw new Error(ghError(res));
        return res;
      });
    }

    attempt(true).then(function () {
      state = B.normalize(out);
      dirty = false;
      persistNow();
      renderAll();
      if (opts.download) downloadText(text);
      setStatus('저장했습니다 (' + clock() + '). 1~2분 뒤 공개 페이지에 반영됩니다.' + (opts.download ? ' data.js도 내려받았습니다.' : ''));
    }).catch(function (e) {
      setStatus(errText(e), true);
    }).then(function () { setBusy(false); });
  }

  // GitHub 저장소의 최신 내용을 불러온다.
  // mode: 'auto' 페이지를 열 때 조용히 / 'manual' 버튼 / 'discard' 변경 버리기
  function pull(mode) {
    if (busy) return;
    var c = ghConfig();
    if (!ghReady(c)) {
      showTab('save');
      setStatus('먼저 GitHub 연결 정보(저장소와 토큰)를 입력해 주세요.', true);
      return;
    }
    if (mode === 'manual' && dirty && !window.confirm('저장하지 않은 편집 내용이 GitHub의 최신 내용으로 바뀝니다. 계속할까요?')) return;
    setBusy(true);
    if (mode !== 'auto') setStatus('GitHub에서 불러오는 중...');
    getRemote(c).then(function (res) {
      if (!res.ok) throw new Error(ghError(res));
      return res.json();
    }).then(function (remote) {
      var next = parseText(fromBase64(remote.content));
      if (mode === 'auto' && dirty) return;      // 그 사이 편집을 시작했으면 덮어쓰지 않는다
      if (mode !== 'auto') snapshot();
      state = next;
      dirty = false;
      pending = null;
      persistNow();
      renderAll();
      setStatus(mode === 'discard' ? '변경을 버리고 마지막으로 저장된 내용으로 되돌렸습니다.' : 'GitHub의 최신 내용을 불러왔습니다.');
    }).catch(function (e) {
      setStatus((mode === 'auto' ? 'GitHub에서 최신 내용을 불러오지 못해 사이트에 배포된 내용을 보여줍니다. ' : '') + errText(e), true);
    }).then(function () { setBusy(false); });
  }

  function discard() {
    if (!dirty) { setStatus('버릴 변경이 없습니다.'); return; }
    if (!window.confirm('저장하지 않은 변경을 모두 버리고 마지막으로 저장된 내용으로 되돌립니다. 계속할까요?')) return;
    if (ghReady(ghConfig())) { pull('discard'); return; }
    snapshot();
    state = B.normalize(deployed);
    dirty = false;
    pending = null;
    persistNow();
    renderAll();
    setStatus('변경을 버리고 사이트에 배포된 내용으로 되돌렸습니다.');
  }

  function importFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var next;
      try { next = parseText(reader.result); } catch (e) {
        setStatus('파일을 읽지 못했습니다. data.js 파일인지 확인해 주세요.', true);
        return;
      }
      if (dirty && !window.confirm('편집 중인 내용이 불러온 파일 내용으로 바뀝니다. 계속할까요?')) return;
      change(function () { state = next; });
      showTab('list');
      setStatus('파일을 불러왔습니다. [저장]을 눌러야 반영됩니다.', true);
    };
    reader.readAsText(file, 'UTF-8');
  }

  function testGh() {
    var c = ghConfig();
    var msg = $('gh-msg');
    function say(text, warn) { msg.textContent = text; msg.className = 'status' + (warn ? ' dirty' : ''); }
    saveGh();
    if (!ghReady(c)) { say('저장소 주인, 저장소 이름, 토큰을 모두 입력해 주세요.', true); return; }
    setBusy(true);
    say('확인하는 중...');
    getRemote(c).then(function (res) {
      if (res.ok) say('연결되었습니다. 저장소의 ' + c.path + ' 파일을 읽었습니다. (쓰기 권한은 첫 저장 때 확인됩니다)');
      else say(ghError(res), true);
    }).catch(function (e) { say(errText(e), true); }).then(function () { setBusy(false); });
  }

  // ---------- 탭 ----------
  function showTab(name) {
    ['list', 'site', 'save'].forEach(function (t) { $('tab-' + t).hidden = t !== name; });
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (b) {
      b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === name));
    });
  }

  // ---------- 이벤트 연결 ----------
  Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (b) {
    b.addEventListener('click', function () { showTab(b.getAttribute('data-tab')); });
  });
  $('save').addEventListener('click', save);
  $('undo').addEventListener('click', undo);
  $('discard').addEventListener('click', discard);
  $('pull').addEventListener('click', function () { pull('manual'); });
  $('download').addEventListener('click', function () {
    var out = clean();
    var problem = validate(out);
    if (problem) { setStatus(problem, true); return; }
    downloadText(buildText(out));
    setStatus('data.js를 내려받았습니다.', dirty);
  });
  $('import-btn').addEventListener('click', function () { $('import-file').click(); });
  $('import-file').addEventListener('change', function (e) {
    if (e.target.files && e.target.files[0]) importFile(e.target.files[0]);
    e.target.value = '';
  });
  $('filter-q').addEventListener('input', renderList);
  $('filter-missing').addEventListener('change', renderList);
  $('expand').addEventListener('click', function () {
    state.sections.forEach(function (s) { open[s.id] = true; });
    renderList();
  });
  $('collapse').addEventListener('click', function () { open = {}; renderList(); });
  $('gh-test').addEventListener('click', testGh);
  $('gh-forget').addEventListener('click', function () {
    gh.token.value = '';
    saveGh();
    $('gh-msg').textContent = '저장된 토큰을 지웠습니다.';
    $('gh-msg').className = 'status';
  });
  ['owner', 'repo', 'branch', 'path', 'token'].forEach(function (k) {
    gh[k].addEventListener('input', refreshGh);
    gh[k].addEventListener('change', saveGh);
  });
  gh.remember.addEventListener('change', saveGh);
  $('opt-download').addEventListener('change', function () {
    opts.download = $('opt-download').checked;
    try { localStorage.setItem(OPT_KEY, JSON.stringify(opts)); } catch (e) {}
  });
  document.addEventListener('focusin', function (e) {
    var t = e.target;
    if (t && t.closest && t.closest('#editor, #site-form') && /^(INPUT|TEXTAREA)$/.test(t.tagName)) {
      pending = JSON.stringify(state);
    }
  });
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 's') { e.preventDefault(); save(); }
  });

  // ---------- 시작 ----------
  var savedOpts = readJson('localStorage', OPT_KEY);
  if (savedOpts) opts.download = !!savedOpts.download;
  $('opt-download').checked = opts.download;
  initGh();

  var draft = readJson('localStorage', DRAFT_KEY);
  var resumed = false;
  if (draft && (Array.isArray(draft) || draft.dirty)) {
    state = B.normalize(Array.isArray(draft) ? draft : draft.data);
    dirty = true;
    resumed = true;
  }
  renderAll();
  if (resumed) setStatus('저장하지 않은 편집 내용을 이어서 불러왔습니다.', true);
  else if (ghReady(ghConfig())) pull('auto');
})();
