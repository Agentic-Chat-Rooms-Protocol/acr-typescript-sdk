import assert from 'node:assert';
import {
  AcrClient,
  UniversalSigner,
  RvfStore,
  LshIndex,
  cosineSimilarity
} from '../dist/index.js';

console.log('Testing AcrClient from dist/index.js...');

const client = new AcrClient({
  baseUrl: 'http://localhost:20443',
  agentDid: 'did:key:z6MkqTestTS123',
  agentName: 'TypeScript Agent'
});

assert.strictEqual(client.baseUrl, 'http://localhost:20443');
assert.strictEqual(client.agentDid, 'did:key:z6MkqTestTS123');
assert.strictEqual(client.agentName, 'TypeScript Agent');
console.log('[OK] AcrClient config initialization verified');

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
console.log('[OK] AcrRoomHandle message dispatch & listener verified');

const vote = await room.voteConsensus({
  choice: 'APPROVE',
  reason: 'TLA+ invariants verified'
});
assert.strictEqual(vote, true);
console.log('[OK] Consensus voting verified');

const opsStatus = await client.getOpsRoomStatus();
assert.strictEqual(opsStatus.status, 'nominal');
assert.strictEqual(opsStatus.incident?.severity, 'SEV-1');
assert.strictEqual(opsStatus.squad?.agent_count, 5);
console.log('[OK] OpsRoom status verified');

const incidentRes = await client.triggerIncident({ title: 'Spike' });
assert.strictEqual(incidentRes.status, 'triggered');
console.log('[OK] OpsRoom incident trigger verified');

const planRes = await client.executePlan('plan_123');
assert.strictEqual(planRes.status, 'executed');
assert.strictEqual(planRes.plan_id, 'plan_123');
console.log('[OK] OpsRoom plan execute verified');

const battlecard = await client.getBattlecard();
assert.strictEqual(battlecard.length, 4);
assert.strictEqual(battlecard[0].winner, 'ACR OpsRoom (10x Fewer Loops)');
console.log('[OK] OpsRoom battlecard verified');

// --- UniversalSigner Tests ---
console.log('\nTesting UniversalSigner...');
const composed = UniversalSigner.compose('test.header.v1', ['abc', 'def']);
assert.strictEqual(new TextDecoder().decode(composed), 'test.header.v1\n3:abc\n3:def\n');
console.log('[OK] UniversalSigner canonical length-prefixed compose verified');

const keypair = await UniversalSigner.generateKeypair();
assert.strictEqual(keypair.publicKeyHex.length, 64);
assert.strictEqual(keypair.privateKeyHex.length, 64);

const testPayload = 'agentic-chat-rooms-deep-moat';
const sig = await UniversalSigner.sign(keypair.privateKeyHex, testPayload);
assert.strictEqual(sig.length, 128);

const isValid = await UniversalSigner.verify(keypair.publicKeyHex, testPayload, sig);
assert.strictEqual(isValid, true);

const isTampered = await UniversalSigner.verify(keypair.publicKeyHex, testPayload + '-tampered', sig);
assert.strictEqual(isTampered, false);
console.log('[OK] UniversalSigner Ed25519 keygen, sign, verify, and tamper rejection verified');

const digest = await UniversalSigner.sha256('hello-acr');
assert.strictEqual(digest.length, 64);
console.log('[OK] UniversalSigner SHA-256 content-addressing verified');

// --- RVF Vector Memory & LshIndex Tests ---
console.log('\nTesting RvfStore & LshIndex...');
const dim = 4;
const store = new RvfStore(dim);

store.upsert({
  id: 'v1',
  vector: [1.0, 0.0, 0.5, -0.2],
  meta: { role: 'researcher' }
});
store.upsert({
  id: 'v2',
  vector: [0.99, 0.01, 0.49, -0.19],
  meta: { role: 'analyst' }
});
store.upsert({
  id: 'v3',
  vector: [-1.0, 0.0, -0.5, 0.2],
  meta: { role: 'adversary' }
});
assert.strictEqual(store.length, 3);

// Binary serialization roundtrip
const serialized = store.toBytes();
const deserialized = RvfStore.fromBytes(serialized);
assert.strictEqual(deserialized.dim, dim);
assert.strictEqual(deserialized.length, 3);
assert.strictEqual(deserialized.records[0].id, 'v1');
assert.strictEqual(deserialized.records[0].meta.role, 'researcher');
assert.strictEqual(deserialized.records[0].vector[0], 1.0);
console.log('[OK] RvfStore agentbbs.rvf.v1 binary serialization roundtrip verified');

// Cosine search
const searchHits = store.search([1.0, 0.0, 0.5, -0.2], 2);
assert.strictEqual(searchHits.length, 2);
assert.strictEqual(searchHits[0].id, 'v1');
assert.ok(searchHits[0].score > 0.9999);
assert.strictEqual(searchHits[1].id, 'v2');
console.log('[OK] RvfStore exact cosine search verified');

// LSH approximate search
const lsh = LshIndex.build(store);
const lshHits = lsh.search(store, [1.0, 0.0, 0.5, -0.2], 2, 2);
assert.strictEqual(lshHits.length, 2);
assert.strictEqual(lshHits[0].id, 'v1');
assert.strictEqual(lshHits[1].id, 'v2');
console.log('[OK] LshIndex 64-hyperplane ANN recall and candidate re-ranking verified');

console.log('\nALL TYPESCRIPT SDK TESTS PASSED (100% OK)');
