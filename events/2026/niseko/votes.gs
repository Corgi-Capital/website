// Hokkaido Eats Vote: Google Apps Script backend.
// Setup: create a Google Sheet, then Extensions > Apps Script, paste this file,
// Project Settings > Script properties: add TRIP_CODE = <a code you share with the group>,
// then Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).
// Copy the /exec URL into CONFIG.votesUrl in index.html.

const NAMES = ['Bill', 'Edwin', 'Mikey', 'Alice'];

function doGet(e) {
  if (!codeOk(e.parameter.code)) return out({ ok: false, error: 'code' });
  return out(read());
}

function doPost(e) {
  let b;
  try { b = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, error: 'json' }); }
  if (!codeOk(b.code)) return out({ ok: false, error: 'code' });
  if (NAMES.indexOf(b.name) < 0) return out({ ok: false, error: 'name' });
  const votes = {};
  Object.keys(b.votes || {}).forEach(function (k) {
    const v = b.votes[k];
    if (/^[a-z0-9]{1,24}$/.test(k) && [0, 1, 2, 3].indexOf(v) >= 0) votes[k] = v;
  });
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const sh = sheet();
    const rows = sh.getDataRange().getValues();
    const i = rows.findIndex(function (r) { return r[0] === b.name; });
    const vals = [b.name, JSON.stringify(votes), new Date()];
    if (i < 0) sh.appendRow(vals); else sh.getRange(i + 1, 1, 1, 3).setValues([vals]);
  } finally {
    lock.releaseLock();
  }
  return out(read());
}

function read() {
  const ballots = {};
  sheet().getDataRange().getValues().forEach(function (r) {
    if (NAMES.indexOf(r[0]) >= 0) { try { ballots[r[0]] = JSON.parse(r[1]); } catch (e) {} }
  });
  return { ok: true, ballots: ballots };
}

function sheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName('ballots') || ss.insertSheet('ballots');
}

function codeOk(c) {
  const want = PropertiesService.getScriptProperties().getProperty('TRIP_CODE');
  return !!want && c === want;
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
