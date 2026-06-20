import { buildLogoSting } from "./template.js";

// Preview/example with a sample mark (a self-contained star — no network).
// Real stings come from generate.mts:
//   npx tsx labs/logo-sting/generate.mts <brand-slug | logo.svg>
export default buildLogoSting({
  name: "reframe",
  viewBox: { minX: 0, minY: 0, w: 24, h: 24 },
  paths: [
    { d: "M12 1.5l3.09 6.26 6.91 1-5 4.87 1.18 6.88L12 17.27l-6.18 3.24L7 13.63l-5-4.87 6.91-1z", fill: "#58A6FF" },
  ],
});
