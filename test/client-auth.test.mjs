import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AcrClient, loadDaemonApiToken } from '../dist/index.js';

function startMockServer(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, url: `http://127.0.0.1:${addr.port}` });
    });
  });
}

describe('AcrClient daemon auth, default URL, and noRedirect behavior', () => {
  it('defaults baseUrl to literal http://127.0.0.1:20443', () => {
    const prevUrl = process.env.ACR_DAEMON_URL;
    try {
      delete process.env.ACR_DAEMON_URL;
      const client = new AcrClient();
      assert.equal(client.baseUrl, 'http://127.0.0.1:20443');
    } finally {
      if (prevUrl === undefined) delete process.env.ACR_DAEMON_URL;
      else process.env.ACR_DAEMON_URL = prevUrl;
    }
  });

  it('sends Authorization: Bearer from ACR_API_TOKEN env var', async () => {
    const seenAuth = [];
    const { server, url } = await startMockServer((req, res) => {
      seenAuth.push(req.headers.authorization);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([{ id: 'consensus-main', name: 'Main', is_private: false, participants: [], created_at: '2026-01-01T00:00:00Z', message_count: 0 }]));
    });

    const prevToken = process.env.ACR_API_TOKEN;
    try {
      process.env.ACR_API_TOKEN = 'env-secret-token-xyz';
      const client = new AcrClient({ baseUrl: url, strict: true });
      const rooms = await client.listRooms();
      assert.equal(rooms.length, 1);
      assert.equal(seenAuth[0], 'Bearer env-secret-token-xyz');
    } finally {
      if (prevToken === undefined) delete process.env.ACR_API_TOKEN;
      else process.env.ACR_API_TOKEN = prevToken;
      server.close();
    }
  });

  it('loads Bearer token from ~/.acr/api-token when ACR_API_TOKEN is unset', async () => {
    const tempHome = mkdtempSync(join(tmpdir(), 'acr-ts-home-'));
    const acrDir = join(tempHome, '.acr');
    mkdirSync(acrDir, { recursive: true });
    writeFileSync(join(acrDir, 'api-token'), '  file-secret-token-abc \n', 'utf8');

    const seenAuth = [];
    const { server, url } = await startMockServer((req, res) => {
      seenAuth.push(req.headers.authorization);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', version: '1.0.0' }));
    });

    const prevToken = process.env.ACR_API_TOKEN;
    const prevHome = process.env.HOME;
    const prevUserProfile = process.env.USERPROFILE;
    try {
      delete process.env.ACR_API_TOKEN;
      process.env.HOME = tempHome;
      process.env.USERPROFILE = tempHome;

      const resolved = await loadDaemonApiToken();
      assert.equal(resolved, 'file-secret-token-abc');

      const client = new AcrClient({ baseUrl: url, strict: true });
      const health = await client.health();
      assert.equal(health.status, 'ok');
      assert.equal(seenAuth[0], 'Bearer file-secret-token-abc');
    } finally {
      if (prevToken === undefined) delete process.env.ACR_API_TOKEN;
      else process.env.ACR_API_TOKEN = prevToken;
      if (prevHome === undefined) delete process.env.HOME;
      else process.env.HOME = prevHome;
      if (prevUserProfile === undefined) delete process.env.USERPROFILE;
      else process.env.USERPROFILE = prevUserProfile;
      server.close();
      rmSync(tempHome, { recursive: true, force: true });
    }
  });

  it('rejects 3xx redirects without following or leaking Bearer token', async () => {
    let targetHit = false;
    const { server: targetServer, url: targetUrl } = await startMockServer((_req, res) => {
      targetHit = true;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
    const { server: redirectServer, url: redirectUrl } = await startMockServer((_req, res) => {
      res.writeHead(302, { Location: `${targetUrl}/steal` });
      res.end();
    });

    try {
      const client = new AcrClient({ baseUrl: redirectUrl, apiKey: 'secret-token', strict: true });
      await assert.rejects(() => client.listRooms(), /redirects are not followed/);
      assert.equal(targetHit, false);
    } finally {
      redirectServer.close();
      targetServer.close();
    }
  });
});
