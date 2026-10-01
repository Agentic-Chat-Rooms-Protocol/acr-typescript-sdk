/**
 * Universal Isomorphic Web Crypto / Node Crypto Signer & Verifier
 *
 * Implements Ed25519 key generation, signing, verification, and canonical
 * length-prefixed bytes composition across Node.js, Browsers, and Edge runtimes.
 */
const ED25519_PKCS8_PREFIX = new Uint8Array([
    0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70,
    0x04, 0x22, 0x04, 0x20
]);
function hexToBytes(hex) {
    const clean = hex.trim();
    const bytes = new Uint8Array(clean.length / 2);
    for (let i = 0; i < clean.length; i += 2) {
        bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
    }
    return bytes;
}
function bytesToHex(bytes) {
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
        hex += bytes[i].toString(16).padStart(2, '0');
    }
    return hex;
}
function toUint8Array(data) {
    if (typeof data === 'string') {
        return new TextEncoder().encode(data);
    }
    return data;
}
function concatBytes(a, b) {
    const res = new Uint8Array(a.length + b.length);
    res.set(a, 0);
    res.set(b, a.length);
    return res;
}
export class UniversalSigner {
    /**
     * Constructs canonical, versioned, length-prefixed bytes for tamper-evident signing.
     * Format:
     * header\n
     * {len}:{part_0}\n
     * {len}:{part_1}\n
     */
    static compose(header, parts) {
        const enc = new TextEncoder();
        const chunks = [enc.encode(header + '\n')];
        for (const p of parts) {
            const b = typeof p === 'string' ? enc.encode(p) : p;
            const prefix = enc.encode(`${b.length}:`);
            chunks.push(prefix);
            chunks.push(b);
            chunks.push(enc.encode('\n'));
        }
        const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
        const result = new Uint8Array(totalLen);
        let offset = 0;
        for (const c of chunks) {
            result.set(c, offset);
            offset += c.length;
        }
        return result;
    }
    /**
     * Generates a new Ed25519 keypair.
     */
    static async generateKeypair() {
        const subtle = globalThis.crypto?.subtle;
        if (!subtle) {
            throw new Error('WebCrypto subtle is not available in current environment');
        }
        const kp = (await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']));
        const rawPub = await subtle.exportKey('raw', kp.publicKey);
        const pkcs8Priv = await subtle.exportKey('pkcs8', kp.privateKey);
        const rawPriv = new Uint8Array(pkcs8Priv).subarray(16);
        return {
            publicKeyHex: bytesToHex(new Uint8Array(rawPub)),
            privateKeyHex: bytesToHex(rawPriv)
        };
    }
    /**
     * Signs data with an Ed25519 private key (raw 32 bytes hex).
     */
    static async sign(privateKeyHex, data) {
        const rawPriv = hexToBytes(privateKeyHex);
        const msg = toUint8Array(data);
        const subtle = globalThis.crypto?.subtle;
        if (!subtle) {
            throw new Error('WebCrypto subtle is not available in current environment');
        }
        const pkcs8 = concatBytes(ED25519_PKCS8_PREFIX, rawPriv);
        const privKey = await subtle.importKey('pkcs8', pkcs8.buffer, { name: 'Ed25519' }, false, ['sign']);
        const sig = await subtle.sign({ name: 'Ed25519' }, privKey, msg.buffer);
        return bytesToHex(new Uint8Array(sig));
    }
    /**
     * Verifies an Ed25519 signature against a public key (raw 32 bytes hex).
     */
    static async verify(publicKeyHex, data, signatureHex) {
        try {
            const rawPub = hexToBytes(publicKeyHex);
            const sig = hexToBytes(signatureHex);
            const msg = toUint8Array(data);
            const subtle = globalThis.crypto?.subtle;
            if (!subtle) {
                return false;
            }
            const pubKey = await subtle.importKey('raw', rawPub.buffer, { name: 'Ed25519' }, false, ['verify']);
            return await subtle.verify({ name: 'Ed25519' }, pubKey, sig.buffer, msg.buffer);
        }
        catch {
            return false;
        }
    }
    /**
     * Computes SHA-256 hex digest for content-addressing across environments.
     */
    static async sha256(data) {
        const msg = toUint8Array(data);
        const subtle = globalThis.crypto?.subtle;
        if (!subtle) {
            throw new Error('WebCrypto subtle is not available in current environment');
        }
        const hashBuf = await subtle.digest('SHA-256', msg.buffer);
        return bytesToHex(new Uint8Array(hashBuf));
    }
}
