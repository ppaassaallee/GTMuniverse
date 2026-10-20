import { Tabs } from "./ui";
import type { Database } from "@/lib/types";

export function UniverseTabs({ db, active, inbox }: { db: Database; active: string; inbox: number }) {
  return (
    <Tabs
      active={active}
      tabs={[
        { href: "/universe", label: "Universe", count: db.accounts.length },
        { href: "/universe/inbox", label: "Signal inbox", count: inbox },
        { href: "/universe/lists", label: "Lists", count: db.lists.length },
        { href: "/universe/rules", label: "Routing rules", count: db.rules.length },
        { href: "/universe/freezer", label: "Freezer", count: db.accounts.filter((a) => a.routing?.dest === "Freezer").length },
      ]}
    />
  );
}

export const freshInbox = (signalsDays: (number | null)[]) => signalsDays.filter((d) => d != null && d <= 7).length;
