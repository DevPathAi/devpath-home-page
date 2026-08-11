// DevPath 리드 파이프라인 Apps Script Web App (T10).
// devpath-landing-page 백엔드를 이식·확장한 단일 배포 소스:
//   POST ?action=lead|step1|step2|interview  → leads 시트 upsert (프라이버시 가드)
//   GET  ?action=stats                        → 집계 카운트만 반환 (F3, PII 금지)
// 배포: Web App(실행 = 나, 접근 = 익명). SHEET_ID를 Script Property로 설정.

const LEADS_SHEET_NAME = 'leads';

const HEADERS = [
  'lead_id', 'email_normalized', 'email_raw', 'consent_required', 'consent_version',
  'consent_accepted_at', 'step1_submitted_at', 'step2_submitted_at', 'last_updated_at',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'referrer', 'landing_variant',
  'current_stage', 'stack', 'recent_stuck_moment', 'wtp_krw',
  'pain_specificity_score', 'spring_fit_score', 'source_quality_score', 'lead_score',
  'status', 'shortlisted_at', 'invited_at', 'scheduled_at', 'completed_at',
  'honorarium_paid_at', 'insight_coded_at',
  'interview_transcript', 'interview_turns', 'ab_distilled_question', 'ab_context_side',
  'ab_user_choice', 'ab_rating_1to5', 'ab_completed_at',
];

const SENSITIVE_PATTERNS = [
  /github\.com\/[\w.-]+\/[\w.-]+/i,
  /https?:\/\//i,
  /\bpassword\s*=/i,
  /\b(token|api[_-]?key|secret)\s*[:=]/i,
  /BEGIN\s+(RSA\s+|EC\s+|OPENSSH\s+)?PRIVATE KEY/i,
  /\.env\b/i,
  /jdbc:[a-z]+:\/\//i,
  /\n\s+at\s+[\w.$<>]+/i,
  /(?:\n.*){5,}/,
];

// ── POST: 리드 upsert ─────────────────────────────────────────────────────
function doPost(e) {
  try {
    const payload = parsePayload_(e);
    validatePayload_(payload);

    const sheet = getLeadsSheet_();
    ensureHeaders_(sheet);
    const headers = getHeaders_(sheet);
    const rowNumber = findRow_(sheet, headers, payload.lead_id, payload.email_normalized);
    const existing = rowNumber
      ? rowToObject_(sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0], headers)
      : {};
    const merged = mergeRows_(existing, decoratePayload_(payload));

    if (!merged.status) merged.status = 'new';
    recomputeScores_(merged);

    if (rowNumber) {
      sheet.getRange(rowNumber, 1, 1, headers.length).setValues([objectToRow_(merged, headers)]);
    } else {
      sheet.appendRow(objectToRow_(merged, headers));
    }

    // 확인 메일은 신규 접수에만 보낸다(재신청마다 다시 보내면 스팸이 된다).
    // 발송 실패가 접수 자체를 실패로 만들면 안 되므로 삼키되, 무엇이 실제로
    // 일어났는지는 mail_sent로 정직하게 돌려준다 — 화면 문구가 이 값에 종속된다.
    let mailSent = false;
    if (!rowNumber && payload.action === 'lead') {
      try {
        mailSent = sendLeadEmails_(merged);
      } catch (mailError) {
        mailSent = false;
      }
    }
    return json_({ ok: true, lead_id: merged.lead_id, updated: Boolean(rowNumber), mail_sent: mailSent });
  } catch (error) {
    return json_({ ok: false, error: error.message });
  }
}

// ── GET: 집계 통계 (화이트리스트, PII 금지) ───────────────────────────────
function doGet(e) {
  const action = e && e.parameter && e.parameter.action;
  if (action === 'stats') {
    try {
      return json_(computeStats_());
    } catch (error) {
      return json_({ ok: false, error: error.message });
    }
  }
  return json_({ ok: false, error: 'unknown_action' });
}

