import Image from "next/image";
import { Skeleton } from "@/components/ui/skeleton";

// Shown the instant someone clicks "Book Tickets" / "Register Now". Without it
// the event page just sits there until the server responds, which on the
// shared VPS can take several seconds and looks like a dead button.
export default function Loading() {
  return (
    <div className="bg-brand-black text-brand-white min-h-screen">
      <nav className="brand-nav fixed">
        <div className="max-w-[1280px] mx-auto px-6 flex items-center h-[68px]">
          <Image src="/logos/agfj100-light.png" alt="Assemblies of God" width={52} height={52} className="object-contain" priority />
        </div>
      </nav>

      <div className="pt-[68px]">
        <Skeleton className="w-full aspect-[16/9] max-h-[max(70vh,30vw)] bg-white/5 rounded-none" />
      </div>

      <div className="max-w-[960px] mx-auto px-6 py-12 space-y-6">
        <Skeleton className="h-3 w-24 bg-white/10" />
        <Skeleton className="h-10 w-72 bg-white/10" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-64 bg-white/10" />
          <Skeleton className="h-4 w-56 bg-white/10" />
          <Skeleton className="h-4 w-80 bg-white/10" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 pt-6">
          <Skeleton className="h-28 bg-white/10" />
          <Skeleton className="h-28 bg-white/10" />
        </div>
      </div>
    </div>
  );
}
