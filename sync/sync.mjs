// 유튜브 채널의 새 영상을 읽어 data.js의 기술 항목에 영상 주소를 채워 넣습니다.
// 사용법: node sync/sync.mjs            (GitHub Actions에서 매일 실행)
//        FEED_FILE=파일.xml node sync/sync.mjs   (인터넷 없이 시험)
// 규칙:
//  - 이미 영상 주소가 있는 기술은 건드리지 않습니다(관리자가 직접 넣은 영상 우선).
//  - 이 스크립트가 넣은 영상만, 더 정확한 영상(단독 기술 영상)이 나오면 교체합니다.
//  - 어느 기술인지 확실하지 않은 영상은 sync/videos.json 의 status 가 "review" 로 남습니다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = (f) => path.join(ROOT, f);
const SKIP_SECTIONS = new Set(['pos']); // 포지션 이름은 제목에 문맥으로 자주 나와서 자동 매칭에서 제외
const watchUrl = (id) => `https://www.youtube.com/watch?v=${id}`;
const norm = (s) => s.toLowerCase().replace(/[\s·()\-_,.]/g, '');
const readJson = (f, dflt) => (fs.existsSync(P(f)) ? JSON.parse(fs.readFileSync(P(f), 'utf8')) : dflt);

// ---------- data.js 읽기/쓰기 (관리자 페이지와 같은 형식 유지) ----------
const dataSrc = fs.readFileSync(P('data.js'), 'utf8');
const head = dataSrc.slice(0, dataSrc.indexOf('window.BJJ_DATA = '));
const data = new Function('window', `${dataSrc}; return window.BJJ_DATA;`)({});
const writeData = () =>
  fs.writeFileSync(P('data.js'), `${head}window.BJJ_DATA = ${JSON.stringify(data, null, 1)};\n`);

// ---------- 기술 목록 ----------
const items = [];
for (const s of data.sections)
  for (const g of s.groups)
    for (const it of g.items)
      items.push({ key: `${s.id}/${g.name}/${it.ko}`, sec: s.id, secTitle: s.title, group: g.name, ref: it });
const byKey = new Map(items.map((i) => [i.key, i]));

// ---------- 영상 목록 가져오기 ----------
async function fetchFeed(channelId) {
  if (process.env.FEED_FILE) return fs.readFileSync(process.env.FEED_FILE, 'utf8');
  const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
  if (!res.ok) throw new Error(`RSS ${channelId}: HTTP ${res.status}`);
  return res.text();
}
const unesc = (s) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
function parseFeed(xml, channelName) {
  const out = [];
  for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const id = (m[1].match(/<yt:videoId>([^<]+)</) || [])[1];
    const title = (m[1].match(/<title>([^<]*)</) || [])[1];
    const published = (m[1].match(/<published>([^<]+)</) || [])[1] || null;
    const desc = (m[1].match(/<media:description>([\s\S]*?)<\/media:description>/) || [])[1] || '';
    if (id && title) out.push({ id, title: unesc(title), desc: unesc(desc), published, channel: channelName });
  }
  return out;
}

// ---------- 제목 → 기술 매칭 ----------
function matchTitle(title) {
  const segs = title.split(/\s*[|｜]\s*/);
  const primary = norm(segs[0]);
  const full = norm(title);
  const series = (segs.length > 1 && segs[segs.length - 1].match(/^(.+?)\s*(\d+)$/)) || null;
  // 긴 이름부터 찾고, 찾은 자리는 지워서 "스트레이트 암바" 안의 "암바"가 또 잡히지 않게 함
  const names = [...new Set(items.filter((i) => !SKIP_SECTIONS.has(i.sec)).map((i) => i.ref.ko))];
  const variants = [];
  for (const ko of names) {
    const v = new Set([norm(ko), norm(ko.replace(/\(.*?\)/g, ''))]);
    for (const x of v) if (x.length >= 2) variants.push({ ko, v: x });
  }
  variants.sort((a, b) => b.v.length - a.v.length);
  let text = primary;
  const hitNames = [];
  for (const { ko, v } of variants) {
    if (hitNames.includes(ko)) continue;
    const at = text.indexOf(v);
    if (at < 0) continue;
    text = text.slice(0, at) + '#'.repeat(v.length) + text.slice(at + v.length);
    hitNames.push(ko);
  }
  const keys = [];
  let ambiguous = false;
  for (const ko of hitNames) {
    const cands = items.filter((i) => !SKIP_SECTIONS.has(i.sec) && i.ref.ko === ko);
    let pick = cands;
    if (cands.length > 1) {
      pick = cands.filter((c) => full.includes(norm(c.group)) || full.includes(norm(c.secTitle)));
      if (pick.length !== 1) { ambiguous = true; continue; }
    }
    keys.push(pick[0].key);
  }
  return { keys, ambiguous, series: series ? `${series[1]} ${series[2]}` : null };
}


