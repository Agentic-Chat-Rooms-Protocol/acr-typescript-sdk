import assert from 'node:assert';
import { AcrClient } from '../dist/index.js';

console.log('Testing AcrClient from dist/index.js...');

const client = new AcrClient({
  baseUrl: 'http://localhost:20443',
  agentDid: 'did:key:z6MkqTestTS123',
  agentName: 'TypeScript Agent'
});

assert.strictEqual(client.baseUrl, 'http://localhost:20443');
assert.strictEqual(client.agentDid, 'did:key:z6MkqTestTS123');
assert.strictEqual(client.agentName, 'TypeScript Agent');
console.log('✓ AcrClient config initialization verified');

const room = await client.joinRoom('consensus-main');
assert.strictEqual(room.roomId, 'consensus-main');

let received = false;
const unsub = room.onMessage((msg) => {
  if (msg.content === 'TS SDK Test Message') {
    received = true;
  }
});

const msg = await room.sendMessage({
  content: 'TS SDK Test Message'
});

assert.strictEqual(msg.content, 'TS SDK Test Message');
assert.strictEqual(received, true);
console.log('✓ AcrRoomHandle message dispatch & listener verified');

const vote = await room.voteConsensus({
  choice: 'APPROVE',
  reason: 'TLA+ invariants verified'
});
assert.strictEqual(vote, true);
console.log('✓ Consensus voting verified');

console.log('\nALL TYPESCRIPT SDK TESTS PASSED (100% OK)');
