import type { Metadata } from "next";
import { SITE, getSiteUrl } from "./site";

interface BuildPageMetadataOptions {
  title: string;
  description?: string;
  path: string;
  noindex?: boolean;
}

export function buildPageMetadata({
  title,
  description,
  path,
  noindex = false,
}: BuildPageMetadataOptions): Metadata {
  const siteUrl = getSiteUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const canonical = `${siteUrl}${normalizedPath}`;
  const desc = description ?? SITE.defaultDescription;

  const socialTitle = title.includes(SITE.titleSuffix)
    ? title
    : `${title} | ${SITE.titleSuffix}`;

  return {
    title,
    description: desc,
    alternates: { canonical },
    robots: noindex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      type: "website",
      locale: SITE.locale,
      url: canonical,
      title: socialTitle,
      description: desc,
      siteName: SITE.name,
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description: desc,
    },
  };
}
