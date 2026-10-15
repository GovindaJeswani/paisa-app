"use client";

import { icons, type LucideIcon } from "lucide-react";
import { getCategoryById, getCategoryColor, getCategoryColorBg, getCategoryIcon, resolveLegacyCategory } from "@/lib/categories";

/**
 * CategoryIcon — renders a Lucide icon for a category.
 *
 * Accepts either a new category ID ("food") or a legacy emoji string ("🍽️ Food").
 * Falls back gracefully to a generic icon if not found.
 */

interface CategoryIconProps {
  /** Category ID (e.g. "food") or legacy string (e.g. "🍽️ Food") */
  category: string;
  /** Override icon name */
  iconName?: string;
  /** Size in px */
  size?: number;
  /** Show background circle */
  showBackground?: boolean;
  /** Additional className */
  className?: string;
}

export function CategoryIcon({ category, iconName, size = 18, showBackground = false, className = "" }: CategoryIconProps) {
  const resolvedIconName = iconName || getCategoryIcon(category);
  const color = getCategoryColor(category);
  const bgColor = getCategoryColorBg(category);

  // Dynamically resolve the Lucide icon component
  const IconComponent = (icons as Record<string, LucideIcon>)[resolvedIconName] || (icons as Record<string, LucideIcon>)["Ellipsis"];

  if (showBackground) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl shrink-0 ${className}`}
        style={{ width: size + 16, height: size + 16, backgroundColor: bgColor }}
      >
        <IconComponent size={size} style={{ color }} strokeWidth={2} />
      </div>
    );
  }

  return <IconComponent size={size} style={{ color }} strokeWidth={2} className={className} />;
}

/**
 * Get a Lucide icon component by name (for dynamic rendering).
 */
export function getLucideIcon(name: string): LucideIcon {
  return (icons as Record<string, LucideIcon>)[name] || (icons as Record<string, LucideIcon>)["Ellipsis"];
}
