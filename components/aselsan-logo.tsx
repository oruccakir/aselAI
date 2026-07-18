"use client";

import { motion, type Transition } from "framer-motion";
import { cn } from "@/lib/utils";

const DEFAULT_SRC = "/images/asel_logo.png";

const DEFAULT_TRANSITION: Transition = {
  delay: 0.2,
  duration: 0.5,
  ease: [0.22, 1, 0.36, 1],
};

/**
 * Reusable ASELSAN wordmark. Drop it anywhere in the UI:
 *
 *   <AselsanLogo size={120} />                            // fixed height in px
 *   <AselsanLogo className="h-24 md:h-32" />              // responsive height
 *   <AselsanLogo transition={{ delay: 0, duration: 1 }} />
 *   <AselsanLogo animated={false} src="/images/other.png" />
 *
 * The default artwork is white-on-transparent, so it is inverted to dark in
 * light mode (disable with invertInLightMode={false}). Height can be given
 * either via `size` (pixels) or Tailwind classes through `className`; width
 * always scales to keep the aspect ratio.
 */
export function AselsanLogo({
  src = DEFAULT_SRC,
  size,
  className,
  transition = DEFAULT_TRANSITION,
  animated = true,
  invertInLightMode = true,
}: {
  /** Public path of the image, e.g. "/images/asel_logo.png". */
  src?: string;
  /** Height in pixels; width scales automatically. Omit to size via className. */
  size?: number;
  /** Extra classes (margins, responsive heights, ...). */
  className?: string;
  /** framer-motion transition for the fade-up entrance. */
  transition?: Transition;
  /** Set false to render without the entrance animation. */
  animated?: boolean;
  /** Invert the (white) artwork to dark in light mode. */
  invertInLightMode?: boolean;
}) {
  const resolvedSrc = src.startsWith("/")
    ? `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${src}`
    : src;

  return (
    // biome-ignore lint/performance/noImgElement: local asset; next/image adds nothing here
    <motion.img
      alt="ASELSAN"
      animate={animated ? { opacity: 1, y: 0 } : undefined}
      className={cn(
        "w-auto select-none",
        invertInLightMode && "invert dark:invert-0",
        className
      )}
      draggable={false}
      initial={animated ? { opacity: 0, y: 10 } : false}
      src={resolvedSrc}
      style={size === undefined ? undefined : { height: size }}
      transition={transition}
    />
  );
}
