"use client";

import { useEffect, useState } from "react";
import { fetchUserRoles } from "@/lib/users";

export default function UserEffectivePermissions({ userId }: { userId: string }) {
  const [permissions, setPermissions] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    fetchUserRoles(userId).then(data => { if (active) setPermissions(data.effectivePermissions); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Unable to load permissions."); });
    return () => { active = false; };
  }, [userId]);
  if (error) return <p role="alert">{error}</p>;
  if (!permissions) return <p role="status">Loading effective permissions...</p>;
  return <div className="space-y-3">
    <p className="text-sm text-slate-500">Permissions granted by all assigned roles. Server authorization may still restrict access during the rollout.</p>
    {permissions.length ? <ul className="grid gap-2 md:grid-cols-2">{permissions.map(permission => <li key={permission} className="rounded-xl border border-slate-200 p-3 text-sm">{permission}</li>)}</ul> : <p>No permissions assigned.</p>}
  </div>;
}
