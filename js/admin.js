(function () {
  'use strict';

  var YT = 'https://www.youtube.com/results?search_query=';
  var DRAFT_KEY = 'bjjDraft';
  var deployed = Array.isArray(window.BJJ_DATA) ? window.BJJ_DATA : [];

  var root = document.getElementById('editor');
  var statusEl = document.getElementById('status');
  var statEl = document.getElementById('stat');
  var open = {};
  var uidCount = 0;
  var saveTimer = null;

  function uid() { uidCount += 1; return 's' + Date.now().toString(36) + uidCount; }
  function isHttp(u) { return /^https?:\/\//i.test(u || ''); }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  function normalize(list) {
    if (!Array.isArray(list)) list = [];
    var seen = {};
    list.forEach(function (s) {
      s.title = s.title || '';
      s.desc = s.desc || '';
      if (!s.id || seen[s.id]) s.id = uid();
      seen[s.id] = true;
      s.groups = Array.isArray(s.groups) ? s.groups : [];
      s.groups.forEach(function (g) {
        g.name = g.name || '';
        g.note = g.note || '';
        g.items = Array.isArray(g.items) ? g.items : [];
        g.items.forEach(function (it) {
          it.ko = it.ko || '';
          it.en = it.en || '';
          it.video = it.video || '';
        });
      });
    });
    return list;
  }

  // 이 브라우저에 저장된 초안이 있으면 그것을, 없으면 배포된 목록을 편집한다
  var data;
  var loadedDraft = false;
  try {
    var raw = localStorage.getItem(DRAFT_KEY);
    if (raw) { data = normalize(JSON.parse(raw)); loadedDraft = true; }
  } catch (e) {}
  if (!data) data = normalize(clone(deployed));

  // ---------- 작은 DOM 도우미 ----------
  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (k === 'class') e.className = v;
        else if (k === 'text') e.textContent = v;
        else if (k === 'value') e.value = v;
        else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v);
      });
    }
    (kids || []).forEach(function (c) {
      if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  }

  function field(label, value, onInput, multiline) {
    var input = h(multiline ? 'textarea' : 'input', multiline ? { rows: '2' } : { type: 'text' });
    input.value = value;
    input.addEventListener('input', function () { onInput(input.value, input); changed(); });
    return h('label', { class: 'field' }, [h('span', { text: label }), input]);
  }

  function btn(text, cls, onClick, title) {
    var b = h('button', { type: 'button', class: 'btn ' + (cls || ''), text: text });
    if (title) b.title = title;
    b.addEventListener('click', onClick);
    return b;
  }

  function move(arr, i, d) {
    var j = i + d;
    if (j < 0 || j >= arr.length) return;
    var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    changed();
    render();
  }

  function remove(arr, i, message) {
    if (message && !window.confirm(message)) return;
    arr.splice(i, 1);
    changed();
    render();
  }

  function testUrl(it) {
    if (isHttp(it.video)) return it.video;
    return YT + encodeURIComponent(String(it.ko || '').replace(/\s*\(.*\)/, '').trim() + ' 주짓수');
  }

  // ---------- 초안 자동 저장 / 상태 표시 ----------
  function setStatus(text, warn) {
    statusEl.textContent = text;
    statusEl.className = 'status' + (warn ? ' dirty' : '');
  }

  function changed() {
    updateStat();
    setStatus('편집 중 (이 브라우저에 초안으로 저장됩니다)');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
        setStatus('초안 저장됨. 반영하려면 data.js를 내려받아 저장소에 커밋하세요.');
      } catch (e) {
        setStatus('이 브라우저에 초안을 저장하지 못했습니다. 작업이 끝나면 바로 data.js를 내려받으세요.', true);
      }
    }, 400);
  }

  function updateStat() {
    var total = 0, custom = 0;
    data.forEach(function (s) {
      s.groups.forEach(function (g) {
        g.items.forEach(function (it) { total += 1; if (isHttp(it.video)) custom += 1; });
      });
    });
    document.getElementById('stat').textContent =
      '기술 ' + total + '개 중 영상 직접 지정 ' + custom + '개 (나머지는 유튜브 검색으로 연결)';
  }

  // ---------- 화면 그리기 ----------
  function render() {
    root.textContent = '';
    data.forEach(function (sec, si) { root.appendChild(sectionNode(sec, si)); });
    root.appendChild(h('div', { class: 'actions' }, [
      btn('+ 섹션 추가', '', function () {
        var s = { id: uid(), title: '새 섹션', desc: '', groups: [] };
        data.push(s);
        open[s.id] = true;
        changed();
        render();
      })
    ]));
    updateStat();
  }

  function sectionNode(sec, si) {
    var count = 0;
    sec.groups.forEach(function (g) { count += g.items.length; });
    var titleSpan = h('span', { class: 't', text: sec.title || '(제목 없음)' });
    var det = h('details', { class: 'sec' }, [
      h('summary', null, [titleSpan, h('span', { class: 'c', text: count + '개' })])
    ]);
    if (open[sec.id]) det.open = true;
    det.addEventListener('toggle', function () { open[sec.id] = det.open; });

    var body = h('div', { class: 'sec-body' });
    body.appendChild(h('div', { class: 'fields' }, [
      field('섹션 제목', sec.title, function (v) { sec.title = v; titleSpan.textContent = v || '(제목 없음)'; }),
      field('섹션 설명', sec.desc, function (v) { sec.desc = v; })
    ]));
    body.appendChild(h('div', { class: 'actions' }, [
      btn('↑ 위로', 'sm', function () { move(data, si, -1); }),
      btn('↓ 아래로', 'sm', function () { move(data, si, 1); }),
      btn('섹션 삭제', 'sm danger', function () {
        remove(data, si, '"' + (sec.title || '이 섹션') + '" 섹션과 안의 모든 기술을 삭제할까요?');
      })
    ]));
    sec.groups.forEach(function (g, gi) { body.appendChild(groupNode(sec, g, gi)); });
    body.appendChild(h('div', { class: 'actions' }, [
      btn('+ 그룹 추가', '', function () {
        sec.groups.push({ name: '새 그룹', note: '', items: [] });
        open[sec.id] = true;
        changed();
        render();
      })
    ]));
    det.appendChild(body);
    return det;
  }

  function groupNode(sec, g, gi) {
    var box = h('div', { class: 'grp' });
    box.appendChild(h('div', { class: 'fields' }, [
      field('그룹 이름', g.name, function (v) { g.name = v; }),
      field('그룹 메모 (선택)', g.note, function (v) { g.note = v; }, true)
    ]));
    box.appendChild(h('div', { class: 'actions' }, [
      btn('↑', 'sm', function () { move(sec.groups, gi, -1); }, '그룹을 위로'),
      btn('↓', 'sm', function () { move(sec.groups, gi, 1); }, '그룹을 아래로'),
      btn('그룹 삭제', 'sm danger', function () {
        remove(sec.groups, gi, '"' + (g.name || '이 그룹') + '" 그룹과 안의 기술을 삭제할까요?');
      })
    ]));
    box.appendChild(h('div', { class: 'itemhead' }, [
      h('span', { text: '기술 이름' }), h('span', { text: '영어 검색어' }),
      h('span', { text: '영상 주소 (비우면 유튜브 검색)' }), h('span', { text: '' })
    ]));
    g.items.forEach(function (it, ii) { box.appendChild(itemRow(g, it, ii)); });
    box.appendChild(h('div', { class: 'actions' }, [
      btn('+ 기술 추가', 'sm', function () {
        g.items.push({ ko: '', en: '', video: '' });
        open[sec.id] = true;
        changed();
        render();
      })
    ]));
    return box;
  }

  function itemRow(g, it, ii) {
    function input(value, placeholder, onInput) {
      var i = h('input', { type: 'text', placeholder: placeholder, 'aria-label': placeholder });
      i.value = value;
      i.addEventListener('input', function () { onInput(i.value, i); changed(); });
      return i;
    }
    var test = h('a', { class: 'btn sm', target: '_blank', rel: 'noopener noreferrer', text: '▶', title: '이 항목의 링크 열어보기' });
    test.href = testUrl(it);

    var ko = input(it.ko, '기술 이름', function (v) { it.ko = v; test.href = testUrl(it); });
    var en = input(it.en, '영어 검색어', function (v) { it.en = v; });
    var video = input(it.video, '영상 주소 (비우면 유튜브 검색)', function (v, el) {
      it.video = v.trim();
      el.classList.toggle('invalid', it.video !== '' && !isHttp(it.video));
      test.href = testUrl(it);
    });
    video.classList.toggle('invalid', it.video !== '' && !isHttp(it.video));
    video.setAttribute('inputmode', 'url');

    return h('div', { class: 'itemrow' }, [
      ko, en, video,
      h('div', { class: 'ops' }, [
        test,
        btn('↑', 'sm', function () { move(g.items, ii, -1); }, '위로'),
        btn('↓', 'sm', function () { move(g.items, ii, 1); }, '아래로'),
        btn('✕', 'sm danger', function () { remove(g.items, ii); }, '삭제')
      ])
    ]);
  }

  // ---------- 내려받기 / 가져오기 / 되돌리기 ----------
  function clean() {
    return data.map(function (s) {
      return {
        id: s.id, title: s.title.trim(), desc: s.desc.trim(),
        groups: s.groups.map(function (g) {
          return {
            name: g.name.trim(), note: g.note.trim(),
            items: g.items.map(function (it) {
              return { ko: it.ko.trim(), en: it.en.trim(), video: it.video.trim() };
            })
          };
        })
      };
    });
  }

  function validate(list) {
    for (var si = 0; si < list.length; si++) {
      var s = list[si];
      if (!s.title) return (si + 1) + '번째 섹션의 제목이 비어 있습니다.';
      for (var gi = 0; gi < s.groups.length; gi++) {
        var g = s.groups[gi];
        if (!g.name) return '"' + s.title + '"의 ' + (gi + 1) + '번째 그룹 이름이 비어 있습니다.';
        for (var ii = 0; ii < g.items.length; ii++) {
          var it = g.items[ii];
          var where = '"' + s.title + '" > "' + g.name + '" > ' + (ii + 1) + '번째 기술: ';
          if (!it.ko) return where + '이름이 비어 있습니다.';
          if (it.video && !isHttp(it.video)) return where + '영상 주소는 http:// 또는 https://로 시작해야 합니다.';
        }
      }
    }
    return null;
  }

  function download() {
    var list = clean();
    var problem = validate(list);
    if (problem) { setStatus(problem, true); return; }
    var text = '// 기술 목록. 설정 페이지(admin.html)에서 내려받은 data.js로 이 파일을 교체하면 됩니다.\n' +
      '// video: 영상 주소 (비우면 유튜브 검색으로 연결)\n' +
      'window.BJJ_DATA = ' + JSON.stringify(list, null, 1) + ';\n';
    var blob = new Blob([text], { type: 'text/javascript;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'data.js';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    setStatus('data.js를 내려받았습니다. 저장소의 data.js를 이 파일로 교체해 커밋하세요.');
  }

  function importFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var text = String(reader.result);
      var a = text.indexOf('[');
      var b = text.lastIndexOf(']');
      try {
        if (a < 0 || b < a) throw new Error('x');
        var list = normalize(JSON.parse(text.slice(a, b + 1)));
        if (!window.confirm('편집 중인 내용이 가져온 파일 내용으로 바뀝니다. 계속할까요?')) return;
        data = list;
        changed();
        render();
      } catch (e) {
        setStatus('파일을 읽지 못했습니다. data.js 또는 목록 JSON 파일인지 확인해 주세요.', true);
      }
    };
    reader.readAsText(file, 'UTF-8');
  }

  document.getElementById('download').addEventListener('click', download);
  document.getElementById('import-btn').addEventListener('click', function () {
    document.getElementById('import-file').click();
  });
  document.getElementById('import-file').addEventListener('change', function (e) {
    if (e.target.files && e.target.files[0]) importFile(e.target.files[0]);
    e.target.value = '';
  });
  document.getElementById('reset').addEventListener('click', function () {
    if (!window.confirm('편집 중인 초안을 지우고 현재 배포된 목록으로 되돌립니다. 계속할까요?')) return;
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
    data = normalize(clone(deployed));
    render();
    setStatus('배포된 목록으로 되돌렸습니다.');
  });

  var bar = document.querySelector('.bar');
  function syncBar() { document.documentElement.style.setProperty('--bar-h', bar.offsetHeight + 'px'); }
  window.addEventListener('resize', syncBar);

  render();
  setStatus(loadedDraft ? '이 브라우저에 저장된 초안을 불러왔습니다.' : '');
  syncBar();
})();
