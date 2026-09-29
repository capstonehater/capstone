"use client";

import { useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// Unwrap page containers (including the extra reports layout) without adding
// DOM wrappers that could change flex sizing or scrolling.
function pageSections(container: HTMLElement): HTMLElement[] {
  const children = Array.from(container.children).filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement &&
      !child.matches('script, style, [hidden], [role="dialog"], [aria-modal="true"]') &&
      !["fixed", "absolute"].includes(getComputedStyle(child).position),
  );

  if (children.length === 1 && children[0].matches("div, section")) {
    const nested = pageSections(children[0]);
    if (nested.length) return nested;
  }

  return children;
}

export function useAdminPageEntrance() {
  const contentRef = useRef<HTMLElement>(null);
  const pathname = usePathname();

  useLayoutEffect(() => {
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const animations: Animation[] = [];
    const cancelAnimations = () => animations.forEach(animation => animation.cancel());
    // Start before paint so content cannot flash visible before fading in.
    // Read all existing animations before starting any new ones.
    {
      if (!contentRef.current || motionPreference.matches) return;

      const sections = pageSections(contentRef.current).filter(section => {
        // Keep existing card and forecasting entrance animations intact.
        const hasEntrance = section.getAnimations({ subtree: true }).some(
          animation => animation instanceof CSSAnimation,
        );
        return !hasEntrance;
      });

      sections.forEach((section, index) => {
        animations.push(section.animate(
          [
            { opacity: 0, transform: "translateY(8px)" },
            { opacity: 1, transform: "none" },
          ],
          {
            duration: 700,
            delay: Math.min(index, 6) * 45,
            easing: "cubic-bezier(0.16, 1, 0.3, 1)",
            fill: "backwards",
          },
        ));
      });
    }

    motionPreference.addEventListener("change", cancelAnimations);
    return () => {
      cancelAnimations();
      motionPreference.removeEventListener("change", cancelAnimations);
    };
  }, [pathname]);

  return contentRef;
}
