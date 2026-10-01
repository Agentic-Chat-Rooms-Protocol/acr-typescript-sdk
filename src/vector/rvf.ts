/**
 * Standalone RVF Vector Memory Layout & LshIndex ANN Client
 *
 * Implements the agentbbs.rvf.v1 binary format specification and 64-hyperplane
 * sign random-projection approximate nearest neighbor search with exact cosine re-ranking.
 */

export interface RvfRecord {
  id: string;
  vector: number[];
  meta: Record<string, any>;
}

export interface RvfHit {
  id: string;
  score: number;
  meta: Record<string, any>;
}

const MAGIC = new Uint8Array([0x41, 0x47, 0x42, 0x42, 0x53, 0x52, 0x56, 0x46]); // "AGBBSRVF"
const VERSION = 1;

export function cosineSimilarity(a: number[], b: number[], normA?: number): number {
  let dot = 0;
  let normBSq = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normBSq += b[i] * b[i];
  }

  const nA = normA ?? Math.sqrt(a.reduce((acc, val) => acc + val * val, 0));
  const nB = Math.sqrt(normBSq);
  const denom = nA * nB;
  if (denom <= 0) return 0;
  const sim = dot / denom;
  return Math.max(-1.0, Math.min(1.0, sim));
}

export class RvfStore {
  public readonly dim: number;
  private readonly _records: RvfRecord[] = [];

  constructor(dim: number) {
    if (dim <= 0) {
      throw new Error(`Invalid vector dimension: ${dim}`);
    }
    this.dim = dim;
  }

  public get records(): readonly RvfRecord[] {
    return this._records;
  }

  public get length(): number {
    return this._records.length;
  }

  public upsert(rec: RvfRecord): void {
    if (rec.vector.length !== this.dim) {
      throw new Error(`Vector dimension mismatch: expected ${this.dim}, got ${rec.vector.length}`);
    }

    const idx = this._records.findIndex((r) => r.id === rec.id);
    if (idx >= 0) {
      this._records[idx] = rec;
    } else {
      this._records.push(rec);
    }
  }

  public search(query: number[], topK = 10): RvfHit[] {
    if (query.length !== this.dim) {
      throw new Error(`Query vector dimension mismatch: expected ${this.dim}, got ${query.length}`);
    }

    const qNorm = Math.sqrt(query.reduce((acc, v) => acc + v * v, 0));
    const hits: RvfHit[] = this._records.map((r) => ({
      id: r.id,
      score: cosineSimilarity(query, r.vector, qNorm),
      meta: r.meta
    }));

    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, topK);
  }

  /**
   * Serializes the store to agentbbs.rvf.v1 binary format.
   */
  public toBytes(): Uint8Array {
    const enc = new TextEncoder();
    const parts: Uint8Array[] = [];

    // Header: Magic(8) + Version(2) + Dim(4) + Count(4) = 18 bytes
    const headerBuf = new ArrayBuffer(18);
    const headerView = new DataView(headerBuf);
    new Uint8Array(headerBuf, 0, 8).set(MAGIC);
    headerView.setUint16(8, VERSION, true);
    headerView.setUint32(10, this.dim, true);
    headerView.setUint32(14, this._records.length, true);
    parts.push(new Uint8Array(headerBuf));

    for (const r of this._records) {
      const idBytes = enc.encode(r.id);
      const metaBytes = enc.encode(JSON.stringify(r.meta ?? {}));

      // id_len (2) + idBytes + meta_len (4) + metaBytes + vector (dim * 4)
      const recPrefixBuf = new ArrayBuffer(2);
      new DataView(recPrefixBuf).setUint16(0, idBytes.length, true);
      parts.push(new Uint8Array(recPrefixBuf));
      parts.push(idBytes);

      const metaPrefixBuf = new ArrayBuffer(4);
      new DataView(metaPrefixBuf).setUint32(0, metaBytes.length, true);
      parts.push(new Uint8Array(metaPrefixBuf));
      parts.push(metaBytes);

      const vecBuf = new ArrayBuffer(this.dim * 4);
      const vecView = new DataView(vecBuf);
      for (let d = 0; d < this.dim; d++) {
        vecView.setFloat32(d * 4, r.vector[d], true);
      }
      parts.push(new Uint8Array(vecBuf));
    }

    const totalLen = parts.reduce((acc, p) => acc + p.length, 0);
    const result = new Uint8Array(totalLen);
    let offset = 0;
    for (const p of parts) {
      result.set(p, offset);
      offset += p.length;
    }
    return result;
  }

  /**
   * Deserializes an RvfStore from agentbbs.rvf.v1 binary data.
   */
  public static fromBytes(data: Uint8Array): RvfStore {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    if (data.byteLength < 18) {
      throw new Error('Invalid RVF data: buffer too small for header');
    }

    // Check magic
    for (let i = 0; i < 8; i++) {
      if (data[i] !== MAGIC[i]) {
        throw new Error('Invalid RVF magic bytes');
      }
    }

    const version = view.getUint16(8, true);
    if (version !== VERSION) {
      throw new Error(`Unsupported RVF version: ${version}`);
    }

    const dim = view.getUint32(10, true);
    const count = view.getUint32(14, true);

    const store = new RvfStore(dim);
    const dec = new TextDecoder();
    let offset = 18;

    for (let i = 0; i < count; i++) {
      if (offset + 2 > data.byteLength) throw new Error('Truncated RVF record id length');
      const idLen = view.getUint16(offset, true);
      offset += 2;

      if (offset + idLen > data.byteLength) throw new Error('Truncated RVF record id');
      const id = dec.decode(data.subarray(offset, offset + idLen));
      offset += idLen;

      if (offset + 4 > data.byteLength) throw new Error('Truncated RVF record meta length');
      const metaLen = view.getUint32(offset, true);
      offset += 4;

      if (offset + metaLen > data.byteLength) throw new Error('Truncated RVF record meta');
      const metaStr = dec.decode(data.subarray(offset, offset + metaLen));
      const meta = JSON.parse(metaStr || '{}');
      offset += metaLen;

      if (offset + dim * 4 > data.byteLength) throw new Error('Truncated RVF record vector');
      const vec: number[] = new Array(dim);
      for (let d = 0; d < dim; d++) {
        vec[d] = view.getFloat32(offset + d * 4, true);
      }
      offset += dim * 4;

      store.upsert({ id, vector: vec, meta });
    }

    return store;
  }
}

