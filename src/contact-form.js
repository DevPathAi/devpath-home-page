const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_TYPES = new Set(['ERROR', 'INQUIRY']);
const TURNSTILE_NORMAL_WIDTH = 300;

export function validatePublicSupport(data) {
  const errors = {};
  if (!ALLOWED_TYPES.has(data.type)) errors.type = '문의 또는 오류 신고를 선택해 주세요.';
  if (!EMAIL_RE.test(String(data.email || '').trim())) errors.email = '올바른 이메일을 입력해 주세요.';
  if (!String(data.title || '').trim()) errors.title = '제목을 입력해 주세요.';
  else if (String(data.title).length > 200) errors.title = '제목은 200자 이하여야 합니다.';
  if (!String(data.body || '').trim()) errors.body = '내용을 입력해 주세요.';
  else if (String(data.body).length > 5000) errors.body = '내용은 5,000자 이하여야 합니다.';
  if (data.privacyConsent !== true) errors.privacyConsent = '개인정보 수집·이용 동의가 필요합니다.';
  if (!String(data.turnstileToken || '').trim()) errors.turnstileToken = '자동 제출 방지 확인을 완료해 주세요.';
  return errors;
}

export async function submitPublicSupport(data, {
  fetchImpl = globalThis.fetch,
  endpoint = 'https://api.leva.ai.kr/support/public-requests',
  timeoutMs = 12_000,
} = {}) {
  const errors = validatePublicSupport(data);
  if (Object.keys(errors).length > 0) return { kind: 'invalid', errors };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: data.type,
        email: String(data.email).trim(),
        title: String(data.title).trim(),
        body: String(data.body).trim(),
        privacyConsent: true,
        turnstileToken: data.turnstileToken,
      }),
      signal: controller.signal,
    });
    if (response.ok) {
      const payload = await response.json().catch(() => ({}));
      return { kind: 'success', id: payload.id };
    }
    const payload = await response.json().catch(() => ({}));
    if (payload.code === 'TURNSTILE_FAILED') return { kind: 'turnstile' };
    if (payload.code === 'TURNSTILE_UNAVAILABLE') return { kind: 'turnstile-unavailable' };
    if (response.status === 400 || response.status === 422) return { kind: 'invalid' };
    if (response.status === 429) return { kind: 'rate-limit' };
    return { kind: 'server' };
  } catch (error) {
    if (error?.name === 'AbortError') return { kind: 'timeout' };
    return { kind: 'network' };
  } finally {
    clearTimeout(timeout);
  }
}

const fieldIds = {
  type: 'contact-type-error',
  email: 'contact-email-error',
  title: 'contact-title-error',
  body: 'contact-body-error',
  privacyConsent: 'contact-consent-error',
  turnstileToken: 'contact-turnstile-error',
};

const resultMessages = {
  success: '문의가 접수되었습니다. 입력한 이메일로 답변드리겠습니다.',
  invalid: '입력한 내용을 다시 확인해 주세요.',
  turnstile: '자동 제출 방지 확인에 실패했습니다. 다시 확인해 주세요.',
  'turnstile-unavailable': '보안 확인 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',
  'rate-limit': '짧은 시간에 여러 번 요청했습니다. 잠시 후 다시 시도해 주세요.',
  timeout: '보안 확인 또는 접수 요청이 시간 안에 끝나지 않았습니다. 다시 시도해 주세요.',
  network: '네트워크에 연결할 수 없습니다. 연결을 확인하고 다시 시도해 주세요.',
  server: '지금은 문의를 접수할 수 없습니다. 잠시 후 다시 시도해 주세요.',
};

export function mountContactForm(form, turnstileApi = globalThis.turnstile) {
  if (!form) return;
  const status = document.querySelector('#contact-status');
  const submit = form.querySelector('button[type="submit"]');
  const turnstileContainer = form.querySelector('#contact-turnstile');
  let turnstileToken = '';
  let widgetId;

  function showFieldErrors(errors) {
    for (const [field, id] of Object.entries(fieldIds)) {
      const error = document.querySelector(`#${id}`);
      if (!error) continue;
      error.textContent = errors[field] || '';
      error.hidden = !errors[field];
      const control = form.elements.namedItem(field);
      if (control && 'setAttribute' in control) {
        if (errors[field]) control.setAttribute('aria-invalid', 'true');
        else control.removeAttribute('aria-invalid');
      }
    }
  }

  const sitekey = form.dataset.turnstileSitekey;
  if (!turnstileApi || !sitekey) {
    showFieldErrors({ turnstileToken: '보안 확인을 불러오지 못했습니다. 잠시 후 새로고침해 주세요.' });
    submit.disabled = true;
    return;
  }

  widgetId = turnstileApi.render('#contact-turnstile', {
    sitekey,
    action: form.dataset.turnstileAction,
    size: turnstileContainer?.clientWidth < TURNSTILE_NORMAL_WIDTH ? 'compact' : 'normal',
    callback(token) {
      turnstileToken = token;
      showFieldErrors({});
    },
    'error-callback'() {
      turnstileToken = '';
      showFieldErrors({ turnstileToken: '보안 확인에 실패했습니다. 다시 시도해 주세요.' });
    },
    'timeout-callback'() {
      turnstileToken = '';
      showFieldErrors({ turnstileToken: '보안 확인 시간이 지났습니다. 다시 확인해 주세요.' });
    },
    'expired-callback'() {
      turnstileToken = '';
    },
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = {
      type: form.type.value,
      email: form.email.value,
      title: form.title.value,
      body: form.body.value,
      privacyConsent: form.privacyConsent.checked,
      turnstileToken,
    };
    const errors = validatePublicSupport(data);
    showFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      form.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }

    submit.disabled = true;
    status.hidden = true;
    const result = await submitPublicSupport(data, { endpoint: form.dataset.endpoint });
    status.textContent = resultMessages[result.kind];
    status.dataset.kind = result.kind === 'success' ? 'success' : 'error';
    status.hidden = false;
    if (result.kind === 'success') {
      form.reset();
    }
    turnstileToken = '';
    turnstileApi.reset(widgetId);
    submit.disabled = false;
    status.focus?.();
  });
}

if (typeof document !== 'undefined') {
  const form = document.querySelector('#contact-form');
  if (form) {
    const mount = () => mountContactForm(form, globalThis.turnstile);
    if (globalThis.turnstile) mount();
    else window.addEventListener('load', mount, { once: true });
  }
}
