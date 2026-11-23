import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { auditLogs } from './data.js';
import { auditLogsToCsv, AuthorizationError, listAuditLogs } from './audit-log-service.js';

function viewerFrom(request) {
  return {
    id: request.headers['x-user-id'] || 'anonymous',
    role: request.headers['x-role'] === 'admin' ? 'admin' : 'member',
    projectId: request.headers['x-project-id'] || ''
  };
}

function sendJSON(response, statusCode, value) {
  response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}

function sendError(response, error) {
  if (error instanceof AuthorizationError) {
    return sendJSON(response, error.statusCode, {
      error: error.code,
      message: error.message
    });
  }

  return sendJSON(response, 500, { error: 'INTERNAL_ERROR' });
}

function queryAuditLogs(request, url) {
  return listAuditLogs({
    logs: auditLogs,
    viewer: viewerFrom(request),
    projectId: url.searchParams.get('projectId') || '',
    operatorId: url.searchParams.get('operatorId') || ''
  });
}

export function createApp() {
  return http.createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');

    if (request.method === 'GET' && url.pathname === '/health') {
      return sendJSON(response, 200, { status: 'ok' });
    }

    if (request.method === 'GET' && url.pathname === '/api/audit-logs') {
      try {
        return sendJSON(response, 200, { items: queryAuditLogs(request, url) });
      } catch (error) {
        return sendError(response, error);
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/audit-logs/export') {
      let csv;

      try {
        csv = auditLogsToCsv(queryAuditLogs(request, url));
      } catch (error) {
        return sendError(response, error);
      }

      response.writeHead(200, {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="audit-logs.csv"'
      });
      return response.end(csv);
    }

    return sendJSON(response, 404, { error: 'NOT_FOUND' });
  });
}

const entryURL = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === entryURL) {
  const port = Number(process.env.PORT || 3000);
  createApp().listen(port, () => {
    console.log(`Audit log demo listening on http://localhost:${port}`);
  });
}