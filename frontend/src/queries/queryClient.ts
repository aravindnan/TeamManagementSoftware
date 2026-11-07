import { QueryClient } from "@tanstack/react-query";
import { NotSignedInError } from "./unwrap";

/**
 * Retry only what could succeed on a second try: network failures and 5xx, at most twice.
 * Client errors (401/403/404/400) are answers, not glitches, and a missing session never recovers by retrying.
 */
export const shouldRetry = (failureCount: number, error: any): boolean => {
  if (error instanceof NotSignedInError) return false;
  const status = error?.response?.status;
  if (status && status < 500) return false;
  return failureCount < 2;
};

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000, // shown instantly from cache and quietly refreshed once older than 30 s
        gcTime: 5 * 60_000,
        retry: shouldRetry,
        refetchOnWindowFocus: true,
      },
    },
  });

/** The app-wide client. Tests build their own with createQueryClient(). */
export const queryClient = createQueryClient();
