# 다른 GitHub 계정으로 옮기기 (비개발자용 가이드)

이 사이트를 다른 GitHub 계정으로 옮기는 방법입니다. 코드를 직접 고치거나 명령어를 칠 필요 없이,
**웹 브라우저에서 클릭만으로** 할 수 있게 순서대로 적었습니다.

옮기면 새로 해줘야 하는 설정이 몇 가지 있습니다. 아래 "0. 시작 전 준비"부터 차례로 따라 하세요.
각 단계 끝에 "잘 됐는지 확인" 방법도 적어 두었습니다.

> 소요 시간: 20~30분 (도메인 연결이 반영되기까지 몇 분~몇 시간 더 걸릴 수 있습니다)

---

## 0. 시작 전 준비

- [ ] **새 계정**으로 GitHub에 로그인할 수 있는지 확인합니다.
- [ ] 지금 계정에서 `Settings` → `Pages`에 들어가 **Custom domain**(개인 도메인) 칸에 적힌 주소를 메모합니다. (예: `www.noryangjinbjj.cloud`)
- [ ] 도메인을 산 곳(가비아, 후이즈, Cloudflare 등)에 로그인할 수 있는지 확인합니다.
- [ ] 유튜브 자동 동기화에서 Gemini AI 보조를 쓰고 있다면, 기존 Gemini API 키를 따로 메모해 둡니다. (키는 새 계정에서 다시 넣어야 합니다. 키를 모르겠다면 아래 5번에서 새로 발급합니다.)
- [ ] 안전을 위해 `data.js`와 `sync` 폴더를 내 컴퓨터에 내려받아 백업합니다. (저장소 화면 → 초록색 `Code` 버튼 → `Download ZIP`)

---

## 1. 저장소 옮기기 (둘 중 하나를 고르세요)

### 방법 A. 저장소 이전 (Transfer): 권장

기록과 설정을 그대로 가져가는 가장 간단한 방법입니다.

1. 지금 계정에서 저장소(`bjj-videos-static`)를 엽니다.
2. 위쪽 `Settings` → 맨 아래 **Danger Zone** → **Transfer ownership** 을 누릅니다.
3. 새 계정 이름(또는 조직 이름)을 입력하고 안내에 따라 확인합니다.
4. 새 계정의 이메일로 도착한 초대를 **수락**합니다. (메일이 없으면 `https://github.com/새계정이름/bjj-videos-static` 주소로 직접 들어가 수락)

잘 됐는지 확인: 새 계정에서 저장소가 보이면 성공입니다.

> 이전 후에도 **예전 github.com 주소는 새 주소로 자동 연결**되지만, **예전 `계정.github.io` 주소는 연결되지 않습니다.**
> 아래 2~3번을 하고 나면 새 `새계정.github.io/bjj-videos-static/` 주소로 열립니다.

### 방법 B. 포크(Fork)로 복사

원본은 그대로 두고 복사본을 새 계정에 만들 때 씁니다. (저장소가 공개(Public) 상태여야 합니다.)

1. **새 계정으로 로그인**한 상태에서 기존 저장소 주소(`https://github.com/kyeongha2857-code/bjj-videos-static`)를 엽니다.
2. 오른쪽 위 **Fork** → `Create fork` 를 누릅니다.
3. 복사된 저장소의 `Actions` 탭에 들어가 초록색 **I understand my workflows, go ahead and enable them** 버튼을 누릅니다. (복사본은 자동 동기화가 꺼진 채로 시작합니다.)

> 방법 B는 원본과 복사본이 따로 움직입니다. 원본에서 쓰던 개인 도메인을 새 쪽으로 쓰려면 **원본 쪽 도메인 설정을 먼저 지워야** 합니다. (4번 참고)

---

## 2. 사이트 공개(Pages) 켜기

**새 계정의 저장소**에서 합니다.

1. `Settings` → 왼쪽 메뉴 `Pages`
2. **Source**: `Deploy from a branch`
3. **Branch**: `main` / 폴더 `/ (root)` 선택 후 `Save`
4. 1~2분 뒤 같은 화면 위쪽에 `Your site is live at https://새계정이름.github.io/bjj-videos-static/` 라고 뜹니다.

잘 됐는지 확인: 위 주소를 열었을 때 사이트가 보이면 성공입니다.

---

## 3. 자동 동기화가 저장소를 고칠 수 있게 허용하기

