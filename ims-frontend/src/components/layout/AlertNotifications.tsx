"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, X } from "lucide-react";
import { fetchAlertNotifications } from "@/lib/alerts";
import { alertColor, alertTitle } from "@/lib/alert-presentation";
import { useAuthStore } from "@/store/authStore";
import { createNotificationPoller } from "@/lib/notification-poller";
import { createAlertNotificationFlow, suppressAlertNotifications, type AlertNotice } from "@/lib/alert-notification-flow";
import styles from "./AlertNotifications.module.css";

export default function AlertNotifications() {
  const userId = useAuthStore(state => state.user?.id);
  const canView = useAuthStore(state => state.can("alerts.view"));
  return userId && canView ? <NotificationQueue key={userId} userId={userId} /> : null;
}

function NotificationQueue({ userId }: { userId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const suppressed = suppressAlertNotifications(pathname);
  const [queue, setQueue] = useState<AlertNotice[]>([]);
  const [paused, setPaused] = useState(false);
  const [closing, setClosing] = useState<{ key: string; href?: string } | null>(null);
  const flowRef = useRef<ReturnType<typeof createAlertNotificationFlow> | null>(null);

  useEffect(() => {
    const flow = createAlertNotificationFlow(userId, Date.now());
    flowRef.current = flow;
    const isSuppressed = () => suppressAlertNotifications(window.location.pathname);
    const poller = createNotificationPoller({
      request: fetchAlertNotifications,
      isVisible: () => document.visibilityState !== "hidden",
      onSnapshot(snapshot) {
        const next = flow.ingest(snapshot, isSuppressed(), Date.now());
        setQueue(current => next.length === current.length && next.every((notice, index) => notice === current[index]) ? current : next);
      },
    });
    const refresh = () => { void poller.refresh(); };
    const viewed = (event: Event) => {
      if ((event as CustomEvent<{ userId: string }>).detail?.userId !== userId) return;
      setQueue(flow.clear(Date.now()));
      setPaused(false);
    };
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("alerts-updated", refresh);
    window.addEventListener("alerts-viewed", viewed);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      poller.stop();
      flowRef.current = null;
      window.removeEventListener("focus", refresh);
      window.removeEventListener("alerts-updated", refresh);
      window.removeEventListener("alerts-viewed", viewed);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [userId]);

  // Alerts and POS silence the sequence immediately, even before their data loads.
  useEffect(() => {
    if (suppressed) {
      flowRef.current?.clear(Date.now());
      const timer = window.setTimeout(() => { setQueue([]); setPaused(false); }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [suppressed]);

  const notice = queue[0];
  const noticeKey = notice?.key;
  const isClosing = closing?.key === noticeKey;
  useEffect(() => {
    if (!noticeKey || paused || suppressed || isClosing) return;
    const timer = window.setTimeout(() => setClosing({ key: noticeKey }), 12000);
    return () => window.clearTimeout(timer);
  }, [noticeKey, paused, suppressed, isClosing]);

  useEffect(() => {
    if (!closing) return;
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 280;
    const timer = window.setTimeout(() => {
      setPaused(false);
      if (closing.href) {
        setQueue(flowRef.current?.clear(Date.now()) ?? []);
        router.push(closing.href);
      } else {
        setQueue(flowRef.current?.advance(closing.key, Date.now()) ?? []);
      }
    }, duration);
    return () => window.clearTimeout(timer);
  }, [closing, router]);

  if (suppressed || !notice) return null;
  const href = notice.alert ? `/alerts?alert=${encodeURIComponent(notice.alert.id)}#alert-${notice.alert.id}` : notice.kind === "summary" ? "/alerts" : "/alerts?pending=1";
  const title = notice.kind === "summary"
    ? `You have ${notice.count} new alert${notice.count === 1 ? "" : "s"}`
    : notice.alert ? alertTitle(notice.alert).replace(/ batch (?=is nearing expiry$|has expired$)/i, " ") : `${notice.count} pending alert${notice.count === 1 ? "" : "s"} still need${notice.count === 1 ? "s" : ""} solving`;
  const tone = notice.alert ? styles[alertColor(notice.alert)] : styles.reminder;
  return (
    <aside key={notice.key} className={`${styles.toast} ${tone} ${isClosing ? styles.closing : ""}`} aria-label="Inventory notification" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}>
      <div role="status" aria-live="polite" className={styles.content}>
        <Bell size={22} aria-hidden="true" />
        <Link href={href} prefetch={false} className={styles.link} onClick={event => {
          if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
          event.preventDefault();
          if (!isClosing) setClosing({ key: notice.key, href });
        }}>
          <strong>{title}</strong>
        </Link>
      </div>
      <button className={styles.close} type="button" aria-label="Close notification" disabled={isClosing} onClick={() => setClosing({ key: notice.key })}><X size={18} /></button>
    </aside>
  );
}
