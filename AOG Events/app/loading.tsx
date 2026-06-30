import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen bg-brand-black">
      <div className="max-w-6xl mx-auto px-6 py-16 space-y-12">
        <div className="space-y-3">
          <Skeleton className="h-4 w-32 bg-white/10" />
          <Skeleton className="h-10 w-64 bg-white/10" />
          <Skeleton className="h-4 w-48 bg-white/10" />
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
              <Skeleton className="h-48 w-full bg-white/10 rounded-none" />
              <div className="p-5 space-y-3">
                <Skeleton className="h-5 w-3/4 bg-white/10" />
                <Skeleton className="h-4 w-1/2 bg-white/10" />
                <Skeleton className="h-2 w-full bg-white/10 mt-4" />
                <Skeleton className="h-10 w-full bg-white/10 mt-2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
