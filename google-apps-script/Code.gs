/**
 * ✨ 별가루 키우기 — 구글 시트 클라우드 저장 서버
 *
 * 설치 방법은 저장소 README의 "클라우드 저장 설정" 섹션을 참고하세요.
 * 이 스크립트를 구글 시트의 Apps Script에 붙여넣고 웹 앱으로 배포하면
 * 게임의 ☁️ 동기화 기능이 이 시트에 세이브를 저장합니다.
 *
 * 시트 구조 (saves 시트, 자동 생성):
 *   A: 닉네임 | B: 비밀코드 해시 | C: 세이브 코드 | D: 마지막 저장 시각
 */

const SHEET_NAME = 'saves';

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(['user', 'passHash', 'data', 'updatedAt']);
  }
  return sh;
}

function hash_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map(function (b) { return ((b + 256) % 256).toString(16).padStart(2, '0'); })
    .join('');
}

function findRow_(sh, user) {
  const last = sh.getLastRow();
  if (last < 2) return -1;
  const vals = sh.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < vals.length; i++) {
    if (String(vals[i][0]) === user) return i + 2;
  }
  return -1;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'load') {
    const user = String(p.user || '').trim();
    if (!user) return json_({ ok: false, error: 'bad_request' });
    const sh = getSheet_();
    const row = findRow_(sh, user);
    if (row < 0) return json_({ ok: false, error: 'not_found' });
    const rec = sh.getRange(row, 1, 1, 4).getValues()[0];
    if (rec[1] !== hash_(String(p.pass || ''))) return json_({ ok: false, error: 'wrong_pass' });
    return json_({ ok: true, data: rec[2], updatedAt: String(rec[3]) });
  }
  return json_({ ok: true, ping: 'stardust' });
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'bad_json' });
  }
  const user = String(body.user || '').trim();
  const pass = String(body.pass || '');
  if (body.action !== 'save' || !user || !pass || !body.data) {
    return json_({ ok: false, error: 'bad_request' });
  }
  if (String(body.data).length > 50000) return json_({ ok: false, error: 'too_big' });

  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const sh = getSheet_();
    const row = findRow_(sh, user);
    const now = new Date();
    if (row < 0) {
      sh.appendRow([user, hash_(pass), String(body.data), now]);
    } else {
      if (sh.getRange(row, 2).getValue() !== hash_(pass)) {
        return json_({ ok: false, error: 'wrong_pass' });
      }
      sh.getRange(row, 3, 1, 2).setValues([[String(body.data), now]]);
    }
    return json_({ ok: true });
  } finally {
    lock.releaseLock();
  }
}
