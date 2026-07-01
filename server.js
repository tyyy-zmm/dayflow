const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const rootDir = __dirname;
const publicDir = path.join(rootDir, "public");
const dataDir = path.join(rootDir, "data");
const tasksFile = path.join(dataDir, "tasks.json");
const settingsFile = path.join(dataDir, "settings.json");
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".ico": "image/x-icon"
};

function todayISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function defaultTasks() {
  return [
    {
      id: crypto.randomUUID(),
      title: "写下今天最想推进的一件事",
      note: "不用很大，清楚到下一步就好。",
      date: todayISO(),
      startTime: "09:00",
      endTime: "09:30",
      priority: "high",
      tag: "计划",
      done: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: crypto.randomUUID(),
      title: "把脑子里的零散想法放进收件箱",
      note: "先收下来，晚一点再决定要不要安排。",
      date: "",
      startTime: "",
      endTime: "",
      priority: "medium",
      tag: "整理",
      done: false,
      createdAt: Date.now() + 1,
      updatedAt: Date.now() + 1
    }
  ];
}

async function ensureStore() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(tasksFile);
  } catch {
    await fs.writeFile(tasksFile, `${JSON.stringify(defaultTasks(), null, 2)}\n`, "utf8");
  }
  try {
    await fs.access(settingsFile);
  } catch {
    await fs.writeFile(settingsFile, `${JSON.stringify({ weekGoals: {} }, null, 2)}\n`, "utf8");
  }
}

async function readTasks() {
  await ensureStore();
  const raw = await fs.readFile(tasksFile, "utf8");
  const parsed = JSON.parse(raw || "[]");
  return Array.isArray(parsed) ? parsed : [];
}

async function writeTasks(tasks) {
  await ensureStore();
  await fs.writeFile(tasksFile, `${JSON.stringify(tasks, null, 2)}\n`, "utf8");
}

async function readSettings() {
  await ensureStore();
  const raw = await fs.readFile(settingsFile, "utf8");
  const parsed = JSON.parse(raw || "{}");
  return {
    weekGoals: parsed.weekGoals && typeof parsed.weekGoals === "object" ? parsed.weekGoals : {}
  };
}

async function writeSettings(settings) {
  await ensureStore();
  await fs.writeFile(settingsFile, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

async function readBody(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 1024 * 1024) {
      throw new Error("请求体过大");
    }
  }
  return body ? JSON.parse(body) : {};
}

function cleanTask(input) {
  return {
    title: String(input.title || "").trim().slice(0, 90),
    note: String(input.note || "").trim().slice(0, 300),
    date: String(input.date || "").slice(0, 10),
    startTime: String(input.startTime || input.time || "").slice(0, 5),
    endTime: String(input.endTime || "").slice(0, 5),
    priority: ["high", "medium", "low"].includes(input.priority) ? input.priority : "medium",
    tag: String(input.tag || "").trim().slice(0, 40),
    repeat: ["none", "daily", "weekly"].includes(input.repeat) ? input.repeat : "none",
    done: Boolean(input.done)
  };
}

function cleanImportedTask(input) {
  return {
    id: typeof input.id === "string" && input.id ? input.id : crypto.randomUUID(),
    ...cleanTask(input),
    createdAt: Number(input.createdAt || Date.now()),
    updatedAt: Number(input.updatedAt || Date.now())
  };
}

async function handleApi(req, res, pathname) {
  if (pathname === "/api/health" && req.method === "GET") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (pathname === "/api/tasks" && req.method === "GET") {
    sendJson(res, 200, await readTasks());
    return;
  }

  if (pathname === "/api/export" && req.method === "GET") {
    sendJson(res, 200, {
      version: 1,
      exportedAt: new Date().toISOString(),
      tasks: await readTasks(),
      settings: await readSettings()
    });
    return;
  }

  if (pathname === "/api/import" && req.method === "POST") {
    const body = await readBody(req);
    if (!Array.isArray(body.tasks)) {
      sendError(res, 400, "导入文件缺少 tasks 数组");
      return;
    }
    const tasks = body.tasks.map(cleanImportedTask);
    await writeTasks(tasks);
    if (body.settings && typeof body.settings === "object") {
      await writeSettings({
        weekGoals: body.settings.weekGoals && typeof body.settings.weekGoals === "object" ? body.settings.weekGoals : {}
      });
    }
    sendJson(res, 200, { ok: true, count: tasks.length });
    return;
  }

  if (pathname === "/api/settings" && req.method === "GET") {
    sendJson(res, 200, await readSettings());
    return;
  }

  if (pathname === "/api/settings" && req.method === "PUT") {
    const body = await readBody(req);
    const current = await readSettings();
    const next = {
      weekGoals: body.weekGoals && typeof body.weekGoals === "object" ? body.weekGoals : current.weekGoals
    };
    await writeSettings(next);
    sendJson(res, 200, next);
    return;
  }

  if (pathname === "/api/tasks" && req.method === "POST") {
    const payload = cleanTask(await readBody(req));
    if (!payload.title) {
      sendError(res, 400, "任务标题不能为空");
      return;
    }

    const tasks = await readTasks();
    const task = {
      id: crypto.randomUUID(),
      ...payload,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    tasks.unshift(task);
    await writeTasks(tasks);
    sendJson(res, 201, task);
    return;
  }

  const taskMatch = pathname.match(/^\/api\/tasks\/([^/]+)$/);
  if (taskMatch && req.method === "PUT") {
    const id = decodeURIComponent(taskMatch[1]);
    const payload = cleanTask(await readBody(req));
    if (!payload.title) {
      sendError(res, 400, "任务标题不能为空");
      return;
    }

    const tasks = await readTasks();
    const index = tasks.findIndex(task => task.id === id);
    if (index === -1) {
      sendError(res, 404, "任务不存在");
      return;
    }

    tasks[index] = {
      ...tasks[index],
      ...payload,
      updatedAt: Date.now()
    };
    await writeTasks(tasks);
    sendJson(res, 200, tasks[index]);
    return;
  }

  if (taskMatch && req.method === "DELETE") {
    const id = decodeURIComponent(taskMatch[1]);
    const tasks = await readTasks();
    const nextTasks = tasks.filter(task => task.id !== id);
    if (nextTasks.length === tasks.length) {
      sendError(res, 404, "任务不存在");
      return;
    }

    await writeTasks(nextTasks);
    sendJson(res, 200, { ok: true });
    return;
  }

  sendError(res, 404, "接口不存在");
}

async function serveStatic(req, res, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(publicDir, safePath));

  if (!filePath.startsWith(publicDir)) {
    sendError(res, 403, "禁止访问");
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    const type = mimeTypes[path.extname(filePath)] || "application/octet-stream";
    res.writeHead(200, { "content-type": type });
    res.end(file);
  } catch {
    const fallback = await fs.readFile(path.join(publicDir, "index.html"));
    res.writeHead(200, { "content-type": mimeTypes[".html"] });
    res.end(fallback);
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url.pathname);
      return;
    }
    await serveStatic(req, res, url.pathname);
  } catch (error) {
    sendError(res, 500, error.message || "服务器错误");
  }
});

server.listen(port, host, () => {
  console.log(`Dayflow running at http://${host}:${port}`);
});
