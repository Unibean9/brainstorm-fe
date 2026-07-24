import { getSiteUrlFromRequest } from "./request-site-url";
import { SITE } from "./site";

export async function RootJsonLd() {
  const siteUrl = await getSiteUrlFromRequest();

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: SITE.name,
        url: siteUrl,
        description: SITE.defaultDescription,
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name: SITE.name,
        description: SITE.defaultDescription,
        publisher: { "@id": `${siteUrl}/#organization` },
        inLanguage: "vi",
      },
      {
        "@type": "ItemList",
        "@id": `${siteUrl}/#brainstorm-flow`,
        name: "Thinking Orchestration Flow",
        description:
          "Observe → Analyze → Diagnose → Select Thinking State → Choose Technique → Facilitate → Capture Thinking Trace",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Problem Framing",
            url: `${siteUrl}/rooms`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Brainstorm Sessions",
            url: `${siteUrl}/rooms`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: "Thinking Trace",
            url: `${siteUrl}/workspace`,
          },
        ],
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
