import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// apps-script/Code.gs는 GAS 런타임 전역에 의존해 import할 수 없다.
// 소스를 읽어 전역을 목으로 주입하고 실제로 실행한다 — 문자열 검사가 아니라
// 동작을 검증하기 위해서다.
const SOURCE = readFileSync(
  fileURLToPath(new URL('../apps-script/Code.gs', import.meta.url)),
  'utf-8',
);

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

function makeSheet(rows) {
  return {
    rows,
    getLastRow: () => rows.length,
    getLastColumn: () => (rows[0] ? rows[0].length : 0),
    getRange(r, c, numRows, numCols) {
      return {
        getValues: () => {
          const out = [];
          for (let i = 0; i < numRows; i += 1) {
            const row = rows[r - 1 + i] || [];
            const slice = [];
            for (let j = 0; j < numCols; j += 1) slice.push(row[c - 1 + j] ?? '');
            out.push(slice);
          }
          return out;
        },
        setValues: (values) => {
          values.forEach((value, i) => {
            const target = rows[r - 1 + i] || (rows[r - 1 + i] = []);
            value.forEach((v, j) => { target[c - 1 + j] = v; });
          });
        },
      };
    },
    appendRow: (row) => rows.push(row),
  };
}

function load({ sheetRows = [HEADERS.slice()], properties = { SHEET_ID: 'sheet-x' }, mailThrows = false } = {}) {
  const sent = [];
  const sheet = makeSheet(sheetRows);

  const MailApp = {
    getRemainingDailyQuota: () => 100,
    sendEmail: (options) => {
      if (mailThrows) throw new Error('quota exceeded');
      sent.push(options);
    },
  };
  const SpreadsheetApp = {
    openById: () => ({ getSheetByName: () => sheet, insertSheet: () => sheet }),
    getActiveSpreadsheet: () => ({ getSheetByName: () => sheet, insertSheet: () => sheet }),
  };
  const PropertiesService = {
    getScriptProperties: () => ({ getProperty: (key) => properties[key] ?? null }),
  };
  const ContentService = {
    MimeType: { JSON: 'application/json' },
    createTextOutput: (text) => ({ setMimeType: () => ({ text }) }),
  };

  const factory = new Function(
    'MailApp', 'SpreadsheetApp', 'PropertiesService', 'ContentService',
    `${SOURCE}\nreturn { doPost, doGet };`,
  );
  const api = factory(MailApp, SpreadsheetApp, PropertiesService, ContentService);
  return { ...api, sent, sheet };
}

const leadBody = (overrides = {}) => ({
  postData: {
    contents: JSON.stringify({
      action: 'lead',
      lead_id: 'lead-1',
      email_normalized: 'applicant@example.com',
      current_stage: 'learning',
      stack: 'Java/Spring',
      consent_required: true,
      ...overrides,
    }),
  },
});

const parse = (res) => JSON.parse(res.text);

describe('신규 리드 접수', () => {
  let ctx;
  beforeEach(() => { ctx = load(); });

  it('시트에 기록한다', () => {
    const res = parse(ctx.doPost(leadBody()));

    expect(res.ok).toBe(true);
    expect(ctx.sheet.rows).toHaveLength(2);
  });

  it('신청자에게 확인 메일을 보낸다', () => {
    ctx.doPost(leadBody());

    const toApplicant = ctx.sent.find((m) => m.to === 'applicant@example.com');
    expect(toApplicant).toBeDefined();
    expect(toApplicant.subject).toContain('Leva');
  });

  it('관리자에게 신규 신청 알림을 보낸다', () => {
    ctx.doPost(leadBody());

    const toAdmin = ctx.sent.find((m) => m.to === 'info@leva.ai.kr');
    expect(toAdmin).toBeDefined();
    expect(toAdmin.body).toContain('applicant@example.com');
  });

  it('발송했다는 사실을 응답에 담는다', () => {
    expect(parse(ctx.doPost(leadBody())).mail_sent).toBe(true);
  });
});

describe('발송이 실패해도', () => {
  it('리드 기록은 남기고 mail_sent만 false로 보고한다', () => {
    const ctx = load({ mailThrows: true });

    const res = parse(ctx.doPost(leadBody()));

    // 메일을 못 보낸 것과 신청을 잃는 것은 전혀 다른 문제다. 후자가 훨씬 나쁘다.
    expect(res.ok).toBe(true);
    expect(ctx.sheet.rows).toHaveLength(2);
    expect(res.mail_sent).toBe(false);
  });
});

describe('중복 신청', () => {
  it('이미 있는 이메일이면 확인 메일을 다시 보내지 않는다', () => {
    const existing = HEADERS.map((h) => (h === 'email_normalized' ? 'applicant@example.com' : ''));
    const ctx = load({ sheetRows: [HEADERS.slice(), existing] });

    const res = parse(ctx.doPost(leadBody({ lead_id: 'lead-2' })));

    expect(res.updated).toBe(true);
    expect(ctx.sent.filter((m) => m.to === 'applicant@example.com')).toHaveLength(0);
    expect(res.mail_sent).toBe(false);
  });
});

describe('검증 실패', () => {
  it('동의가 없으면 시트도 메일도 건드리지 않는다', () => {
    const ctx = load();

    const res = parse(ctx.doPost(leadBody({ consent_required: false })));

    expect(res.ok).toBe(false);
    expect(ctx.sheet.rows).toHaveLength(1);
    expect(ctx.sent).toHaveLength(0);
  });
});
