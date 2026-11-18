# 유튜브 영상 자동 동기화 설정 (비개발자용 가이드)

새 영상이 유튜브에 올라오면 **30분 안에** 사이트의 기술 목록에 자동으로 연결되게 하는 방법입니다.
코드를 고치지 않고 브라우저에서 클릭만으로 설정할 수 있게 순서대로 적었습니다.

## 먼저 알아둘 것: 어떻게 돌아가나요?

```
Google Apps Script (30분마다 깨어남)
        ↓ "동기화 실행해" 신호를 GitHub에 전송 (토큰 사용)
GitHub Actions: "유튜브 영상 동기화" 워크플로
        ↓ 유튜브 새 영상 확인 → 기술 이름에 연결
data.js, sync/videos.json 자동 커밋 → 사이트에 반영
```

- **GitHub 자체 예약 실행(cron)을 쓰지 않는 이유**: 이 저장소에서는 GitHub의 예약 실행이 하루 종일 한 번도 돌지 않았습니다. GitHub 예약 기능은 보장되는 기능이 아니라서 이런 일이 있습니다. 그래서 **밖에서 30분마다 신호를 보내는 방식**으로 바꿨습니다.
- **Google Apps Script**는 구글 계정만 있으면 무료로 쓰는 예약 실행 서비스입니다. 별도 가입이나 이메일 인증이 필요 없습니다.
- 새 영상이 없으면 아무것도 바뀌지 않고, 커밋도 남지 않습니다.
- 관리자 화면의 **영상 동기화** 버튼으로 언제든 수동 실행할 수 있습니다.

> 필요한 것: GitHub 계정(저장소 주인), 구글 계정

---

## 1. 동기화 전용 토큰 만들기 (GitHub)

Apps Script가 GitHub에 "동기화 실행" 신호를 보내려면 **토큰**(임시 열쇠)이 필요합니다.
관리자 페이지용 토큰과 **따로** 만들고, **Actions 권한만** 줍니다. 이렇게 하면 이 토큰이 새어도 동기화를 실행시키는 것밖에 못 합니다.

1. GitHub 오른쪽 위 내 사진 → `Settings` → 맨 아래 `Developer settings`
2. `Personal access tokens` → `Fine-grained tokens` → `Generate new token`
3. 아래처럼 채웁니다.

   | 항목 | 값 |
   |---|---|
   | Token name | `cron-trigger` (구분되는 이름) |
   | Expiration | 원하는 기간 (**만료되면 동기화가 멈춥니다.** 만료일을 달력에 적어 두세요) |
   | Repository access | **Only select repositories** → 이 사이트 저장소 하나만 |
   | Permissions | **Actions: Read and write** 하나만 추가 (Metadata: Read-only는 자동으로 들어갑니다) |

   **Contents, Workflows 같은 다른 권한은 주지 마세요.**
   (Workflows 권한이 있으면 토큰이 새었을 때 워크플로 파일을 고쳐 비밀 값을 빼갈 수 있습니다.)

4. `Generate token` → 나온 토큰(`github_pat_...`)을 바로 복사합니다. 창을 닫으면 다시 볼 수 없습니다.

> 토큰은 비밀번호와 같습니다. 채팅, 메일, 저장소 파일에 적지 마세요.

---

## 2. Google Apps Script 만들기

1. <https://script.google.com> 에 구글 계정으로 로그인합니다.
2. 왼쪽 위 **새 프로젝트**를 누릅니다.
3. 위쪽 프로젝트 이름(제목 없는 프로젝트)을 `bjj-sync-trigger` 로 바꿉니다.

### 2-1. 토큰 저장 (코드보다 먼저)
1. 왼쪽 톱니바퀴 **프로젝트 설정**을 누릅니다.
2. 맨 아래 **스크립트 속성** → **스크립트 속성 추가**
3. 속성: `GH_TOKEN`, 값: 1번에서 복사한 토큰 → **스크립트 속성 저장**

토큰은 코드에 적지 않고 이 칸에만 보관합니다. 코드를 다른 사람에게 보여 줘도 토큰은 보이지 않습니다.

### 2-2. 코드 붙여넣기
1. 왼쪽 `< >` 아이콘 **편집기**로 돌아갑니다.
2. 기존 코드를 모두 지우고 아래를 붙여넣습니다.
3. 저장(디스크 아이콘 또는 `Ctrl+S`)합니다.

```js
function triggerSync() {
  var token = PropertiesService.getScriptProperties().getProperty('GH_TOKEN');
  var url = 'https://api.github.com/repos/계정이름/저장소이름/actions/workflows/sync-youtube.yml/dispatches';
  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    payload: JSON.stringify({ ref: 'main' }),
    muteHttpExceptions: true
  });
  Logger.log(res.getResponseCode() + ' ' + res.getContentText());
}
```

**3번째 줄의 `계정이름/저장소이름`을 내 것으로 바꾸세요.**
현재 사이트는 `kyeongha2857-code/bjj-videos-static` 입니다. 다른 계정으로 옮겼다면 [MIGRATION.md](MIGRATION.md)의 새 계정 이름을 넣으세요.

