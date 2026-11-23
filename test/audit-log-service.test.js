import test from 'node:test';
import assert from 'node:assert/strict';
import { auditLogs } from '../src/data.js';
import { auditLogsToCsv, AuthorizationError, listAuditLogs } from '../src/audit-log-service.js';

test('a member sees logs from their own project', () => {
  const result = listAuditLogs({
    logs: auditLogs,
    viewer: { id: 'user-alice', role: 'member', projectId: 'project-alpha' }
  });

  assert.equal(result.length, 3);
  assert.ok(result.every((entry) => entry.projectId === 'project-alpha'));
});

test('a member cannot request another project', () => {
  assert.throws(
    () => listAuditLogs({
      logs: auditLogs,
      viewer: { id: 'user-alice', role: 'member', projectId: 'project-alpha' },
      projectId: 'project-beta'
    }),
    AuthorizationError
  );
});

test('an admin can request another project', () => {
  const result = listAuditLogs({
    logs: auditLogs,
    viewer: { id: 'admin-1', role: 'admin', projectId: 'project-alpha' },
    projectId: 'project-beta'
  });

  assert.deepEqual(result.map((entry) => entry.id), ['log-1003']);
});

test('results are returned newest first and are safe to mutate', () => {
  const result = listAuditLogs({
    logs: auditLogs,
    viewer: { id: 'user-alice', role: 'member', projectId: 'project-alpha' }
  });

  assert.deepEqual(result.map((entry) => entry.id), ['log-1004', 'log-1002', 'log-1001']);
  result[0].action = 'changed-by-caller';
  assert.equal(auditLogs.find((entry) => entry.id === 'log-1004').action, 'run.approve');
});

test('a member can filter their project logs by operatorId', () => {
  const result = listAuditLogs({
    logs: auditLogs,
    viewer: { id: 'user-alice', role: 'member', projectId: 'project-alpha' },
    operatorId: 'user-alice'
  });

  assert.deepEqual(result.map((entry) => entry.id), ['log-1004', 'log-1001']);
  assert.ok(result.every((entry) => entry.operatorId === 'user-alice'));
});

test('operatorId matches exactly and is case-sensitive', () => {
  const viewer = { id: 'user-alice', role: 'member', projectId: 'project-alpha' };

  assert.deepEqual(
    listAuditLogs({ logs: auditLogs, viewer, operatorId: 'USER-ALICE' }),
    []
  );
  assert.deepEqual(
    listAuditLogs({ logs: auditLogs, viewer, operatorId: 'user-alic' }),
    []
  );
});

test('an empty operatorId does not filter', () => {
  const result = listAuditLogs({
    logs: auditLogs,
    viewer: { id: 'user-alice', role: 'member', projectId: 'project-alpha' },
    operatorId: ''
  });

  assert.equal(result.length, 3);
});

test('project authorization is enforced before operator filtering', () => {
  assert.throws(
    () => listAuditLogs({
      logs: auditLogs,
      viewer: { id: 'user-alice', role: 'member', projectId: 'project-alpha' },
      projectId: 'project-beta',
      operatorId: 'user-carol'
    }),
    AuthorizationError
  );
});

test('an admin can filter another project by operatorId', () => {
  const result = listAuditLogs({
    logs: auditLogs,
    viewer: { id: 'admin-1', role: 'admin', projectId: 'project-alpha' },
    projectId: 'project-beta',
    operatorId: 'user-carol'
  });

  assert.deepEqual(result.map((entry) => entry.id), ['log-1003']);
});

test('CSV export uses the documented columns, CRLF and no BOM', () => {
  const csv = auditLogsToCsv(listAuditLogs({
    logs: auditLogs,
    viewer: { id: 'user-alice', role: 'member', projectId: 'project-alpha' }
  }));

  assert.ok(!csv.startsWith('\uFEFF'));
  assert.ok(csv.startsWith('id,projectId,operatorId,action,createdAt\r\n'));
  assert.ok(csv.endsWith('\r\n'));
  assert.equal(csv.split('\r\n').filter(Boolean).length, 4);
});

test('CSV escapes commas, quotes and line breaks per RFC 4180', () => {
  const csv = auditLogsToCsv([
    {
      id: 'log-1',
      projectId: 'project-alpha',
      operatorId: 'user,a',
      action: 'said "hello"',
      createdAt: '2026-11-15T09:00:00.000Z'
    },
    {
      id: 'log-2',
      projectId: 'project-alpha',
      operatorId: 'user-b',
      action: 'line1\nline2',
      createdAt: '2026-11-15T10:00:00.000Z'
    }
  ]);

  assert.ok(csv.includes('"user,a"'));
  assert.ok(csv.includes('"said ""hello"""'));
  assert.ok(csv.includes('"line1\nline2"'));
});

test('CSV export of an empty result contains only the header', () => {
  assert.equal(
    auditLogsToCsv([]),
    'id,projectId,operatorId,action,createdAt\r\n'
  );
});
