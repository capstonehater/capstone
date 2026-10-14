const POLL_INTERVAL = 15000;
const MAX_RETRY_INTERVAL = 5 * 60 * 1000;
const REQUEST_TIMEOUT = 10000;

/** One read at a time; events never bypass the cooldown or error backoff. */
export function createNotificationPoller<T>({ request, onSnapshot, isVisible }: {
  request: (signal: AbortSignal) => Promise<T>;
  onSnapshot: (snapshot: T) => void;
  isVisible: () => boolean;
}) {
  let stopped = false;
  let busy = false;
  let nextAllowed = 0;
  let retryInterval = POLL_INTERVAL;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;

  function schedule(delay: number) {
    if (stopped) return;
    clearTimeout(timer);
    timer = setTimeout(() => void refresh(), delay);
  }

  async function refresh() {
    if (stopped || busy) return;
    if (Date.now() < nextAllowed) {
      schedule(nextAllowed - Date.now());
      return;
    }
    if (!isVisible()) {
      schedule(POLL_INTERVAL);
      return;
    }
    busy = true;
    clearTimeout(timer);
    controller = new AbortController();
    timeout = setTimeout(() => controller?.abort(), REQUEST_TIMEOUT);
    try {
      const snapshot = await request(controller.signal);
      if (stopped || controller.signal.aborted) return;
      onSnapshot(snapshot);
      retryInterval = POLL_INTERVAL;
    } catch {
      retryInterval = Math.min(retryInterval * 2, MAX_RETRY_INTERVAL);
    } finally {
      clearTimeout(timeout);
      busy = false;
      nextAllowed = Date.now() + retryInterval;
      schedule(retryInterval);
    }
  }

  return {
    refresh,
    stop() {
      stopped = true;
      clearTimeout(timer);
      clearTimeout(timeout);
      controller?.abort();
    },
  };
}
