import type { Icon as PhosphorIconType, IconProps, IconWeight } from "phosphor-react-native";
import { cssInterop } from "nativewind";
import * as React from "react";
import { TextClassContext } from "@/components/ui/text";
import { cn } from "@/lib/utils";

/**
 * NativeWind bridge for Phosphor icons.
 *
 * Lucide icons inherit their colour from `currentColor`, so the existing
 * <Icon> wrapper can simply hand them a className and let the resolved
 * style colour flow through. Phosphor does not - it takes an explicit
 * `color` prop - so a className alone would leave every icon its default
 * colour regardless of theme.
 *
 * `nativeStyleToProp` solves this: NativeWind resolves the className to a
 * style object as usual, then lifts `color`, `height` and `width` back
 * out of that style and passes them as real props. The result behaves
 * like the Lucide wrapper (`className="text-primary"` just works) while
 * respecting Phosphor's API.
 *
 * Phosphor is used over Lucide wherever an icon carries visual weight
 * rather than just labelling something: it ships six weights, and
 * `duotone`/`fill` are what stop an interface reading as default
 * thin-stroke iconography.
 */
type PhosphorWrapperProps = IconProps & {
  as: PhosphorIconType;
  className?: string;
};

function PhosphorImpl({ as: IconComponent, ...props }: PhosphorWrapperProps) {
  return <IconComponent {...props} />;
}

cssInterop(PhosphorImpl, {
  className: {
    target: "style",
    nativeStyleToProp: {
      height: "size",
      width: "size",
      color: "color",
    },
  },
});

function PhosphorIcon({
  as: IconComponent,
  className,
  size = 20,
  weight = "duotone",
  ...props
}: PhosphorWrapperProps & { weight?: IconWeight }) {
  const textClass = React.useContext(TextClassContext);
  return (
    <PhosphorImpl
      as={IconComponent}
      className={cn("text-foreground", textClass, className)}
      size={size}
      weight={weight}
      {...props}
    />
  );
}

export { PhosphorIcon };
