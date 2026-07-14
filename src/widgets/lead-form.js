// 리드폼 위젯 (T3 + T16 상태표). #lead-form-root 에 마운트.
// 검증(프라이버시 가드) → same-origin /api/lead 제출 → 상태 UX.
// 상태표: 버튼 스피너(제출 중) · 필드별 에러 메시지 · 성공("확인 메일 발송").
import { postJson, ApiError } from '../api.js';
import { config } from '../config.js';
import {
  validateLead, buildLeadPayload, detectSensitiveInput, parseAttribution, createLeadId,
  isValidEmail,
} from '../form-utils.js';

const STAGES = [
  { value: '', label: '선택하세요' },
  { value: 'beginner', label: '입문 (막 시작)' },
  { value: 'learning', label: '학습 중' },
  { value: 'job_seeking', label: '취업 준비' },
  { value: 'working', label: '현업 개발자' },
];

function field(labelHtml, controlHtml, errorId, hintHtml = '') {
  return `<div class="lf-field">${labelHtml}${controlHtml}${hintHtml}<p class="lf-field-error" id="${errorId}" role="alert"></p></div>`;
}

function formMarkup() {
  const stageOptions = STAGES.map((s) => `<option value="${s.value}">${s.label}</option>`).join('');
  return `
    <form class="lead-form surface" novalidate>
      ${field(
        '<label for="lf-email">이메일 <span aria-hidden="true">*</span></label>',
        '<input id="lf-email" name="email" type="email" autocomplete="email" required inputmode="email" aria-describedby="lf-email-err" />',
        'lf-email-err',
      )}
      ${field(
        '<label for="lf-stage">현재 단계 <span aria-hidden="true">*</span></label>',
        `<select id="lf-stage" name="current_stage" required aria-describedby="lf-stage-err">${stageOptions}</select>`,
        'lf-stage-err',
      )}
      ${field(
        '<label for="lf-stack">주로 쓰는 스택 <span class="lf-opt">(선택)</span></label>',
        '<input id="lf-stack" name="stack" type="text" autocomplete="off" placeholder="예: Java/Spring, React" />',
        'lf-stack-err',
      )}
      ${field(
        '<label for="lf-stuck">요즘 가장 막히는 지점 <span class="lf-opt">(선택)</span></label>',
        '<textarea id="lf-stuck" name="recent_stuck_moment" rows="3" aria-describedby="lf-stuck-hint lf-stuck-err" placeholder="어떤 부분이 막히나요? (코드·비밀값·로그는 넣지 마세요)"></textarea>',
        'lf-stuck-err',
        '<p class="lf-hint" id="lf-stuck-hint" aria-live="polite"></p>',
      )}
      <div class="lf-field lf-consent">
        <label>
          <input id="lf-consent" name="consent_required" type="checkbox" required aria-describedby="lf-consent-err" />
          <span>개인정보 수집·이용(이메일·학습 단계)에 동의합니다. <span aria-hidden="true">*</span></span>
        </label>
        <p class="lf-field-error" id="lf-consent-err" role="alert"></p>
      </div>
      <p class="lf-error" id="lf-error" role="alert" hidden></p>
      <button class="btn btn-primary lf-submit" type="submit">진단 초대받기</button>
    </form>
    <div class="lead-form__success surface" id="lf-success" tabindex="-1" hidden>
      <h3>신청이 접수됐어요 ✓</h3>
      <p>진단 초대와 로드맵 안내를 이메일로 보내드릴게요. 확인 메일을 발송했으니 스팸함도 한 번 확인해 주세요.</p>
    </div>
  `;
}

export function mount(root) {
  root.innerHTML = formMarkup();
  const form = root.querySelector('.lead-form');
  const successBox = root.querySelector('#lf-success');
  const submitBtn = root.querySelector('.lf-submit');
  const stuck = root.querySelector('#lf-stuck');
  const stuckHint = root.querySelector('#lf-stuck-hint');
  const formError = root.querySelector('#lf-error');

  const errEls = {
    email: root.querySelector('#lf-email-err'),
    current_stage: root.querySelector('#lf-stage-err'),
    recent_stuck_moment: root.querySelector('#lf-stuck-err'),
    consent_required: root.querySelector('#lf-consent-err'),
  };
  const inputEls = {
    email: root.querySelector('#lf-email'),
    current_stage: root.querySelector('#lf-stage'),
    consent_required: root.querySelector('#lf-consent'),
    recent_stuck_moment: stuck,
  };

  function clearFieldErrors() {
    for (const [key, el] of Object.entries(errEls)) {
      el.textContent = '';
      inputEls[key]?.removeAttribute('aria-invalid');
    }
  }
  function setFieldError(key, msg) {
    if (!errEls[key]) return;
    errEls[key].textContent = msg;
    inputEls[key]?.setAttribute('aria-invalid', 'true');
  }

  // 필드별 검증 — 첫 번째 오류 필드에 포커스
  function validateFields(data) {
    clearFieldErrors();
    const errors = {};
    if (!isValidEmail(data.email)) errors.email = '올바른 이메일을 입력해주세요.';
    if (!data.current_stage) errors.current_stage = '현재 단계를 선택해주세요.';
    if (!data.consent_required) errors.consent_required = '필수 동의가 필요합니다.';
    const sensitive = detectSensitiveInput(data.recent_stuck_moment);
    if (sensitive.length) errors.recent_stuck_moment = `코드·로그·URL·비밀값은 넣지 말아주세요. 감지: ${sensitive.join(', ')}`;
    return errors;
  }

  // 자유텍스트 민감 입력 실시간 경고 (ERROR 상태 표시)
  stuck.addEventListener('blur', () => {
    const hits = detectSensitiveInput(stuck.value);
    stuckHint.textContent = hits.length
      ? `⚠ 코드·URL·토큰·로그로 보이는 내용이 있어요 (${hits.join(', ')}). 제거 후 제출해 주세요.`
      : '';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = {
      lead_id: createLeadId(),
      email: form.email.value,
      current_stage: form.current_stage.value,
      stack: form.stack.value,
      recent_stuck_moment: form.recent_stuck_moment.value,
      consent_required: form.consent_required.checked,
    };

    formError.hidden = true;
    const errors = validateFields(data);
    const firstErrorKey = Object.keys(errors)[0];
    if (firstErrorKey) {
      for (const [key, msg] of Object.entries(errors)) setFieldError(key, msg);
      inputEls[firstErrorKey]?.focus();
      return;
    }

    const attribution = parseAttribution(window.location.href, document.referrer);
    const payload = buildLeadPayload(data, {
      ...attribution,
      consentVersion: config.consentVersion,
      landingVariant: config.landingVariant,
    });

    // 제출 중 — 버튼 스피너
    submitBtn.disabled = true;
    submitBtn.dataset.loading = 'true';
    submitBtn.textContent = '보내는 중…';

    try {
      const res = await postJson(config.formEndpoint, payload, { timeoutMs: 12000, retries: 1 });
      if (res && res.ok === false) throw new ApiError(res.error || '제출 실패', { kind: 'http', status: 400 });
      form.hidden = true;
      successBox.hidden = false;
      successBox.focus();
    } catch (err) {
      formError.textContent = err instanceof ApiError && err.kind === 'timeout'
        ? '응답이 지연됐어요. 잠시 후 다시 시도해 주세요.'
        : '제출에 실패했어요. 잠시 후 다시 시도해 주세요.';
      formError.hidden = false;
      submitBtn.disabled = false;
      delete submitBtn.dataset.loading;
      submitBtn.textContent = '진단 초대받기';
    }
  });
}
