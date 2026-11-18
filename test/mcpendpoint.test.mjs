import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  REMOTE_MCP_URL,
  DEFAULT_LOCAL_URL,
  CLERK_OAUTH_CLIENT_SCOPES,
  REQUIRED_REMOTE_SCOPES,
  McpEndpointError,
  validateRemote,
  validateLocal,
  resolveEndpoint,
  resolveLocalDaemonUrl,
  assertNoRedirectResponse,
  CANONICAL_WORKFLOW_IDS,
  isCanonicalWorkflowId,
} from '../dist/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const vectors = JSON.parse(
  readFileSync(join(__dirname, 'fixtures', 'endpoint-vectors.json'), 'utf8')
);

describe('mcpendpoint shared vector suite', () => {
  it('exposes canonical constants and safe Clerk OAuth client scopes', () => {
    assert.equal(REMOTE_MCP_URL, 'https://mcp.agentchatrooms.dev/mcp');
    assert.equal(DEFAULT_LOCAL_URL, 'http://127.0.0.1:20443');
    assert.deepEqual([...CLERK_OAUTH_CLIENT_SCOPES], ['profile', 'email']);
    assert.equal(CLERK_OAUTH_CLIENT_SCOPES.includes('acr:rooms'), false);
    assert.equal(CLERK_OAUTH_CLIENT_SCOPES.includes('acr:cloud:pro'), false);
    assert.deepEqual([...REQUIRED_REMOTE_SCOPES], ['acr:rooms', 'acr:cloud:pro']);
  });

  it('validateRemote accepts canonical vectors', () => {
    for (const url of vectors.remote.accept) {
      assert.equal(validateRemote(url), REMOTE_MCP_URL, `expected accept for ${url}`);
    }
  });

  it('validateRemote rejects unsafe/lookalike vectors', () => {
    for (const url of vectors.remote.reject) {
      assert.throws(() => validateRemote(url), McpEndpointError, `expected reject for ${url}`);
    }
  });

  it('validateLocal accepts loopback literals and pins localhost to 127.0.0.1', () => {
    for (const entry of vectors.local.accept) {
      assert.equal(
        validateLocal(entry.input),
        entry.expected,
        `expected ${entry.input} -> ${entry.expected}`
      );
    }
  });

  it('validateLocal rejects DNS-rebinding, LAN, alternate-IP, and non-http vectors', () => {
    for (const url of vectors.local.reject) {
      assert.throws(() => validateLocal(url), McpEndpointError, `expected reject for ${url}`);
    }
  });

  it('resolveEndpoint matches the full mode resolution table', () => {
    for (const row of vectors.resolve) {
      if (row.expectError) {
        assert.throws(
          () =>
            resolveEndpoint({
              override: row.override,
              grantedScopes: row.scopes,
              localUrl: row.localUrl,
            }),
          McpEndpointError,
          row.name
        );
      } else {
        const res = resolveEndpoint({
          override: row.override,
          grantedScopes: row.scopes,
          localUrl: row.localUrl,
        });
        assert.equal(res.mode, row.mode, row.name);
        assert.equal(res.url, row.url, row.name);
      }
    }
  });

  it('resolveLocalDaemonUrl respects explicit > ACR_DAEMON_URL > default', () => {
    const prev = process.env.ACR_DAEMON_URL;
    try {
      delete process.env.ACR_DAEMON_URL;
      assert.equal(resolveLocalDaemonUrl(), 'http://127.0.0.1:20443');

      process.env.ACR_DAEMON_URL = 'http://localhost:21000';
      assert.equal(resolveLocalDaemonUrl(), 'http://127.0.0.1:21000');

      assert.equal(resolveLocalDaemonUrl('http://[::1]:22000'), 'http://[::1]:22000');
    } finally {
      if (prev === undefined) delete process.env.ACR_DAEMON_URL;
      else process.env.ACR_DAEMON_URL = prev;
    }
  });

  it('assertNoRedirectResponse rejects 3xx status codes and opaqueredirect', () => {
    for (const status of [301, 302, 303, 307, 308]) {
      assert.throws(
        () => assertNoRedirectResponse({ status, type: 'basic' }),
        /redirects are not followed/
      );
    }
    assert.throws(
      () => assertNoRedirectResponse({ status: 0, type: 'opaqueredirect' }),
      /redirects are not followed/
    );
    const ok = { status: 200, type: 'basic' };
    assert.equal(assertNoRedirectResponse(ok), ok);
  });

  it('exports all 18 canonical workflow IDs', () => {
    assert.equal(CANONICAL_WORKFLOW_IDS.length, 18);
    assert.equal(isCanonicalWorkflowId('postgres-split-brain'), true);
    assert.equal(isCanonicalWorkflowId('transitive-trust-federation'), true);
    assert.equal(isCanonicalWorkflowId('nonexistent-workflow'), false);
  });
});
