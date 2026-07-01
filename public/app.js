import * as api from "./api.js";
import {
  addDays,
  formatLongDate,
  formatShortDate,
  formatWeekRange,
  fromISO,
  startOfWeek,
  todayISO,
  toISO,
  weekDays
} from "./date.js";
import {
  formatTimeRange,
  getEndTime,
  getStartTime,
  plannedMinutes,
  sortedTasks,
  splitDayTasks
} from "./taskView.mjs";

const storageKey = "dayflow.tasks.fallback.v2";
const uiStorageKey = "dayflow.ui.v1";

const state = {
  tasks: [],
  settings: { weekGoals: {} },
  query: "",
  statusFilter: "all",
  tagFilter: "",
  editingId: null,
  selectedDate: todayISO(),
  weekStart: startOfWeek(new Date()),
  weekOpen: true,
  openDays: new Set([todayISO()]),
  density: "compact",
  drawerMode: null,
  draggedTaskId: null,
  apiOnline: true
};

const els = {
  todayLabel: document.querySelector("#todayLabel"),
  prevWeekBtn: document.querySelector("#prevWeekBtn"),
  nextWeekBtn: document.querySelector("#nextWeekBtn"),
  thisWeekBtn: document.querySelector("#thisWeekBtn"),
  jumpDateInput: document.querySelector("#jumpDateInput"),
  statWeekOpen: document.querySelector("#statWeekOpen"),
  statWeekDone: document.querySelector("#statWeekDone"),
  statHigh: document.querySelector("#statHigh"),
  statMinutes: document.querySelector("#statMinutes"),
  countBacklog: document.querySelector("#countBacklog"),
  countDone: document.querySelector("#countDone"),
  inboxBtn: document.querySelector("#inboxBtn"),
  doneBtn: document.querySelector("#doneBtn"),
  densityBtn: document.querySelector("#densityBtn"),
  densityLabel: document.querySelector("#densityLabel"),
  exportBtn: document.querySelector("#exportBtn"),
  importInput: document.querySelector("#importInput"),
  weekKicker: document.querySelector("#weekKicker"),
  weekTitle: document.querySelector("#weekTitle"),
  weekCopy: document.querySelector("#weekCopy"),
  progressText: document.querySelector("#progressText"),
  progressFill: document.querySelector("#progressFill"),
  searchInput: document.querySelector("#searchInput"),
  statusFilter: document.querySelector("#statusFilter"),
  tagFilter: document.querySelector("#tagFilter"),
  newTaskBtn: document.querySelector("#newTaskBtn"),
  quickTitleInput: document.querySelector("#quickTitleInput"),
  quickInboxBtn: document.querySelector("#quickInboxBtn"),
  weekGoalInput: document.querySelector("#weekGoalInput"),
  weekToggleBtn: document.querySelector("#weekToggleBtn"),
  weekToggleIcon: document.querySelector("#weekToggleIcon"),
  weekRangeTitle: document.querySelector("#weekRangeTitle"),
  weekRangeMeta: document.querySelector("#weekRangeMeta"),
  dayList: document.querySelector("#dayList"),
  focusTask: document.querySelector("#focusTask"),
  finishFocusBtn: document.querySelector("#finishFocusBtn"),
  form: document.querySelector("#taskForm"),
  formTitle: document.querySelector("#formTitle"),
  cancelEditBtn: document.querySelector("#cancelEditBtn"),
  titleInput: document.querySelector("#titleInput"),
  noteInput: document.querySelector("#noteInput"),
  dateInput: document.querySelector("#dateInput"),
  startTimeInput: document.querySelector("#startTimeInput"),
  endTimeInput: document.querySelector("#endTimeInput"),
  priorityInput: document.querySelector("#priorityInput"),
  repeatInput: document.querySelector("#repeatInput"),
  tagInput: document.querySelector("#tagInput"),
  submitBtn: document.querySelector("#submitBtn"),
  drawer: document.querySelector("#drawer"),
  drawerBackdrop: document.querySelector("#drawerBackdrop"),
  drawerCloseBtn: document.querySelector("#drawerCloseBtn"),
  drawerKicker: document.querySelector("#drawerKicker"),
  drawerTitle: document.querySelector("#drawerTitle"),
  drawerList: document.querySelector("#drawerList")
};