유튜브 새 영상을 자동으로 연결하는 기능이 `data.js`를 수정해 저장하려면 권한이 필요합니다.

1. `Settings` → 왼쪽 `Actions` → `General`
2. 아래쪽 **Workflow permissions** 에서 **Read and write permissions** 를 선택
3. `Save`

잘 됐는지 확인: 6번(동기화 시험)에서 확인합니다.

---

## 4. 개인 도메인(www.noryangjinbjj.cloud) 옮기기

개인 도메인을 쓰고 있을 때만 하면 됩니다. **개인 도메인은 한 번에 한 저장소에만 연결**할 수 있어서 순서가 중요합니다.

**4-1. 예전 쪽 연결 해제** (방법 B로 복사한 경우에만 필요. 방법 A는 건너뛰어도 됩니다.)
- 예전 계정의 저장소 → `Settings` → `Pages` → Custom domain 옆 **Remove**

**4-2. 도메인 업체에서 DNS 값 바꾸기**
- 도메인을 산 업체의 DNS(네임서버/레코드) 관리 화면으로 갑니다.
- `www` 항목의 **CNAME** 레코드 값을 아래처럼 바꿉니다.

  | 종류 | 호스트 | 값 |
  |---|---|---|
  | CNAME | `www` | `새계정이름.github.io.` |

  (끝에 점(`.`)이 있으면 그대로 두세요. 업체에 따라 점이 자동으로 붙기도 합니다.)

**4-3. 새 저장소에 도메인 입력**
- 새 계정 저장소 → `Settings` → `Pages` → **Custom domain** 에 `www.noryangjinbjj.cloud` 입력 → `Save`
- 잠시 뒤 **Enforce HTTPS** 체크박스가 켜지면 체크합니다. (몇 분~몇 시간 걸릴 수 있습니다.)

잘 됐는지 확인: `https://www.noryangjinbjj.cloud` 가 열리고 주소창에 자물쇠가 보이면 성공입니다.

---

## 5. 유튜브 자동 동기화 설정 (Gemini AI는 선택)

> Gemini 키는 **없어도 동작합니다.** 제목만으로 기술을 못 찾는 영상을 AI가 한 번 더 판단해 주는 보조 기능일 뿐입니다.

1. `Settings` → 왼쪽 `Secrets and variables` → `Actions`
2. **Secrets** 탭 → `New repository secret`
   - Name: `GEMINI_API_KEY`
   - Secret: Gemini API 키 붙여넣기 → `Add secret`
   - 키가 없으면 <https://aistudio.google.com/apikey> 에서 새로 만들 수 있습니다. (구글 계정이 있으면 됩니다. 기존 키를 그대로 써도 됩니다.)
3. (선택) **Variables** 탭 → `New repository variable`
   - Name: `GEMINI_MODEL`, Value: 쓰고 싶은 모델 이름. 비워 두면 기본값(`gemini-2.5-flash`)을 씁니다.

---

## 6. 관리자 페이지 연결과 토큰 새로 만들기

관리자 페이지에서 저장하거나 "영상 동기화" 버튼을 쓰려면 GitHub **토큰**(임시 열쇠)이 필요합니다.
토큰은 계정에 묶여 있어서 **새 계정에서 새로 만들어야** 합니다.

**6-1. GitHub 연결 주소 바꾸기**
1. 새 주소(`https://새계정이름.github.io/bjj-videos-static/admin`)로 관리자 페이지에 들어갑니다. (비밀번호는 그대로입니다.)
2. `저장 설정` 탭의 GitHub 연결 칸에 **계정(owner)** 과 **저장소(repo)** 가 새 계정 이름으로 채워져 있는지 확인합니다. 다르면 새 이름으로 고칩니다.

**6-2. 토큰 만들기** (새 계정으로 로그인한 상태에서)
1. GitHub 오른쪽 위 내 사진 → `Settings` → 맨 아래 `Developer settings`
2. `Personal access tokens` → `Fine-grained tokens` → `Generate new token`
3. 아래처럼 채웁니다.
   - **Token name**: 아무 이름 (예: `bjj-site`)
   - **Expiration**: 원하는 기간 (만료되면 다시 만들어야 합니다)
   - **Repository access**: `Only select repositories` → 이 사이트 저장소만 선택
   - **Permissions** → `Repository permissions`:
     - **Contents**: `Read and write`
     - **Actions**: `Read and write`
