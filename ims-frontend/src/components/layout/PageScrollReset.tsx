"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

export default function PageScrollReset() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    const smallScreen = window.matchMedia("(max-width: 1279px), (pointer: coarse)");
    if (!smallScreen.matches) return;
    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    let frame = 0;
    const reset = () => {
      // Preserve links that intentionally open a section of the page.
      if (window.location.hash) return;
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      document.querySelectorAll<HTMLElement>("main").forEach(main => {
        main.scrollTo({ top: 0, left: 0, behavior: "instant" });
      });
    };
    const scheduleReset = () => {
      cancelAnimationFrame(frame);
      reset();
      frame = requestAnimationFrame(reset);
    };
    scheduleReset();
    window.addEventListener("pageshow", scheduleReset);
    window.addEventListener("load", scheduleReset);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pageshow", scheduleReset);
      window.removeEventListener("load", scheduleReset);
      window.history.scrollRestoration = previousRestoration;
    };
  }, [pathname]);

  return null;
}
