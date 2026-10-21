"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; n?: string; label: string; hint: string; count?: number; match?: string[] };

export function NavLinks({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Stages">
      {items.map((it) => {
        const active = it.href === "/" ? path === "/" : [it.href, ...(it.match || [])].some((h) => path.startsWith(h));
        return (
          <Link key={it.href} href={it.href} aria-current={active ? "page" : undefined}>
            <span className="nav-n">{it.n || "·"}</span>
            <span className="nav-t">
              <b>{it.label}</b>
              <small>{it.hint}</small>
            </span>
            {it.count != null ? <span className="count">{it.count}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
