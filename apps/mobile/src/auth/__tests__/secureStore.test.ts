import * as SecureStore from 'expo-secure-store';
import { createChunkedSecureStore, chunkedSecureStore, sanitizeKey } from '../secureStore';

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  const MAX_BYTES = 2048;

  function ensureValidKey(key: string) {
    if (typeof key !== 'string' || !/^[\w.-]+$/.test(key)) {
      throw new Error(
        `Invalid key provided to SecureStore. Keys must not be empty and contain only alphanumeric characters, ".", "-", and "_".`
      );
    }
  }

  return {
    getItemAsync: jest.fn(async (key: string) => {
      ensureValidKey(key);
      return store.has(key) ? store.get(key)! : null;
    }),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      ensureValidKey(key);
      // Simulate native SecureStore 2KB limit per key
      if (Buffer.byteLength(value, 'utf8') > MAX_BYTES) {
        throw new Error(`SecureStore limit exceeded: payload size is > ${MAX_BYTES} bytes`);
      }
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      ensureValidKey(key);
      store.delete(key);
    }),
    __store: store,
    __clear: () => store.clear(),
  };
});

describe('ChunkedSecureStore', () => {
  beforeEach(() => {
    (SecureStore as unknown as { __clear: () => void }).__clear();
    jest.clearAllMocks();
  });

  it('rejects keys with ":" in SecureStore native layer (demonstrating why old keys failed)', async () => {
    await expect(SecureStore.setItemAsync('my-key:manifest', 'val')).rejects.toThrow(
      'Invalid key provided to SecureStore'
    );
    await expect(SecureStore.getItemAsync('my-key:chunk:0')).rejects.toThrow(
      'Invalid key provided to SecureStore'
    );
    await expect(SecureStore.deleteItemAsync('my-key:manifest')).rejects.toThrow(
      'Invalid key provided to SecureStore'
    );
  });

  it('stores and retrieves payloads smaller than 2 KB', async () => {
    const key = 'test-small';
    const payload = JSON.stringify({ token: 'abc-123', user: 'test@example.com' });

    await chunkedSecureStore.setItem(key, payload);
    const retrieved = await chunkedSecureStore.getItem(key);

    expect(retrieved).toBe(payload);
  });

  it('stores and retrieves payloads larger than 2 KB (> 2048 bytes) in chunks without exceeding native limit', async () => {
    const key = 'test-large-session';
    // Create a realistic large Supabase session payload > 4 KB
    const largeObject = {
      access_token: 'jwt-header.' + 'a'.repeat(2500) + '.jwt-signature',
      refresh_token: 'refresh-' + 'b'.repeat(1000),
      user: {
        id: 'user-uuid-12345',
        email: 'freelancer@example.com',
        user_metadata: {
          full_name: 'Haseela Freelancer',
          bio: 'Long description '.repeat(50),
        },
      },
    };
    const largePayload = JSON.stringify(largeObject);
    expect(Buffer.byteLength(largePayload, 'utf8')).toBeGreaterThan(2048);

    // Storing via chunkedSecureStore must succeed without throwing the mocked 2KB limit error
    await chunkedSecureStore.setItem(key, largePayload);

    // Verify it was chunked into multiple keys matching valid key regex
    const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;
    expect(store.has(`${key}.manifest`)).toBe(true);
    expect(store.has(`${key}.chunk.0`)).toBe(true);
    expect(store.has(`${key}.chunk.1`)).toBe(true);

    // Verify all keys in store comply with expo-secure-store requirements (no colons)
    for (const storedKey of store.keys()) {
      expect(/^[\w.-]+$/.test(storedKey)).toBe(true);
      expect(storedKey).not.toContain(':');
    }

    // Retrieve and verify perfect round-trip fidelity
    const retrieved = await chunkedSecureStore.getItem(key);
    expect(retrieved).toBe(largePayload);
    expect(JSON.parse(retrieved!)).toEqual(largeObject);
  });

  it('cleans up previous leftover chunks when replacing with a smaller payload', async () => {
    const key = 'test-shrink';
    const largePayload = 'X'.repeat(3500); // 4 chunks with 1024 chunk size
    await chunkedSecureStore.setItem(key, largePayload);

    const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;
    expect(store.has(`${key}.chunk.3`)).toBe(true);

    // Now overwrite with a small payload (1 chunk)
    const smallPayload = 'small';
    await chunkedSecureStore.setItem(key, smallPayload);

    expect(store.has(`${key}.chunk.0`)).toBe(true);
    expect(store.has(`${key}.chunk.1`)).toBe(false);
    expect(store.has(`${key}.chunk.2`)).toBe(false);
    expect(store.has(`${key}.chunk.3`)).toBe(false);

    const retrieved = await chunkedSecureStore.getItem(key);
    expect(retrieved).toBe(smallPayload);
  });

  it('removes all chunks and manifest when removeItem is called', async () => {
    const key = 'test-remove';
    const largePayload = 'Y'.repeat(3000);
    await chunkedSecureStore.setItem(key, largePayload);

    const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;
    expect(store.has(`${key}.manifest`)).toBe(true);
    expect(store.has(`${key}.chunk.0`)).toBe(true);

    await chunkedSecureStore.removeItem(key);

    expect(store.has(`${key}.manifest`)).toBe(false);
    expect(store.has(`${key}.chunk.0`)).toBe(false);
    expect(store.has(`${key}.chunk.1`)).toBe(false);

    const retrieved = await chunkedSecureStore.getItem(key);
    expect(retrieved).toBeNull();
  });

  it('defensively sanitizes keys containing invalid characters like ":"', async () => {
    const invalidKey = 'sb:project-ref:auth-token';
    const payload = JSON.stringify({ token: 'xyz-789' });

    await chunkedSecureStore.setItem(invalidKey, payload);

    const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;
    for (const storedKey of store.keys()) {
      expect(/^[\w.-]+$/.test(storedKey)).toBe(true);
      expect(storedKey).not.toContain(':');
    }

    const retrieved = await chunkedSecureStore.getItem(invalidKey);
    expect(retrieved).toBe(payload);
  });

  it('logs an error and returns null when getItem encounters an error', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(
      new Error('Hardware security module failure')
    );

    const result = await chunkedSecureStore.getItem('failing-key');
    expect(result).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to get item from SecureStore for key: failing-key'),
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  it('falls back to unchunked direct key for backward compatibility', async () => {
    const key = 'legacy-key';
    const legacyValue = 'legacy-stored-token';
    const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;
    store.set(key, legacyValue);

    const retrieved = await chunkedSecureStore.getItem(key);
    expect(retrieved).toBe(legacyValue);
  });
});
