import AdminDashboardLayout from "@/components/admin/AdminDashboardLayout";

function Placeholder({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200/80 ${className}`} />;
}

export default function WorkspaceLoading() {
  return (
    <AdminDashboardLayout showHeader={false}>
      <div aria-label="Loading page" aria-busy="true" className="mx-auto w-full max-w-[1600px] space-y-6">
        <div className="space-y-3">
          <Placeholder className="h-8 w-56" />
          <Placeholder className="h-4 w-96 max-w-full" />
        </div>
        <section aria-label="Summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, index) => <div key={index} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
            <Placeholder className="h-4 w-28" />
            <Placeholder className="h-8 w-20" />
            <Placeholder className="h-3 w-36 max-w-full" />
          </div>)}
        </section>
        <section aria-label="Page content" className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => <div key={index} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
            <Placeholder className="h-5 w-40" />
            <Placeholder className="h-4 w-full" />
            <Placeholder className="h-4 w-11/12" />
            <Placeholder className="h-4 w-4/5" />
            <Placeholder className="h-24 w-full" />
          </div>)}
        </section>
      </div>
    </AdminDashboardLayout>
  );
}
