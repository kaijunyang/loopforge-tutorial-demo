import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/server.js';

const member = {
  'x-user-id': 'user-alice',
  'x-role': 'member',
  'x-project-id': 'project-alpha'
};

const admin = {
  'x-user-id': 'admin-1',
  'x-role': 'admin',
  'x-project-id': 'project-alpha'
};

async function withServer(run) {
  const server = createApp();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('GET /api/audit-logs filters by operatorId', async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/api/audit-logs?operatorId=user-alice`, {
      headers: member
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body.items.map((entry) => entry.id), ['log-1004', 'log-1001']);
    assert.ok(body.items.every((entry) => entry.operatorId === 'user-alice'));
  });
});

test('GET /api/audit-logs/export returns a CSV attachment', async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/api/audit-logs/export?operatorId=user-alice`, {
      headers: member
    });
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'text/csv; charset=utf-8');
    assert.equal(
      response.headers.get('content-disposition'),
      'attachment; filename="audit-logs.csv"'
    );
    assert.ok(body.startsWith('id,projectId,operatorId,action,createdAt\r\n'));
    assert.ok(!body.startsWith('\uFEFF'));
    assert.equal(body.split('\r\n').filter(Boolean).length, 3);
  });
});

test('a member gets 403 when requesting another project', async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/api/audit-logs?projectId=project-beta`, {
      headers: member
    });
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.error, 'FORBIDDEN');
    assert.equal(body.message, 'You are not allowed to access this project');
  });
});

test('a member gets 403 JSON without CSV headers when exporting another project', async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/api/audit-logs/export?projectId=project-beta`, {
      headers: member
    });
    const body = await response.text();

    assert.equal(response.status, 403);
    assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
    assert.equal(response.headers.get('content-disposition'), null);
    assert.equal(JSON.parse(body).error, 'FORBIDDEN');
    assert.ok(!body.includes('log-1003'));
  });
});

test('an admin can export another project and filter it by operatorId', async () => {
  await withServer(async (base) => {
    const response = await fetch(
      `${base}/api/audit-logs/export?projectId=project-beta&operatorId=user-carol`,
      { headers: admin }
    );
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.ok(body.includes('log-1003,project-beta,user-carol,sop.publish'));
    assert.equal(body.split('\r\n').filter(Boolean).length, 2);
  });
});

test('an empty export contains only the CSV header', async () => {
  await withServer(async (base) => {
    const response = await fetch(
      `${base}/api/audit-logs/export?operatorId=user-nobody`,
      { headers: member }
    );
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.equal(body, 'id,projectId,operatorId,action,createdAt\r\n');
  });
});

test('unknown routes return 404', async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/api/unknown`, { headers: member });

    assert.equal(response.status, 404);
    assert.equal((await response.json()).error, 'NOT_FOUND');
  });
});