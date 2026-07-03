const CALENDAR_CONFIG = {
  calendarId: "c47a0c723511e6a698e428ad142c626c61c0481790e2c9b178d93b08cd533eaa@group.calendar.google.com",
  apiKey: "AIzaSyAKW95iMCKRHxgTK7AC5tuAMyhAj5Cwyr4",
  timezone: "Asia/Seoul",
  refreshMinutes: 10,
};

const DEMO_EVENTS = [
  {
    id: "demo-1",
    summary: "AI 기초 입문",
    location: "온라인 Zoom",
    description: "생성형 AI 개념, 프롬프트 작성법, 실습 안내",
    start: { dateTime: offsetDate(2, 19, 0) },
    end: { dateTime: offsetDate(2, 21, 0) },
  },
  {
    id: "demo-2",
    summary: "데이터 분석 실습",
    location: "강의실 B",
    description: "스프레드시트 기반 데이터 정리와 시각화",
    status: "confirmed",
    start: { dateTime: offsetDate(8, 14, 0) },
    end: { dateTime: offsetDate(8, 17, 0) },
  },
  {
    id: "demo-3",
    summary: "프로젝트 멘토링",
    location: "미정",
    description: "팀별 프로젝트 진행 상황 점검. 세부 시간이 미정입니다.",
    status: "tentative",
    start: { dateTime: offsetDate(15, 20, 0) },
    end: { dateTime: offsetDate(15, 21, 30) },
  },
];

const state = {
  events: [],
  view: "agenda",
  query: "",
  status: "all",
  selectedMonth: getMonthKey(new Date()),
  certaintyOverrides: loadCertaintyOverrides(),
  activeEventId: null,
  lastSyncedAt: null,
};

const els = {
  agendaView: document.querySelector("#agendaView"),
  monthView: document.querySelector("#monthView"),
  emptyState: document.querySelector("#emptyState"),
  eventTemplate: document.querySelector("#eventTemplate"),
  resultCount: document.querySelector("#resultCount"),
  viewTitle: document.querySelector("#viewTitle"),
  todayCount: document.querySelector("#todayCount"),
  upcomingCount: document.querySelector("#upcomingCount"),
  lastSynced: document.querySelector("#lastSynced"),
  notice: document.querySelector("#notice"),
  searchInput: document.querySelector("#searchInput"),
  monthLabel: document.querySelector("#monthLabel"),
  prevMonthButton: document.querySelector("#prevMonthButton"),
  nextMonthButton: document.querySelector("#nextMonthButton"),
  refreshButton: document.querySelector("#refreshButton"),
  eventModal: document.querySelector("#eventModal"),
  modalCloseButton: document.querySelector("#modalCloseButton"),
  modalStatus: document.querySelector("#modalStatus"),
  modalTitle: document.querySelector("#modalTitle"),
  modalTime: document.querySelector("#modalTime"),
  modalLocation: document.querySelector("#modalLocation"),
  modalDescription: document.querySelector("#modalDescription"),
  modalEditLink: document.querySelector("#modalEditLink"),
  modalCertaintyActions: document.querySelector(".modal-certainty-actions"),
};

init();

function init() {
  hydrateFromUrl();
  updateMonthLabel();
  bindEvents();
  loadEvents();
  window.setInterval(loadEvents, CALENDAR_CONFIG.refreshMinutes * 60 * 1000);
}