function fallbackTasks() {
  const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
  if (Array.isArray(saved)) return saved;
  return [
    {
      id: crypto.randomUUID(),
      title: "写下这周最想推进的一件事",
      note: "不用很大，清楚到下一步就好。",
      date: todayISO(),
      startTime: "09:00",
      endTime: "09:30",
      priority: "high",
      tag: "计划",
      done: false,
      createdAt: Date.now()
    }
  ];
}

function saveFallback() {
  localStorage.setItem(storageKey, JSON.stringify(state.tasks));
}

function loadUiState() {
  const saved = JSON.parse(localStorage.getItem(uiStorageKey) || "null");
  if (!saved) return;
  if (typeof saved.density === "string") state.density = saved.density;
  if (typeof saved.weekOpen === "boolean") state.weekOpen = saved.weekOpen;
  if (Array.isArray(saved.openDays)) state.openDays = new Set(saved.openDays);
}

function saveUiState() {
  localStorage.setItem(uiStorageKey, JSON.stringify({
    density: state.density,
    weekOpen: state.weekOpen,
    openDays: [...state.openDays]
  }));
}

function inCurrentWeek(task) {
  if (!task.date) return false;
  const date = fromISO(task.date);
  const end = addDays(state.weekStart, 6);
  return date >= state.weekStart && date <= end;
}

function matchesQuery(task) {
  if (!state.query) return true;
  return `${task.title} ${task.note} ${task.tag}`.toLowerCase().includes(state.query.toLowerCase());
}

function matchesFilters(task) {
  if (state.statusFilter === "open" && task.done) return false;
  if (state.statusFilter === "done" && !task.done) return false;
  if (state.statusFilter === "high" && task.priority !== "high") return false;
  if (state.tagFilter && !String(task.tag || "").toLowerCase().includes(state.tagFilter.toLowerCase())) return false;
  return true;
}

function weekTasks() {
  return state.tasks.filter(task => inCurrentWeek(task) && matchesQuery(task));
}

function tasksForDate(iso) {
  return sortedTasks(state.tasks.filter(task => task.date === iso && matchesQuery(task) && matchesFilters(task)));
}

function weekStats() {
  const all = state.tasks.filter(inCurrentWeek);
  const open = all.filter(task => !task.done);
  const done = all.filter(task => task.done);
  const high = open.filter(task => task.priority === "high");
  const minutes = open.reduce((sum, task) => sum + plannedMinutes(task), 0);
  return { all, open, done, high, minutes };
}

function renderShell() {
  els.todayLabel.textContent = formatLongDate(new Date());
  els.dateInput.value = state.selectedDate;
  els.jumpDateInput.value = state.selectedDate || todayISO();
  document.body.classList.remove("density-comfortable", "density-compact", "density-minimal");
  document.body.classList.add(`density-${state.density}`);
  els.densityLabel.textContent = { comfortable: "舒适", compact: "紧凑", minimal: "极简" }[state.density];
}

function renderStats() {
  const stats = weekStats();
  const backlog = state.tasks.filter(task => !task.done && !task.date);
  const done = state.tasks.filter(task => task.done);

  els.statWeekOpen.textContent = stats.open.length;
  els.statWeekDone.textContent = stats.done.length;
  els.statHigh.textContent = stats.high.length;
  els.statMinutes.textContent = stats.minutes >= 60 ? `${Math.floor(stats.minutes / 60)}h ${stats.minutes % 60}m` : `${stats.minutes}m`;
  els.countBacklog.textContent = backlog.length;
  els.countDone.textContent = done.length;

  const percent = stats.all.length ? Math.round((stats.done.length / stats.all.length) * 100) : 0;
  els.progressText.textContent = `${percent}%`;
  els.progressFill.style.width = `${percent}%`;
}

function renderHero() {
  const range = formatWeekRange(state.weekStart);
  const stats = weekStats();

  els.weekKicker.textContent = "完整 7 天计划";
  els.weekTitle.textContent = `${range} 的安排`;
  els.weekCopy.textContent = stats.open.length
    ? `这一周还有 ${stats.open.length} 件待推进的事。每天展开后可以分别安排任务。`
    : "这一周暂时很轻，可以先给某一天放进一个明确的小目标。";
  els.weekRangeTitle.textContent = `周计划 ${range}`;
  els.weekRangeMeta.textContent = `${stats.all.length} 个任务 · ${stats.done.length} 个已完成`;
  els.weekToggleIcon.textContent = state.weekOpen ? "⌃" : "⌄";
  els.weekGoalInput.value = state.settings.weekGoals[toISO(state.weekStart)] || "";
}

