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

    data.sections.forEach(function (sec) {
      var secHtml = '';
      sec.groups.forEach(function (g) {
        var groupMatch = term && g.name.toLowerCase().indexOf(term) > -1;
        var items = g.items.filter(function (it) {
          return !term || groupMatch ||
            it.ko.toLowerCase().indexOf(term) > -1 || it.en.toLowerCase().indexOf(term) > -1;
        });
        if (!items.length) return;
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

    main.innerHTML = html || '<p class="empty">' + esc(site.emptyText) + '</p>';
    nav.innerHTML = navHtml;
    syncBar();
  }

  function syncBar() {
    document.documentElement.style.setProperty('--bar-h', bar.offsetHeight + 'px');
  }

  function setLang(l) {
    lang = l;
    btnKo.setAttribute('aria-pressed', String(l === 'ko'));
    btnEn.setAttribute('aria-pressed', String(l === 'en'));
    try { localStorage.setItem('bjjLang', l); } catch (e) {}
    render();
  }

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
})();
