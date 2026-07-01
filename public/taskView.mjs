export function priorityRank(priority) {
  return { high: 0, medium: 1, low: 2 }[priority] ?? 3;
}

export function getStartTime(task) {
  return task.startTime || task.time || "";
}

export function getEndTime(task) {
  if (task.endTime) return task.endTime;
  if (!task.time || !task.duration) return "";
  const [hour, minute] = task.time.split(":").map(Number);
  const date = new Date(2000, 0, 1, hour, minute + Number(task.duration || 0));
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function hasTimeRange(task) {
  return Boolean(getStartTime(task) && getEndTime(task));
}

export function formatTimeRange(task) {
  const start = getStartTime(task);
  const end = getEndTime(task);
  if (start && end) return `${start} - ${end}`;
  if (start) return `${start} 开始`;
  if (end) return `${end} 前`;
  return "";
}

export function plannedMinutes(task) {
  const start = getStartTime(task);
  const end = getEndTime(task);
  if (!start || !end) return 0;
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  return Math.max(0, endHour * 60 + endMinute - (startHour * 60 + startMinute));
}

export function sortedTasks(tasks) {
  return [...tasks].sort((a, b) => {
    if (a.done !== b.done) return Number(a.done) - Number(b.done);
    const aStart = getStartTime(a);
    const bStart = getStartTime(b);
    if ((aStart || "") !== (bStart || "")) return (aStart || "99:99").localeCompare(bStart || "99:99");
    return priorityRank(a.priority) - priorityRank(b.priority);
  });
}

export function splitDayTasks(tasks) {
  const sorted = sortedTasks(tasks);
  return {
    timed: sorted.filter(hasTimeRange),
    loose: sorted.filter(task => !hasTimeRange(task))
  };
}
