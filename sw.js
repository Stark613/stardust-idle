// 별가루 키우기 서비스 워커 — 오프라인 플레이 지원
const CACHE = 'stardust-idle-v1';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // 구글 시트 동기화 등 외부 요청은 그대로 네트워크로
  if (!e.request.url.startsWith(self.location.origin)) return;
  // 네트워크 우선, 실패하면 캐시 (게임 업데이트를 바로 받으면서 오프라인도 지원)
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then(hit => hit || caches.match('./index.html')))
  );
});
