import { useState } from "react";
import { CalendarDays } from "lucide-react-native";
import { Image, View } from "react-native";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

/**
 * Falls back to the branded placeholder icon when there's no imageUrl, or
 * when the image fails to load- offline browsing shows cached event text
 * fine (SQLite cache), but cached data doesn't include image bytes, so a
 * failed/offline image load is an expected case here, not an error state.
 */
export function EventImage({
  uri,
  className,
  iconSize = 28,
}: {
  uri: string | null;
  className?: string;
  iconSize?: number;
}) {
  const [failed, setFailed] = useState(false);

  if (!uri || failed) {
    return (
      <View className={cn("bg-primary items-center justify-center", className)}>
        <Icon as={CalendarDays} size={iconSize} className="text-primary-foreground" />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      className={className}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  );
}
