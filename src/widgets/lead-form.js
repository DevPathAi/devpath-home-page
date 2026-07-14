// 리드폼 위젯 (T3). #lead-form-root 에 마운트.
// 검증(프라이버시 가드) → same-origin /api/lead 제출 → 상태 UX(로딩/성공/에러).
import { postJson, ApiError } from '../api.js';
import { config } from '../config.js';
import {
  validateLead, buildLeadPayload, detectSensitiveInput, parseAttribution, createLeadId,
} from '../form-utils.js';

const STAGES = [
  { value: '', label: '선택하세요' },
  { value: 'beginner', label: '입문 (막 시작)' },
  { value: 'learning', label: '학습 중' },
  { value: 'job_seeking', label: '취업 준비' },
  { value: 'working', label: '현업 개발자' },
];

function field(labelHtml, controlHtml, hintHtml = '') {
  return `<div class="lf-field">${labelHtml}${controlHtml}${hintHtml}</div>`;
}

function formMarkup() {
  const stageOptions = STAGES.map((s) => `<option value="${s.value}">${s.label}</option>`).join('');
  return `
    <form class="lead-form surface" novalidate>
      ${field(
        '<label for="lf-email">이메일 <span aria-hidden="true">*</span></label>',
        '<input id="lf-email" name="email" type="email" autocomplete="email" required inputmode="email" />',
      )}
      ${field(
        '<label for="lf-stage">현재 단계 <span aria-hidden="true">*</span></label>',
        `<select id="lf-stage" name="current_stage" required>${stageOptions}</select>`,
      )}
      ${field(
        '<label for="lf-stack">주로 쓰는 스택 <span class="lf-opt">(선택)</span></label>',
        '<input id="lf-stack" name="stack" type="text" autocomplete="off" placeholder="예: Java/Spring, React" />',
      )}
      ${field(
        '<label for="lf-stuck">요즘 가장 막히는 지점 <span class="lf-opt">(선택)</span></label>',
        '<textarea id="lf-stuck" name="recent_stuck_moment" rows="3" placeholder="어떤 부분이 막히나요? (코드·비밀값·로그는 넣지 마세요)"></textarea>',
        '<p class="lf-hint" id="lf-stuck-hint" aria-live="polite"></p>',
      )}
      <div class="lf-field lf-consent">
        <label>
          <input id="lf-consent" name="consent_required" type="checkbox" required />
          <span>개인정보 수집·이용(이메일·학습 단계)에 동의합니다. <span aria-hidden="true">*</span></span>
        </label>
      </div>
      <p class="lf-error" id="lf-error" role="alert" hidden></p>
      <button class="btn btn-primary lf-submit" type="submit">진단 초대받기</button>
    </form>
    <div class="lead-form__success surface" id="lf-success" hidden>
      <h3>신청이 접수됐어요 ✓</h3>
      <p>진단 초대와 로드맵 안내를 이메일로 보내드릴게요. 스팸함도 한 번 확인해 주세요.</p>
    </div>
  `;
}

export function mount(root) {
  root.innerHTML = formMarkup();
  const form = root.querySelector('.lead-form');
  const successBox = root.querySelector('#lf-success');
  const errorBox = root.querySelector('#lf-error');
  const submitBtn = root.querySelector('.lf-submit');
  const stuck = root.querySelector('#lf-stuck');
  const stuckHint = root.querySelector('#lf-stuck-hint');

  // 자유텍스트 민감 입력 실시간 경고 (제출 전 안내)
  stuck.addEventListener('blur', () => {
    const hits = detectSensitiveInput(stuck.value);
    stuckHint.textContent = hits.length
      ? `⚠ 코드·URL·토큰·로그로 보이는 내용이 있어요 (${hits.join(', ')}). 제거 후 제출해 주세요.`
      : '';
  });

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.hidden = false;
  }
  function clearError() {
    errorBox.textContent = '';
    errorBox.hidden = true;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();

    const data = {
      lead_id: createLeadId(),
      email: form.email.value,
      current_stage: form.current_stage.value,
      stack: form.stack.value,
      recent_stuck_moment: form.recent_stuck_moment.value,
      consent_required: form.consent_required.checked,
    };

    const errors = validateLead(data);
    if (errors.length) {
      showError(errors.join(' '));
      return;
    }

    const attribution = parseAttribution(window.location.href, document.referrer);
    const payload = buildLeadPayload(data, {
      ...attribution,
      consentVersion: config.consentVersion,
      landingVariant: config.landingVariant,
    });

    submitBtn.disabled = true;
    submitBtn.dataset.loading = 'true';
    submitBtn.textContent = '보내는 중…';

    try {
      const res = await postJson(config.formEndpoint, payload, { timeoutMs: 12000, retries: 1 });
      if (res && res.ok === false) throw new ApiError(res.error || '제출 실패', { kind: 'http', status: 400 });
      form.hidden = true;
      successBox.hidden = false;
      successBox.focus?.();
    } catch (err) {
      const msg = err instanceof ApiError && err.kind === 'timeout'
        ? '응답이 지연됐어요. 잠시 후 다시 시도해 주세요.'
        : '제출에 실패했어요. 잠시 후 다시 시도해 주세요.';
      showError(msg);
      submitBtn.disabled = false;
      delete submitBtn.dataset.loading;
      submitBtn.textContent = '진단 초대받기';
    }
  });
}
