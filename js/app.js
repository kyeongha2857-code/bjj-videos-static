(function () {
  var data = Array.isArray(window.BJJ_DATA) ? window.BJJ_DATA : [];

  // ?preview=1 이면 설정 페이지에서 편집 중인 초안(이 브라우저에 저장됨)을 보여준다
  if (/[?&]preview\b/.test(location.search)) {
    try {
      var draft = JSON.parse(localStorage.getItem('bjjDraft'));
      if (Array.isArray(draft)) {
        data = draft;
        document.getElementById('preview-banner').hidden = false;
      }
    } catch (e) {}
  }

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
  function isHttp(u) { return /^https?:\/\//i.test(u || ''); }
  function stripParen(s) { return String(s || '').replace(/\s*\(.*\)/, '').trim(); }

  // 영상 주소가 있으면 그 영상으로, 없으면 유튜브 검색으로 연결
  function link(it) {
    if (isHttp(it.video)) return it.video;
    var q = lang === 'ko'
      ? stripParen(it.ko) + ' 주짓수'
      : (it.en ? it.en : stripParen(it.ko)) + ' BJJ';
    return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);
  }

  function render() {
    var term = input.value.trim().toLowerCase();
    var html = '';
    var navHtml = '';
    var total = 0;

    data.forEach(function (sec) {
      var secHtml = '';
      (sec.groups || []).forEach(function (g) {
        var groupMatch = term && String(g.name || '').toLowerCase().indexOf(term) > -1;
        var items = (g.items || []).filter(function (it) {
          return !term || groupMatch ||
            String(it.ko || '').toLowerCase().indexOf(term) > -1 ||
            String(it.en || '').toLowerCase().indexOf(term) > -1;
        });
        if (!items.length) return;
        total += items.length;
        secHtml += '<div class="row"><h3>' + esc(g.name) + '</h3><div>' +
          (g.note ? '<p class="note">' + esc(g.note) + '</p>' : '') +
          '<div class="pills">' + items.map(function (it) {
            return '<a class="pill' + (isHttp(it.video) ? ' has-video' : '') + '" href="' + esc(link(it)) +
              '" target="_blank" rel="noopener noreferrer">' + esc(it.ko) + '</a>';
          }).join('') + '</div></div></div>';
      });
      if (secHtml) {
        html += '<section id="' + esc(sec.id) + '"><h2>' + esc(sec.title) + '</h2><p class="desc">' +
          esc(sec.desc) + '</p><div class="rows">' + secHtml + '</div></section>';
        navHtml += '<a href="#' + esc(sec.id) + '">' + esc(stripParen(sec.title)) + '</a>';
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
  render();
})();