---

## 3. 테스트 실행

1. 위쪽 함수 선택이 `triggerSync` 인지 확인하고 **실행**(▷)을 누릅니다.
2. 처음에는 **권한 검토** 창이 뜹니다. 계정을 고르고, "Google에서 확인하지 않은 앱" 경고가 나오면 **고급** → **(프로젝트 이름)(안전하지 않음)으로 이동** → **허용**을 누릅니다. 본인이 만든 스크립트라 안전합니다.
3. 아래 실행 로그의 숫자를 확인합니다.

| 로그 숫자 | 뜻 |
|---|---|
| **204** | 성공. GitHub Actions 목록에 `Manually run` 실행이 하나 생깁니다 |
| 401 | 토큰이 비었거나 잘못 붙여넣음. 2-1을 다시 확인 |
| 403 | 토큰 권한 부족. 1번에서 Actions: Read and write 확인 |
| 404 | 계정/저장소 이름 오타이거나, 토큰이 이 저장소를 선택하지 않음 |

---

## 4. 30분마다 자동 실행 걸기

1. 왼쪽 시계 아이콘 **트리거**를 누릅니다.
2. 오른쪽 아래 **트리거 추가**를 누릅니다.
3. 아래처럼 고르고 **저장**합니다.

   | 항목 | 값 |
   |---|---|
   | 실행할 함수 | `triggerSync` |
   | 실행할 배포 | Head |
   | 이벤트 소스 | 시간 기반 |
   | 시간 기반 트리거 유형 | 분 타이머 |
   | 간격 | 30분마다 |

4. 권한 승인 창이 한 번 더 뜨면 허용합니다.

> 정확한 시각(예: 정각)에 도는 것이 아니라 **30분 주기 안의 임의 시각**에 돕니다. 새 영상은 늦어도 30분~1시간 안에 사이트에 반영됩니다.

---

## 5. 잘 돌고 있는지 확인하기

- GitHub 저장소 → `Actions` 탭 → 왼쪽 **유튜브 영상 동기화** 에 30분마다 `Manually run` 실행이 쌓이면 정상입니다. (신호를 보내는 쪽이 Apps Script라 `Scheduled`가 아니라 `Manually run` 으로 표시됩니다.)
- Apps Script 쪽은 왼쪽 **실행** 메뉴에서 각 실행의 성공/실패를 볼 수 있습니다.
- 새 영상이 반영되면 저장소에 `유튜브 새 영상 자동 동기화` 커밋이 생깁니다.

---

## 자주 겪는 문제

| 증상 | 원인과 해결 |
|---|---|
| 어느 날부터 동기화가 멈춤 | 토큰 만료일이 지났을 가능성이 큽니다. 1번에서 새 토큰을 만들어 2-1의 `GH_TOKEN` 값만 바꾸세요. |
| Apps Script 실행이 실패로 표시됨 | 실행 로그의 숫자를 위 표로 확인하세요. |
| Actions에 실행은 생기는데 빨간 X | [MIGRATION.md](MIGRATION.md) 3번(Workflow permissions를 Read and write)과 5번(Secret) 설정을 확인하세요. |
| 트리거가 사라졌거나 이메일로 오류 알림이 옴 | 4번을 다시 설정하세요. Apps Script가 실패하면 구글이 알림 메일을 보냅니다. |
| 새 영상이 연결 안 됨 | 제목으로 기술을 찾지 못한 경우입니다. `sync/overrides.json` 으로 직접 연결하거나 관리자 화면에서 영상 주소를 넣으세요. (README 참고) |
| 다른 계정으로 옮김 | 1번 토큰을 새 계정에서 새로 만들고, 2-2의 코드 3번째 줄을 새 `계정이름/저장소이름`으로 바꾼 뒤 3번 테스트를 다시 하세요. |

---

## 참고: GitHub 예약(cron)이 안 돌던 이유

이 저장소에서는 `.github/workflows/sync-youtube.yml` 의 `schedule`(cron) 설정이 몇 시간 동안 한 번도 실행되지 않았습니다.
정각을 피해 시각을 바꾸고, 저장소 주인 계정 이름으로 다시 커밋하고, 워크플로를 껐다 켜 봤지만 해결되지 않았습니다.
수동 실행(`workflow_dispatch`)은 항상 정상이어서, 위 방식처럼 외부에서 `workflow_dispatch` 를 호출하는 것이 가장 확실했습니다.
워크플로 파일의 `schedule` 줄은 남겨 두어도 해가 없습니다.

---

## 체크리스트

- [ ] GitHub: Actions 권한만 가진 `cron-trigger` 토큰 발급
- [ ] Apps Script: 프로젝트 만들기, `GH_TOKEN` 스크립트 속성 저장
- [ ] 코드 붙여넣기, 3번째 줄 계정/저장소 이름 확인
- [ ] 테스트 실행 결과 `204`
- [ ] 트리거 추가 (시간 기반, 분 타이머, 30분마다)
- [ ] 30~60분 뒤 Actions에 실행이 쌓이는지 확인
- [ ] 토큰 만료일을 달력에 적어 두기
