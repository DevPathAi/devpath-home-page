const ENDPOINT = 'https://api.leva.ai.kr/mentor-access/invite-rounds';

export function formatInviteRound(round) {
  const number = Number(round?.roundNumber);
  const count = Number(round?.deliveredCount);
  const date = String(round?.date ?? '');
  if (!Number.isSafeInteger(number) || number < 1 ||
      !Number.isSafeInteger(count) || count < 0 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('초대 회차 응답 형식이 올바르지 않다');
  }
  return `${number}차 초대 ${count}명 발송 · ${date.replaceAll('-', '.')}`;
}

export async function fetchInviteRounds(fetcher = fetch) {
  const response = await fetcher(ENDPOINT, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'omit',
  });
  if (!response.ok) throw new Error(`초대 회차 조회 실패: ${response.status}`);
  const rounds = await response.json();
  if (!Array.isArray(rounds) || rounds.length > 12) {
    throw new Error('초대 회차 응답 형식이 올바르지 않다');
  }
  return rounds.map((round) => ({ round, label: formatInviteRound(round) }));
}

async function renderInviteRounds() {
  const list = document.querySelector('[data-invite-rounds]');
  const status = document.querySelector('[data-invite-rounds-status]');
  if (!list || !status) return;
  try {
    const rows = await fetchInviteRounds();
    if (rows.length === 0) {
      status.textContent = '아직 완료된 초대 회차가 없습니다.';
      return;
    }
    const fragment = document.createDocumentFragment();
    for (const { label } of rows) {
      const item = document.createElement('li');
      item.textContent = label;
      fragment.append(item);
    }
    list.replaceChildren(fragment);
    list.hidden = false;
    status.textContent = '메일 전송 성공이 기록된 회차만 표시합니다.';
  } catch (_) {
    status.textContent = '초대 회차 기록을 잠시 불러오지 못했습니다.';
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', renderInviteRounds, { once: true });
}
