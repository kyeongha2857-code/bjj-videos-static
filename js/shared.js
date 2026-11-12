// 공개 페이지와 관리자 페이지가 함께 쓰는 코드
window.BJJ = (function () {
  'use strict';

  // 관리자 페이지에서 바꿀 수 있는 화면 설정의 기본값
  var DEFAULT_SITE = {
    eyebrow: '노량진 주짓수락 · White Belt',
    title: '화이트벨트 기술 영상',
    description: '',
    favicon: '',
    lede: '기술 이름을 누르면 해당 기술 영상으로 이동합니다. 영상이 지정되지 않은 기술은 유튜브 검색 결과가 새 탭으로 열립니다.',
    scores: [
      { point: '2점', label: '테이크다운 · 스윕 · 니온벨리' },
      { point: '3점', label: '가드패스' },
      { point: '4점', label: '마운트 · 백마운트' }
    ],
    searchPlaceholder: '기술 검색 (예: 암바, 스윕, 라쏘)',
    emptyText: '맞는 기술이 없습니다. 다른 이름으로 검색해 보세요.',
    showLang: true,
    langKoLabel: '한국어 검색',
    langEnLabel: 'English 검색',
    koSuffix: '주짓수',
    enSuffix: 'BJJ',
    footer: '▶ 표시가 있는 기술은 지정된 영상으로 바로 연결되고, 나머지는 유튜브 검색 결과로 연결됩니다. 자료 출처: 노량진 주짓수락 화이트벨트 가이드라인.',
    showAdminLink: true,
    adminLinkText: '관리자',
    accent: '#e5533d',
    mat: '#3b4a7a',
    theme: 'auto'
  };

  var counter = 0;
  function uid() { counter += 1; return 's' + Date.now().toString(36) + counter; }
  function str(v) { return typeof v === 'string' ? v : ''; }
  function isObj(v) { return !!v && typeof v === 'object'; }
  function list(v) { return Array.isArray(v) ? v.filter(isObj) : []; }
  function isColor(v) { return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v); }

  // 어떤 모양의 데이터가 와도 { site, sections } 형태의 새 사본으로 맞춘다.
  // (예전 형식인 섹션 배열만 있는 data.js도 그대로 읽는다)
  function normalize(raw) {
    var src = Array.isArray(raw) ? { sections: raw } : (isObj(raw) ? raw : {});
    var site = isObj(src.site) ? src.site : {};
    var out = { site: {}, sections: [] };
    Object.keys(DEFAULT_SITE).forEach(function (k) {
      var d = DEFAULT_SITE[k];
      var v = site[k];
      if (k === 'scores') {
        out.site.scores = list(Array.isArray(v) ? v : d).map(function (x) {
          return { point: str(x.point), label: str(x.label) };
        });
      } else if (k === 'accent' || k === 'mat') {
        out.site[k] = isColor(v) ? v.toLowerCase() : d;
      } else if (k === 'theme') {
        out.site.theme = v === 'light' || v === 'dark' ? v : 'auto';
      } else {
        out.site[k] = typeof v === typeof d ? v : d;
      }
    });
    var seen = {};
    list(src.sections).forEach(function (sec) {
      var id = str(sec.id);
      if (!/^[A-Za-z][\w-]*$/.test(id) || seen[id]) id = uid();
      seen[id] = true;
      out.sections.push({
        id: id,
        title: str(sec.title),
        desc: str(sec.desc),
        groups: list(sec.groups).map(function (g) {
          return {
            name: str(g.name),
            note: str(g.note),
            items: list(g.items).map(function (it) {
              return { ko: str(it.ko), en: str(it.en), video: str(it.video) };
            })
          };
        })
      });
    });
    return out;
  }

  function isHttp(u) { return /^https?:\/\//i.test(u || ''); }
  function stripParen(s) { return String(s || '').replace(/\s*\(.*\)/, '').trim(); }

  function searchUrl(it, lang, site) {
    var q = lang === 'en'
      ? (it.en || stripParen(it.ko)) + ' ' + (site.enSuffix || '')
      : stripParen(it.ko) + ' ' + (site.koSuffix || '');
    return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q.trim());
  }

  // 영상 주소가 있으면 그 영상, 없으면 유튜브 검색
  function link(it, lang, site) {
    return isHttp(it.video) ? it.video : searchUrl(it, lang, site);
  }

  function youtubeId(url) {
    var m = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|embed\/|live\/))([\w-]{11})/.exec(url || '');
    return m ? m[1] : '';
  }

  // ---------- 색 ----------
  function rgb(hex) { return [1, 3, 5].map(function (i) { return parseInt(hex.slice(i, i + 2), 16); }); }
  function hex(c) {
    return '#' + c.map(function (v) { return ('0' + Math.round(Math.max(0, Math.min(255, v))).toString(16)).slice(-2); }).join('');
  }
  function mix(a, b, t) {
    var x = rgb(a), y = rgb(b);
    return hex(x.map(function (v, i) { return v + (y[i] - v) * t; }));
  }
  // 0(검정) ~ 1(흰색) 밝기
  function luminance(h) {
    var c = rgb(h).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function inkOn(h) { return luminance(h) > 0.45 ? '#14080a' : '#ffffff'; }

  // 관리자 페이지에서 고른 색과 화면 모드를 페이지에 적용한다.
  // 어두운 화면에서는 고른 색을 밝게 바꿔 글자가 보이게 한다.
  function applyTheme(site) {
    var root = document.documentElement;
    if (site.theme === 'light' || site.theme === 'dark') root.setAttribute('data-theme', site.theme);
    else root.removeAttribute('data-theme');

    var light = '', dark = '';
    if (site.accent !== DEFAULT_SITE.accent) {
      var da = mix(site.accent, '#ffffff', 0.3);
      light += '--accent:' + site.accent + ';--accent-ink:' + inkOn(site.accent) + ';';
      dark += '--accent:' + da + ';--accent-ink:' + inkOn(da) + ';';
    }
    if (site.mat !== DEFAULT_SITE.mat) {
      light += '--mat:' + site.mat + ';';
      dark += '--mat:' + mix(site.mat, '#ffffff', 0.55) + ';';
    }
    var el = document.getElementById('bjj-theme');
    if (!el) {
      el = document.createElement('style');
      el.id = 'bjj-theme';
      document.head.appendChild(el);
    }
    el.textContent = light
      ? ':root{' + light + '}' +
        '@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){' + dark + '}}' +
        ':root[data-theme="dark"]{' + dark + '}'
      : '';
  }

  // 파비콘 값(이모지, 이미지 주소, 업로드한 이미지)을 <link>에 쓸 주소로 바꾼다
  function faviconHref(v) {
    v = (v || '').trim();
    if (!v) return '';
    if (/^(https?:\/\/|data:image\/|\.{0,2}\/)/i.test(v) || /\.(png|jpe?g|gif|svg|ico|webp)(\?.*)?$/i.test(v)) return v;
    var t = Array.from(v).slice(0, 2).join('').replace(/[<>&"']/g, '');
    return 'data:image/svg+xml,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text x="50" y="50" font-size="80" text-anchor="middle" dominant-baseline="central">' + t + '</text></svg>');
  }

  // 브라우저 탭 이름, 설명, 파비콘을 설정에 맞춘다
  function applyHead(site) {
    if (site.title) document.title = site.title;
    function meta(attr, name, val) {
      var m = document.head.querySelector('meta[' + attr + '="' + name + '"]');
      if (!val) { if (m) m.remove(); return; }
      if (!m) { m = document.createElement('meta'); m.setAttribute(attr, name); document.head.appendChild(m); }
      m.setAttribute('content', val);
    }
    meta('name', 'description', site.description);
    meta('property', 'og:description', site.description);
    meta('property', 'og:title', site.title);
    var href = faviconHref(site.favicon);
    var link = document.getElementById('bjj-favicon');
    if (!href) { if (link) link.remove(); return; }
    if (!link) {
      link = document.createElement('link');
      link.id = 'bjj-favicon';
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.removeAttribute('type');
    link.href = href;
  }

  return {
    DEFAULT_SITE: DEFAULT_SITE, uid: uid, normalize: normalize, isHttp: isHttp,
    stripParen: stripParen, searchUrl: searchUrl, link: link, youtubeId: youtubeId,
    luminance: luminance, applyTheme: applyTheme,
    faviconHref: faviconHref, applyHead: applyHead
  };
})();
