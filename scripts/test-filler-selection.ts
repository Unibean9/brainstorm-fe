import assert from "node:assert/strict";

import { pickFiller } from "../hooks/useFillerThinking";

const catalog: Parameters<typeof pickFiller>[0] = [
  { name: "vi-framing", url: "/vi.wav", phase: "framing", voiceId: "vi-female-01", lang: "vi" },
  { name: "en-framing", url: "/en.wav", phase: "framing", voiceId: "en-male-01", lang: "en" },
  { name: "en-diverging", url: "/en-2.wav", phase: "diverging", voiceId: "en-male-01", lang: "en" },
];

assert.equal(
  pickFiller(catalog, "framing", "en-male-01", "en")?.lang,
  "en",
  "English must select an English filler"
);
assert.equal(
  pickFiller(catalog, "framing", "vi-female-01", "en"),
  null,
  "English must not fall back to a Vietnamese filler"
);
assert.equal(
  pickFiller(catalog, "critiquing", "en-male-01", "en")?.lang,
  "en",
  "A missing phase may fall back within the same language"
);

console.log("filler selection regression checks passed");
