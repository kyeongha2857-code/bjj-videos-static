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
    document.title = site.title || document.title;
    document.getElementById('site-eyebrow').textContent = site.eyebrow;
    document.getElementById('site-title').textContent = site.title;
    document.getElementById('site-lede').textContent = site.lede;
    document.getElementById('site-footer').textContent = site.footer;
    var box = document.getElementById('site-scores');
    box.hidden = site.scores.length === 0;
    box.innerHTML = site.scores.map(function (s) {
      return '<div><b>' + esc(s.point) + '</b><span>' + esc(s.label) + '</span></div>';
    }).join('');
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

    main.innerHTML = html || '<p class="empty">맞는 기술이 없습니다. 다른 이름으로 검색해 보세요.</p>';
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
  applySite();
  render();
})();
