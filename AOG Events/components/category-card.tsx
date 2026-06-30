"use client";

import { cn } from "@/lib/utils";
import { CategoryInfo } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Building, Globe, Users, User, Sprout, ChevronRight } from "lucide-react";

interface CategoryCardProps {
  category: CategoryInfo;
  isSelected: boolean;
  onSelect: (category: CategoryInfo) => void;
}

const iconMap = {
  building: Building,
  globe: Globe,
  users: Users,
  user: User,
  sprout: Sprout,
};

export function CategoryCard({ category, isSelected, onSelect }: CategoryCardProps) {
  const Icon = iconMap[category.icon as keyof typeof iconMap] || Building;

  return (
    <button
      onClick={() => onSelect(category)}
      aria-pressed={isSelected}
      className={cn(
        "w-full text-left p-4 rounded-lg border transition-all duration-200 group",
        "hover:border-primary/50 hover:bg-secondary/50",
        isSelected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border bg-card"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors",
              isSelected
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-medium text-foreground">{category.name}</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {category.description}
            </p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge variant={category.type === "church" ? "secondary" : "success"}>
                {category.type === "church" ? "Church Registration" : "Individual Registration"}
              </Badge>
              <Badge variant="outline" className="font-mono">
                Code: {category.categoryCode}
              </Badge>
            </div>
            {isSelected && (
              <div className="mt-3 p-3 rounded-lg bg-secondary/60 text-xs text-muted-foreground space-y-1">
                <p>
                  Registration limit:{" "}
                  {category.registrationLimit === null ? "No cap" : `${category.registrationLimit} registrations`}
                </p>
                <p>Total seats available in this category: {category.ticketPool.toLocaleString()}</p>
                <p>Registration fee: ${category.fee.toLocaleString()} FJD</p>
              </div>
            )}
          </div>
        </div>
        <ChevronRight
          className={cn(
            "h-5 w-5 shrink-0 text-muted-foreground transition-transform",
            isSelected ? "text-primary" : "group-hover:translate-x-1"
          )}
        />
      </div>
    </button>
  );
}
