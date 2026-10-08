import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge has to be told about custom `fontSize` keys.
 *
 * `text-*` is ambiguous- it is both a font-size and a text-colour
 * utility- so tailwind-merge decides which group a class belongs to by
 * recognising the value. It knows the built-in sizes (`text-base`,
 * `text-xl`), but not ours, so `text-eyebrow` was being classified as a
 * COLOUR. That made it conflict with any real colour earlier in the
 * string, and tailwind-merge resolved the conflict by deleting the
 * colour:
 *
 *   cn("text-muted-foreground font-ui text-eyebrow uppercase")
 *     -> "font-ui text-eyebrow uppercase"      // colour gone
 *
 * Every eyebrow label and the role badge therefore rendered with no
 * colour at all and fell back to default black- invisible on the dark
 * theme. Registering the custom sizes here fixes it everywhere at once,
 * rather than reordering classes at each call site.
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