function renderWeek() {
  els.dayList.innerHTML = "";
  if (!state.weekOpen) return;

  for (const day of weekDays(state.weekStart)) {
    const tasks = tasksForDate(day.iso);
    const doneCount = tasks.filter(task => task.done).length;
    const isOpen = state.openDays.has(day.iso);
    const section = document.createElement("section");
    section.className = "day-section";
    section.innerHTML = `
      <button class="day-header" data-action="toggle-day" data-date="${day.iso}">
        <span>
          <span class="day-title">${day.label} ${day.readable}</span>
          <span class="day-meta">${day.iso === todayISO() ? "今天" : "计划日"}</span>
        </span>
        <span class="day-count">
          ${tasks.length ? `${doneCount}/${tasks.length}` : "0 个任务"}
          <span>${isOpen ? "⌃" : "⌄"}</span>
        </span>
      </button>
      <div class="task-list"></div>
    `;

    const list = section.querySelector(".task-list");
    if (!isOpen) {
      list.hidden = true;
    } else if (!tasks.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "这一天还没有安排。";
      list.append(empty);
    } else {
      const { timed, loose } = splitDayTasks(tasks);
      if (timed.length) list.append(renderTimeline(timed));
      if (loose.length) list.append(renderLooseTasks(loose));
    }

    els.dayList.append(section);
  }
}

function renderTimeline(tasks) {
  const timeline = document.createElement("div");
  timeline.className = "timeline";
  const label = document.createElement("div");
  label.className = "list-label";
  label.textContent = "时间安排";
  timeline.append(label);

  for (const task of tasks) {
    const row = document.createElement("div");
    row.className = "timeline-row";
    const time = document.createElement("div");
    time.className = "timeline-time";
    time.textContent = formatTimeRange(task);
    row.append(time, renderTask(task));
    timeline.append(row);
  }

  return timeline;
}

function renderLooseTasks(tasks) {
  const group = document.createElement("div");
  group.className = "loose-tasks";
  if (tasks.some(task => getStartTime(task) || getEndTime(task))) {
    const label = document.createElement("div");
    label.className = "list-label";
    label.textContent = "待确认时长";
    group.append(label);
  }
  for (const task of tasks) group.append(renderTask(task));
  return group;
}

function renderTask(task) {
  const item = document.createElement("article");
  item.className = `task priority-${task.priority}${task.done ? " done" : ""}`;
  item.draggable = true;
  item.dataset.id = task.id;
  item.innerHTML = `
    <button class="check ${task.done ? "checked" : ""}" title="完成" data-action="toggle-task" data-id="${task.id}">✓</button>
    <div>
      <div class="task-title"></div>
      <div class="task-note"></div>
      <div class="meta"></div>
    </div>
    <div class="task-actions">
      <button class="icon-btn" title="移动到下一天" data-action="move-next" data-id="${task.id}">›</button>
      <button class="icon-btn" title="编辑" data-action="edit-task" data-id="${task.id}">✎</button>
      <button class="icon-btn" title="删除" data-action="delete-task" data-id="${task.id}">×</button>
    </div>
  `;
  item.querySelector(".task-title").textContent = task.title;
  item.querySelector(".task-note").textContent = task.note || "";

  const priorityText = { high: "高优先级", medium: "中优先级", low: "低优先级" }[task.priority];
  const bits = [
    { text: priorityText, cls: task.priority },
    formatTimeRange(task) ? { text: formatTimeRange(task) } : null,
    task.repeat && task.repeat !== "none" ? { text: task.repeat === "daily" ? "每天" : "每周" } : null,
    task.tag ? { text: `#${task.tag}` } : null
  ].filter(Boolean);
  const meta = item.querySelector(".meta");
  for (const bit of bits) {
    const pill = document.createElement("span");
    pill.className = `pill ${bit.cls || ""}`;
    pill.textContent = bit.text;
    meta.append(pill);
  }
  return item;
}

