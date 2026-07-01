# Dayflow

Dayflow 是一个自然轻快的计划安排 App。它现在采用前后端结构：

- `server.js`：Node.js 后端，提供任务 API 和静态资源服务。
- `public/index.html`：前端入口。
- `public/styles.css`：界面样式。
- `public/app.js`：周计划交互逻辑。
- `public/api.js`：前端 API 封装。
- `public/date.js`：日期和周计算工具。
- `data/tasks.json`：本地任务数据，运行时自动创建，不提交到仓库。
- `data/settings.json`：周目标等设置，运行时自动创建，不提交到仓库。
- `DESIGN.md`：中文设计方向。

## 本地运行

```bash
npm start
```

然后打开：

```text
http://localhost:4173
```

## API

- `GET /api/tasks`：读取任务
- `POST /api/tasks`：新增任务
- `PUT /api/tasks/:id`：更新任务
- `DELETE /api/tasks/:id`：删除任务
- `GET /api/settings`：读取设置
- `PUT /api/settings`：更新设置
- `GET /api/export`：导出任务和设置
- `POST /api/import`：导入任务和设置
- `GET /api/health`：健康检查

## 当前能力

- 完整 7 天周计划视图
- 每周和每天折叠
- 周目标
- 收件箱抽屉
- 已完成抽屉
- 搜索、状态筛选、标签筛选
- 任务拖拽到某一天
- 任务快速移动到下一天
- 显示密度切换
- 重复任务快速创建
- JSON 导入导出
