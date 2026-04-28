"use client";

import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-lg">
            AGFJ
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sm leading-tight">AOG Fiji Events</span>
            <span className="text-xs text-muted-foreground leading-tight">Register for AGFJ Events</span>
          </div>
        </Link>

        <Link
          href="/admin"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Admin Dashboard
        </Link>
      </div>
    </header>
  );
}
