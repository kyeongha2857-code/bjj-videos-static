// 공개 페이지와 관리자 페이지가 함께 쓰는 코드
window.BJJ = (function () {
  'use strict';

  var DEFAULT_SITE = {
    eyebrow: '노량진 주짓수락 · White Belt',
    title: '화이트벨트 기술 영상',
    lede: '기술 이름을 누르면 해당 기술 영상으로 이동합니다. 영상이 지정되지 않은 기술은 유튜브 검색 결과가 새 탭으로 열립니다.',
    scores: [
      { point: '2점', label: '테이크다운 · 스윕 · 니온벨리' },
      { point: '3점', label: '가드패스' },
      { point: '4점', label: '마운트 · 백마운트' }
    ],
    footer: '빨간 테두리 기술은 지정된 영상으로 바로 연결되고, 나머지는 유튜브 검색 결과로 연결됩니다. 자료 출처: 노량진 주짓수락 화이트벨트 가이드라인.',
    koSuffix: '주짓수',
    enSuffix: 'BJJ'
  };

  var counter = 0;
  function uid() { counter += 1; return 's' + Date.now().toString(36) + counter; }
  function str(v) { return typeof v === 'string' ? v : ''; }
  function isObj(v) { return !!v && typeof v === 'object'; }
  function list(v) { return Array.isArray(v) ? v.filter(isObj) : []; }

  // 어떤 모양의 데이터가 와도 { site, sections } 형태의 새 사본으로 맞춘다.
  // (예전 형식인 섹션 배열만 있는 data.js도 그대로 읽는다)
  function normalize(raw) {
    var src = Array.isArray(raw) ? { sections: raw } : (isObj(raw) ? raw : {});
    var site = isObj(src.site) ? src.site : {};
    var out = { site: {}, sections: [] };
    ['eyebrow', 'title', 'lede', 'footer', 'koSuffix', 'enSuffix'].forEach(function (k) {
      out.site[k] = typeof site[k] === 'string' ? site[k] : DEFAULT_SITE[k];
    });
    out.site.scores = list(Array.isArray(site.scores) ? site.scores : DEFAULT_SITE.scores).map(function (x) {
      return { point: str(x.point), label: str(x.label) };
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

  return {
    DEFAULT_SITE: DEFAULT_SITE, uid: uid, normalize: normalize, isHttp: isHttp,
    stripParen: stripParen, searchUrl: searchUrl, link: link, youtubeId: youtubeId
  };
})();
