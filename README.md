# LoopForge Tutorial Demo

这是一个用于 LoopForge 0—1 实战教程的最小 Node.js 项目。它提供了一个带项目权限边界的审计日志查询接口，后续由 SOP 完成“按操作人筛选并导出 CSV”的需求。

项目不依赖第三方 npm 包，Node.js 18 及以上版本即可运行。

## 本地验证

```bash
npm test
npm start
```

服务默认监听 `http://localhost:3000`。

健康检查：

```bash
curl http://localhost:3000/health
```

以普通成员身份查看自己项目的日志：

```bash
curl \
  -H 'x-user-id: user-alice' \
  -H 'x-role: member' \
  -H 'x-project-id: project-alpha' \
  'http://localhost:3000/api/audit-logs'
```

尝试访问其他项目会返回 `403`：

```bash
curl \
  -H 'x-user-id: user-alice' \
  -H 'x-role: member' \
  -H 'x-project-id: project-alpha' \
  'http://localhost:3000/api/audit-logs?projectId=project-beta'
```

## 用于 LoopForge 的任务

把本项目推送到 GitHub 后，在 LoopForge 中创建需求。需求正文可以直接复制 [docs/demo-requirement.md](docs/demo-requirement.md)。

当前接口：

- `GET /api/audit-logs`：支持可选的 `projectId` 和 `operatorId` 查询参数，返回 JSON。
- `GET /api/audit-logs/export`：同样支持 `projectId` 和 `operatorId`，返回 CSV 附件。

普通成员只能访问自己所属项目，传入其他 `projectId` 会返回 `403`；管理员可以通过 `projectId` 指定项目。查询与导出共用同一套权限判断。

按操作人筛选：

```bash
curl \
  -H 'x-user-id: user-alice' \
  -H 'x-role: member' \
  -H 'x-project-id: project-alpha' \
  'http://localhost:3000/api/audit-logs?operatorId=user-alice'
```

导出 CSV：

```bash
curl \
  -H 'x-user-id: user-alice' \
  -H 'x-role: member' \
  -H 'x-project-id: project-alpha' \
  -o audit-logs.csv \
  'http://localhost:3000/api/audit-logs/export?operatorId=user-alice'
```

CSV 固定为 `id,projectId,operatorId,action,createdAt` 五列，使用 CRLF 换行、UTF-8 无 BOM，并按 RFC 4180 转义逗号、双引号和换行。

## 项目结构

```text
.
├── docs/
│   └── demo-requirement.md
├── src/
│   ├── audit-log-service.js
│   ├── data.js
│   └── server.js
├── test/
│   ├── audit-log-api.test.js
│   └── audit-log-service.test.js
└── package.json
```

## License

MIT