// leads 시트에서 집계 카운트만 계산해 반환한다. 어떤 행 단위 값도 노출하지 않는다.
function computeStats_() {
  const sheet = getLeadsSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return { ok: true, signups: 0, diagnoses_completed: 0, satisfaction: null, updated_at: nowIso_() };
  }
  const headers = getHeaders_(sheet);
  const idx = (name) => headers.indexOf(name);
  const rows = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();

  const emailIdx = idx('email_normalized');
  const completedIdx = idx('completed_at');
  const ratingIdx = idx('ab_rating_1to5');

  let signups = 0;
  let completed = 0;
  let ratingSum = 0;
  let ratingCount = 0;

  for (const row of rows) {
    if (emailIdx >= 0 && String(row[emailIdx] || '').trim()) signups += 1;
    if (completedIdx >= 0 && String(row[completedIdx] || '').trim()) completed += 1;
    const r = ratingIdx >= 0 ? Number(row[ratingIdx]) : NaN;
    if (!Number.isNaN(r) && r > 0) { ratingSum += r; ratingCount += 1; }
  }

  const satisfaction = ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) / 10 : null;
  return { ok: true, signups, diagnoses_completed: completed, satisfaction, updated_at: nowIso_() };
}

// ── 메일 발송 ─────────────────────────────────────────────────────────────
const ADMIN_EMAIL_FALLBACK = 'info@leva.ai.kr';

function adminEmail_() {
  return PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL') || ADMIN_EMAIL_FALLBACK;
}

// 보냈으면 true. 보내지 못했으면 false를 돌려주고 예외는 호출자가 삼킨다.
function sendLeadEmails_(lead) {
  const applicant = String(lead.email_normalized || '').trim();
  if (!applicant) return false;
  // 일일 쿼터를 넘기면 sendEmail이 던진다. 미리 보고 조용히 건너뛴다.
  if (MailApp.getRemainingDailyQuota() < 2) return false;

  const admin = adminEmail_();
  MailApp.sendEmail({
    to: applicant,
    subject: 'Leva 진단 초대 신청이 접수됐습니다',
    body: applicantMailBody_(lead, admin),
    name: 'Leva',
    replyTo: admin,
  });
  MailApp.sendEmail({
    to: admin,
    subject: '[Leva] 새 진단 신청 — ' + applicant,
    body: adminMailBody_(lead),
    name: 'Leva 리드 알림',
    replyTo: applicant,
  });
  return true;
}

function applicantMailBody_(lead, admin) {
  return [
    '진단 초대 신청이 접수됐습니다.',
    '',
    '남겨주신 내용을 확인한 뒤, 진단 초대와 학습 로드맵 안내를 이메일로 보내드립니다.',
    '베타 기간에는 순차적으로 초대를 보내고 있어 며칠 걸릴 수 있습니다.',
    '',
    '접수 내용',
    '- 이메일: ' + lead.email_normalized,
    '- 현재 단계: ' + (lead.current_stage || '-'),
    '- 스택: ' + (lead.stack || '-'),
    '',
    '이 신청을 한 적이 없다면 이 메일을 무시하셔도 됩니다.',
    '문의: ' + admin,
    '',
    'Leva · https://leva.ai.kr',
  ].join('\n');
}

function adminMailBody_(lead) {
  return [
    '새 진단 신청이 접수됐습니다.',
    '',
    '- 이메일: ' + lead.email_normalized,
    '- 현재 단계: ' + (lead.current_stage || '-'),
    '- 스택: ' + (lead.stack || '-'),
    '- 막히는 지점: ' + (lead.recent_stuck_moment || '-'),
    '- 유입: ' + (lead.utm_source || '-') + ' / ' + (lead.referrer || '-'),
    '- lead_score: ' + (lead.lead_score || 0),
    '- lead_id: ' + lead.lead_id,
  ].join('\n');
}

// ── 검증 ──────────────────────────────────────────────────────────────────
function parsePayload_(e) {
  if (!e || !e.postData || !e.postData.contents) throw new Error('Missing request body.');
  return JSON.parse(e.postData.contents);
}

