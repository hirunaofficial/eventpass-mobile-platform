import { CalendarDays } from "lucide-react-native";
import { Image, View } from "react-native";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

// Self-authored category illustrations, bundled with the app (not fetched
// from anywhere)- see app/src/assets/event-categories/. Metro needs each
// require() to be a static literal, so this can't be built dynamically
// from `imageKey`.
const CATEGORY_IMAGES: Record<string, number> = {
  tech: require("@/assets/event-categories/tech.png"),
  music: require("@/assets/event-categories/music.png"),
  art: require("@/assets/event-categories/art.png"),
  business: require("@/assets/event-categories/business.png"),
  comedy: require("@/assets/event-categories/comedy.png"),
  wellness: require("@/assets/event-categories/wellness.png"),
  film: require("@/assets/event-categories/film.png"),
  sports: require("@/assets/event-categories/sports.png"),
  food: require("@/assets/event-categories/food.png"),
  workshop: require("@/assets/event-categories/workshop.png"),
  classical: require("@/assets/event-categories/classical.png"),
};

/**
 * Falls back to the branded placeholder icon when imageKey is missing or
 * unrecognized. Bundled locally, so unlike a remote image this works fully
 * offline- no network dependency, no loading/failure state to handle.
 */
export function EventImage({
  imageKey,
  className,
  iconSize = 28,
}: {
  imageKey: string | null;
  className?: string;
  iconSize?: number;
}) {
  const source = imageKey ? CATEGORY_IMAGES[imageKey] : undefined;

  if (!source) {
    return (
      <View className={cn("bg-primary items-center justify-center", className)}>
        <Icon as={CalendarDays} size={iconSize} className="text-primary-foreground" />
      </View>
    );
  }

  return <Image source={source} className={className} resizeMode="cover" />;
}
