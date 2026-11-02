/**
 * Minimal WebCrypto polyfill for native (Hermes has no global `crypto`).
 *
 * supabase-js PKCE needs `crypto.getRandomValues` for the code verifier and
 * `crypto.subtle.digest('SHA-256')` for the S256 challenge. Without them it
 * silently falls back to a Math.random verifier and the insecure `plain`
 * challenge method. Both are backed by expo-crypto's native implementations.
 * Existing implementations (web, or a future RN runtime) are never replaced.
 */
import * as ExpoCrypto from 'expo-crypto';
import { Platform } from 'react-native';

type IntegerTypedArray = Int8Array | Uint8Array | Uint8ClampedArray | Int16Array | Uint16Array | Int32Array | Uint32Array;

type MinimalCrypto = {
  getRandomValues: <T extends IntegerTypedArray>(array: T) => T;
  subtle: { digest: (algorithm: string | { name: string }, data: BufferSource) => Promise<ArrayBuffer> };
};

const DIGESTS: Record<string, ExpoCrypto.CryptoDigestAlgorithm> = {
  'SHA-1': ExpoCrypto.CryptoDigestAlgorithm.SHA1,
  'SHA-256': ExpoCrypto.CryptoDigestAlgorithm.SHA256,
  'SHA-384': ExpoCrypto.CryptoDigestAlgorithm.SHA384,
  'SHA-512': ExpoCrypto.CryptoDigestAlgorithm.SHA512,
};

function installCryptoPolyfill(): void {
  if (Platform.OS === 'web') return;

  const g = globalThis as { crypto?: Partial<MinimalCrypto> };
  const existing: Partial<MinimalCrypto> = g.crypto ?? {};

  const polyfill: MinimalCrypto = {
    getRandomValues:
      existing.getRandomValues ?? (<T extends IntegerTypedArray>(array: T): T => ExpoCrypto.getRandomValues(array)),
    subtle: existing.subtle ?? {
      digest: (algorithm, data) => {
        const name = typeof algorithm === 'string' ? algorithm : algorithm.name;
        const mapped = DIGESTS[name.toUpperCase()];
        if (!mapped) return Promise.reject(new Error(`Unsupported digest algorithm: ${name}`));
        return ExpoCrypto.digest(mapped, data);
      },
    },
  };

  if (existing.getRandomValues && existing.subtle) return;
  Object.defineProperty(globalThis, 'crypto', { value: { ...existing, ...polyfill }, configurable: true, writable: true });
}

installCryptoPolyfill();
