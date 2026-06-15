import { buildGhScene } from "./template.js";

// Preview/example with sample data. Real videos come from generate.mts:
//   npx tsx examples/gh-video/generate.mts <github-username>
export default buildGhScene({
  name: "Kiyeon Jeon",
  login: "kiyeonjeon21",
  bio: "AI Engineer · Building AI-native services",
  avatarSrc: "assets/avatar.png",
  repos: 45,
  stars: 10,
  followers: 7,
  languages: [
    { name: "TypeScript", n: 10, color: "#3178C6" },
    { name: "Python", n: 8, color: "#3572A5" },
    { name: "Jupyter", n: 4, color: "#DA5B0B" },
    { name: "Java", n: 3, color: "#B07219" },
    { name: "Scala", n: 1, color: "#C22D40" },
    { name: "CSS", n: 1, color: "#563D7C" },
  ],
  topRepo: { name: "mermaid-to-hyperframes", stars: 6, language: "TypeScript" },
  url: "github.com/kiyeonjeon21",
});