4. `Generate token` → 화면에 나온 토큰(`github_pat_...`)을 **바로 복사**합니다. (창을 닫으면 다시 볼 수 없습니다.)
5. 관리자 페이지 `저장 설정` 탭의 **토큰** 칸에 붙여넣고 저장합니다.

> 토큰은 비밀번호와 같습니다. 남에게 보여 주거나 `config.properties` 같은 저장소 파일에 적지 마세요.

**6-3. 저장소 파일의 기본 연결값도 새 이름으로 바꾸기** (관리자 링크가 새 주소로 열리게 하기 위해)

방법 1: 관리자 페이지 `저장 설정`에서 저장하면 `config.properties` 의 `github.owner`, `github.repo` 가 자동으로 바뀝니다.

방법 2: GitHub에서 직접 수정
1. 저장소에서 `config.properties` 파일을 엽니다.
2. 오른쪽 위 연필(Edit) 아이콘을 누릅니다.
3. 아래 두 줄의 값을 새 계정/저장소 이름으로 바꿉니다.
   ```
   github.owner=새계정이름
   github.repo=bjj-videos-static
   ```
4. 오른쪽 위 `Commit changes...` → `Commit changes` 를 누릅니다.

---

## 7. 마지막 점검: 동기화 시험

1. 새 저장소의 `Actions` 탭 → 왼쪽 **유튜브 영상 동기화** 선택
2. 오른쪽 `Run workflow` → 초록색 `Run workflow` 버튼
3. 1~2분 뒤 목록에 초록색 체크가 뜨면 성공입니다. 빨간 X면 3번(권한)과 5번(Secret)을 다시 확인하세요.
4. 같은 일을 관리자 페이지 메뉴의 **영상 동기화** 버튼으로도 할 수 있습니다. (6-2의 토큰에 Actions 권한이 있어야 합니다.)

이후에는 **30분마다**(매시 7분, 37분경) 자동으로 새 영상을 확인합니다.

---

## 자주 겪는 문제

| 증상 | 원인과 해결 |
|---|---|
| 사이트에 `404` 가 뜸 | 2번(Pages) 설정을 안 했거나 아직 반영 전입니다. 2~3분 기다린 뒤 다시 확인하세요. |
| 동기화가 빨간 X로 끝남 | 3번 권한이 `Read only` 인지 확인하세요. 로그의 `Permission denied` 가 보이면 이 문제입니다. |
| 관리자에서 저장이 안 됨 | 토큰을 새로 만들었는지, 대상 저장소와 `Contents: Read and write` 권한이 맞는지 확인하세요. |
| "영상 동기화" 버튼이 오류를 냄 | 토큰에 `Actions: Read and write` 권한이 없는 경우입니다. 6-2에서 권한을 추가한 새 토큰으로 바꾸세요. |
| 개인 도메인이 안 열림 | DNS 반영에 몇 분~몇 시간 걸립니다. 4-2의 CNAME 값(`새계정이름.github.io.`)과 4-3의 Custom domain 입력을 다시 확인하세요. |
| `Enforce HTTPS` 를 누를 수 없음 | 도메인 연결이 완전히 반영되기 전입니다. 잠시 뒤 다시 시도하세요. |
| 카카오톡 미리보기가 옛날 모습 | 카카오는 미리보기를 저장해 둡니다. <https://developers.kakao.com/tool/clear/og> 에서 주소를 입력해 초기화하세요. |
| 자동 동기화가 어느 날부터 멈춤 | GitHub는 저장소에 60일간 활동이 없으면 예약 실행을 끕니다. `Actions` 탭에서 `Enable workflow` 를 누르세요. |
| 예약 시각보다 늦게 돎 | GitHub 혼잡에 따라 몇 분~수십 분 늦을 수 있습니다. 정상입니다. |

---

## 체크리스트 (복사해서 쓰세요)

- [ ] 0. 도메인 주소 메모, `data.js`와 `sync` 폴더 백업
- [ ] 1. 저장소 이전(A) 또는 포크(B) 완료
- [ ] 2. Pages 켜기 (main / root)
- [ ] 3. Workflow permissions를 Read and write로 변경
- [ ] 4. 개인 도메인: CNAME 변경, Custom domain 입력, HTTPS 적용
- [ ] 5. `GEMINI_API_KEY` 등록 (선택)
- [ ] 6. 관리자 연결 주소 확인, 새 토큰 발급 후 입력, `config.properties` 의 owner/repo 수정
- [ ] 7. `Run workflow` 로 동기화 시험 성공 확인