function validatePayload_(payload) {
  if (!payload.lead_id && !payload.email_normalized) {
    throw new Error('lead_id or email_normalized is required.');
  }
  const emailActions = ['step1', 'interview', 'lead'];
  if (emailActions.indexOf(payload.action) >= 0) {
    if (!payload.email_normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email_normalized)) {
      throw new Error('Valid email is required.');
    }
    if (!payload.current_stage) throw new Error('current_stage is required.');
    if (payload.consent_required !== true) throw new Error('Required consent is missing.');
  }
  if (payload.action === 'interview' && payload.interview_transcript &&
      SENSITIVE_PATTERNS.some((p) => p.test(payload.interview_transcript))) {
    throw new Error('Sensitive content is not allowed in transcript.');
  }
  if (payload.recent_stuck_moment && SENSITIVE_PATTERNS.some((p) => p.test(payload.recent_stuck_moment))) {
    throw new Error('Sensitive code, URL, token, or log-like input is not allowed.');
  }
}

// ── 헬퍼 ──────────────────────────────────────────────────────────────────
function decoratePayload_(payload) {
  const decorated = Object.assign({}, payload);
  delete decorated.action;
  if (decorated.email_normalized) decorated.email_normalized = String(decorated.email_normalized).trim().toLowerCase();
  return decorated;
}

function recomputeScores_(row) {
  row.pain_specificity_score = scorePainSpecificity_(row.recent_stuck_moment);
  row.spring_fit_score = scoreSpringFit_(row.stack);
  row.source_quality_score = scoreSourceQuality_(row.utm_source);
  row.lead_score = Number(row.pain_specificity_score || 0) + Number(row.spring_fit_score || 0) + Number(row.source_quality_score || 0);
}

function mergeRows_(existing, incoming) {
  const merged = Object.assign({}, existing);
  Object.keys(incoming).forEach((key) => {
    const value = incoming[key];
    if (value === '' || value === null || typeof value === 'undefined') return;
    merged[key] = value;
  });
  return merged;
}

function getLeadsSheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  const spreadsheet = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('Spreadsheet not found. Set SHEET_ID or bind this script to a sheet.');
  return spreadsheet.getSheetByName(LEADS_SHEET_NAME) || spreadsheet.insertSheet(LEADS_SHEET_NAME);
}

function ensureHeaders_(sheet) {
  const current = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), HEADERS.length)).getValues()[0];
  if (sheet.getLastRow() === 0 || current.every((value) => value === '')) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    return;
  }
  const missing = HEADERS.filter((header) => !current.includes(header));
  if (missing.length > 0) {
    sheet.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
  }
}

function getHeaders_(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

function findRow_(sheet, headers, leadId, emailNormalized) {
  if (sheet.getLastRow() < 2) return 0;
  const leadIdIndex = headers.indexOf('lead_id');
  const emailIndex = headers.indexOf('email_normalized');
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (leadId && row[leadIdIndex] === leadId) return index + 2;
    if (emailNormalized && row[emailIndex] === emailNormalized) return index + 2;
  }
  return 0;
}

function rowToObject_(row, headers) {
  return headers.reduce((acc, header, index) => { acc[header] = row[index]; return acc; }, {});
}

function objectToRow_(object, headers) {
  return headers.map((header) => Object.prototype.hasOwnProperty.call(object, header) ? object[header] : '');
}

function scorePainSpecificity_(text) {
  const value = String(text || '').trim();
  if (!value) return 0;
  if (value.length >= 80) return 3;
  if (value.length >= 35) return 2;
  return 1;
}

function scoreSpringFit_(stack) {
  const value = String(stack || '').toLowerCase();
  let score = 0;
  if (value.includes('java')) score += 1;
  if (value.includes('spring')) score += 2;
  if (value.includes('jpa')) score += 1;
  return score;
}

function scoreSourceQuality_(source) {
  const value = String(source || '').toLowerCase();
  if (['github', 'docs', 'blog', 'readme'].includes(value)) return 2;
  if (value) return 1;
  return 0;
}

function nowIso_() {
  return new Date().toISOString();
}

function json_(object) {
  return ContentService.createTextOutput(JSON.stringify(object)).setMimeType(ContentService.MimeType.JSON);
}
