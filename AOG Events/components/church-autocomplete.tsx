"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Loader2, Building, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChurchOption {
  id: string;
  name: string;
  district: string | null;
  country: string;
  category: string | null;
}

interface ChurchAutocompleteProps {
  value: ChurchOption | null;
  onSelect: (church: ChurchOption) => void;
  country?: string; // scope the search to a specific country (e.g. WFC lookups)
  placeholder?: string;
}

export function ChurchAutocomplete({ value, onSelect, country, placeholder }: ChurchAutocompleteProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ChurchOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const params = new URLSearchParams({ q: query });
      if (country) params.set("country", country);
      const res = await fetch(`/api/churches?${params.toString()}`);
      const data = await res.json();
      setResults(data.churches ?? []);
      setLoading(false);
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, country]);

  if (value) {
    return (
      <div className="flex items-center justify-between p-3 rounded-lg border border-primary bg-primary/5">
        <div className="flex items-center gap-2 text-sm">
          <Check className="h-4 w-4 text-primary" />
          <span className="font-medium text-foreground">{value.name}</span>
          {value.district && <span className="text-muted-foreground">— {value.district}</span>}
        </div>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground underline"
          onClick={() => {
            setQuery("");
            onSelect(null as any);
          }}
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder ?? "Start typing your church name…"}
      />
      {open && query.trim() && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-popover shadow-md max-h-64 overflow-y-auto">
          {loading ? (
            <div className="p-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching…
            </div>
          ) : results.length > 0 ? (
            results.map((church) => (
              <button
                key={church.id}
                type="button"
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary transition-colors"
                )}
                onClick={() => {
                  onSelect(church);
                  setOpen(false);
                }}
              >
                <Building className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-foreground">{church.name}</span>
                {church.district && <span className="text-muted-foreground text-xs">— {church.district}</span>}
              </button>
            ))
          ) : (
            <div className="p-3 text-sm text-muted-foreground">No matching church found.</div>
          )}
        </div>
      )}
    </div>
  );
}
