import * as SecureStore from 'expo-secure-store';

export interface ChunkedSecureStoreOptions {
  chunkSize?: number;
}

const DEFAULT_CHUNK_SIZE = 1024;

/**
 * Sanitizes keys to ensure they conform to expo-secure-store's key constraint:
 * /^[\w.-]+$/ (alphanumeric characters, '.', '-', and '_').
 */
export function sanitizeKey(key: string): string {
  const sanitized = key.replace(/[^\w.-]/g, '_');
  return sanitized || 'default_key';
}

export function createChunkedSecureStore(options?: ChunkedSecureStoreOptions) {
  const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;

  return {
    async getItem(key: string): Promise<string | null> {
      try {
        const safeKey = sanitizeKey(key);
        const manifestStr = await SecureStore.getItemAsync(`${safeKey}.manifest`);
        if (manifestStr) {
          const { count } = JSON.parse(manifestStr) as { count: number };
          const chunks: string[] = [];

          for (let i = 0; i < count; i++) {
            const chunk = await SecureStore.getItemAsync(`${safeKey}.chunk.${i}`);
            if (chunk === null) {
              console.error(
                `Missing chunk ${i} for key: ${key} in SecureStore (expected ${count} chunks)`
              );
              return null;
            }
            chunks.push(chunk);
          }

          return chunks.join('');
        }

        // Fallback for non-chunked or legacy stored values
        return await SecureStore.getItemAsync(safeKey);
      } catch (err) {
        console.error(`Failed to get item from SecureStore for key: ${key}`, err);
        return null;
      }
    },

    async setItem(key: string, value: string): Promise<void> {
      try {
        const safeKey = sanitizeKey(key);
        const manifestKey = `${safeKey}.manifest`;
        const prevManifestStr = await SecureStore.getItemAsync(manifestKey);
        let prevCount = 0;
        if (prevManifestStr) {
          try {
            prevCount = (JSON.parse(prevManifestStr) as { count: number }).count ?? 0;
          } catch {
            prevCount = 0;
          }
        }

        const count = Math.ceil(value.length / chunkSize) || 1;

        for (let i = 0; i < count; i++) {
          const chunk = value.slice(i * chunkSize, (i + 1) * chunkSize);
          await SecureStore.setItemAsync(`${safeKey}.chunk.${i}`, chunk);
        }

        await SecureStore.setItemAsync(
          manifestKey,
          JSON.stringify({ count, size: value.length })
        );

        // Clean up leftover chunks if the new value has fewer chunks than before
        if (prevCount > count) {
          for (let i = count; i < prevCount; i++) {
            await SecureStore.deleteItemAsync(`${safeKey}.chunk.${i}`).catch(() => {});
          }
        }

        // Clean up any plain unchunked key if previously set
        await SecureStore.deleteItemAsync(safeKey).catch(() => {});
      } catch (err) {
        console.error(`Failed to set item in SecureStore for key: ${key}`, err);
        throw err;
      }
    },

    async removeItem(key: string): Promise<void> {
      try {
        const safeKey = sanitizeKey(key);
        const manifestKey = `${safeKey}.manifest`;
        const manifestStr = await SecureStore.getItemAsync(manifestKey);
        if (manifestStr) {
          try {
            const { count } = JSON.parse(manifestStr) as { count: number };
            for (let i = 0; i < count; i++) {
              await SecureStore.deleteItemAsync(`${safeKey}.chunk.${i}`).catch(() => {});
            }
          } catch {}
          await SecureStore.deleteItemAsync(manifestKey).catch(() => {});
        }

        await SecureStore.deleteItemAsync(safeKey).catch(() => {});
      } catch (err) {
        console.error(`Failed to remove item from SecureStore for key: ${key}`, err);
      }
    },
  };
}

export const chunkedSecureStore = createChunkedSecureStore();
