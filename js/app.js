(function () {
  'use strict';
  var B = window.BJJ;
  var data = B.normalize(window.BJJ_DATA);

  // ?preview=1 이면 관리자 페이지에서 편집 중인 내용(이 브라우저에 보관됨)을 보여준다
  if (/[?&]preview\b/.test(location.search)) {
    try {
      var draft = JSON.parse(localStorage.getItem('bjjDraft'));
      if (draft) {
        data = B.normalize(draft.data || draft);
        document.getElementById('preview-banner').hidden = false;
      }
    } catch (e) {}
  }

  var site = data.site;
  var lang = 'ko';
  try { if (localStorage.getItem('bjjLang') === 'en') lang = 'en'; } catch (e) {}

  var input = document.getElementById('q');
  var main = document.getElementById('main');
  var nav = document.getElementById('nav');
  var bar = document.querySelector('.bar');
  var btnKo = document.getElementById('lang-ko');
  var btnEn = document.getElementById('lang-en');
  var onlyBtn = document.getElementById('only-video');
  var recentEl = document.getElementById('recent');
  var countEl = document.getElementById('result-count');
  var onlyVideo = false;
  try { onlyVideo = localStorage.getItem('bjjOnlyVideo') === '1'; } catch (e) {}
  var recent = [];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // 관리자 페이지에서 고친 사이트 문구를 화면에 반영
  function applySite() {
    B.applyHead(site);
    document.getElementById('site-eyebrow').textContent = site.eyebrow;
    document.getElementById('site-title').textContent = site.title;
    document.getElementById('site-lede').textContent = site.lede;
    document.getElementById('site-footer').textContent = site.footer;
    var box = document.getElementById('site-scores');
    box.hidden = site.scores.length === 0;
    box.innerHTML = site.scores.map(function (s) {
      return '<div><b>' + esc(s.point) + '</b><span>' + esc(s.label) + '</span></div>';
    }).join('');
    input.placeholder = site.searchPlaceholder;
    input.setAttribute('aria-label', site.searchPlaceholder || '기술 검색');
    btnKo.textContent = site.langKoLabel;
    btnEn.textContent = site.langEnLabel;
    document.getElementById('lang-seg').hidden = !site.showLang;
    if (!site.showLang) lang = 'ko';
    document.getElementById('admin-link').textContent = site.adminLinkText || '관리자';
    document.getElementById('admin-link-wrap').hidden = !site.showAdminLink;
    document.getElementById('site-eyebrow').hidden = !site.eyebrow;
    document.getElementById('site-lede').hidden = !site.lede;
    document.getElementById('site-footer').hidden = !site.footer;
    B.applyTheme(site);
  }

  function render() {
    var term = input.value.trim().toLowerCase();
    var html = '';
    var navHtml = '';
    var shown = 0;

    data.sections.forEach(function (sec) {
      var secHtml = '';
      sec.groups.forEach(function (g) {
        var groupMatch = term && g.name.toLowerCase().indexOf(term) > -1;
        var items = g.items.filter(function (it) {
          if (onlyVideo && !B.isHttp(it.video)) return false;
          return !term || groupMatch ||
            it.ko.toLowerCase().indexOf(term) > -1 || it.en.toLowerCase().indexOf(term) > -1;
        });
        if (!items.length) return;
        shown += items.length;
        secHtml += '<div class="row"><h3>' + esc(g.name) + '</h3><div>' +
          (g.note ? '<p class="note">' + esc(g.note) + '</p>' : '') +
          '<div class="pills">' + items.map(function (it) {
            return '<a class="pill' + (B.isHttp(it.video) ? ' has-video' : '') + '" href="' +
              esc(B.link(it, lang, site)) + '" target="_blank" rel="noopener noreferrer">' + esc(it.ko) + '</a>';
          }).join('') + '</div></div></div>';
      });
      if (secHtml) {
        html += '<section id="' + esc(sec.id) + '"><h2>' + esc(sec.title) + '</h2>' +
          (sec.desc ? '<p class="desc">' + esc(sec.desc) + '</p>' : '') +
          '<div class="rows">' + secHtml + '</div></section>';
        navHtml += '<a href="#' + esc(sec.id) + '">' + esc(B.stripParen(sec.title)) + '</a>';
      }
    });

    main.innerHTML = html || '<p class="empty">' + esc(onlyVideo && !term ? '아직 영상이 연결된 기술이 없습니다.' : site.emptyText) + '</p>';
    countEl.textContent = (term || onlyVideo) ? shown + '개 기술' : '';
    recentEl.hidden = !recent.length || !!term || onlyVideo;
    nav.innerHTML = navHtml;
    syncBar();
    lastSpy = '';
    spy();
  }

  function syncBar() {
    document.documentElement.style.setProperty('--bar-h', bar.offsetHeight + 'px');
  }

  // 스크롤하면 지금 보고 있는 분류를 위 메뉴에서 파랗게 표시
  var scroller = document.getElementById('scroll');
  var lastSpy = '';
  var spyQueued = false;
  function spy() {
    spyQueued = false;
    var secs = main.querySelectorAll('section');
    if (!secs.length) return;
    var line = scroller.getBoundingClientRect().top + bar.offsetHeight + 24;
    var cur = secs[0].id;
    for (var i = 0; i < secs.length; i++) {
      if (secs[i].getBoundingClientRect().top <= line) cur = secs[i].id;
    }
    if (cur === lastSpy) return;
    lastSpy = cur;
    var links = nav.querySelectorAll('a');
    for (var j = 0; j < links.length; j++) {
      var on = links[j].getAttribute('href') === '#' + cur;
      if (on) {
        links[j].setAttribute('aria-current', 'true');
        var a = links[j].getBoundingClientRect(), n = nav.getBoundingClientRect();
        nav.scrollLeft += (a.left - n.left) - (nav.clientWidth - a.width) / 2;
      } else {
        links[j].removeAttribute('aria-current');
      }
    }
  }
  scroller.addEventListener('scroll', function () {
    if (!spyQueued) { spyQueued = true; requestAnimationFrame(spy); }
  }, { passive: true });

  function setLang(l) {
    lang = l;
    btnKo.setAttribute('aria-pressed', String(l === 'ko'));
    btnEn.setAttribute('aria-pressed', String(l === 'en'));
    try { localStorage.setItem('bjjLang', l); } catch (e) {}
    render();
  }

  // 최근 올라온 영상: 동기화가 기록한 sync/videos.json 을 읽어 카드로 보여준다 (없으면 숨김)
  function fmtDate(iso) {
    var d = new Date(iso);
    return isNaN(d) ? '' : (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
  }
  function renderRecent() {
    if (!recent.length) { recentEl.hidden = true; return; }
    recentEl.innerHTML = '<h2>최근 올라온 영상</h2><div class="rail">' + recent.map(function (v) {
      var segs = String(v.title || '').split(/\s*[|｜]\s*/);
      var tag = v.series || (segs.length > 2 ? segs[segs.length - 1] : '');
      var sub = segs.length > 1 && segs[1] !== tag ? segs[1] : '';
      var techs = (v.items || []).slice(0, 3).map(function (k) { return k.split('/').pop(); }).join(' · ');
      return '<a class="vcard" href="https://www.youtube.com/watch?v=' + encodeURIComponent(v.id) +
        '" target="_blank" rel="noopener noreferrer">' +
        '<img src="https://i.ytimg.com/vi/' + encodeURIComponent(v.id) + '/mqdefault.jpg" alt="" loading="lazy">' +
        '<div class="vmeta">' + (tag ? '<span class="vtag">' + esc(tag) + '</span>' : '') +
        '<span class="vdate">' + esc(fmtDate(v.published)) + '</span></div>' +
        '<b class="vtitle">' + esc(segs[0]) + '</b>' +
        (sub ? '<span class="vsub">' + esc(sub) + '</span>' : '') +
        (techs ? '<span class="vtech">' + esc(techs) + '</span>' : '') + '</a>';
    }).join('') + '</div>';
    recentEl.hidden = !!input.value.trim() || onlyVideo;
    syncBar();
  }
  function loadRecent() {
    if (!window.fetch || /[?&]preview\b/.test(location.search)) return;
    fetch('sync/videos.json?_=' + Date.now(), { cache: 'no-store' }).then(function (r) {
      return r.ok ? r.json() : null;
    }).then(function (j) {
      if (!j || !j.videos) return;
      recent = Object.keys(j.videos).map(function (id) {
        var v = j.videos[id]; v.id = id; return v;
      }).filter(function (v) { return v.published; }).sort(function (a, b) {
        return a.published < b.published ? 1 : -1;
      }).slice(0, 8);
      renderRecent();
    }).catch(function () {});
  }

  onlyBtn.setAttribute('aria-pressed', String(onlyVideo));
  onlyBtn.addEventListener('click', function () {
    onlyVideo = !onlyVideo;
    onlyBtn.setAttribute('aria-pressed', String(onlyVideo));
    try { localStorage.setItem('bjjOnlyVideo', onlyVideo ? '1' : '0'); } catch (e) {}
    render();
  });
  // 키보드 / 를 누르면 검색창으로 이동
  document.addEventListener('keydown', function (e) {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target && e.target.tagName;
    if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return;
    e.preventDefault();
    input.focus();
  });

  btnKo.addEventListener('click', function () { setLang('ko'); });
  btnEn.addEventListener('click', function () { setLang('en'); });
  input.addEventListener('input', render);
  window.addEventListener('resize', syncBar);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncBar);

  btnKo.setAttribute('aria-pressed', String(lang === 'ko'));
  btnEn.setAttribute('aria-pressed', String(lang === 'en'));
  // 개인 도메인으로 접속했더라도 관리자 링크는 github.io 주소로 열리게 한다
  // (config.properties의 github.owner / github.repo 값을 사용)
  (function adminLinkToGithubIo() {
    if (/\.github\.io$/i.test(location.hostname) || !window.fetch) return;
    fetch('config.properties?_=' + Date.now(), { cache: 'no-store' }).then(function (r) {
      return r.ok ? r.text() : '';
    }).then(function (t) {
      var o = /^\s*github\.owner\s*[=:]\s*(\S+)/m.exec(t), r = /^\s*github\.repo\s*[=:]\s*(\S+)/m.exec(t);
      if (!o || !r) return;
      var a = document.getElementById('admin-link');
      a.href = 'https://' + o[1].toLowerCase() + '.github.io/' + r[1] + '/admin';
      a.target = '_top';
    }).catch(function () {});
  })();

  applySite();
  render();
  loadRecent();
  // 주소에 #분류 가 붙어 있으면 (화면이 그려진 뒤) 그 분류로 이동
  if (location.hash.length > 1) {
    var target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target && target.tagName === 'SECTION') target.scrollIntoView();
  }
})();
