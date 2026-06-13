import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: (failureCount, error: unknown) => {
        if (error instanceof Response && error.status === 401) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      onError: (error: unknown) => {
        console.error("Mutation error:", error);
      },
    },
  },
});
