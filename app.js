const CALENDAR_CONFIG = {
  calendarId: "c47a0c723511e6a698e428ad142c626c61c0481790e2c9b178d93b08cd533eaa@group.calendar.google.com",
  apiKey: "AIzaSyAKW95iMCKRHxgTK7AC5tuAMyhAj5Cwyr4",
  timezone: "Asia/Seoul",
  refreshMinutes: 10,
};

const ACCESS_CONFIG = {
  sessionKey: "lectureDashboardViewer",
  cacheKey: "lectureDashboardAccessCache",
  remote: {
    owner: "datathinkinglab",
    repository: "lecture-schedule",
    branch: "main",
    path: "access.json",
  },
  admin: {
    id: "admin",
    name: "관리자",
    password: "admin2026",
  },
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
  untaggedVisibility: "private",
};

const initialAccessData = loadAccessData();

const DEMO_EVENTS = [
  {
    id: "demo-1",
    summary: "[EXC] AI 기초 입문",
    location: "온라인 Zoom",
    description: "생성형 AI 개념, 프롬프트 작성법, 실습 안내",
    start: { dateTime: offsetDate(2, 19, 0) },
    end: { dateTime: offsetDate(2, 21, 0) },
  },
  {
    id: "demo-2",
    summary: "[캐럿] 데이터 분석 실습",
    location: "강의실 B",
    description: "스프레드시트 기반 데이터 정리와 시각화",
    status: "confirmed",
    start: { dateTime: offsetDate(8, 14, 0) },
    end: { dateTime: offsetDate(8, 17, 0) },
  },
  {
    id: "demo-3",
    summary: "[공통] 프로젝트 멘토링",
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
  accessData: initialAccessData,
  viewer: null,
  activeEventId: null,
  lastSyncedAt: null,
  accessLastSyncedAt: null,
};

const els = {
  authScreen: document.querySelector("#authScreen"),
  authForm: document.querySelector("#authForm"),
  organizationInput: document.querySelector("#organizationInput"),
  passwordInput: document.querySelector("#passwordInput"),
  authError: document.querySelector("#authError"),
  appShell: document.querySelector("#appShell"),
  viewerChip: document.querySelector("#viewerChip"),
  adminButton: document.querySelector("#adminButton"),
  logoutButton: document.querySelector("#logoutButton"),
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
  addScheduleButton: document.querySelector("#addScheduleButton"),
  eventModal: document.querySelector("#eventModal"),
  modalCloseButton: document.querySelector("#modalCloseButton"),
  modalStatus: document.querySelector("#modalStatus"),
  modalTitle: document.querySelector("#modalTitle"),
  modalTime: document.querySelector("#modalTime"),
  modalLocation: document.querySelector("#modalLocation"),
  modalDescription: document.querySelector("#modalDescription"),
  modalEditLink: document.querySelector("#modalEditLink"),
  modalCertaintyActions: document.querySelector(".modal-certainty-actions"),
  adminModal: document.querySelector("#adminModal"),
  adminCloseButton: document.querySelector("#adminCloseButton"),
  adminAccountForm: document.querySelector("#adminAccountForm"),
  adminOrganizationId: document.querySelector("#adminOrganizationId"),
  adminOrganizationName: document.querySelector("#adminOrganizationName"),
  adminOrganizationPassword: document.querySelector("#adminOrganizationPassword"),
  adminSaveButton: document.querySelector("#adminSaveButton"),
  adminCancelButton: document.querySelector("#adminCancelButton"),
  adminAccountList: document.querySelector("#adminAccountList"),
  githubTokenInput: document.querySelector("#githubTokenInput"),
  accessSyncButton: document.querySelector("#accessSyncButton"),
  adminSyncStatus: document.querySelector("#adminSyncStatus"),
};

init();

async function init() {
  resetSearch();
  hydrateFromUrl();
  updateMonthLabel();
  bindEvents();
  await refreshAccessData({ silent: true });
  state.viewer = loadViewerSession(state.accessData);
  renderAuthState();
  if (state.viewer) {
    loadEvents();
  }
  window.setInterval(loadEvents, CALENDAR_CONFIG.refreshMinutes * 60 * 1000);
}

function bindEvents() {
  els.authForm.addEventListener("submit", handleLogin);
  els.logoutButton.addEventListener("click", logout);
  els.adminButton.addEventListener("click", openAdminModal);
  els.adminCloseButton.addEventListener("click", closeAdminModal);
  els.adminAccountForm.addEventListener("submit", saveOrganization);
  els.adminCancelButton.addEventListener("click", resetAdminForm);
  els.accessSyncButton.addEventListener("click", reloadAccessDataFromAdmin);
  els.adminModal.addEventListener("click", (event) => {
    if (event.target.matches("[data-close-admin]")) {
      closeAdminModal();
    }
  });

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

  // Keep password managers from treating schedule search as a login field.
  document.querySelector("#scheduleSearchForm").addEventListener("submit", (event) => event.preventDefault());
  els.searchInput.addEventListener("pointerdown", enableSearch);
  els.searchInput.addEventListener("keydown", (event) => {
    if (event.key !== "Tab" && event.key !== "Escape") enableSearch();
  });
  window.addEventListener("pageshow", () => {
    resetSearch();
    if (state.viewer) render();
  });

  els.searchInput.addEventListener("input", (event) => {
    if (els.searchInput.readOnly) {
      els.searchInput.value = "";
      return;
    }
    state.query = event.target.value.trim().toLowerCase();
    render();
  });

  els.prevMonthButton.addEventListener("click", () => changeMonth(-1));
  els.nextMonthButton.addEventListener("click", () => changeMonth(1));
  els.refreshButton.addEventListener("click", refreshDashboard);
  els.addScheduleButton.addEventListener("click", openGoogleCalendarCreate);
  els.modalCloseButton.addEventListener("click", closeEventModal);
  els.eventModal.addEventListener("click", (event) => {
    if (event.target.matches("[data-close-modal]")) {
      closeEventModal();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!els.adminModal.classList.contains("is-hidden")) {
        closeAdminModal();
      } else if (!els.eventModal.classList.contains("is-hidden")) {
        closeEventModal();
      }
    }
  });
}

