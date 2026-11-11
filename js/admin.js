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
    setStatus('편집 중 (저장하기 전까지는 이 브라우저에 초안으로만 남습니다)');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
        setStatus('초안 저장됨. 공개 페이지에 반영하려면 [GitHub에 저장]을 누르세요.');
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

  var HEADER = '// 기술 목록. 설정 페이지(admin.html)에서 저장하면 자동으로 갱신됩니다.\n' +
    '// video: 영상 주소 (비우면 유튜브 검색으로 연결)\n';

  function buildText(list) {
    return HEADER + 'window.BJJ_DATA = ' + JSON.stringify(list, null, 1) + ';\n';
  }

  // data.js 본문에서 목록 배열만 꺼낸다
  function parseText(text) {
    var a = text.indexOf('[');
    var b = text.lastIndexOf(']');
    if (a < 0 || b < a) throw new Error('목록을 찾지 못했습니다.');
    return normalize(JSON.parse(text.slice(a, b + 1)));
  }

  function download() {
    var list = clean();
    var problem = validate(list);
    if (problem) { setStatus(problem, true); return; }
    var blob = new Blob([buildText(list)], { type: 'text/javascript;charset=utf-8' });
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
      try {
        var list = parseText(String(reader.result));
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

  // ---------- GitHub 연결 ----------
  var GH_KEY = 'bjjGh';
  var ghEl = {
    owner: document.getElementById('gh-owner'),
    repo: document.getElementById('gh-repo'),
    branch: document.getElementById('gh-branch'),
    path: document.getElementById('gh-path'),
    token: document.getElementById('gh-token'),
    remember: document.getElementById('gh-remember'),
    state: document.getElementById('gh-state'),
    panel: document.getElementById('gh-panel')
  };

  function store(kind) {
    try { return window[kind]; } catch (e) { return null; }
  }

  function readGh() {
    var out = null;
    ['localStorage', 'sessionStorage'].forEach(function (k) {
      if (out) return;
      var st = store(k);
      try {
        var raw = st && st.getItem(GH_KEY);
        if (raw) out = JSON.parse(raw);
      } catch (e) {}
    });
    return out || {};
  }

  // github.io 주소에서 저장소 주인과 이름을 미리 채운다 (예: 계정.github.io/저장소/)
  function guessRepo() {
    var m = /^([^.]+)\.github\.io$/i.exec(location.hostname);
    var seg = location.pathname.split('/').filter(Boolean)[0];
    return {
      owner: m ? m[1] : '',
      repo: m && seg && !/\.html?$/i.test(seg) ? seg : ''
    };
  }

  function ghConfig() {
    return {
      owner: ghEl.owner.value.trim(),
      repo: ghEl.repo.value.trim(),
      branch: ghEl.branch.value.trim() || 'main',
      path: ghEl.path.value.trim().replace(/^\/+/, '') || 'data.js',
      token: ghEl.token.value.trim()
    };
  }

  function ghReady(c) { return !!(c.owner && c.repo && c.token); }

  function refreshGhState() {
    var ok = ghReady(ghConfig());
    ghEl.state.textContent = ok ? '연결됨' : '설정 필요';
    ghEl.state.className = 'c ' + (ok ? 'ok' : 'warn');
  }

  function saveGh() {
    var c = ghConfig();
    var keep = ghEl.remember.checked;
    var data = JSON.stringify(c);
    try { localStorage.removeItem(GH_KEY); } catch (e) {}
    try { sessionStorage.removeItem(GH_KEY); } catch (e) {}
    try {
      (keep ? localStorage : sessionStorage).setItem(GH_KEY, data);
    } catch (e) {
      setStatus('이 브라우저에 연결 정보를 저장하지 못했습니다. 이번에만 입력한 값으로 동작합니다.', true);
    }
    refreshGhState();
  }

  function initGh() {
    var saved = readGh();
    var guess = guessRepo();
    ghEl.owner.value = saved.owner || guess.owner;
    ghEl.repo.value = saved.repo || guess.repo;
    ghEl.branch.value = saved.branch || 'main';
    ghEl.path.value = saved.path || 'data.js';
    ghEl.token.value = saved.token || '';
    try { ghEl.remember.checked = !(store('sessionStorage') && sessionStorage.getItem(GH_KEY)); } catch (e) {}
    refreshGhState();
    if (!ghReady(ghConfig())) ghEl.panel.open = true;
  }

  function ghUrl(c) {
    return 'https://api.github.com/repos/' + encodeURIComponent(c.owner) + '/' + encodeURIComponent(c.repo) +
      '/contents/' + c.path.split('/').map(encodeURIComponent).join('/');
  }

  function ghHeaders(c, extra) {
    var h = { 'Accept': 'application/vnd.github+json', 'Authorization': 'Bearer ' + c.token, 'X-GitHub-Api-Version': '2022-11-28' };
    Object.keys(extra || {}).forEach(function (k) { h[k] = extra[k]; });
    return h;
  }

  function ghError(res) {
    if (res.status === 401) return '토큰이 올바르지 않거나 만료되었습니다. GitHub 연결에서 토큰을 다시 확인해 주세요.';
    if (res.status === 403) return '이 토큰에 쓰기 권한이 없습니다. 토큰의 Contents 권한이 Read and write인지 확인해 주세요.';
    if (res.status === 404) return '저장소나 파일을 찾지 못했습니다. 저장소 주인/이름/브랜치/경로와, 토큰이 이 저장소를 선택했는지 확인해 주세요.';
    if (res.status === 409 || res.status === 422) return '저장소의 파일이 그 사이에 바뀌었습니다. 다시 한 번 저장해 주세요.';
    return 'GitHub 요청이 실패했습니다. (' + res.status + ')';
  }

  function toBase64(text) {
    var bytes = new TextEncoder().encode(text);
    var bin = '';
    for (var i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  }

  function fromBase64(b64) {
    var bin = atob(String(b64).replace(/\s/g, ''));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  }

  function getRemote(c) {
    return fetch(ghUrl(c) + '?ref=' + encodeURIComponent(c.branch) + '&_=' + Date.now(), {
      headers: ghHeaders(c), cache: 'no-store'
    });
  }

  var busy = false;
  function setBusy(v) {
    busy = v;
    document.getElementById('publish').disabled = v;
    document.getElementById('pull').disabled = v;
  }

  function needGh() {
    var c = ghConfig();
    if (!ghReady(c)) {
      ghEl.panel.open = true;
      setStatus('먼저 GitHub 연결 정보(저장소와 토큰)를 입력해 주세요.', true);
      return null;
    }
    saveGh();
    return c;
  }

  function publish() {
    if (busy) return;
    var list = clean();
    var problem = validate(list);
    if (problem) { setStatus(problem, true); return; }
    var c = needGh();
    if (!c) return;
    var text = buildText(list);
    setBusy(true);
    setStatus('GitHub에 저장하는 중...');

    function attempt(retry) {
      return getRemote(c).then(function (res) {
        if (res.status === 404) return null;          // 파일이 아직 없으면 새로 만든다
        if (!res.ok) throw new Error(ghError(res));
        return res.json();
      }).then(function (remote) {
        var body = {
          message: '설정 페이지에서 영상 목록 수정',
          content: toBase64(text),
          branch: c.branch
        };
        if (remote && remote.sha) body.sha = remote.sha;
        return fetch(ghUrl(c), {
          method: 'PUT',
          headers: ghHeaders(c, { 'Content-Type': 'application/json' }),
          body: JSON.stringify(body)
        });
      }).then(function (res) {
        if ((res.status === 409 || res.status === 422) && retry) return attempt(false);
        if (!res.ok) throw new Error(ghError(res));
        return res;
      });
    }

    attempt(true).then(function () {
      data = normalize(list);
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch (e) {}
      var t = new Date();
      setStatus('GitHub에 저장했습니다 (' + String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0') +
        '). 1~2분 뒤 공개 페이지에 반영됩니다.');
      render();
    }).catch(function (e) {
      setStatus(e && e.message && !/Failed to fetch|NetworkError|Load failed/i.test(e.message)
        ? e.message : '네트워크 오류로 GitHub에 연결하지 못했습니다. 접속 환경을 확인해 주세요.', true);
    }).then(function () { setBusy(false); });
  }

  function pull() {
    if (busy) return;
    var c = needGh();
    if (!c) return;
    if (!window.confirm('편집 중인 내용이 GitHub 저장소의 최신 목록으로 바뀝니다. 계속할까요?')) return;
    setBusy(true);
    setStatus('GitHub에서 불러오는 중...');
    getRemote(c).then(function (res) {
      if (!res.ok) throw new Error(ghError(res));
      return res.json();
    }).then(function (remote) {
      data = parseText(fromBase64(remote.content));
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch (e) {}
      render();
      setStatus('GitHub 저장소의 최신 목록을 불러왔습니다.');
    }).catch(function (e) {
      setStatus(e && e.message && !/Failed to fetch|NetworkError|Load failed/i.test(e.message)
        ? e.message : '네트워크 오류로 GitHub에 연결하지 못했습니다. 접속 환경을 확인해 주세요.', true);
    }).then(function () { setBusy(false); });
  }

  document.getElementById('download').addEventListener('click', download);
  document.getElementById('publish').addEventListener('click', publish);
  document.getElementById('pull').addEventListener('click', pull);
  document.getElementById('gh-save').addEventListener('click', function () {
    saveGh();
    setStatus('연결 정보를 저장했습니다.');
  });
  document.getElementById('gh-forget').addEventListener('click', function () {
    ghEl.token.value = '';
    saveGh();
    setStatus('저장된 토큰을 지웠습니다.');
  });
  ['owner', 'repo', 'branch', 'path', 'token'].forEach(function (k) {
    ghEl[k].addEventListener('input', refreshGhState);
  });
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); publish(); }
  });
  document.getElementById('import-btn').addEventListener('click', function () {
    document.getElementById('import-file').click();
  });
  document.getElementById('import-file').addEventListener('change', function (e) {
    if (e.target.files && e.target.files[0]) importFile(e.target.files[0]);
    e.target.value = '';
  });
  document.getElementById('reset').addEventListener('click', function () {
    if (!window.confirm('편집 중인 초안을 지우고 사이트에 배포된 목록으로 되돌립니다. 방금 GitHub에 저장했다면 반영 전의 옛 목록일 수 있으니, 그때는 [GitHub에서 불러오기]를 쓰세요. 계속할까요?')) return;
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
    data = normalize(clone(deployed));
    render();
    setStatus('배포된 목록으로 되돌렸습니다.');
  });

  var bar = document.querySelector('.bar');
  function syncBar() { document.documentElement.style.setProperty('--bar-h', bar.offsetHeight + 'px'); }
  window.addEventListener('resize', syncBar);

  initGh();
  render();
  setStatus(loadedDraft ? '이 브라우저에 저장된 초안을 불러왔습니다.' : '');
  syncBar();
})();
