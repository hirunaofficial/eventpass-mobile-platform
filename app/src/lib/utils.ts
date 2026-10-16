import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge must be told about custom `fontSize` keys.
 *
 * `text-*` is both a size and a colour utility, so tailwind-merge
 * decides the group by recognising the value. It knows `text-base`,
 * but not ours - it read `text-eyebrow` as a COLOUR and deleted the
 * real colour before it:
 *
 *   cn("text-muted-foreground font-ui text-eyebrow") // colour gone
 *
 * Every eyebrow label and the role badge then fell back to black,
 * invisible on the dark theme.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["eyebrow"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