async function loadEvents() {
  if (!state.viewer) {
    return;
  }

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

async function refreshDashboard() {
  await refreshAccessData({ silent: true });
  await loadEvents();
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
      organizationIds: getEventOrganizationIds(event),
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
  els.addScheduleButton.classList.toggle("is-hidden", state.view !== "month");
  els.emptyState.classList.toggle("is-hidden", filtered.length > 0);
  els.viewTitle.textContent = `${formatMonthLabel(state.selectedMonth)} 강의`;
  els.resultCount.textContent = `${filtered.length}개 일정`;
}

function getFilteredEvents() {
  const now = new Date();
  const { start, end } = getSelectedMonthRange();

  return state.events.filter((event) => {
    const searchable = getSearchableEventText(event);
    const matchesQuery = !state.query || searchable.includes(state.query);
    const matchesMonth = event.startDate >= start && event.startDate < end;
    const matchesOrganization = canViewerSeeEvent(event);
    const matchesStatus =
      state.status === "all" ||
      (state.status === "today" && isSameDay(event.startDate, now)) ||
      (state.status === "upcoming" && event.startDate >= startOfDay(now));

    return matchesQuery && matchesMonth && matchesOrganization && matchesStatus;
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
    const canSeeDetails = canViewerSeeEventDetails(event);

    node.querySelector(".date-month").textContent = formatMonth(event.startDate);
    node.querySelector(".date-day").textContent = formatDay(event.startDate);
    node.querySelector(".date-weekday").textContent = formatWeekday(event.startDate);
    node.classList.toggle("is-limited", !canSeeDetails);
    node.querySelector("h3").textContent = canSeeDetails ? event.title : "일정 있음";
    node.querySelector(".event-time").textContent = formatEventTime(event);
    node.querySelector(".event-location").textContent = canSeeDetails
      ? event.location
        ? `장소: ${event.location}`
        : "장소 미정"
      : "다른 소속 일정";
    node.querySelector(".event-description").textContent = canSeeDetails
      ? event.description || "상세 설명이 없습니다."
      : "상세 내용은 표시되지 않습니다.";
    const editLink = node.querySelector(".event-edit-link");
    editLink.classList.toggle("is-hidden", !event.editLink || !canSeeDetails);
    editLink.href = event.editLink || "#";
    if (canSeeDetails) {
      bindCertaintyToggle(pill, event);
    } else {
      pill.textContent = "비공개";
      pill.title = "다른 소속 일정입니다.";
      pill.setAttribute("aria-label", `${formatEventTime(event)} 다른 소속 일정`);
      pill.className = "status-pill is-private";
      pill.disabled = true;
    }

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
          const canSeeDetails = canViewerSeeEventDetails(event);
          item.classList.toggle("is-tentative", canSeeDetails && event.certainty === "tentative");
          item.classList.toggle("is-private", !canSeeDetails);
          item.title = canSeeDetails ? event.title : "다른 소속 일정";
          item.textContent = canSeeDetails
            ? event.certainty === "tentative"
              ? `미정 · ${event.title}`
              : event.title
            : "일정 있음";
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

function resetSearch() {
  state.query = "";
  els.searchInput.value = "";
  els.searchInput.readOnly = true;
}

function enableSearch() {
  els.searchInput.readOnly = false;
}

function handleLogin(event) {
  event.preventDefault();
  const organizationName = els.organizationInput.value.trim();
  const password = els.passwordInput.value;
  const organization = [ACCESS_CONFIG.admin, ...state.accessData.organizations].find(
    (item) => normalizeText(item.name) === normalizeText(organizationName),
  );

  if (!organization || organization.password !== password) {
    els.authError.classList.remove("is-hidden");
    return;
  }

  state.viewer = {
    organizationId: organization.id,
    organizationName: organization.name,
    role: organization.id === ACCESS_CONFIG.admin.id ? "admin" : "organization",
    accessRevision: organization.id === ACCESS_CONFIG.admin.id ? "admin" : state.accessData.updatedAt,
  };
  resetSearch();
  saveViewerSession();
  els.passwordInput.value = "";
  els.organizationInput.value = "";
  els.authError.classList.add("is-hidden");
  renderAuthState();
  loadEvents();
}

function logout() {
  resetSearch();
  state.viewer = null;
  sessionStorage.removeItem(ACCESS_CONFIG.sessionKey);
  state.events = [];
  renderAuthState();
}

function renderAuthState() {
  const isLoggedIn = Boolean(state.viewer);
  const isAdmin = state.viewer?.role === "admin";
  els.authScreen.classList.toggle("is-hidden", isLoggedIn);
  els.appShell.classList.toggle("is-locked", !isLoggedIn);
  els.viewerChip.textContent = isLoggedIn ? `${state.viewer.organizationName} 접속 중` : "";
  els.adminButton.classList.toggle("is-hidden", !isAdmin);
}

function openEventModal(event) {
  state.activeEventId = event.id;
  renderEventModal(event);
  els.eventModal.classList.remove("is-hidden");
  els.modalCloseButton.focus();
}

function renderEventModal(event) {
  const canSeeDetails = canViewerSeeEventDetails(event);
  els.modalTitle.textContent = canSeeDetails ? event.title : "일정 있음";
  els.modalTime.textContent = formatEventTime(event);
  els.modalLocation.textContent = canSeeDetails
    ? event.location
      ? `장소: ${event.location}`
      : "장소 미정"
    : "다른 소속 일정";
  els.modalDescription.textContent = canSeeDetails
    ? event.description || "상세 설명이 없습니다."
    : "상세 내용은 표시되지 않습니다.";
  els.modalStatus.textContent = canSeeDetails ? (event.certainty === "tentative" ? "미정" : "확정") : "비공개";
  els.modalStatus.className = canSeeDetails
    ? `status-pill ${event.certainty === "tentative" ? "is-tentative" : "is-confirmed"}`
    : "status-pill is-private";
  els.modalEditLink.classList.toggle("is-hidden", !event.editLink || !canSeeDetails);
  els.modalEditLink.href = event.editLink || "#";
  els.modalCertaintyActions.classList.toggle("is-hidden", !canSeeDetails);
  if (canSeeDetails) {
    bindCertaintyControls(els.eventModal, event);
  }
}

function closeEventModal() {
  state.activeEventId = null;
  els.eventModal.classList.add("is-hidden");
}

function bindCertaintyToggle(button, event) {
  const isTentative = event.certainty === "tentative";
  button.textContent = isTentative ? "미정" : "확정";
  button.title = isTentative ? "클릭하면 확정으로 변경됩니다." : "클릭하면 미정으로 변경됩니다.";
  button.setAttribute("aria-label", `${event.title} 확정 여부: ${isTentative ? "미정" : "확정"}`);
  button.setAttribute("aria-pressed", String(!isTentative));
  button.classList.toggle("is-tentative", isTentative);
  button.classList.toggle("is-confirmed", !isTentative);
  button.onclick = () => updateEventCertainty(event.id, isTentative ? "confirmed" : "tentative");
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

function openGoogleCalendarCreate() {
  const date = getDefaultScheduleDate();
  const nextDate = new Date(date);
  nextDate.setHours(date.getHours() + 1);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: "강의 일정",
    dates: `${formatGoogleCalendarDate(date)}/${formatGoogleCalendarDate(nextDate)}`,
    ctz: CALENDAR_CONFIG.timezone,
  });

  window.open(`https://calendar.google.com/calendar/render?${params}`, "_blank", "noopener");
}

function getDefaultScheduleDate() {
  const selected = parseMonthKey(state.selectedMonth);
  const now = new Date();
  const date =
    selected.getFullYear() === now.getFullYear() && selected.getMonth() === now.getMonth()
      ? new Date(now)
      : new Date(selected);

  date.setHours(10, 0, 0, 0);
  return date;
}

function formatGoogleCalendarDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}T${hour}${minute}${second}`;
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

function getEventOrganizationIds(event) {
  const title = event.summary || event.title || "";
  const details = `${title} ${event.location || ""} ${stripHtml(event.description || "")}`;
  const explicitOrganizationIds = state.accessData.organizations
    .filter((organization) => getOrganizationAliases(organization).some((alias) => hasBracketTag(details, alias)))
    .map((organization) => organization.id);

  const organizationIds =
    explicitOrganizationIds.length > 0
      ? explicitOrganizationIds
      : state.accessData.organizations
          .filter((organization) =>
            getOrganizationAliases(organization).some((alias) => hasStandaloneKeyword(details, alias)),
          )
          .map((organization) => organization.id);

  if (ACCESS_CONFIG.sharedKeywords.some((keyword) => hasBracketTag(details, keyword) || hasStandaloneKeyword(details, keyword))) {
    organizationIds.push("all");
  }

  return [...new Set(organizationIds)];
}

function canViewerSeeEvent(event) {
  if (!state.viewer) {
    return false;
  }

  return true;
}

function canViewerSeeEventDetails(event) {
  if (!state.viewer) {
    return false;
  }

  if (state.viewer.role === "admin") {
    return true;
  }

  if (event.organizationIds.includes("all") || event.organizationIds.includes(state.viewer.organizationId)) {
    return true;
  }

  if (event.organizationIds.length === 0) {
    return ACCESS_CONFIG.untaggedVisibility === "details";
  }

  return false;
}

function getSearchableEventText(event) {
  if (canViewerSeeEventDetails(event)) {
    return `${event.title} ${event.location} ${event.description}`.toLowerCase();
  }

  return "일정 있음 다른 소속 일정".toLowerCase();
}

function loadViewerSession(accessData) {
  try {
    const session = JSON.parse(sessionStorage.getItem(ACCESS_CONFIG.sessionKey) || "null");
    const accounts = [ACCESS_CONFIG.admin, ...accessData.organizations];
    const organization = accounts.find((item) => item.id === session?.organizationId);
    const isAdmin = organization?.id === ACCESS_CONFIG.admin.id;
    const hasCurrentAccess = isAdmin || session?.accessRevision === accessData.updatedAt;
    return organization && hasCurrentAccess
      ? {
          organizationId: organization.id,
          organizationName: organization.name,
          role: isAdmin ? "admin" : "organization",
          accessRevision: isAdmin ? "admin" : accessData.updatedAt,
        }
      : null;
  } catch {
    return null;
  }
}

function saveViewerSession() {
  sessionStorage.setItem(ACCESS_CONFIG.sessionKey, JSON.stringify(state.viewer));
}

function loadAccessData() {
  try {
    const saved = JSON.parse(localStorage.getItem(ACCESS_CONFIG.cacheKey) || "null");
    if (Array.isArray(saved?.organizations)) {
      return {
        updatedAt: String(saved.updatedAt || "cached"),
        organizations: saved.organizations.filter(isValidOrganization).map(sanitizeOrganization),
      };
    }
  } catch {
    // 기본 소속 설정을 사용합니다.
  }

  return {
    updatedAt: "default",
    organizations: ACCESS_CONFIG.defaultOrganizations.map((organization) => ({ ...organization })),
  };
}

async function refreshAccessData({ silent = false } = {}) {
  if (!silent) {
    setAdminSyncStatus("공용 소속 설정을 불러오는 중입니다.", "loading");
  }

  try {
    const remoteData = await fetchRemoteAccessData();
    if (!Array.isArray(remoteData?.organizations)) {
      throw new Error("공용 설정 파일 형식이 올바르지 않습니다.");
    }

    applyAccessData(remoteData);
    state.accessLastSyncedAt = new Date();
    if (!silent) {
      setAdminSyncStatus(`동기화 완료 · ${formatTime(state.accessLastSyncedAt)}`, "success");
    }
    return true;
  } catch (error) {
    if (!silent) {
      setAdminSyncStatus(error.message, "error");
    }
    return false;
  }
}

function applyAccessData(accessData) {
  const updatedAt = String(accessData.updatedAt || "unknown");
  state.accessData = {
    updatedAt,
    organizations: accessData.organizations.filter(isValidOrganization).map(sanitizeOrganization),
  };

  try {
    localStorage.setItem(ACCESS_CONFIG.cacheKey, JSON.stringify(state.accessData));
  } catch {
    // 공용 설정은 메모리에 적용되므로 캐시 저장 실패는 무시합니다.
  }

  state.events.forEach((event) => {
    event.organizationIds = getEventOrganizationIds(event);
  });

  if (state.viewer?.role === "organization" && state.viewer.accessRevision !== updatedAt) {
    state.viewer = null;
    sessionStorage.removeItem(ACCESS_CONFIG.sessionKey);
  }

  if (!els.adminModal.classList.contains("is-hidden")) {
    renderAdminAccounts();
  }

  if (state.viewer) {
    render();
  }
}

function getRawAccessUrl() {
  const { owner, repository, branch, path } = ACCESS_CONFIG.remote;
  return `https://raw.githubusercontent.com/${owner}/${repository}/${branch}/${path}`;
}

function getAccessApiUrl() {
  const { owner, repository, path } = ACCESS_CONFIG.remote;
  return `https://api.github.com/repos/${owner}/${repository}/contents/${path}`;
}

async function fetchRemoteAccessData() {
  const apiResponse = await fetch(
    `${getAccessApiUrl()}?ref=${encodeURIComponent(ACCESS_CONFIG.remote.branch)}&v=${Date.now()}`,
    {
      headers: { Accept: "application/vnd.github+json" },
      cache: "no-store",
    },
  );

  if (apiResponse.ok) {
    const file = await apiResponse.json();
    return JSON.parse(decodeBase64Utf8(file.content));
  }

  const rawResponse = await fetch(`${getRawAccessUrl()}?v=${Date.now()}`, { cache: "no-store" });
  if (!rawResponse.ok) {
    throw new Error(`공용 설정을 불러오지 못했습니다. (${rawResponse.status})`);
  }
  return rawResponse.json();
}

async function commitAccessData(organizations, message) {
  const token = els.githubTokenInput.value.trim();
  if (!token) {
    throw new Error("GitHub 동기화 토큰을 입력해 주세요.");
  }

  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const currentResponse = await fetch(`${getAccessApiUrl()}?ref=${encodeURIComponent(ACCESS_CONFIG.remote.branch)}`, {
    headers,
    cache: "no-store",
  });
  const currentData = await currentResponse.json();

  if (!currentResponse.ok) {
    throw new Error(getGithubApiError(currentData, currentResponse.status));
  }

  const nextData = {
    version: 1,
    updatedAt: new Date().toISOString(),
    organizations: organizations.map(sanitizeOrganization),
  };
  const response = await fetch(getAccessApiUrl(), {
    method: "PUT",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      branch: ACCESS_CONFIG.remote.branch,
      sha: currentData.sha,
      content: encodeBase64Utf8(`${JSON.stringify(nextData, null, 2)}\n`),
    }),
  });
  const result = await response.json();

  if (!response.ok) {
    throw new Error(getGithubApiError(result, response.status));
  }

  applyAccessData(nextData);
  state.accessLastSyncedAt = new Date();
  return result;
}

