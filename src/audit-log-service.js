export class AuthorizationError extends Error {
  constructor(message = 'You are not allowed to access this project') {
    super(message);
    this.name = 'AuthorizationError';
    this.code = 'FORBIDDEN';
    this.statusCode = 403;
  }
}

const CSV_COLUMNS = ['id', 'projectId', 'operatorId', 'action', 'createdAt'];

function targetProject(viewer, requestedProjectId) {
  if (viewer.role === 'admin') {
    return requestedProjectId || viewer.projectId;
  }

  if (requestedProjectId && requestedProjectId !== viewer.projectId) {
    throw new AuthorizationError();
  }

  return viewer.projectId;
}

export function listAuditLogs({ logs, viewer, projectId, operatorId = '' }) {
  const visibleProjectId = targetProject(viewer, projectId);

  if (!visibleProjectId) {
    return [];
  }

  return logs
    .filter((entry) => entry.projectId === visibleProjectId)
    .filter((entry) => !operatorId || entry.operatorId === operatorId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map((entry) => ({ ...entry }));
}

function escapeCsvValue(value) {
  const text = value === undefined || value === null ? '' : String(value);

  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

export function auditLogsToCsv(entries) {
  const rows = [CSV_COLUMNS.join(',')];

  for (const entry of entries) {
    rows.push(CSV_COLUMNS.map((column) => escapeCsvValue(entry[column])).join(','));
  }

  return `${rows.join('\r\n')}\r\n`;
}