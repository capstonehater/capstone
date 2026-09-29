"use client";

import { CheckCircle2, CircleAlert, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ActionAlertProps = {
  tone: "success" | "error" | "warning";
  title: string;
  message: string;
  onDismiss?: () => void;
  placement?: "top" | "center" | "header";
};

export default function ActionAlert({ tone, title, message, onDismiss, placement = "top" }: ActionAlertProps) {
  const success = tone === "success";
  const warning = tone === "warning";
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const closingRef = useRef(false);
  const onDismissRef = useRef(onDismiss);
  useEffect(() => { onDismissRef.current = onDismiss; }, [onDismiss]);
  const dismiss = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    closeTimer.current = window.setTimeout(() => onDismissRef.current?.(), 400);
  }, []);
  useEffect(() => {
    return () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
  }, []);

  const alert = (
    <div role={success ? "status" : "alert"} className={`action-alert fixed left-1/2 ${placement === "center" ? "action-alert-centered top-1/2" : "top-6"} z-[100] w-[min(760px,calc(100vw-2rem))] overflow-hidden rounded-[14px] bg-white shadow-[0_10px_30px_rgba(0,0,0,.15)] ${closing ? "action-alert-closing" : ""}`}>
      <div className="flex items-center gap-4 p-[18px]">
        <div className={`flex h-[45px] w-[45px] shrink-0 items-center justify-center rounded-full border-[3px] text-2xl ${success ? "border-[#a5dc86] text-[#65b741]" : warning ? "border-yellow-300 bg-yellow-50 text-yellow-600" : "border-[#f8bb86] text-[#f39c12]"}`}>{success ? <CheckCircle2 size={25} /> : warning ? <CircleAlert size={25} /> : <XCircle size={25} />}</div>
        <div className="min-w-0 flex-1"><p className="mb-1 text-[17px] font-bold text-slate-900">{title}</p><p className="text-sm text-[#777]">{message}</p></div>
        {onDismiss ? <button type="button" onClick={dismiss} aria-label="Dismiss notification" className="border-0 bg-transparent text-2xl text-[#aaa] hover:text-slate-700">×</button> : null}
      </div>
      <div className="h-[5px] bg-[#eee]"><div onAnimationEnd={onDismiss ? dismiss : undefined} className={`h-full ${success ? "bg-[#65b741]" : warning ? "bg-yellow-400" : "bg-[#f39c12]"} action-alert-progress`} /></div>
      <style jsx global>{` .action-alert { --alert-rest-y: 0%; --alert-enter-y: -140%; transform: translate(-50%, var(--alert-enter-y)); animation: actionAlertShow .4s ease-out forwards; } .action-alert-centered { --alert-rest-y: -50%; --alert-enter-y: -65%; } .action-alert.action-alert-closing { animation: actionAlertHide .4s ease-in forwards; } .action-alert-progress { width: 100%; animation: actionAlertTimer 5s linear .4s forwards; } @keyframes actionAlertShow { from { opacity: 0; transform: translate(-50%, var(--alert-enter-y)); } to { opacity: 1; transform: translate(-50%, var(--alert-rest-y)); } } @keyframes actionAlertHide { from { opacity: 1; transform: translate(-50%, var(--alert-rest-y)); } to { opacity: 0; transform: translate(-50%, var(--alert-enter-y)); } } @keyframes actionAlertTimer { from { width: 100%; } to { width: 0%; } } `}</style>
    </div>
  );
  // Keep viewport alerts outside page entrance animations and transformed containers.
  return placement !== "top" && typeof document !== "undefined" ? createPortal(alert, document.body) : alert;
}
