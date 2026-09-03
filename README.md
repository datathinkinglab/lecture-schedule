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

관리자로 로그인하면 상단의 `소속 관리`에서 소속과 비밀번호를 추가, 수정, 삭제할 수 있으며 모든 일정의 상세 내용을 볼 수 있습니다. 관리자에서 변경한 계정 설정은 현재 브라우저의 `localStorage`에 저장됩니다.

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

이 방식은 정적 웹사이트용 간이 접근 제어입니다. 관리자에서 추가한 소속은 해당 브라우저에만 저장되므로 다른 기기나 사용자에게 자동 반영되지 않습니다. 여러 사용자에게 계정 변경을 공유하거나 민감한 일정을 보호하려면 배포 전에 서버 기반 로그인과 데이터베이스를 연결해야 합니다.

## 파일 구조

- `index.html`: 화면 구조
- `styles.css`: 반응형 대시보드 스타일
- `app.js`: Google Calendar 연동, 필터, 목록/월간 보기

API 키는 브라우저에 노출되는 값이므로 반드시 HTTP 리퍼러 제한을 걸어두세요.