function renderDrawer() {
  if (!state.drawerMode) {
    els.drawer.hidden = true;
    els.drawerBackdrop.hidden = true;
    return;
  }

  const isDone = state.drawerMode === "done";
  const tasks = sortedTasks(state.tasks.filter(task => isDone ? task.done : !task.done && !task.date));
  els.drawer.hidden = false;
  els.drawerBackdrop.hidden = false;
  els.drawerKicker.textContent = isDone ? "已完成" : "收件箱";
  els.drawerTitle.textContent = isDone ? "已完成任务" : "未安排任务";
  els.drawerList.innerHTML = "";

  if (!tasks.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = isDone ? "还没有已完成任务。" : "收件箱是空的。";
    els.drawerList.append(empty);
    return;
  }

  for (const task of tasks) {
    const item = renderTask(task);
    if (!isDone) {
      const planner = document.createElement("div");
      planner.className = "drawer-planner";
      planner.innerHTML = `
        <button data-action="plan-today" data-id="${task.id}">今天</button>
        <button data-action="plan-tomorrow" data-id="${task.id}">明天</button>
        <button data-action="plan-selected" data-id="${task.id}">当前选中日</button>
      `;
      const wrap = document.createElement("div");
      wrap.className = "drawer-task";
      wrap.append(item, planner);
      els.drawerList.append(wrap);
    } else {
      els.drawerList.append(item);
    }
  }
}

function renderFocus() {
  const candidate = sortedTasks(state.tasks.filter(task => !task.done && (task.date === todayISO() || !task.date)))[0];
  els.focusTask.textContent = candidate ? candidate.title : "暂无任务";
  els.finishFocusBtn.disabled = !candidate;
  els.finishFocusBtn.dataset.id = candidate ? candidate.id : "";
}

function render() {
  renderShell();
  renderStats();
  renderHero();
  renderWeek();
  renderFocus();
  renderDrawer();
}

function resetForm(date = state.selectedDate) {
  state.editingId = null;
  els.formTitle.textContent = "新增任务";
  els.submitBtn.textContent = "保存任务";
  els.form.reset();
  els.dateInput.value = date || todayISO();
  els.priorityInput.value = "medium";
  els.repeatInput.value = "none";
}

function fillForm(task) {
  state.editingId = task.id;
  state.selectedDate = task.date || todayISO();
  els.formTitle.textContent = "编辑任务";
  els.submitBtn.textContent = "更新任务";
  els.titleInput.value = task.title;
  els.noteInput.value = task.note || "";
  els.dateInput.value = task.date || "";
  els.startTimeInput.value = getStartTime(task);
  els.endTimeInput.value = getEndTime(task);
  els.priorityInput.value = task.priority;
  els.repeatInput.value = task.repeat || "none";
  els.tagInput.value = task.tag || "";
  els.titleInput.focus();
}