function encodeBase64Utf8(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function decodeBase64Utf8(value) {
  const binary = atob(String(value).replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function getGithubApiError(data, status) {
  if (status === 401) {
    return "GitHub 토큰이 올바르지 않거나 만료되었습니다.";
  }
  if (status === 403) {
    return "토큰에 이 저장소의 Contents 쓰기 권한이 없습니다.";
  }
  if (status === 409 || status === 422) {
    return "다른 관리자가 먼저 수정했습니다. 새로고침 후 다시 시도해 주세요.";
  }
  return data?.message ? `GitHub 저장 실패: ${data.message}` : `GitHub 저장에 실패했습니다. (${status})`;
}

function isValidOrganization(organization) {
  return Boolean(organization?.id && organization?.name && organization?.password);
}

function sanitizeOrganization(organization) {
  return {
    id: String(organization.id),
    name: String(organization.name).trim(),
    password: String(organization.password),
    keywords: Array.isArray(organization.keywords) ? organization.keywords.map(String) : [],
  };
}

function normalizeText(value) {
  return String(value || "").trim().toLocaleLowerCase("ko-KR");
}

function getOrganizationAliases(organization) {
  return [...new Set([organization.name, ...(organization.keywords || [])].map((value) => String(value).replace(/^\[|\]$/g, "").trim()).filter(Boolean))];
}

function hasBracketTag(text, keyword) {
  return normalizeText(text).includes(`[${normalizeText(keyword)}]`);
}

function hasStandaloneKeyword(text, keyword) {
  const normalizedText = normalizeText(text);
  const normalizedKeyword = normalizeText(keyword);
  if (!normalizedKeyword) {
    return false;
  }

  const escaped = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9가-힣])${escaped}([^a-z0-9가-힣]|$)`, "i").test(normalizedText);
}

function openAdminModal() {
  if (state.viewer?.role !== "admin") {
    return;
  }

  resetAdminForm();
  renderAdminAccounts();
  setAdminSyncStatus(
    state.accessLastSyncedAt ? `공용 설정 연결됨 · ${formatTime(state.accessLastSyncedAt)}` : "공용 설정 캐시 사용 중",
    state.accessLastSyncedAt ? "success" : "",
  );
  els.adminModal.classList.remove("is-hidden");
  els.adminOrganizationName.focus();
}

async function reloadAccessDataFromAdmin() {
  const hasUnsavedInput = Boolean(
    els.adminOrganizationId.value ||
      els.adminOrganizationName.value.trim() ||
      els.adminOrganizationPassword.value,
  );
  if (hasUnsavedInput && !window.confirm("입력 중인 내용은 사라집니다. GitHub의 최신 설정을 다시 불러올까요?")) {
    return;
  }

  resetAdminForm();
  await refreshAccessData({ silent: false });
}

function closeAdminModal() {
  resetAdminForm();
  els.githubTokenInput.value = "";
  els.adminModal.classList.add("is-hidden");
}

function renderAdminAccounts() {
  els.adminAccountList.replaceChildren();

  state.accessData.organizations.forEach((organization) => {
    const row = document.createElement("div");
    row.className = "admin-account-row";

    const name = document.createElement("strong");
    name.textContent = organization.name;

    const password = document.createElement("code");
    password.textContent = "비밀번호 설정됨";

    const actions = document.createElement("div");
    actions.className = "admin-row-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "수정";
    editButton.addEventListener("click", () => editOrganization(organization.id));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "danger-button";
    deleteButton.textContent = "삭제";
    deleteButton.addEventListener("click", () => deleteOrganization(organization.id));

    actions.append(editButton, deleteButton);
    row.append(name, password, actions);
    els.adminAccountList.append(row);
  });
}

async function saveOrganization(event) {
  event.preventDefault();
  const id = els.adminOrganizationId.value;
  const name = els.adminOrganizationName.value.trim();
  const password = els.adminOrganizationPassword.value;
  const currentOrganization = state.accessData.organizations.find((item) => item.id === id);
  const duplicate = state.accessData.organizations.find(
    (organization) => normalizeText(organization.name) === normalizeText(name) && organization.id !== id,
  );

  if (!name || (!id && !password) || normalizeText(name) === normalizeText(ACCESS_CONFIG.admin.name) || duplicate) {
    window.alert(duplicate ? "이미 등록된 소속명입니다." : "사용할 수 있는 소속명과 비밀번호를 입력해 주세요.");
    return;
  }

  const nextOrganizations = state.accessData.organizations.map((organization) => ({ ...organization }));
  if (id) {
    const organization = nextOrganizations.find((item) => item.id === id);
    if (organization) {
      organization.name = name;
      organization.password = password || currentOrganization.password;
    }
  } else {
    nextOrganizations.push({
      id: `org-${Date.now()}`,
      name,
      password,
      keywords: [],
    });
  }

  await persistOrganizationChanges(nextOrganizations, id ? `${name} 소속 정보 수정` : `${name} 소속 추가`);
}

function editOrganization(organizationId) {
  const organization = state.accessData.organizations.find((item) => item.id === organizationId);
  if (!organization) {
    return;
  }

  els.adminOrganizationId.value = organization.id;
  els.adminOrganizationName.value = organization.name;
  els.adminOrganizationPassword.value = "";
  els.adminOrganizationPassword.placeholder = "변경할 때만 입력";
  els.adminOrganizationPassword.required = false;
  els.adminSaveButton.textContent = "변경 저장 및 동기화";
  els.adminCancelButton.classList.remove("is-hidden");
  els.adminOrganizationName.focus();
}

async function deleteOrganization(organizationId) {
  const organization = state.accessData.organizations.find((item) => item.id === organizationId);
  if (!organization || !window.confirm(`${organization.name} 소속을 삭제하시겠습니까?`)) {
    return;
  }

  const nextOrganizations = state.accessData.organizations.filter((item) => item.id !== organizationId);
  await persistOrganizationChanges(nextOrganizations, `${organization.name} 소속 삭제`);
}

async function persistOrganizationChanges(organizations, message) {
  els.adminSaveButton.disabled = true;
  setAdminSyncStatus("GitHub 공용 설정에 저장하는 중입니다.", "loading");

  try {
    const result = await commitAccessData(organizations, message);
    resetAdminForm();
    renderAdminAccounts();
    render();
    els.githubTokenInput.value = "";
    const shortSha = result?.commit?.sha?.slice(0, 7);
    setAdminSyncStatus(
      `GitHub 저장 완료${shortSha ? ` (${shortSha})` : ""} · ${formatTime(state.accessLastSyncedAt)}`,
      "success",
    );
  } catch (error) {
    setAdminSyncStatus(error.message, "error");
  } finally {
    els.adminSaveButton.disabled = false;
  }
}

function resetAdminForm() {
  els.adminAccountForm.reset();
  els.adminOrganizationId.value = "";
  els.adminOrganizationPassword.placeholder = "비밀번호 입력";
  els.adminOrganizationPassword.required = true;
  els.adminSaveButton.textContent = "소속 추가 및 동기화";
  els.adminCancelButton.classList.add("is-hidden");
}

function setAdminSyncStatus(message, type = "") {
  els.adminSyncStatus.textContent = message;
  els.adminSyncStatus.className = `admin-sync-status${type ? ` is-${type}` : ""}`;
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
