"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  ["/", "Control Tower"],
  ["/universe", "Universe"],
  ["/board", "Expert Board"],
  ["/settings", "Workspace"],
] as const;

export function NavLinks() {
  const path = usePathname();
  return (
    <nav aria-label="Sections">
      {LINKS.map(([href, label]) => {
        const active = href === "/" ? path === "/" : path.startsWith(href) || (href === "/universe" && path.startsWith("/accounts"));
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
