/* 주짓수 樂 가이드: 홈 화면 앱용 서비스 워커
   - 사이트 자체 파일은 "네트워크 우선"이라 항상 최신 내용(새 영상 연결 등)이 먼저 보입니다.
   - 인터넷이 안 될 때만 마지막으로 본 화면을 보여 줍니다.
   - 유튜브 영상과 외부 주소(폰트, 썸네일)는 건드리지 않습니다. */
var CACHE = 'bjj-v1';

self.addEventListener('install', function (e) {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // 관리자 화면은 항상 최신이어야 하고 저장 동작과 섞이면 안 되므로 캐시하지 않는다
  if (/\/admin(\.html)?$/.test(url.pathname) || url.pathname.indexOf('/js/admin') !== -1 || url.pathname.indexOf('/css/admin') !== -1) return;
  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.status === 200) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) {
        return hit || (req.mode === 'navigate' ? caches.match('./') : undefined);
      });
    })
  );
});