async function persistCreate(payload) {
  if (!state.apiOnline) {
    const task = {
      id: crypto.randomUUID(),
      ...payload,
      done: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    state.tasks.unshift(task);
    saveFallback();
    return;
  }
  const created = await api.createTask({ ...payload, done: false });
  state.tasks.unshift(created);
}

async function persistUpdate(id, payload) {
  if (!state.apiOnline) {
    state.tasks = state.tasks.map(task => task.id === id ? { ...task, ...payload, updatedAt: Date.now() } : task);
    saveFallback();
    return;
  }
  const updated = await api.updateTask(id, payload);
  state.tasks = state.tasks.map(task => task.id === id ? updated : task);
}

async function persistDelete(id) {
  if (state.apiOnline) {
    await api.deleteTask(id);
  }
  state.tasks = state.tasks.filter(task => task.id !== id);
  if (!state.apiOnline) saveFallback();
}

function moveToWeekOf(iso) {
  state.selectedDate = iso || todayISO();
  state.weekStart = startOfWeek(fromISO(state.selectedDate));
  state.openDays.add(state.selectedDate);
  saveUiState();
}

function repeatDates(startISO, repeat) {
  if (!startISO || repeat === "none") return [startISO];
  const start = fromISO(startISO);
  const count = repeat === "daily" ? 7 : 4;
  const step = repeat === "daily" ? 1 : 7;
  return Array.from({ length: count }, (_, index) => toISO(addDays(start, index * step)));
}

async function createWithRepeat(payload) {
  const dates = repeatDates(payload.date, payload.repeat);
  for (const date of dates) {
    await persistCreate({ ...payload, date, repeat: dates.length > 1 ? payload.repeat : "none" });
  }
}

async function moveTaskToDate(task, date) {
  await persistUpdate(task.id, { ...task, date });
  moveToWeekOf(date);
}

function downloadJson(name, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

async function persistSettings() {
  if (state.apiOnline) {
    state.settings = await api.updateSettings(state.settings);
  } else {
    localStorage.setItem("dayflow.settings.fallback.v1", JSON.stringify(state.settings));
  }
}

els.prevWeekBtn.addEventListener("click", () => {
  state.weekStart = addDays(state.weekStart, -7);
  state.selectedDate = toISO(state.weekStart);
  state.openDays.add(state.selectedDate);
  resetForm(state.selectedDate);
  saveUiState();
  render();
});

els.nextWeekBtn.addEventListener("click", () => {
  state.weekStart = addDays(state.weekStart, 7);
  state.selectedDate = toISO(state.weekStart);
  state.openDays.add(state.selectedDate);
  resetForm(state.selectedDate);
  saveUiState();
  render();
});

els.thisWeekBtn.addEventListener("click", () => {
  moveToWeekOf(todayISO());
  resetForm(state.selectedDate);
  render();
});

els.jumpDateInput.addEventListener("change", event => {
  if (!event.target.value) return;
  moveToWeekOf(event.target.value);
  resetForm(state.selectedDate);
  render();
});

els.weekToggleBtn.addEventListener("click", () => {
  state.weekOpen = !state.weekOpen;
  saveUiState();
  render();
});

els.newTaskBtn.addEventListener("click", () => {
  resetForm(state.selectedDate);
  els.titleInput.focus();
});

els.quickInboxBtn.addEventListener("click", async () => {
  const title = els.quickTitleInput.value.trim();
  if (!title) return;
  await persistCreate({
    title,
    note: "",
    date: "",
    startTime: "",
    endTime: "",
    priority: "medium",
    repeat: "none",
    tag: "",
    done: false
  });
  els.quickTitleInput.value = "";
  state.drawerMode = "inbox";
  render();
});

els.quickTitleInput.addEventListener("keydown", event => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  els.quickInboxBtn.click();
});

els.searchInput.addEventListener("input", event => {
  state.query = event.target.value.trim();
  render();
});

els.statusFilter.addEventListener("change", event => {
  state.statusFilter = event.target.value;
  render();
});

els.tagFilter.addEventListener("input", event => {
  state.tagFilter = event.target.value.trim();
  render();
});

els.dayList.addEventListener("click", async event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const action = button.dataset.action;
  if (action === "toggle-day") {
    const iso = button.dataset.date;
    state.selectedDate = iso;
    if (state.openDays.has(iso)) {
      state.openDays.delete(iso);
    } else {
      state.openDays.add(iso);
    }
    saveUiState();
    resetForm(iso);
    render();
    return;
  }

  const task = state.tasks.find(item => item.id === button.dataset.id);
  if (!task) return;

  if (action === "toggle-task") {
    await persistUpdate(task.id, { ...task, done: !task.done });
  }
  if (action === "delete-task") {
    await persistDelete(task.id);
  }
  if (action === "move-next") {
    const nextDate = task.date ? toISO(addDays(fromISO(task.date), 1)) : state.selectedDate;
    await moveTaskToDate(task, nextDate);
  }
  if (action === "edit-task") {
    fillForm(task);
    render();
    return;
  }
  render();
});

els.dayList.addEventListener("dragstart", event => {
  const task = event.target.closest(".task");
  if (!task) return;
  state.draggedTaskId = task.dataset.id;
  task.classList.add("dragging");
});

els.dayList.addEventListener("dragend", event => {
  event.target.closest(".task")?.classList.remove("dragging");
  state.draggedTaskId = null;
  for (const section of document.querySelectorAll(".day-section")) section.classList.remove("drag-over");
});

els.dayList.addEventListener("dragover", event => {
  const section = event.target.closest(".day-section");
  if (!section || !state.draggedTaskId) return;
  event.preventDefault();
  section.classList.add("drag-over");
});

els.dayList.addEventListener("dragleave", event => {
  event.target.closest(".day-section")?.classList.remove("drag-over");
});

els.dayList.addEventListener("drop", async event => {
  const section = event.target.closest(".day-section");
  if (!section || !state.draggedTaskId) return;
  event.preventDefault();
  section.classList.remove("drag-over");
  const date = section.querySelector(".day-header")?.dataset.date;
  const task = state.tasks.find(item => item.id === state.draggedTaskId);
  if (task && date) {
    await moveTaskToDate(task, date);
    render();
  }
});

