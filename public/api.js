async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { "content-type": "application/json" },
    ...options
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || "请求失败");
  }
  return payload;
}

export function getTasks() {
  return requestJson("/api/tasks");
}

export function createTask(payload) {
  return requestJson("/api/tasks", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateTask(id, payload) {
  return requestJson(`/api/tasks/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function deleteTask(id) {
  return requestJson(`/api/tasks/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
}

export function getSettings() {
  return requestJson("/api/settings");
}

export function updateSettings(settings) {
  return requestJson("/api/settings", {
    method: "PUT",
    body: JSON.stringify(settings)
  });
}

export function exportData() {
  return requestJson("/api/export");
}

export function importData(payload) {
  return requestJson("/api/import", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
