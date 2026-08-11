---
title: 한 사이트에서 URL 규칙이 서로 반대로 적용되고 있었다
description: 파일은 확장자를 떼고, 디렉터리는 슬래시를 붙인다. 그래서 canonical이 리다이렉트되는 주소를 가리키고 있었다.
date: 2026-08-11
---

## 규칙은 하나인 줄 알았다

이 사이트는 Cloudflare Pages에 정적 파일을 올려 서비스한다. Pages는 `.html` 확장자를 떼는 clean URL을 만들어 준다. `privacy.html`을 올리면 `/privacy`로 접근할 수 있고, `/privacy.html`로 들어오면 `/privacy`로 308 리다이렉트한다.

그래서 규칙을 하나로 정했다. **canonical·사이트맵·내부 링크에 `.html`을 쓰지 않는다.** 문서에도 그렇게 적고, 테스트로도 막았다.

```js
it('canonical이 확장자 없는 자기 URL을 가리킨다', () => {
  expect(html).toContain('<link rel="canonical" href="https://leva.ai.kr/notes/my-post" />');
  expect(html).not.toContain('.html"');
});
```

이 규칙으로 개발 기록 여섯 편을 배포했다. 테스트는 전부 통과했다.

## 배포하고 재 봤다

배포 직후에는 항상 실제 주소를 몇 번 호출해 본다. 상태코드와 `content-type`을 함께 본다.

```text
/sitemap.xml                    200 application/xml
/notes/empty-response-...       200 text/html
/zzz-no-page                    404 text/html
/notes                          308            ← ?
```

글 페이지는 200인데 목록 페이지가 308이었다. 리다이렉트 대상을 확인했다.

```text
HTTP/1.1 308 Permanent Redirect
Location: /notes/
```

슬래시가 붙었다. 반대 방향이었다.

## 파일이냐 디렉터리냐가 규칙을 가른다

정리하면 이렇다.

```text
privacy.html            → /privacy      200   (확장자를 뗀다)
notes/my-post.html      → /notes/my-post 200  (확장자를 뗀다)
notes/index.html        → /notes/       200
                          /notes        308 → /notes/   (슬래시를 붙인다)
                          /notes/index.html 308 → /notes/
```

같은 호스팅, 같은 배포인데 두 규칙이 서로 반대로 적용된다. **파일 경로는 확장자를 떼고, 디렉터리 인덱스는 슬래시를 붙인다.** 둘 다 "정규 주소로 모아 준다"는 같은 목적이지만 방향이 다르다.

내가 정한 규칙은 앞의 절반만 담고 있었다. 그래서 목록 페이지의 canonical, 사이트맵의 `<loc>`, 홈과 글에서 목록으로 가는 모든 링크가 **리다이렉트되는 주소**를 가리키고 있었다.

## 왜 테스트가 못 잡았나

테스트는 "우리가 쓴 문자열이 우리가 정한 규칙과 맞는가"를 봤다. 규칙 자체가 절반만 맞았으므로, 규칙대로 쓴 문자열은 당연히 통과한다.

이건 코드 안에서는 확인할 수 없는 종류다. 서버가 그 주소에 무엇을 돌려주는지는 서버만 안다. **배포하고 실제로 호출해 봐야 나온다.**

## 고친 것

목록을 가리키는 모든 곳을 `/notes/`로 통일했다. canonical, `og:url`, 사이트맵 고정 항목, 홈 내비, 글 하단의 "목록으로" 링크.

그리고 무슬래시 형태가 되돌아오면 실패하는 가드를 넣었다.

```js
it('sitemap이 리다이렉트되는 무슬래시 /notes를 담지 않는다', () => {
  expect(locs).not.toContain('https://leva.ai.kr/notes');
});

it('index.html이 리다이렉트되는 무슬래시 링크를 남기지 않는다', () => {
  expect(read('index.html')).not.toContain('href="/notes"');
});
```

두 번째 단언은 조금 까다롭다. `href="/notes/"`는 통과해야 하고 `href="/notes"`만 막아야 하는데, 닫는 따옴표까지 포함해 비교하면 구별된다.

## 리다이렉트가 그렇게 나쁜가

한 번의 홉이다. 사용자는 대개 알아채지 못한다.

그래도 고치는 이유는 canonical 때문이다. canonical은 "이 문서의 정식 주소는 여기"라고 검색엔진에 선언하는 태그다. 그 주소가 다시 다른 곳으로 리다이렉트되면, 스스로 정식이 아니라고 말하는 셈이 된다. 사이트맵도 마찬가지다. 제출한 주소마다 크롤러가 홉을 하나씩 더 탄다.

## 같은 계열로 한 번 더

이 글을 쓰고 얼마 뒤, 다른 글의 제목이 부정확하다는 지적을 받아 slug를 바꿨다. 그러자 옛 주소가 404가 됐다. 그 주소는 이미 사이트맵으로 제출된 상태였다.

리다이렉트 파일을 만들어 옛 주소를 새 주소로 이었다. 그리고 여기에도 가드를 하나 넣었다.

```js
it('리다이렉트 대상이 실재하는 글이다', () => {
  const slugs = collectNotes(root('content/notes')).map((n) => n.slug);
  expect(targets.every((t) => slugs.includes(t))).toBe(true);
});
```

대상이 없으면 리다이렉트가 404로 데려간다. 그건 옛 주소를 그냥 두는 것보다 나쁘다. 오타 하나로 그렇게 될 수 있어서 기계가 보게 했다.

## 남은 습관

배포 확인 목록에 항목이 하나 늘었다. 상태코드가 **200이 아닌 것**도 실패로 본다. 예전에는 "죽지만 않으면 됐다"고 생각해 3xx를 그냥 지나쳤는데, 그 안에 이런 게 숨어 있었다.
