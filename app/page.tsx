import { OnboardingWizard } from "@/components/brainstorm/onboarding-wizard";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { SITE } from "@/lib/seo/site";

export const metadata = buildPageMetadata({
  title: SITE.name,
  description: SITE.defaultDescription,
  path: "/",
});

export default function HomePage() {
  return <OnboardingWizard />;
}