function bindEvents() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      state.view = button.dataset.view;
      document.querySelectorAll("[data-view]").forEach((tab) => tab.classList.remove("is-active"));
      button.classList.add("is-active");
      render();
    });
  });

  document.querySelectorAll("[data-status]").forEach((button) => {
    button.addEventListener("click", () => {
      state.status = button.dataset.status;
      document.querySelectorAll("[data-status]").forEach((segment) => segment.classList.remove("is-active"));
      button.classList.add("is-active");
      render();
    });
  });

  els.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    render();
  });

  els.prevMonthButton.addEventListener("click", () => changeMonth(-1));
  els.nextMonthButton.addEventListener("click", () => changeMonth(1));
  els.refreshButton.addEventListener("click", loadEvents);
  els.modalCloseButton.addEventListener("click", closeEventModal);
  els.eventModal.addEventListener("click", (event) => {
    if (event.target.matches("[data-close-modal]")) {
      closeEventModal();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !els.eventModal.classList.contains("is-hidden")) {
      closeEventModal();
    }
  });
}

async function loadEvents() {
  showNotice("일정을 불러오는 중입니다.");

  try {
    const events = isConfigured() ? await fetchGoogleCalendarEvents() : DEMO_EVENTS;
    state.events = normalizeEvents(events).sort((a, b) => a.startDate - b.startDate);
    state.lastSyncedAt = new Date();
    showNotice(isConfigured() ? "" : "현재는 예시 일정입니다. app.js에 캘린더 ID와 API 키를 입력하면 실제 일정으로 바뀝니다.");
  } catch (error) {
    state.events = [];
    showNotice(`캘린더를 불러오지 못했습니다. ${error.message}`);
  }

  render();
}

