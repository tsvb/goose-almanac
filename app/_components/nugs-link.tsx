"use client";

import type { ReactNode } from "react";

/**
 * Anchor to an `applenugs://` deep link. On click it lets the browser attempt the
 * scheme; if the app doesn't take focus shortly, it sends the user to the web
 * fallback. If the app opens, the page is backgrounded → the fallback is cancelled.
 * Progressive enhancement: with JS off, the anchor still attempts the scheme.
 */
export function NugsLink({
  href, fallback, className, title, children,
}: { href: string; fallback: string; className?: string; title?: string; children: ReactNode }) {
  function handleClick() {
    let cancelled = false;
    const cancel = () => { cancelled = true; };
    window.addEventListener("blur", cancel, { once: true });
    document.addEventListener("visibilitychange", cancel, { once: true });
    window.setTimeout(() => {
      window.removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", cancel);
      if (!cancelled && document.visibilityState === "visible") {
        window.location.href = fallback;
      }
    }, 1200);
  }
  return (
    <a href={href} title={title} className={className} data-fallback={fallback} onClick={handleClick}>
      {children}
    </a>
  );
}
