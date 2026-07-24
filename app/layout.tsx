import type { Metadata } from "next";
import { Open_Sans, Quicksand } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers/app-providers";
import { RootJsonLd } from "@/lib/seo/root-json-ld";
import { SITE, getSiteUrl } from "@/lib/seo/site";

const openSans = Open_Sans({
  subsets: ["latin", "vietnamese"],
  variable: "--font-open-sans",
  weight: ["300", "400", "500", "600", "700", "800"],
});

const quicksand = Quicksand({
  subsets: ["latin", "vietnamese"],
  variable: "--font-quicksand",
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: SITE.name,
    template: `%s | ${SITE.titleSuffix}`,
  },
  description: SITE.defaultDescription,
  keywords: [
    "brainstorm",
    "AI facilitator",
    "thinking orchestration",
    "ideation",
    "workshop",
    "collaboration",
    "thinking trace",
  ],
  openGraph: {
    type: "website",
    locale: SITE.locale,
    url: getSiteUrl(),
    title: SITE.name,
    description: SITE.defaultDescription,
    siteName: SITE.name,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE.name,
    description: SITE.defaultDescription,
  },
  robots: { index: true, follow: true },
  alternates: {
    canonical: getSiteUrl(),
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="vi"
      className={`${openSans.variable} ${quicksand.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">
        <RootJsonLd />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
