# 상품 관리 웹페이지 (로컬 전용)

상품 조회 · 검색 · 추가 · 삭제. React 18을 CDN으로 불러오고, 설정은 `.env.local`에서 읽는다. 인터넷 연결이 필요하다.

## 실행

```bash
node modeling/product-manager/server.js
```

브라우저에서 http://localhost:5173 을 연다. 서버는 `127.0.0.1`에서만 열려서 이 PC에서만 접속된다. 설치할 패키지는 없다(Node 20.12 이상).

## 설정: `.env.local`

| 변수 | 값 | 사용처 |
|---|---|---|
| `SUPABASE_URL` | Project URL | 브라우저(읽기), 서버(쓰기) |
| `SUPABASE_ANON_KEY` | anon public 키 | 브라우저(읽기) |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role 키 | **서버에서만**(추가 · 삭제). 브라우저로 보내지 않는다 |
| `PORT` | 서버 포트 (생략 시 5173) | 서버 |

- Supabase 대시보드의 Project Settings > API에서 복사한다
- DB 접속 문자열(session pooler)은 쓰지 않는다. 프로젝트 URL과 API 키만 쓴다
- 값을 바꾸면 서버를 다시 시작한다
- 이 파일은 공유하거나 올리지 않는다(`.gitignore`에 들어 있다)

## 처음 한 번: Supabase 준비

SQL Editor에서 `modeling/` 폴더의 파일을 순서대로 실행한다.

1. `supabase_schema.sql`
2. `supabase_seed.sql`
3. `supabase_read_policy.sql` (anon에게 읽기만 연다)

`supabase_local_policies.sql`(쓰기까지 여는 파일)은 이 방식에서는 실행하지 않는다. 이미 실행했다면 그 파일 맨 아래 "되돌리기"를 실행한다.

## 모드

| 상태 | 화면 상단 배지 | 동작 |
|---|---|---|
| `.env.local` 비어 있음 | 데모 모드 | 이 브라우저에만 저장. 예시 3건. Supabase에는 영향 없음 |
| URL + anon만 채움 | Supabase 연결 | 읽기만 동작. 추가 · 삭제는 오류 안내가 나온다 |
| 세 값 모두 채움 | Supabase 연결 · 쓰기는 로컬 서버 | 읽기는 anon, 추가 · 삭제는 서버가 service_role로 처리 |

`index.html`을 파일로 직접 열어도 데모 모드로 동작한다(서버 없이).

## 보안 메모

- service_role 키는 RLS를 우회하는 비밀키다. 서버 프로세스 안에서만 쓰고 브라우저에는 URL과 anon 키만 전달한다
- 서버는 정해 둔 경로(`/`, `/config.js`, `/api/products`)만 응답한다. `.env.local`이나 `server.js`는 내려주지 않는다
- 다른 사이트가 이 서버로 요청을 보내지 못하게 호스트, Origin, 사용자 지정 헤더를 확인한다
- 서버를 켜 둔 동안 이 PC의 다른 프로그램은 서버를 통해 추가 · 삭제를 할 수 있다. 쓰지 않을 때는 끈다(Ctrl+C)

## 기타

- 상품을 삭제하면 그 상품의 보관조건도 함께 삭제되고 되돌릴 수 없다
- 수정 기능은 없다. 고치려면 삭제 후 다시 추가한다
- 폼에서 **미기재**를 고르면 DB에는 NULL로, **없음**은 문자열 `없음`으로 저장된다
- 브라우저에서 Babel 변환을 쓰므로 첫 로딩이 약간 느리다. 오래 쓸 거라면 Vite 프로젝트로 옮기는 것이 좋다
