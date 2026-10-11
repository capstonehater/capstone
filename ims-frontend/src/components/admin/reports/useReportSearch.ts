"use client";

import { useEffect, useState } from "react";

export default function useReportSearch(value: string) {
  const [search, setSearch] = useState(value);
  useEffect(() => {
    const timeout = window.setTimeout(() => setSearch(value.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [value]);
  return search;
}
