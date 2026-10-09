"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/questions", label: "기출 문항" },
  { href: "/universities", label: "대학별 면접" },
  { href: "/admissions", label: "입시결과" },
  { href: "/practice", label: "모의 면접" },
  { href: "/record", label: "생기부 예상 질문" },
  { href: "/notes", label: "내 노트" },
];

export default function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto text-sm">
      {LINKS.map((l) => {
        const active = pathname === l.href || pathname.startsWith(l.href + "/");
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`shrink-0 rounded-lg px-3 py-1.5 font-semibold transition-colors ${
              active ? "bg-accent-soft text-accent" : "text-muted hover:text-foreground"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
