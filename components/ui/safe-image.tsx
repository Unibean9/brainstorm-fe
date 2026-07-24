"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";
import { formatImageUrl } from "@/lib/utils/format-image-url";
import { cn } from "@/lib/utils";

export type SafeImageProps = Omit<ImageProps, "src"> & {
  src?: string | null;
  fallbackClassName?: string;
};

export function SafeImage({
  src,
  alt,
  className,
  fallbackClassName,
  ...props
}: SafeImageProps) {
  const [hasError, setHasError] = useState(false);
  const resolved = formatImageUrl(src);

  if (!resolved || hasError) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted text-muted-foreground",
          fallbackClassName ?? className
        )}
        aria-label={alt}
        role="img"
      />
    );
  }

  return (
    <Image
      {...props}
      src={resolved}
      alt={alt}
      className={className}
      onError={() => setHasError(true)}
    />
  );
}
