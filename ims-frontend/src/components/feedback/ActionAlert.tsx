"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type ActionAlertProps = {
  tone: "success" | "error";
  title: string;
  message: string;
  onDismiss?: () => void;
};

export default function ActionAlert({ tone, title, message, onDismiss }: ActionAlertProps) {
  const success = tone === "success";
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const dismiss = useCallback(() => {
    if (closing) return;
    setClosing(true);
    closeTimer.current = window.setTimeout(() => onDismiss?.(), 400);
  }, [closing, onDismiss]);
  useEffect(() => {
    if (!onDismiss) return;
    const timer = window.setTimeout(dismiss, 5000);
    return () => {
      window.clearTimeout(timer);
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
  }, [dismiss, onDismiss]);

  return (
    <div role={success ? "status" : "alert"} className={`action-alert fixed left-1/2 top-6 z-[100] w-[min(760px,calc(100vw-2rem))] overflow-hidden rounded-[14px] bg-white shadow-[0_10px_30px_rgba(0,0,0,.15)] ${closing ? "action-alert-closing" : ""}`}>
      <div className="flex items-center gap-4 p-[18px]">
        <div className={`flex h-[45px] w-[45px] shrink-0 items-center justify-center rounded-full border-[3px] text-2xl ${success ? "border-[#a5dc86] text-[#65b741]" : "border-[#f8bb86] text-[#f39c12]"}`}>{success ? <CheckCircle2 size={25} /> : <XCircle size={25} />}</div>
        <div className="min-w-0 flex-1"><p className="mb-1 text-[17px] font-bold text-slate-900">{title}</p><p className="text-sm text-[#777]">{message}</p></div>
        {onDismiss ? <button type="button" onClick={dismiss} aria-label="Dismiss notification" className="border-0 bg-transparent text-2xl text-[#aaa] hover:text-slate-700">×</button> : null}
      </div>
      <div className="h-[5px] bg-[#eee]"><div className={`h-full ${success ? "bg-[#65b741]" : "bg-[#f39c12]"} action-alert-progress`} /></div>
      <style jsx global>{` .action-alert { transform: translate(-50%, -140%); animation: actionAlertShow .4s ease-out forwards; } .action-alert.action-alert-closing { animation: actionAlertHide .4s ease-in forwards; } .action-alert-progress { width: 100%; animation: actionAlertTimer 5s linear forwards; } @keyframes actionAlertShow { from { opacity: 0; transform: translate(-50%, -140%); } to { opacity: 1; transform: translate(-50%, 0); } } @keyframes actionAlertHide { from { opacity: 1; transform: translate(-50%, 0); } to { opacity: 0; transform: translate(-50%, -140%); } } @keyframes actionAlertTimer { from { width: 100%; } to { width: 0%; } } `}</style>
    </div>
  );
}