els.form.addEventListener("submit", async event => {
  event.preventDefault();
  const payload = {
    title: els.titleInput.value.trim(),
    note: els.noteInput.value.trim(),
    date: els.dateInput.value,
    startTime: els.startTimeInput.value,
    endTime: els.endTimeInput.value,
    priority: els.priorityInput.value,
    repeat: els.repeatInput.value,
    tag: els.tagInput.value.trim(),
    done: false
  };
  if (!payload.title) return;

  try {
    if (state.editingId) {
      const current = state.tasks.find(task => task.id === state.editingId);
      await persistUpdate(state.editingId, { ...current, ...payload, done: current.done });
    } else {
      await createWithRepeat(payload);
    }
    if (payload.date) moveToWeekOf(payload.date);
    resetForm(payload.date || state.selectedDate);
    render();
  } catch (error) {
    alert(error.message);
  }
});

els.dateInput.addEventListener("change", event => {
  if (!event.target.value) return;
  moveToWeekOf(event.target.value);
  render();
});

els.cancelEditBtn.addEventListener("click", () => {
  resetForm(state.selectedDate);
});

els.finishFocusBtn.addEventListener("click", async () => {
  const task = state.tasks.find(item => item.id === els.finishFocusBtn.dataset.id);
  if (!task) return;
  await persistUpdate(task.id, { ...task, done: true });
  render();
});

els.inboxBtn.addEventListener("click", () => {
  state.drawerMode = "inbox";
  render();
});

els.doneBtn.addEventListener("click", () => {
  state.drawerMode = "done";
  render();
});

els.drawerCloseBtn.addEventListener("click", () => {
  state.drawerMode = null;
  render();
});

els.drawerBackdrop.addEventListener("click", () => {
  state.drawerMode = null;
  render();
});

els.drawerList.addEventListener("click", async event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const task = state.tasks.find(item => item.id === button.dataset.id);
  if (!task) return;
  const action = button.dataset.action;
  if (action === "toggle-task") await persistUpdate(task.id, { ...task, done: !task.done });
  if (action === "delete-task") await persistDelete(task.id);
  if (action === "move-next") await moveTaskToDate(task, state.selectedDate || todayISO());
  if (action === "plan-today") await moveTaskToDate(task, todayISO());
  if (action === "plan-tomorrow") await moveTaskToDate(task, toISO(addDays(fromISO(todayISO()), 1)));
  if (action === "plan-selected") await moveTaskToDate(task, state.selectedDate || todayISO());
  if (action === "edit-task") {
    fillForm(task);
    state.drawerMode = null;
  }
  render();
});

els.densityBtn.addEventListener("click", () => {
  const order = ["comfortable", "compact", "minimal"];
  state.density = order[(order.indexOf(state.density) + 1) % order.length];
  saveUiState();
  render();
});

els.weekGoalInput.addEventListener("change", async event => {
  const key = toISO(state.weekStart);
  state.settings.weekGoals[key] = event.target.value.trim();
  await persistSettings();
  render();
});

els.exportBtn.addEventListener("click", async () => {
  const payload = state.apiOnline
    ? await api.exportData()
    : { version: 1, exportedAt: new Date().toISOString(), tasks: state.tasks, settings: state.settings };
  downloadJson(`dayflow-${todayISO()}.json`, payload);
});

els.importInput.addEventListener("change", async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  const payload = JSON.parse(text);
  if (state.apiOnline) {
    await api.importData(payload);
    state.tasks = await api.getTasks();
    state.settings = await api.getSettings();
  } else {
    state.tasks = Array.isArray(payload.tasks) ? payload.tasks : [];
    state.settings = payload.settings || { weekGoals: {} };
    saveFallback();
  }
  event.target.value = "";
  render();
});

async function init() {
  loadUiState();
  try {
    const [tasks, settings] = await Promise.all([api.getTasks(), api.getSettings()]);
    state.tasks = tasks;
    state.settings = settings;
  } catch {
    state.tasks = fallbackTasks();
    state.settings = JSON.parse(localStorage.getItem("dayflow.settings.fallback.v1") || "{\"weekGoals\":{}}");
    state.apiOnline = false;
  }

  for (const day of weekDays(state.weekStart)) {
    if (tasksForDate(day.iso).length) state.openDays.add(day.iso);
  }
  render();
}

init();
