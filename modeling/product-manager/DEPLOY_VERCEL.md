# Vercel 배포 가이드 (화면 조작 순서)

> 화면 문구는 Vercel 화면 개편에 따라 조금 다를 수 있다. 큰 흐름은 같다.

## 0. 먼저 알아둘 것 (배포 전 필수)

현재 코드는 **그대로 Vercel에 올리면 Supabase에 연결되지 않는다.**

| 항목 | 현재 | Vercel에서 |
|---|---|---|
| `server.js` | 내 PC에서 상시 실행 | 실행되지 않음 (서버리스 함수로 바꿔야 함) |
| `/config.js`, `/api/products` | `server.js`가 응답 | 없음 -> 데모 모드로만 동작 |
| `.env.local` | 서버가 읽음 | 올라가지 않음 (`.gitignore`) -> 4번에서 Vercel에 직접 입력 |
| 추가 · 삭제 API | 이 PC에서만 접속 | 인터넷에 공개됨 -> 접근 제한(로그인 등)이 필요 |

그래서 **A단계(코드 준비)가 끝난 뒤에 B단계를 한다.** A단계의 서버리스 변환과 접근 제한은 아직 만들지 않았다.

---

## A. 코드를 GitHub에 올리기

1. 터미널에서 프로젝트 폴더(`1102 실습`)를 연다
2. 올릴 파일을 추가한다. **`.env.local`은 올리지 않는다** (이미 `.gitignore`에 있음)

   ```bash
   git add modeling/product-manager
   git status
   ```

   `git status`의 초록색 목록에 `.env.local`이 **없는지** 확인한다
3. 커밋하고 올린다

   ```bash
   git commit -m "상품 관리 페이지 추가"
   git push
   ```
4. https://github.com/rimisucrimi88/food-list 에서 파일이 보이는지 확인한다

> 화면 캡처에 나온 저장소는 `superbase-test`다. 위 명령은 `food-list`로 올라간다. Vercel에서 가져올 저장소를 **둘 중 하나로 통일**한다

---

## B. Vercel에서 배포하기

### B-1. 로그인

1. https://vercel.com 접속
2. 우측 상단 **Log In** 클릭
3. **Continue with GitHub** 클릭 -> GitHub 로그인 -> 권한 허용

### B-2. 저장소 가져오기

1. 대시보드 우측 상단 **Add New...** 클릭 -> **Project** 선택
2. **Import Git Repository** 목록에서 올린 저장소 오른쪽의 **Import** 클릭
3. 저장소가 목록에 없으면 목록 아래 **Adjust GitHub App Permissions** 클릭 -> GitHub 화면에서 해당 저장소를 선택해 **Save** -> 다시 Vercel로 돌아와 새로고침

### B-3. New Project 화면 입력

| 위치 | 기입 / 선택 |
|---|---|
| **Vercel Team** | `GOODVIBES ONLY`(Hobby) 그대로 |
| **Project Name** | 영문 소문자 · 숫자 · `-`만 가능. 예: `food-list`. 주소가 `food-list.vercel.app`이 된다 |
| **Root Directory** | 오른쪽 폴더 입력칸의 **Edit** 클릭 -> `modeling/product-manager` 선택 -> **Continue** |
| **Application Preset** | **Other** (지금 구조 기준). A단계에서 Next.js로 바꾸면 **Next.js** |

### B-4. Environment Variables 입력 (Deploy 누르기 전)

1. **Environment Variables** 줄을 클릭해 펼친다
2. `Key` 칸에 이름, `Value` 칸에 값을 넣고 **Add**를 누른다. 세 번 반복한다

   | Key | Value | 어디서 복사 |
   |---|---|---|
   | `SUPABASE_URL` | `https://<프로젝트>.supabase.co` | Supabase 대시보드 -> Project Settings -> API -> Project URL |
   | `SUPABASE_ANON_KEY` | anon public 키 | 같은 화면 -> Project API keys -> anon public |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role 키 | 같은 화면 -> service_role (Reveal 클릭) |

3. 키 값은 **채팅이나 문서에 붙여넣지 않는다.** Vercel 입력칸에만 넣는다
4. `.env.local` 파일을 칸 위로 끌어다 놓으면 한꺼번에 채워지기도 하지만, 값이 맞는지 확인한 뒤 **Add**를 누른다
5. `SUPABASE_SERVICE_ROLE_KEY`는 `NEXT_PUBLIC_` 같은 접두사를 **절대 붙이지 않는다** (붙이면 브라우저에 공개된다)

### B-5. 배포

1. 맨 아래 검은색 **Deploy** 버튼 클릭
2. 빌드 로그가 흐르고 1~2분 뒤 "Congratulations!" 화면이 나온다
3. **Continue to Dashboard** 클릭
4. 대시보드의 **Visit** 버튼 또는 **Domains**에 적힌 주소를 클릭해 열어 본다

---

## C. 확인

1. 페이지가 열린다
2. 상단 배지가 **Supabase 연결**인지 본다. **데모 모드**면 환경변수가 반영되지 않은 것이다 (D 참고)
3. 상품 10건이 보인다
4. 상품 추가 -> 목록에 나타난다 -> 삭제해서 정리한다 (테스트 데이터가 남지 않게)
5. 키가 새지 않았는지: 페이지에서 우클릭 -> **페이지 소스 보기** -> `service_role`이나 `eyJ`로 시작하는 긴 키가 **anon 키 외에** 없어야 한다

## D. 문제 해결

| 증상 | 해결 |
|---|---|
| 배지가 데모 모드 | Vercel 프로젝트 -> **Settings** -> **Environment Variables**에서 세 값을 확인 -> 수정 후 **Deployments** 탭 -> 맨 위 배포 오른쪽 `...` -> **Redeploy** (환경변수는 새 배포부터 적용된다) |
| 404 NOT_FOUND | Root Directory가 `modeling/product-manager`인지 확인 (**Settings** -> **General** -> Root Directory) |
| 상품이 안 보임 | Supabase SQL Editor에서 `supabase_schema.sql`, `supabase_seed.sql`, `supabase_read_policy.sql`을 순서대로 실행했는지 확인 |
| 추가 · 삭제 오류 | 서버리스 함수(A단계)가 아직 없는 경우. 로컬 서버에서만 동작한다 |

## E. 이후 수정 반영

코드를 고치고 `git push`하면 Vercel이 **자동으로 다시 배포**한다. 화면에서 따로 누를 것은 없다.

## F. 팀원과 공유할 때

- Hobby 플랜은 팀원 초대가 제한된다. 주소를 아는 사람은 누구나 접속하므로, 추가 · 삭제 API에는 **로그인 등 접근 제한**을 반드시 둔다
- 접근 제한 없이 공개하면 누구나 상품을 지울 수 있다
