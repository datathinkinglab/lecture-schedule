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

## 파일 구조

- `index.html`: 화면 구조
- `styles.css`: 반응형 대시보드 스타일
- `app.js`: Google Calendar 연동, 필터, 목록/월간 보기

API 키는 브라우저에 노출되는 값이므로 반드시 HTTP 리퍼러 제한을 걸어두세요.
