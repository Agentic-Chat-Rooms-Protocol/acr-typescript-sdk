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

const opsStatus = await client.getOpsRoomStatus();
assert.strictEqual(opsStatus.status, 'nominal');
assert.strictEqual(opsStatus.incident?.severity, 'SEV-1');
assert.strictEqual(opsStatus.squad?.agent_count, 5);
console.log('✓ OpsRoom status verified');

const incidentRes = await client.triggerIncident({ title: 'Spike' });
assert.strictEqual(incidentRes.status, 'triggered');
console.log('✓ OpsRoom incident trigger verified');

const planRes = await client.executePlan('plan_123');
assert.strictEqual(planRes.status, 'executed');
assert.strictEqual(planRes.plan_id, 'plan_123');
console.log('✓ OpsRoom plan execute verified');

const battlecard = await client.getBattlecard();
assert.strictEqual(battlecard.length, 4);
assert.strictEqual(battlecard[0].winner, 'ACR OpsRoom (10x Fewer Loops)');
console.log('✓ OpsRoom battlecard verified');

console.log('\nALL TYPESCRIPT SDK TESTS PASSED (100% OK)');