async function fetchGoogleCalendarEvents() {
  const { start, end } = getSelectedMonthRange();

  const params = new URLSearchParams({
    key: CALENDAR_CONFIG.apiKey,
    singleEvents: "true",
    orderBy: "startTime",
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    timeZone: CALENDAR_CONFIG.timezone,
    maxResults: "250",
  });

  const calendarId = encodeURIComponent(CALENDAR_CONFIG.calendarId);
  const url = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?${params}`;
  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok) {
    const message = data.error?.message || "Google Calendar API 요청이 실패했습니다.";
    throw new Error(message);
  }

  return data.items || [];
}

function normalizeEvents(events) {
  return events.map((event) => {
    const startRaw = event.start?.dateTime || event.start?.date;
    const endRaw = event.end?.dateTime || event.end?.date || startRaw;
    return {
      id: event.id,
      title: event.summary || "제목 없는 강의",
      location: event.location || "",
      description: stripHtml(event.description || ""),
      certainty: state.certaintyOverrides[event.id] || getEventCertainty(event),
      editLink: event.htmlLink || "",
      startDate: new Date(startRaw),
      endDate: new Date(endRaw),
      allDay: Boolean(event.start?.date),
    };
  });
}

function render() {
  const filtered = getFilteredEvents();
  renderSummary(filtered);
  renderAgenda(filtered);
  renderMonth(filtered);

  els.agendaView.classList.toggle("is-hidden", state.view !== "agenda");
  els.monthView.classList.toggle("is-hidden", state.view !== "month");
  els.emptyState.classList.toggle("is-hidden", filtered.length > 0);
  els.viewTitle.textContent = `${formatMonthLabel(state.selectedMonth)} 강의`;
  els.resultCount.textContent = `${filtered.length}개 일정`;
}

function getFilteredEvents() {
  const now = new Date();
  const { start, end } = getSelectedMonthRange();

  return state.events.filter((event) => {
    const searchable = `${event.title} ${event.location} ${event.description}`.toLowerCase();
    const matchesQuery = !state.query || searchable.includes(state.query);
    const matchesMonth = event.startDate >= start && event.startDate < end;
    const matchesStatus =
      state.status === "all" ||
      (state.status === "today" && isSameDay(event.startDate, now)) ||
      (state.status === "upcoming" && event.startDate >= startOfDay(now));

    return matchesQuery && matchesMonth && matchesStatus;
  });
}

function renderSummary(events) {
  const now = new Date();
  els.todayCount.textContent = String(events.filter((event) => isSameDay(event.startDate, now)).length);
  els.upcomingCount.textContent = String(events.filter((event) => event.startDate >= now).length);
  els.lastSynced.textContent = state.lastSyncedAt ? formatTime(state.lastSyncedAt) : "-";
}

function renderAgenda(events) {
  els.agendaView.replaceChildren();

  events.forEach((event) => {
    const node = els.eventTemplate.content.firstElementChild.cloneNode(true);
    const pill = node.querySelector(".status-pill");

    node.querySelector(".date-month").textContent = formatMonth(event.startDate);
    node.querySelector(".date-day").textContent = formatDay(event.startDate);
    node.querySelector(".date-weekday").textContent = formatWeekday(event.startDate);
    node.querySelector("h3").textContent = event.title;
    node.querySelector(".event-time").textContent = formatEventTime(event);
    node.querySelector(".event-location").textContent = event.location ? `장소: ${event.location}` : "장소 미정";
    node.querySelector(".event-description").textContent = event.description || "상세 설명이 없습니다.";
    bindCertaintyControls(node, event);
    const editLink = node.querySelector(".event-edit-link");
    editLink.classList.toggle("is-hidden", !event.editLink);
    editLink.href = event.editLink || "#";
    pill.textContent = event.certainty === "tentative" ? "미정" : "확정";
    pill.classList.toggle("is-tentative", event.certainty === "tentative");
    pill.classList.toggle("is-confirmed", event.certainty === "confirmed");

    els.agendaView.append(node);
  });
}

function renderMonth(events) {
  els.monthView.replaceChildren();
  const selected = parseMonthKey(state.selectedMonth);
  const first = new Date(selected.getFullYear(), selected.getMonth(), 1);
  const last = new Date(selected.getFullYear(), selected.getMonth() + 1, 0);
  const startOffset = first.getDay();
  const totalCells = Math.ceil((startOffset + last.getDate()) / 7) * 7;

  for (let i = 0; i < totalCells; i += 1) {
    const dayNumber = i - startOffset + 1;
    const cell = document.createElement("div");
    cell.className = "month-cell is-empty";

    if (dayNumber >= 1 && dayNumber <= last.getDate()) {
      const date = new Date(selected.getFullYear(), selected.getMonth(), dayNumber);
      const dayEvents = events.filter((event) => isSameDay(event.startDate, date));
      const label = document.createElement("strong");
      label.textContent = `${dayNumber}일 ${formatWeekday(date)}`;
      cell.append(label);

      if (dayEvents.length > 0) {
        cell.classList.remove("is-empty");
      }

      dayEvents
        .slice(0, 4)
        .forEach((event) => {
          const item = document.createElement("button");
          item.type = "button";
          item.className = "month-event";
          item.classList.toggle("is-tentative", event.certainty === "tentative");
          item.title = event.title;
          item.textContent = event.certainty === "tentative" ? `미정 · ${event.title}` : event.title;
          item.addEventListener("click", () => openEventModal(event));
          cell.append(item);
        });
    }

    els.monthView.append(cell);
  }
}

function hydrateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const month = params.get("month");
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    state.selectedMonth = month;
  }
}

function changeMonth(offset) {
  state.selectedMonth = getMonthKey(shiftMonth(parseMonthKey(state.selectedMonth), offset));
  updateMonthLabel();
  loadEvents();
}

function updateMonthLabel() {
  els.monthLabel.textContent = formatMonthLabel(state.selectedMonth);
}

function openEventModal(event) {
  state.activeEventId = event.id;
  renderEventModal(event);
  els.eventModal.classList.remove("is-hidden");
  els.modalCloseButton.focus();
}

function renderEventModal(event) {
  els.modalTitle.textContent = event.title;
  els.modalTime.textContent = formatEventTime(event);
  els.modalLocation.textContent = event.location ? `장소: ${event.location}` : "장소 미정";
  els.modalDescription.textContent = event.description || "상세 설명이 없습니다.";
  els.modalStatus.textContent = event.certainty === "tentative" ? "미정" : "확정";
  els.modalStatus.className = `status-pill ${event.certainty === "tentative" ? "is-tentative" : "is-confirmed"}`;
  els.modalEditLink.classList.toggle("is-hidden", !event.editLink);
  els.modalEditLink.href = event.editLink || "#";
  bindCertaintyControls(els.eventModal, event);
}

function closeEventModal() {
  state.activeEventId = null;
  els.eventModal.classList.add("is-hidden");
}

function bindCertaintyControls(root, event) {
  root.querySelectorAll("[data-certainty]").forEach((button) => {
    const certainty = button.dataset.certainty;
    button.classList.toggle("is-active", event.certainty === certainty);
    button.setAttribute("aria-pressed", String(event.certainty === certainty));
    button.onclick = () => updateEventCertainty(event.id, certainty);
  });
}

function updateEventCertainty(eventId, certainty) {
  state.certaintyOverrides[eventId] = certainty;
  saveCertaintyOverrides();

  const event = state.events.find((item) => item.id === eventId);
  if (event) {
    event.certainty = certainty;
  }

  render();

  if (state.activeEventId === eventId) {
    const updatedEvent = state.events.find((item) => item.id === eventId);
    if (updatedEvent) {
      renderEventModal(updatedEvent);
    }
  }
}

function showNotice(message) {
  els.notice.textContent = message;
  els.notice.classList.toggle("is-hidden", !message);
}

function isConfigured() {
  return Boolean(CALENDAR_CONFIG.calendarId && CALENDAR_CONFIG.apiKey);
}

function getEventCertainty(event) {
  const text = `${event.summary || ""} ${event.location || ""} ${stripHtml(event.description || "")}`.toLowerCase();
  const hasTentativeText = /미정|tentative|tbd|to be decided|to be confirmed/.test(text);

  if (event.status === "tentative" || hasTentativeText) {
    return "tentative";
  }

  return "confirmed";
}

function loadCertaintyOverrides() {
  try {
    return JSON.parse(localStorage.getItem("lectureCertaintyOverrides") || "{}");
  } catch {
    return {};
  }
}

function saveCertaintyOverrides() {
  try {
    localStorage.setItem("lectureCertaintyOverrides", JSON.stringify(state.certaintyOverrides));
  } catch {
    showNotice("브라우저 저장소를 사용할 수 없어 확정/미정 변경이 새로고침 후 유지되지 않을 수 있습니다.");
  }
}

function offsetDate(days, hour, minute) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function stripHtml(value) {
  const div = document.createElement("div");
  div.innerHTML = value;
  return div.textContent || div.innerText || "";
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getSelectedMonthRange() {
  const start = parseMonthKey(state.selectedMonth);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  return { start, end };
}

function getMonthKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function parseMonthKey(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function shiftMonth(date, offset) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

function formatMonthLabel(monthKey) {
  const date = parseMonthKey(monthKey);
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    timeZone: CALENDAR_CONFIG.timezone,
  }).format(date);
}

function formatMonth(date) {
  return new Intl.DateTimeFormat("ko-KR", { month: "short", timeZone: CALENDAR_CONFIG.timezone }).format(date);
}

function formatDay(date) {
  return new Intl.DateTimeFormat("ko-KR", { day: "2-digit", timeZone: CALENDAR_CONFIG.timezone }).format(date);
}

function formatWeekday(date) {
  return new Intl.DateTimeFormat("ko-KR", { weekday: "short", timeZone: CALENDAR_CONFIG.timezone }).format(date);
}

function formatTime(date) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: CALENDAR_CONFIG.timezone,
  }).format(date);
}

function formatEventTime(event) {
  if (event.allDay) {
    return "종일";
  }

  const day = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: CALENDAR_CONFIG.timezone,
  }).format(event.startDate);

  return `${day} ${formatTime(event.startDate)} - ${formatTime(event.endDate)}`;
}
