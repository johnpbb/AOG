"use client";

import { useRef, useState, useCallback } from "react";
import { Upload, X, ImageIcon, Loader2, AlertCircle, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface BannerUploaderProps {
  /** Current banner URL (from DB) */
  value: string;
  /** Called with the new URL whenever it changes */
  onChange: (url: string) => void;
}

type Tab = "upload" | "url";

export function BannerUploader({ value, onChange }: BannerUploaderProps) {
  const [tab, setTab] = useState<Tab>("upload");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(
    async (file: File) => {
      setError(null);
      setUploading(true);

      const form = new FormData();
      form.append("file", file);

      try {
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Upload failed.");
          return;
        }

        onChange(data.url);
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setUploading(false);
      }
    },
    [onChange]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) upload(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleRemove = () => {
    onChange("");
    setError(null);
  };

  return (
    <div className="space-y-3">
      {/* Tab switcher */}
      <div className="flex rounded-lg border border-border overflow-hidden w-fit">
        <button
          type="button"
          onClick={() => setTab("upload")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors",
            tab === "upload"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary"
          )}
        >
          <Upload className="h-3.5 w-3.5" />
          Upload File
        </button>
        <button
          type="button"
          onClick={() => setTab("url")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors border-l border-border",
            tab === "url"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary"
          )}
        >
          <Link2 className="h-3.5 w-3.5" />
          Enter URL
        </button>
      </div>

      {/* URL tab */}
      {tab === "url" && (
        <Input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://example.com/banner.jpg"
        />
      )}

      {/* Upload tab */}
      {tab === "upload" && (
        <>
          {/* Current preview */}
          {value && (
            <div className="relative rounded-lg overflow-hidden border border-border group">
              <img
                src={value}
                alt="Banner preview"
                className="w-full h-40 object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleRemove}
                  className="gap-1.5"
                >
                  <X className="h-3.5 w-3.5" />
                  Remove
                </Button>
              </div>
            </div>
          )}

          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => !uploading && inputRef.current?.click()}
            className={cn(
              "relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-all",
              isDragging
                ? "border-primary bg-primary/5 scale-[1.01]"
                : uploading
                ? "border-border bg-secondary/40 cursor-not-allowed"
                : "border-border hover:border-primary/50 hover:bg-secondary/30"
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              onChange={handleFileChange}
              disabled={uploading}
            />

            {uploading ? (
              <>
                <div className="relative">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 text-primary animate-spin" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Uploading…</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Please wait</p>
                </div>
              </>
            ) : (
              <>
                <div
                  className={cn(
                    "h-12 w-12 rounded-full flex items-center justify-center transition-colors",
                    isDragging ? "bg-primary/20" : "bg-secondary"
                  )}
                >
                  <ImageIcon
                    className={cn(
                      "h-6 w-6 transition-colors",
                      isDragging ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {isDragging ? "Drop image here" : "Click or drag & drop an image"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    JPEG, PNG, WebP, GIF · Max 10 MB
                  </p>
                </div>
                {value && (
                  <p className="text-xs text-primary font-medium">
                    ↑ Click to replace current banner
                  </p>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
