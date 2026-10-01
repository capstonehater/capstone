import { useAuthStore } from "@/store/authStore";

// Accept a deferred request, never an already-started promise. Check the latest
// snapshot at invocation, including refreshes and background work.
export async function loadIfAllowed<T>(permission: string, request: () => Promise<T>, fallback: T): Promise<T> {
  return useAuthStore.getState().can(permission) ? request() : fallback;
}
