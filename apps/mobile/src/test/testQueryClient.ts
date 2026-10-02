import { QueryClient, onlineManager } from '@tanstack/react-query';

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
        staleTime: 0,
      },
      mutations: {
        retry: false,
        gcTime: Infinity,
      },
    },
  });
}

export function setNetworkOnline(online: boolean) {
  onlineManager.setOnline(online);
}

export function resetNetworkOnline() {
  onlineManager.setOnline(true);
}
