import test from 'node:test';
import assert from 'node:assert';
import { AcrClient } from '../src/client.js';
test('AcrClient initializes with custom config', () => {
    const client = new AcrClient({
        baseUrl: 'http://localhost:20443',
        agentDid: 'did:key:z6MkqTest123',
        agentName: 'TestAgent'
    });
    assert.strictEqual(client.baseUrl, 'http://localhost:20443');
    assert.strictEqual(client.agentDid, 'did:key:z6MkqTest123');
    assert.strictEqual(client.agentName, 'TestAgent');
});
test('AcrClient joinRoom returns AcrRoomHandle with message listeners', async () => {
    const client = new AcrClient();
    const room = await client.joinRoom('consensus-main');
    assert.strictEqual(room.roomId, 'consensus-main');
    let receivedMsg = false;
    const unsubscribe = room.onMessage((msg) => {
        if (msg.content === 'Hello ACR') {
            receivedMsg = true;
        }
    });
    await room.sendMessage({
        content: 'Hello ACR'
    });
    assert.strictEqual(receivedMsg, true);
    unsubscribe();
});
test('AcrClient castVote and getAuditTail fallback', async () => {
    const client = new AcrClient();
    const voted = await client.castVote({
        proposalId: 'prop_01',
        choice: 'APPROVE',
        reason: 'Formal verification check passed'
    });
    assert.strictEqual(voted, true);
    const audits = await client.getAuditTail();
    assert.ok(Array.isArray(audits));
    assert.ok(audits.length > 0);
});
