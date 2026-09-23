import { Inbox } from "lucide-react";

export default function PosReportEmpty({ message }: { message: string }) {
  return <div className="flex min-h-48 flex-col items-center justify-center gap-3 px-6 py-8 text-center"><span className="rounded-full bg-slate-100 p-3 text-slate-500"><Inbox size={28} aria-hidden="true" /></span><p className="text-sm font-medium text-slate-700">{message}</p><p className="text-xs text-slate-500">Try adjusting the date range or filters.</p></div>;
}
