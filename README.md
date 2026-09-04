# 강의 일정 대시보드

Google Calendar의 강의 일정을 읽어 공개 대시보드로 보여주는 정적 웹앱입니다. GitHub Pages, Netlify, Vercel 같은 정적 호스팅에 그대로 올릴 수 있습니다.

## 연결 방법

1. Google Calendar에서 강의 전용 캘린더를 만듭니다.
2. 캘린더 설정에서 `일정의 액세스 권한`을 공개로 설정합니다.
3. `캘린더 통합` 영역의 `캘린더 ID`를 복사합니다.
4. Google Cloud Console에서 Calendar API를 활성화하고 API 키를 만듭니다.
5. API 키의 애플리케이션 제한을 `HTTP 리퍼러`로 설정하고 GitHub Pages 도메인을 등록합니다.
6. `app.js` 상단의 `CALENDAR_CONFIG`를 수정합니다.

```js
const CALENDAR_CONFIG = {
  calendarId: "your_calendar_id@group.calendar.google.com",
  apiKey: "YOUR_GOOGLE_API_KEY",
  timezone: "Asia/Seoul",
  refreshMinutes: 10,
};
```

## GitHub Pages 배포

1. 이 폴더의 파일을 GitHub 저장소에 올립니다.
2. 저장소의 `Settings > Pages`로 이동합니다.
3. `Deploy from a branch`를 선택하고 `main` 브랜치의 루트 폴더를 지정합니다.
4. 표시되는 Pages URL을 공유합니다.

## 확정/미정 표기

- Google Calendar 일정 상태가 `Tentative`이면 대시보드에서 `미정`으로 표시됩니다.
- 일정 제목, 장소, 설명에 `미정`, `tentative`, `TBD`가 들어가도 `미정`으로 표시됩니다.
- 그 외 일정은 `확정`으로 표시됩니다.

## 소속별 접속 권한과 관리자 모드

로그인 화면에는 소속 목록이나 자동완성이 표시되지 않습니다. 사용자는 전달받은 소속명을 직접 정확하게 입력해야 합니다. 기본 계정은 다음과 같습니다.

- 관리자: `관리자` / `admin2026`
- EXC: `EXC` / `exc2026`
- 캐럿: `캐럿` / `caret2026`

관리자로 로그인하면 상단의 `소속 관리`에서 소속과 비밀번호를 추가, 수정, 삭제할 수 있으며 모든 일정의 상세 내용을 볼 수 있습니다. 계정 설정은 저장소의 `access.json`에서 공용으로 관리됩니다. 모든 접속자는 페이지를 열 때 최신 `access.json`을 읽으므로 다른 기기에도 같은 설정이 적용됩니다.

### 관리자 공용 동기화 설정

관리자 화면에서 변경사항을 저장하려면 GitHub fine-grained personal access token이 필요합니다.

1. GitHub에서 fine-grained personal access token을 만듭니다.
2. 저장소 접근 범위를 `datathinkinglab/lecture-schedule` 하나로 제한합니다.
3. Repository permissions에서 `Contents: Read and write`를 허용합니다.
4. 관리자 화면의 `GitHub 토큰`에 붙여넣고 소속을 추가, 수정 또는 삭제합니다.

토큰은 API 요청에만 사용되고 `localStorage`나 `sessionStorage`에 저장되지 않습니다. 관리자 창을 닫으면 입력값도 지워집니다. 저장 성공 시 `access.json`에 새 커밋이 만들어지고 다른 기기는 페이지를 새로 열거나 새로고침할 때 최신 설정을 받습니다.

기본 소속은 `app.js` 상단의 `ACCESS_CONFIG.defaultOrganizations`에서 변경할 수 있습니다.

```js
const ACCESS_CONFIG = {
  defaultOrganizations: [
    {
      id: "exc",
      name: "EXC",
      password: "exc2026",
      keywords: ["EXC", "[EXC]"],
    },
    {
      id: "caret",
      name: "캐럿",
      password: "caret2026",
      keywords: ["캐럿", "CARET", "Caret"],
    },
  ],
  sharedKeywords: ["공통", "전체", "ALL"],
};
```

일정 제목 앞에 `[소속명]` 태그를 넣으면 해당 소속 사용자는 상세 내용을 볼 수 있습니다. 소속을 추가한 경우에도 같은 방식으로 사용합니다.

- `[EXC] AI 기초 입문`: EXC 사용자에게 상세 표시, 다른 소속에는 `일정 있음`으로 표시
- `[캐럿] 데이터 분석 실습`: 캐럿 사용자에게 상세 표시, 다른 소속에는 `일정 있음`으로 표시
- `[새로운소속] 리더십 강의`: 관리자가 추가한 `새로운소속` 사용자에게 상세 표시
- `[공통] 프로젝트 멘토링`: 모든 소속 사용자에게 상세 표시

각 소속 사용자는 전체 일정의 날짜와 시간은 볼 수 있습니다. 다만 다른 소속 일정은 제목, 장소, 설명, 수정 버튼이 숨겨지고 `일정 있음`으로 표시됩니다. 소속 태그가 없는 일정도 일반 사용자에게는 `일정 있음`으로 표시되며 관리자는 상세 내용을 볼 수 있습니다.

이 방식은 정적 웹사이트용 간이 접근 제어입니다. 공개 저장소의 `access.json`과 클라이언트 JavaScript는 누구나 확인할 수 있으므로 기밀 정보를 보호하는 강한 인증 수단은 아닙니다. 민감한 일정에는 서버 기반 로그인과 비공개 데이터베이스를 사용해야 합니다.

## 파일 구조

- `index.html`: 화면 구조
- `styles.css`: 반응형 대시보드 스타일
- `app.js`: Google Calendar 연동, 필터, 목록/월간 보기
- `access.json`: 여러 기기에서 공유하는 소속 및 비밀번호 설정

API 키는 브라우저에 노출되는 값이므로 반드시 HTTP 리퍼러 제한을 걸어두세요.
