/**
 * 강의 일정 등록 API (Google Apps Script 웹앱)
 *
 * 사이트에서 보낸 일정을 검증한 뒤 Google 캘린더에 추가합니다.
 * 설정은 [프로젝트 설정 > 스크립트 속성]에 입력합니다. (README.md 참고)
 *   CALENDAR_ID    : 일정을 추가할 캘린더 ID
 *   ADMIN_PASSWORD : 관리자 비밀번호
 *   ACCESS_URL     : access.json 의 raw 주소
 */

const TIMEZONE = "Asia/Seoul";
const ADMIN_NAME = "관리자";
const SHARED_TAG = "공통";

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const props = PropertiesService.getScriptProperties();

    const role = authenticate_(data, props);
    if (!role) {
      return json_({ ok: false, code: "auth", error: "소속 또는 비밀번호가 올바르지 않습니다." });
    }

    if (data.action === "delete") return deleteEvent_(data, role, props);

    const tag = String(data.tag || "").trim();
    if (role.type !== "admin" && tag !== role.name && tag !== SHARED_TAG) {
      return json_({ ok: false, error: "해당 소속으로는 일정을 등록할 수 없습니다." });
    }

    const title = clean_(data.title, 100);
    if (!title) return json_({ ok: false, error: "강의명을 입력해 주세요." });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date) || !/^\d{2}:\d{2}$/.test(data.start) || !/^\d{2}:\d{2}$/.test(data.end)) {
      return json_({ ok: false, error: "날짜 또는 시간 형식이 올바르지 않습니다." });
    }

    const start = parseKst_(data.date, data.start);
    const end = parseKst_(data.date, data.end);
    if (end <= start) return json_({ ok: false, error: "종료 시간은 시작 시간보다 늦어야 합니다." });

    const fullTitle = (tag ? "[" + tag + "] " : "") + title + (data.tentative ? " (미정)" : "");
    const description = clean_(data.description, 2000) + "\n\n등록: " + role.name + " (사이트 등록)";

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const calendar = CalendarApp.getCalendarById(props.getProperty("CALENDAR_ID"));
      if (!calendar) return json_({ ok: false, error: "캘린더를 찾을 수 없습니다. 서버 설정을 확인해 주세요." });

      if (data.action === "update") {
        const event = calendar.getEventById(String(data.id || ""));
        if (!event) return json_({ ok: false, error: "수정할 일정을 찾을 수 없습니다." });
        if (event.isAllDayEvent()) return json_({ ok: false, error: "종일 일정은 사이트에서 수정할 수 없습니다." });

        // 수정 권한은 기존 일정의 태그 기준으로 확인합니다.
        const currentTagMatch = event.getTitle().match(/^\[([^\]]+)\]/);
        const currentTag = currentTagMatch ? currentTagMatch[1] : "";
        if (role.type !== "admin" && currentTag !== role.name && currentTag !== SHARED_TAG) {
          return json_({ ok: false, error: "이 일정을 수정할 권한이 없습니다." });
        }

        event.setTitle(fullTitle);
        event.setTime(start, end);
        event.setLocation(clean_(data.location, 200));
        event.setDescription(clean_(data.description, 2000) + "\n\n수정: " + role.name + " (사이트 수정)");
        return json_({ ok: true, id: event.getId() });
      }

      const created = calendar.createEvent(fullTitle, start, end, {
        location: clean_(data.location, 200),
        description: description,
      });
      return json_({ ok: true, id: created.getId() });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return json_({ ok: false, error: "처리 중 오류가 발생했습니다: " + err.message });
  }
}

function deleteEvent_(data, role, props) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const calendar = CalendarApp.getCalendarById(props.getProperty("CALENDAR_ID"));
    if (!calendar) return json_({ ok: false, error: "캘린더를 찾을 수 없습니다. 서버 설정을 확인해 주세요." });

    const event = calendar.getEventById(String(data.id || ""));
    if (!event) return json_({ ok: false, error: "삭제할 일정을 찾을 수 없습니다." });

    // 삭제 권한은 수정과 같이 기존 일정의 태그 기준으로 확인합니다.
    const tagMatch = event.getTitle().match(/^\[([^\]]+)\]/);
    const currentTag = tagMatch ? tagMatch[1] : "";
    if (role.type !== "admin" && currentTag !== role.name && currentTag !== SHARED_TAG) {
      return json_({ ok: false, error: "이 일정을 삭제할 권한이 없습니다." });
    }

    event.deleteEvent();
    return json_({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

function authenticate_(data, props) {
  const name = String(data.organization || "").trim();
  const password = String(data.password || "");
  if (!name || !password) return null;

  if (name === ADMIN_NAME) {
    return password === props.getProperty("ADMIN_PASSWORD") ? { type: "admin", name: name } : null;
  }

  const response = UrlFetchApp.fetch(props.getProperty("ACCESS_URL") + "?t=" + Date.now(), { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) throw new Error("access.json 을 불러오지 못했습니다.");
  const orgs = JSON.parse(response.getContentText()).organizations || [];
  const found = orgs.filter(function (o) {
    return String(o.name).trim().toLowerCase() === name.toLowerCase() && o.password === password;
  })[0];
  return found ? { type: "organization", name: found.name } : null;
}

function parseKst_(date, time) {
  return new Date(date + "T" + time + ":00+09:00");
}

function clean_(value, max) {
  return String(value || "").trim().slice(0, max);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