// SplitMix64 generator for deterministic LSH hyperplanes
function splitmix64(state: { s: bigint }): bigint {
  state.s = (state.s + 0x9e3779b97f4a7c15n) & 0xffffffffffffffffn;
  let z = state.s;
  z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & 0xffffffffffffffffn;
  z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & 0xffffffffffffffffn;
  return (z ^ (z >> 31n)) & 0xffffffffffffffffn;
}

function generateLshPlanes(dim: number, bitsCount = 64, seed = 0xa9e52026c0ffee01n): number[][] {
  const state = { s: seed };
  const planes: number[][] = [];
  const divisor = Number(1n << 53n);

  for (let b = 0; b < bitsCount; b++) {
    const plane: number[] = new Array(dim);
    for (let d = 0; d < dim; d++) {
      const u = Number(splitmix64(state) >> 11n) / divisor;
      plane[d] = u * 2.0 - 1.0;
    }
    planes.push(plane);
  }
  return planes;
}

function computeLshSig(planes: number[][], v: number[]): bigint {
  let sig = 0n;
  for (let i = 0; i < planes.length; i++) {
    const p = planes[i];
    let dot = 0;
    for (let d = 0; d < p.length; d++) {
      dot += p[d] * v[d];
    }
    if (dot >= 0) {
      sig |= 1n << BigInt(i);
    }
  }
  return sig;
}

function popcount64(val: bigint): number {
  let count = 0;
  let v = val;
  while (v > 0n) {
    if ((v & 1n) === 1n) count++;
    v >>= 1n;
  }
  return count;
}

export class LshIndex {
  public readonly dim: number;
  private readonly planes: number[][];
  private readonly sigs: bigint[];

  constructor(dim: number, planes: number[][], sigs: bigint[]) {
    this.dim = dim;
    this.planes = planes;
    this.sigs = sigs;
  }

  public static build(store: RvfStore): LshIndex {
    const planes = generateLshPlanes(store.dim, 64);
    const sigs: bigint[] = store.records.map((r) => computeLshSig(planes, r.vector));
    return new LshIndex(store.dim, planes, sigs);
  }

  public computeSignature(v: number[]): bigint {
    return computeLshSig(this.planes, v);
  }

  public search(
    store: RvfStore,
    query: number[],
    topK = 10,
    maxCandidates = 50
  ): RvfHit[] {
    if (query.length !== this.dim) {
      throw new Error(`Query vector dimension mismatch: expected ${this.dim}, got ${query.length}`);
    }

    if (this.sigs.length !== store.records.length) {
      // Stale index fallback to exact scan
      return store.search(query, topK);
    }

    const qSig = computeLshSig(this.planes, query);

    const candidates = this.sigs.map((sig, idx) => ({
      index: idx,
      hamming: popcount64(sig ^ qSig)
    }));

    candidates.sort((a, b) => a.hamming - b.hamming);

    const limit = Math.min(candidates.length, Math.max(topK, maxCandidates));
    const selected = candidates.slice(0, limit);

    const qNorm = Math.sqrt(query.reduce((acc, v) => acc + v * v, 0));
    const hits: RvfHit[] = selected.map((c) => {
      const rec = store.records[c.index];
      return {
        id: rec.id,
        score: cosineSimilarity(query, rec.vector, qNorm),
        meta: rec.meta
      };
    });

    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, topK);
  }
}