// ---------- Gemini 보완 (GEMINI_API_KEY 가 있을 때만, 규칙으로 못 찾은 영상에만 사용) ----------
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
async function askGemini(video) {
  const list = items.filter((i) => !SKIP_SECTIONS.has(i.sec)).map((i) => i.key);
  const prompt = [
    '다음은 주짓수 기술 영상의 제목과 설명입니다. 아래 "기술 목록" 중에서 이 영상이 직접 가르치는 기술만 골라 주세요.',
    '- 목록에 있는 값을 글자 그대로 사용하고, 목록에 없는 기술이나 단순히 언급만 된 포지션은 넣지 마세요.',
    '- 해당하는 기술이 없으면 빈 배열을 주세요.',
    '- 같은 이름이 여러 소분류에 있으면 영상 내용에 가장 맞는 하나만 고르세요.',
    '- 반드시 {"items": ["섹션/소분류/기술명", ...]} 형태의 JSON만 답하세요.',
    '',
    `제목: ${video.title}`,
    `설명: ${(video.desc || '').slice(0, 600)}`,
    '',
    '기술 목록:',
    ...list,
  ].join('\n');
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
  const j = await res.json();
  const text = j.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  const arr = JSON.parse(text).items;
  return Array.isArray(arr) ? arr.filter((k) => byKey.has(k)) : []; // 목록에 없는 값은 버림
}

// ---------- 실행 ----------
const channels = readJson('sync/channels.json', []);
const overrides = readJson('sync/overrides.json', {});
const state = readJson('sync/videos.json', { videos: {}, auto: {} });
state.videos ||= {}; state.auto ||= {};

const found = [];
for (const ch of channels) found.push(...parseFeed(await fetchFeed(ch.channelId), ch.name));
// 관리자가 overrides 에 적어 둔 영상(피드에 안 나오는 예전 영상 포함)도 함께 처리
for (const id of Object.keys(overrides)) {
  if (id.startsWith('_') || found.some((v) => v.id === id) || state.videos[id]) continue;
  found.push({ id, title: overrides[id]._title || '', published: null, channel: channels[0]?.name || '' });
}

const log = [];
const fresh = found.filter((v) => !state.videos[v.id]).sort((a, b) => (a.published || '').localeCompare(b.published || ''));
for (const v of fresh) {
  let keys, status, series = null;
  if (Array.isArray(overrides[v.id])) {
    keys = overrides[v.id].filter((k) => byKey.has(k));
    status = keys.length ? 'ok' : 'no-item';
  } else {
    const m = matchTitle(v.title);
    keys = m.keys; series = m.series;
    status = keys.length === 0 ? 'review' : m.ambiguous ? 'review' : 'ok';
    if (status === 'review' && GEMINI_KEY) {
      try {
        const ai = await askGemini(v);
        if (ai.length) { keys = [...new Set([...keys, ...ai])]; status = 'ai'; }
      } catch (e) {
        console.warn(`Gemini 보완 실패(규칙 매칭 결과만 사용): ${e.message}`);
      }
    }
  }
  const score = keys.length === 1 ? 2 : 1;
  const applied = [];
  for (const k of keys) {
    const it = byKey.get(k).ref;
    const prev = state.auto[k];
    const mine = prev && it.video === watchUrl(prev.videoId);
    if (!it.video || (mine && score > prev.score)) {
      it.video = watchUrl(v.id);
      state.auto[k] = { videoId: v.id, score };
      applied.push(k);
    }
  }
  state.videos[v.id] = { title: v.title, published: v.published, series, status, items: keys, applied };
  log.push(`${status.padEnd(7)} ${v.title}\n         → ${keys.join(', ') || '(연결할 기술 없음)'}${applied.length < keys.length ? `  [이미 영상이 있어 건너뜀: ${keys.length - applied.length}개]` : ''}`);
}

if (!fresh.length) {
  console.log('새 영상이 없습니다.');
} else {
  writeData();
  fs.writeFileSync(P('sync/videos.json'), JSON.stringify(state, null, 1) + '\n');
  console.log(`새 영상 ${fresh.length}개 처리\n` + log.join('\n'));
}
const review = Object.entries(state.videos).filter(([, v]) => v.status === 'review' || v.status === 'no-item');
if (review.length) console.log(`\n확인이 필요한 영상 ${review.length}개:\n` + review.map(([id, v]) => `- ${v.title} (${watchUrl(id)})`).join('\n'));
