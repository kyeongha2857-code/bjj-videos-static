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
  var config = {};           // config.properties 내용
  var AUTH_KEY = 'bjjAuth';  // 이 탭에서 로그인했다는 표시

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
        btn('+ 큰 분류 추가', '', function () {
          change(function () {
            var s = { id: B.uid(), title: '새 큰 분류', desc: '', groups: [{ name: '새 작은 분류', note: '', items: [] }] };
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
        field('큰 분류 이름', sec.title, function (v) { sec.title = v; titleSpan.textContent = v || '(제목 없음)'; }),
        field('설명 (선택)', sec.desc, function (v) { sec.desc = v; })
      ]));
      body.appendChild(h('div', { class: 'actions' }, [
        btn('↑ 위로', 'sm', function () { move(state.sections, si, -1); }),
        btn('↓ 아래로', 'sm', function () { move(state.sections, si, 1); }),
        btn('큰 분류 삭제', 'sm danger', function () { removeAt(state.sections, si, '"' + (sec.title || '큰 분류') + '" 큰 분류를'); })
      ]));
    }
    groups.forEach(function (n) { body.appendChild(n); });
    if (!f) {
      body.appendChild(h('div', { class: 'actions' }, [
        btn('+ 작은 분류 추가', '', function () {
          change(function () { sec.groups.push({ name: '새 작은 분류', note: '', items: [] }); open[sec.id] = true; });
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
      box.appendChild(h('div', { class: 'grp-name', text: g.name || '(이름 없는 작은 분류)' }));
    } else {
      box.appendChild(h('div', { class: 'fields' }, [
        field('작은 분류 이름', g.name, function (v) { g.name = v; }),
        field('안내 글 (선택, 공개 페이지에 함께 보임)', g.note, function (v) { g.note = v; }, true)
      ]));
      box.appendChild(h('div', { class: 'actions' }, [
        btn('↑', 'sm', function () { move(sec.groups, gi, -1); }, '작은 분류를 위로'),
        btn('↓', 'sm', function () { move(sec.groups, gi, 1); }, '작은 분류를 아래로'),
        btn('작은 분류 삭제', 'sm danger', function () { removeAt(sec.groups, gi, '"' + (g.name || '작은 분류') + '" 작은 분류를'); })
      ]));
    }
    if (rows.length) {
      box.appendChild(h('div', { class: 'itemhead' }, [
        h('span', { text: '영상' }), h('span', { text: '기술 이름' }),
        h('span', { text: '영상 주소 (비우면 유튜브 검색)' }), h('span', { text: '영어 검색어 (선택)' }), h('span')
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

  // ---------- 화면 꾸미기 (공개 페이지의 글자와 색) ----------
  function checkbox(label, checked, onToggle) {
    var box = h('input', { type: 'checkbox' });
    box.checked = checked;
    box.addEventListener('change', function () { change(function () { onToggle(box.checked); }); });
    return h('label', { class: 'check' }, [box, h('span', { text: label })]);
  }

  function colorField(label, key, hint) {
    var s = state.site;
    var picker = h('input', { type: 'color', 'aria-label': label });
    picker.value = s[key];
    var code = h('code', { text: s[key] });
    var warn = h('span', { class: 'status dirty' });
    function check() {
      warn.textContent = B.luminance(s[key]) > 0.6 ? '색이 너무 밝으면 글자가 잘 안 보일 수 있어요.' : '';
    }
    picker.addEventListener('input', function () {
      s[key] = picker.value.toLowerCase();
      code.textContent = s[key];
      check();
      edited();
    });
    check();
    return h('div', { class: 'colorrow' }, [
      picker,
      h('div', null, [h('div', { class: 'colorlabel' }, [h('b', { text: label }), code]), h('div', { class: 'hint', text: hint }), warn])
    ]);
  }

  function card(title, kids) {
    return h('section', { class: 'card' }, [h('h2', { text: title })].concat(kids));
  }

  function renderSite() {
    var s = state.site;
    var D = B.DEFAULT_SITE;
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

    var themeSel = h('select', { 'aria-label': '화면 모드' }, [
      h('option', { value: 'auto', text: '보는 사람 기기 설정에 맞춤' }),
      h('option', { value: 'light', text: '항상 밝게' }),
      h('option', { value: 'dark', text: '항상 어둡게' })
    ]);
    themeSel.value = s.theme;
    themeSel.addEventListener('change', function () { change(function () { s.theme = themeSel.value; }); });

    root.appendChild(card('맨 위 제목 부분', [
      h('div', { class: 'fields' }, [
        field('제목 (브라우저 탭 이름도 같이 바뀝니다)', s.title, function (v) { s.title = v; }),
        field('제목 위 작은 글씨 (비우면 숨김)', s.eyebrow, function (v) { s.eyebrow = v; })
      ]),
      h('div', { class: 'fields' }, [field('제목 아래 소개 글 (비우면 숨김)', s.lede, function (v) { s.lede = v; }, true)])
    ]));

    root.appendChild(card('점수표', [
      h('p', { class: 'hint', text: '칸을 모두 지우면 점수표가 보이지 않습니다.' }),
      scoreBox,
      h('div', { class: 'actions' }, [
        btn('+ 점수 칸 추가', 'sm', function () { change(function () { s.scores.push({ point: '', label: '' }); }); })
      ])
    ]));

    root.appendChild(card('검색창', [
      h('div', { class: 'fields' }, [
        field('검색창 안에 흐리게 보이는 안내 글', s.searchPlaceholder, function (v) { s.searchPlaceholder = v; }),
        field('검색 결과가 없을 때 보이는 글', s.emptyText, function (v) { s.emptyText = v; })
      ])
    ]));

    root.appendChild(card('유튜브 검색 방식', [
      h('p', { class: 'hint', text: '영상 주소가 없는 기술은 "기술 이름 + 아래 단어"로 유튜브를 검색합니다.' }),
      h('div', { class: 'fields' }, [
        field('한국어 검색에 붙일 단어', s.koSuffix, function (v) { s.koSuffix = v; }),
        field('영어 검색에 붙일 단어', s.enSuffix, function (v) { s.enSuffix = v; })
      ]),
      checkbox('한국어 / 영어 검색을 고르는 버튼 보이기', s.showLang, function (v) { s.showLang = v; }),
      s.showLang ? h('div', { class: 'fields' }, [
        field('한국어 버튼 글자', s.langKoLabel, function (v) { s.langKoLabel = v; }),
        field('영어 버튼 글자', s.langEnLabel, function (v) { s.langEnLabel = v; })
      ]) : null
    ]));

    root.appendChild(card('맨 아래 부분', [
      h('div', { class: 'fields' }, [field('안내 글 (비우면 숨김)', s.footer, function (v) { s.footer = v; }, true)]),
      checkbox('관리자 페이지로 가는 링크 보이기', s.showAdminLink, function (v) { s.showAdminLink = v; }),
      s.showAdminLink
        ? h('div', { class: 'fields' }, [field('링크 글자', s.adminLinkText, function (v) { s.adminLinkText = v; })])
        : h('p', { class: 'hint', text: '링크를 숨겨도 주소 뒤에 admin.html을 붙이면 이 페이지에 들어올 수 있습니다.' })
    ]));

    root.appendChild(card('색과 화면 모드', [
      colorField('강조 색', 'accent', '작은 머리글, 점수, 영상이 지정된 기술, 마우스를 올렸을 때 색입니다.'),
      colorField('보조 색', 'mat', '작은 분류 이름, 분류 바로가기, 선택된 버튼 색입니다.'),
      h('label', { class: 'field narrow' }, [h('span', { text: '화면 모드' }), themeSel]),
      h('p', { class: 'hint', text: '어두운 화면에서는 고른 색이 자동으로 조금 밝게 바뀝니다.' }),
      h('div', { class: 'actions' }, [
        btn('색과 화면 모드를 처음 상태로', 'sm', function () {
          change(function () { s.accent = D.accent; s.mat = D.mat; s.theme = D.theme; });
        })
      ])
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
    var site = {};
    Object.keys(s).forEach(function (k) { site[k] = typeof s[k] === 'string' ? s[k].trim() : s[k]; });
    site.scores = s.scores.map(function (x) { return { point: x.point.trim(), label: x.label.trim() }; })
      .filter(function (x) { return x.point || x.label; });
    return {
      site: site,
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
    if (!out.site.title) return '[화면 꾸미기]의 제목이 비어 있습니다.';
    for (var si = 0; si < out.sections.length; si++) {
      var s = out.sections[si];
      if (!s.title) return (si + 1) + '번째 큰 분류의 이름이 비어 있습니다.';
      for (var gi = 0; gi < s.groups.length; gi++) {
        var g = s.groups[gi];
        if (!g.name) return '"' + s.title + '"의 ' + (gi + 1) + '번째 작은 분류 이름이 비어 있습니다.';
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

  function downloadText(text, name) {
    var blob = new Blob([text], { type: 'text/javascript;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name || 'data.js';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  // ---------- GitHub 연결 ----------
  var gh = {};
  ['owner', 'repo', 'branch', 'path', 'token'].forEach(function (k) { gh[k] = $('gh-' + k); });

  function readJson(kind, key) {
    try { var st = store(kind); var raw = st && st.getItem(key); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }

  // ---------- 토큰 파일 (이 PC의 파일에서 읽는다. 브라우저에는 저장하지 않는다) ----------
  var tokenHandle = null;   // 고른 파일 (Chrome, Edge). 파일 위치만 기억하고 내용은 저장하지 않는다.
  var tokenName = '';
  var memToken = '';        // 읽어 온 토큰. 메모리에만 있고 새로고침하면 사라진다.
  var tokenError = '';

  function idb(mode, fn) {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error('no indexedDB')); return; }
      var req = window.indexedDB.open('bjj-admin', 1);
      req.onupgradeneeded = function () { req.result.createObjectStore('kv'); };
      req.onerror = function () { reject(req.error); };
      req.onsuccess = function () {
        var db = req.result;
        var tx = db.transaction('kv', mode);
        var r = fn(tx.objectStore('kv'));
        tx.oncomplete = function () { db.close(); resolve(r && r.result); };
        tx.onerror = tx.onabort = function () { db.close(); reject(tx.error); };
      };
    });
  }

  // 파일 내용에서 토큰만 꺼낸다. 토큰 한 줄, token=..., 주석(#) 섞인 파일 모두 읽는다.
  function parseToken(text) {
    var m = /(github_pat_[A-Za-z0-9_]+|gh[pousr]_[A-Za-z0-9]+)/.exec(String(text));
    if (m) return m[1];
    var line = String(text).split(/\r?\n/).map(function (l) { return l.trim(); })
      .filter(function (l) { return l && l.charAt(0) !== '#'; })[0] || '';
    var eq = line.indexOf('=');
    return (eq > -1 ? line.slice(eq + 1) : line).trim();
  }

  // interactive가 true이면 읽기 허용을 물어볼 수 있다 (버튼을 누른 직후에만 가능)
  function readTokenFile(interactive) {
    if (!tokenHandle) return Promise.resolve('');
    var perm = interactive
      ? tokenHandle.requestPermission({ mode: 'read' })
      : tokenHandle.queryPermission({ mode: 'read' });
    return Promise.resolve(perm).then(function (p) {
      if (p !== 'granted') {
        tokenError = '토큰 파일 읽기 허용이 필요합니다. [저장]이나 [연결 확인]을 누르면 허용 창이 나옵니다.';
        return '';
      }
      return tokenHandle.getFile().then(function (f) { return f.text(); }).then(function (t) {
        var tok = parseToken(t);
        tokenError = tok ? '' : '토큰 파일이 비어 있습니다. 파일 안에 토큰을 한 줄로 적어 주세요.';
        return tok;
      });
    }).catch(function (e) {
      tokenError = e && e.name === 'SecurityError'
        ? '허용 창을 띄우지 못했습니다. 버튼을 한 번 더 눌러 주세요.'
        : '토큰 파일을 열지 못했습니다. 파일이 옮겨졌거나 지워졌을 수 있습니다. [토큰 파일 선택]으로 다시 연결해 주세요.';
      return '';
    });
  }

  // 토큰이 필요한 작업 직전에 파일에서 최신 토큰을 읽는다. 직접 입력한 토큰이 있으면 그것을 쓴다.
  function ensureToken(interactive) {
    if (gh.token.value.trim() || !tokenHandle) return Promise.resolve();
    return readTokenFile(interactive).then(function (t) { memToken = t; refreshTokenUi(); });
  }

  function refreshTokenUi() {
    var el = $('tf-state');
    var text, cls = 'badge';
    if (gh.token.value.trim()) { text = '직접 입력 (이 탭에서만)'; cls += ' ok'; }
    else if (tokenHandle) { text = tokenName + (memToken ? ' · 읽음' : ' · 연결됨'); cls += ' ok'; }
    else if (memToken) { text = (tokenName || '파일') + ' · 이번 접속에서만'; cls += ' ok'; }
    else { text = '파일 없음'; cls += ' warn'; }
    el.textContent = text;
    el.className = cls;
    $('tf-clear').hidden = !(tokenHandle || memToken);
  }

  function useHandle(h) {
    tokenHandle = h;
    tokenName = h.name;
    memToken = '';
    return idb('readwrite', function (st) { return st.put(h, 'token'); }).catch(function () {})
      .then(function () { return readTokenFile(true); })
      .then(function (t) { memToken = t; refreshGh(); });
  }

  function loadTokenHandle() {
    return idb('readonly', function (st) { return st.get('token'); }).then(function (h) {
      if (!h) return;
      tokenHandle = h;
      tokenName = h.name || '토큰 파일';
      return readTokenFile(false).then(function (t) { memToken = t; });
    }).catch(function () {}).then(refreshGh);
  }

  function tokenMsg(text, warn) {
    var m = $('gh-msg');
    m.textContent = text;
    m.className = 'status' + (warn ? ' dirty' : '');
  }

  function pickTokenFile() {
    if (!window.showOpenFilePicker) { $('tf-input').click(); return; }   // 이 브라우저는 매번 파일을 고른다
    window.showOpenFilePicker({
      multiple: false,
      types: [{ description: '토큰 파일', accept: { 'text/plain': ['.txt', '.properties', '.token', '.key'] } }]
    }).then(function (hs) {
      return useHandle(hs[0]);
    }).then(function () {
      tokenMsg(memToken ? '토큰 파일을 연결했습니다.' : (tokenError || '토큰 파일을 연결했습니다.'), !memToken);
    }).catch(function (e) {
      if (e && e.name === 'AbortError') return;
      tokenMsg('파일을 열지 못했습니다.', true);
    });
  }

  function createTokenFile() {
    var tok = gh.token.value.trim();
    if (!tok) { tokenMsg('먼저 위 칸에 토큰을 붙여넣어 주세요.', true); return; }
    if (!window.showSaveFilePicker) {
      downloadText(tok + '\n', 'github-token.txt');
      tokenMsg('github-token.txt를 내려받았습니다. 원하는 폴더에 두고 [토큰 파일 선택]으로 연결해 주세요.', true);
      return;
    }
    window.showSaveFilePicker({
      suggestedName: 'github-token.txt',
      types: [{ description: '토큰 파일', accept: { 'text/plain': ['.txt'] } }]
    }).then(function (h) {
      return h.createWritable().then(function (w) {
        return w.write(tok + '\n').then(function () { return w.close(); });
      }).then(function () { return useHandle(h); });
    }).then(function () {
      gh.token.value = '';
      refreshGh();
      tokenMsg('토큰을 파일로 저장하고 연결했습니다. 이 칸에 붙여넣은 토큰은 지웠습니다.');
    }).catch(function (e) {
      if (e && e.name === 'AbortError') return;
      tokenMsg('파일을 저장하지 못했습니다.', true);
    });
  }

  function clearToken() {
    tokenHandle = null;
    tokenName = '';
    memToken = '';
    tokenError = '';
    gh.token.value = '';
    idb('readwrite', function (st) { return st.delete('token'); }).catch(function () {});
    refreshGh();
    tokenMsg('토큰 연결을 해제했습니다. 파일 자체는 지워지지 않으니 필요하면 직접 지워 주세요.');
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
      token: gh.token.value.trim() || memToken
    };
  }

  function ghReady(c) { return !!(c.owner && c.repo && (c.token || tokenHandle)); }

  function refreshGh() {
    refreshTokenUi();
    var ok = ghReady(ghConfig());
    $('gh-state').textContent = ok ? '연결 정보 있음' : '설정 필요';
    $('gh-state').className = 'badge ' + (ok ? 'ok' : 'warn');
    $('gh-dot').className = 'dot ' + (ok ? 'ok' : 'warn');
    $('gh-dot').title = ok ? 'GitHub 연결 정보 있음' : 'GitHub 연결 필요';
    $('save-mode').textContent = ok
      ? '[저장]을 누르면 GitHub 저장소의 data.js가 자동으로 업데이트되고, 1~2분 뒤 공개 페이지에 반영됩니다.'
      : 'GitHub 연결이 없어서, [저장]을 누르면 data.js 파일을 내려받습니다. 받은 파일을 저장소의 data.js와 교체해야 반영됩니다. 아래에서 연결해 두면 자동으로 반영됩니다.';
  }

  // 저장소 정보만 이 브라우저에 보관한다. 토큰은 저장하지 않는다.
  function saveGh() {
    var c = ghConfig();
    var json = JSON.stringify({ owner: c.owner, repo: c.repo, branch: c.branch, path: c.path });
    try { localStorage.removeItem(GH_KEY); } catch (e) {}
    try { sessionStorage.removeItem(GH_KEY); } catch (e) {}
    try { localStorage.setItem(GH_KEY, json); } catch (e) {}
    refreshGh();
  }

  function initGh() {
    var legacy = readJson('localStorage', GH_KEY) || readJson('sessionStorage', GH_KEY) || {};
    var guess = guessRepo();
    gh.owner.value = legacy.owner || config['github.owner'] || guess.owner;
    gh.repo.value = legacy.repo || config['github.repo'] || guess.repo;
    gh.branch.value = legacy.branch || config['github.branch'] || 'main';
    gh.path.value = legacy.path || config['github.path'] || 'data.js';
    gh.token.value = '';
    if (legacy.token) {
      // 예전 방식으로 브라우저에 저장돼 있던 토큰은 지운다. 이번 접속에서만 메모리로 쓴다.
      memToken = legacy.token;
      tokenName = '예전에 저장된 토큰';
      saveGh();
      tokenMsg('예전에 이 브라우저에 저장돼 있던 토큰을 지웠습니다. 이번 접속에서만 쓰이니, [토큰 파일 선택]으로 PC 파일에 옮겨 두세요.', true);
    } else {
      saveGh();
    }
  }

  function ghUrl(c, path) {
    return 'https://api.github.com/repos/' + encodeURIComponent(c.owner) + '/' + encodeURIComponent(c.repo) +
      '/contents/' + (path || c.path).split('/').map(encodeURIComponent).join('/');
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

  function getRemote(c, path) {
    return fetch(ghUrl(c, path) + '?ref=' + encodeURIComponent(c.branch) + '&_=' + Date.now(), { headers: ghHeaders(c), cache: 'no-store' });
  }

  function setBusy(v) {
    busy = v;
    ['save', 'pull', 'discard', 'gh-test', 'pw-save', 'pw-clear'].forEach(function (id) { $(id).disabled = v; });
  }

  function clock() {
    var t = new Date();
    return String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0');
  }

  // 저장소의 파일 하나를 새 내용으로 커밋한다. 그 사이 파일이 바뀌어 충돌하면 한 번 다시 시도한다.
  function putFile(c, path, text, message) {
    function attempt(retry) {
      return getRemote(c, path).then(function (res) {
        if (res.status === 404) return null;          // 파일이 아직 없으면 새로 만든다
        if (!res.ok) throw new Error(ghError(res));
        return res.json();
      }).then(function (remote) {
        var body = { message: message, content: toBase64(text), branch: c.branch };
        if (remote && remote.sha) body.sha = remote.sha;
        return fetch(ghUrl(c, path), { method: 'PUT', headers: ghHeaders(c, { 'Content-Type': 'application/json' }), body: JSON.stringify(body) });
      }).then(function (res) {
        if ((res.status === 409 || res.status === 422) && retry) return attempt(false);
        if (!res.ok) throw new Error(ghError(res));
        return res;
      });
    }
    return attempt(true);
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

    ensureToken(true).then(function () {
      var c2 = ghConfig();
      if (!c2.token) throw new Error(tokenError || '토큰이 없습니다. [저장 설정]에서 토큰 파일을 연결해 주세요.');
      return putFile(c2, c2.path, text, '관리자 페이지에서 내용 수정');
    }).then(function () {
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
    ensureToken(mode !== 'auto').then(function () {
      var c2 = ghConfig();
      if (!c2.token) {
        var err = new Error(tokenError || '토큰이 없습니다. [저장 설정]에서 토큰 파일을 연결해 주세요.');
        err.soft = mode === 'auto';
        throw err;
      }
      return getRemote(c2);
    }).then(function (res) {
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
      if (e && e.soft) { setStatus(e.message); return; }   // 페이지를 막 연 상태라 허용 창을 띄울 수 없을 때
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
    if (!ghReady(c)) { say('저장소 주인, 저장소 이름을 입력하고 토큰 파일을 연결해 주세요.', true); return; }
    setBusy(true);
    say('확인하는 중...');
    ensureToken(true).then(function () {
      var c2 = ghConfig();
      if (!c2.token) throw new Error(tokenError || '토큰이 없습니다. 토큰 파일을 연결해 주세요.');
      return getRemote(c2);
    }).then(function (res) {
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
  $('tf-pick').addEventListener('click', pickTokenFile);
  $('tf-create').addEventListener('click', createTokenFile);
  $('tf-clear').addEventListener('click', clearToken);
  $('tf-input').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () {
      var tok = parseToken(reader.result);
      if (!tok) { tokenMsg('파일에서 토큰을 찾지 못했습니다.', true); return; }
      tokenHandle = null;
      tokenName = f.name;
      memToken = tok;
      refreshGh();
      tokenMsg('토큰 파일을 읽었습니다. 이 브라우저에서는 이번 접속에서만 쓰이고, 다음에 열 때 다시 선택해야 합니다.');
    };
    reader.readAsText(f, 'UTF-8');
  });
  ['owner', 'repo', 'branch', 'path'].forEach(function (k) {
    gh[k].addEventListener('input', refreshGh);
    gh[k].addEventListener('change', saveGh);
  });
  gh.token.addEventListener('input', refreshGh);
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

  // ---------- config.properties (비밀번호, GitHub 기본값) ----------
  var PROP_KEYS = ['admin.password', 'admin.password.salt', 'admin.password.hash',
    'github.owner', 'github.repo', 'github.branch', 'github.path'];

  function parseProps(text) {
    var out = {};
    String(text).split(/\r?\n/).forEach(function (line) {
      line = line.trim();
      if (!line || line.charAt(0) === '#' || line.charAt(0) === '!') return;
      var i = line.search(/[=:]/);
      if (i < 1) return;
      out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    });
    return out;
  }

  function buildProps(cfg) {
    function v(k) { return cfg[k] || ''; }
    return [
      '# 주짓수 영상 사이트 관리자 설정',
      '# 관리자 페이지의 [저장 설정]에서 비밀번호를 바꾸면 이 파일이 자동으로 다시 만들어집니다.',
      '# 주의: 이 파일은 누구나 볼 수 있습니다. GitHub 토큰은 절대 여기에 넣지 마세요.',
      '',
      '# 관리자 페이지 비밀번호 (암호화된 값). 관리자 페이지에서 정하면 아래 두 줄이 채워집니다.',
      '# 두 줄을 모두 비우면 비밀번호 없이 열립니다.',
      'admin.password.salt=' + v('admin.password.salt'),
      'admin.password.hash=' + v('admin.password.hash'),
      '',
      '# 비밀번호를 글자 그대로 적어도 동작하지만, 저장소를 보는 사람 누구나 읽을 수 있어 권하지 않습니다.',
      '# 위의 암호화된 값이 있으면 이 줄은 쓰이지 않습니다.',
      'admin.password=' + v('admin.password'),
      '',
      '# GitHub 연결 기본값 (비워 두면 사이트 주소에서 자동으로 알아냅니다)',
      'github.owner=' + v('github.owner'),
      'github.repo=' + v('github.repo'),
      'github.branch=' + (v('github.branch') || 'main'),
      'github.path=' + (v('github.path') || 'data.js'),
      ''
    ].join('\n');
  }

  function loadConfig() {
    return Promise.resolve().then(function () {
      return fetch('config.properties?_=' + Date.now(), { cache: 'no-store' });
    }).then(function (res) {
      return res && res.ok ? res.text() : '';
    }).then(parseProps).catch(function () { return {}; });
  }

  function toHex(bytes) {
    return Array.prototype.map.call(bytes, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  function fromHex(hexStr) {
    var out = new Uint8Array(hexStr.length / 2);
    for (var i = 0; i < out.length; i++) out[i] = parseInt(hexStr.substr(i * 2, 2), 16);
    return out;
  }

  // 비밀번호를 그대로 저장하지 않고, 되돌릴 수 없는 값으로 바꿔서 저장한다 (PBKDF2)
  function derive(password, saltHex) {
    var subtle = window.crypto && window.crypto.subtle;
    if (!subtle) return Promise.reject(new Error('이 브라우저에서는 비밀번호 기능을 쓸 수 없습니다. https 주소로 접속해 주세요.'));
    return subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']).then(function (key) {
      return subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations: 150000 }, key, 256);
    }).then(function (buf) { return toHex(new Uint8Array(buf)); });
  }

  function hasPassword() { return !!(config['admin.password.hash'] || config['admin.password']); }
  function authMark() { return config['admin.password.hash'] || ('plain:' + config['admin.password']); }
  function setAuth() { try { sessionStorage.setItem(AUTH_KEY, authMark()); } catch (e) {} }

  function checkPassword(input) {
    if (config['admin.password.hash']) {
      return derive(input, config['admin.password.salt'] || '').then(function (h2) { return h2 === config['admin.password.hash']; });
    }
    return Promise.resolve(input === config['admin.password']);
  }

  function refreshPw() {
    var on = hasPassword();
    $('pw-state').textContent = on ? '사용 중' : '없음';
    $('pw-state').className = 'badge ' + (on ? 'ok' : '');
    $('pw-clear').hidden = !on;
    $('lock').hidden = !on;
  }

  // 바뀐 설정을 config.properties로 저장한다 (GitHub 연결이 없으면 파일로 내려받는다)
  function saveConfig(next, doneText) {
    var msg = $('pw-msg');
    function say(text, warn) { msg.textContent = text; msg.className = 'status' + (warn ? ' dirty' : ''); }
    var c = ghConfig();
    next['github.owner'] = c.owner;
    next['github.repo'] = c.repo;
    next['github.branch'] = c.branch;
    next['github.path'] = c.path;
    var text = buildProps(next);
    function applied() {
      config = next;
      if (hasPassword()) setAuth(); else { try { sessionStorage.removeItem(AUTH_KEY); } catch (e) {} }
      $('pw-new').value = '';
      $('pw-new2').value = '';
      refreshPw();
    }
    if (!ghReady(c)) {
      downloadText(text, 'config.properties');
      applied();
      say('config.properties 파일을 내려받았습니다. 저장소 맨 위 폴더에 올려야 적용됩니다. (GitHub를 연결하면 자동으로 올라갑니다)', true);
      return;
    }
    var dir = c.path.indexOf('/') > -1 ? c.path.slice(0, c.path.lastIndexOf('/') + 1) : '';
    setBusy(true);
    say('저장하는 중...');
    ensureToken(true).then(function () {
      var c2 = ghConfig();
      if (!c2.token) throw new Error(tokenError || '토큰이 없습니다. [저장 설정]에서 토큰 파일을 연결해 주세요.');
      return putFile(c2, dir + 'config.properties', text, '관리자 설정 변경');
    }).then(function () {
      applied();
      say(doneText + ' 1~2분 뒤부터 적용됩니다.');
    }).catch(function (e) { say(errText(e), true); }).then(function () { setBusy(false); });
  }

  function copyConfig() {
    var next = {};
    PROP_KEYS.forEach(function (k) { next[k] = config[k] || ''; });
    return next;
  }

  $('pw-save').addEventListener('click', function () {
    var a = $('pw-new').value, b = $('pw-new2').value;
    var msg = $('pw-msg');
    function warn(t) { msg.textContent = t; msg.className = 'status dirty'; }
    if (a.length < 8) { warn('비밀번호는 8자 이상으로 정해 주세요.'); return; }
    if (a !== b) { warn('두 칸의 비밀번호가 서로 다릅니다.'); return; }
    var salt = new Uint8Array(16);
    window.crypto.getRandomValues(salt);
    var saltHex = toHex(salt);
    derive(a, saltHex).then(function (hash) {
      var next = copyConfig();
      next['admin.password.salt'] = saltHex;
      next['admin.password.hash'] = hash;
      next['admin.password'] = '';
      saveConfig(next, '비밀번호를 저장했습니다.');
    }).catch(function (e) { warn(e.message); });
  });

  $('pw-clear').addEventListener('click', function () {
    if (!window.confirm('비밀번호를 없애면 누구나 이 관리자 페이지를 열 수 있습니다. 계속할까요?')) return;
    var next = copyConfig();
    next['admin.password.salt'] = '';
    next['admin.password.hash'] = '';
    next['admin.password'] = '';
    saveConfig(next, '비밀번호를 없앴습니다.');
  });

  $('lock').addEventListener('click', function () {
    try { sessionStorage.removeItem(AUTH_KEY); } catch (e) {}
    location.reload();
  });

  $('login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var msg = $('login-msg');
    msg.textContent = '확인하는 중...';
    checkPassword($('login-pw').value).then(function (ok) {
      if (!ok) { msg.textContent = '비밀번호가 맞지 않습니다.'; $('login-pw').select(); return; }
      setAuth();
      $('login').hidden = true;
      start();
    }).catch(function (err) { msg.textContent = err.message; });
  });

  // ---------- 시작 ----------
  function start() {
    $('app').hidden = false;
    var savedOpts = readJson('localStorage', OPT_KEY);
    if (savedOpts) opts.download = !!savedOpts.download;
    $('opt-download').checked = opts.download;
    initGh();
    refreshPw();

    var draft = readJson('localStorage', DRAFT_KEY);
    var resumed = false;
    if (draft && (Array.isArray(draft) || draft.dirty)) {
      state = B.normalize(Array.isArray(draft) ? draft : draft.data);
      dirty = true;
      resumed = true;
    }
    renderAll();
    if (resumed) setStatus('저장하지 않은 편집 내용을 이어서 불러왔습니다.', true);
    loadTokenHandle().then(function () {
      if (!resumed && ghReady(ghConfig())) pull('auto');
    });
  }

  loadConfig().then(function (cfg) {
    config = cfg;
    var authed = false;
    try { authed = sessionStorage.getItem(AUTH_KEY) === authMark(); } catch (e) {}
    if (hasPassword() && !authed) {
      $('login').hidden = false;
      $('login-pw').focus();
    } else {
      start();
    }
  });
})();
