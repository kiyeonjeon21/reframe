import { scene, rect, text, image, group, seq, par, stagger, tween, wait, type NodeIR, type SceneIR } from "@reframe/core";

// The GitHub "developer card" reveal as a pure function of data — generate.ts
// fetches a username and feeds this; scene.ts feeds a sample for the preview.

export interface GhData {
  name: string;
  login: string;
  bio: string;
  avatarSrc: string; // scene-relative path
  repos: number;
  stars: number;
  followers: number;
  languages: { name: string; n: number; color: string }[];
  topRepo: { name: string; stars: number; language: string } | null;
  url: string;
}

const BG = "#0D1117";
const CARD = "#161B22";
const MUTED = "#8B949E";
const FG = "#E6EDF3";
const ACCENT = "#58A6FF";
const BAR_X = 100;
const BAR_W = 880;

const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

/** GitHub-style compact number: 1134, 86k, 1.2M — fits the card at any scale. */
const fmt = (v: number): string => {
  if (v < 10000) return String(v);
  if (v < 1_000_000) return `${Math.round(v / 1000)}k`;
  return `${(v / 1_000_000).toFixed(1)}M`;
};

export function buildGhScene(d: GhData): SceneIR {
  const langs = d.languages.slice(0, 6);
  const total = Math.max(1, langs.reduce((a, l) => a + l.n, 0));
  let cursor = BAR_X;
  const segs = langs.map((l) => {
    const w = (l.n / total) * BAR_W;
    const x = cursor;
    cursor += w;
    return { ...l, x, w };
  });

  const stat = (id: string, x: number, value: number, label: string): NodeIR =>
    group({ id, x, y: 660, opacity: 0, scale: 0.6 }, [
      text({ id: `${id}-n`, x: 0, y: 0, anchor: "center", content: fmt(value), fontFamily: "Inter", fontSize: 80, fontWeight: 800, fill: FG }),
      text({ id: `${id}-l`, x: 0, y: 62, anchor: "center", content: label, fontFamily: "Inter", fontSize: 26, fill: MUTED }),
    ]);

  const nodes: NodeIR[] = [
    image({ id: "avatar", src: d.avatarSrc, x: 540, y: 250, width: 220, height: 220, anchor: "center", opacity: 0, scale: 0.4 }),
    rect({ id: "ring", x: 540, y: 250, width: 240, height: 240, anchor: "center", stroke: ACCENT, strokeWidth: 4, radius: 120, opacity: 0, scale: 0.4 }),
    text({ id: "name", x: 540, y: 420, anchor: "center", content: truncate(d.name || d.login, 22), fontFamily: "Inter", fontSize: 58, fontWeight: 800, fill: FG, opacity: 0 }),
    text({ id: "handle", x: 540, y: 478, anchor: "center", content: `@${d.login}`, fontFamily: "Inter", fontSize: 30, fill: ACCENT, opacity: 0 }),
    text({ id: "bio", x: 540, y: 528, anchor: "center", content: truncate(d.bio, 52), fontFamily: "Inter", fontSize: 24, fill: MUTED, opacity: 0 }),
    stat("s-repos", 270, d.repos, "repos"),
    stat("s-stars", 540, d.stars, "stars"),
    stat("s-foll", 810, d.followers, "followers"),
    text({ id: "lang-h", x: 100, y: 800, content: "Languages", fontFamily: "Inter", fontSize: 24, fontWeight: 700, fill: MUTED, opacity: 0 }),
    rect({ id: "bar-bg", x: BAR_X, y: 836, width: BAR_W, height: 26, fill: CARD, radius: 13, opacity: 0 }),
    ...segs.map((s, i) => rect({ id: `seg-${i}`, x: s.x, y: 836, width: s.w, height: 26, fill: s.color, opacity: 0 })),
    ...segs.slice(0, 3).map((s, i) => text({ id: `ll-${i}`, x: 100 + i * 200, y: 892, content: `● ${s.name}`, fontFamily: "Inter", fontSize: 22, fill: s.color, opacity: 0 })),
    ...(d.topRepo
      ? [
          group({ id: "repo", x: 540, y: 1040, opacity: 0 }, [
            rect({ id: "repo-bg", x: -440, y: -52, width: 880, height: 104, fill: CARD, stroke: "#30363D", strokeWidth: 1, radius: 16 }),
            text({ id: "repo-name", x: -400, y: -8, content: truncate(d.topRepo.name, 28), fontFamily: "Inter", fontSize: 34, fontWeight: 700, fill: FG }),
            text({ id: "repo-meta", x: -400, y: 28, content: `★ ${fmt(d.topRepo.stars)} · ${d.topRepo.language} · top repo`, fontFamily: "Inter", fontSize: 22, fill: MUTED }),
          ]),
        ]
      : []),
    text({ id: "cta", x: 540, y: 1230, anchor: "center", content: d.url, fontFamily: "Inter", fontSize: 28, fontWeight: 700, fill: FG, opacity: 0 }),
    text({ id: "made", x: 540, y: 1280, anchor: "center", content: "made with reframe", fontFamily: "Inter", fontSize: 18, fill: "#484F58", opacity: 0 }),
  ];

  // A "stage" group wraps everything so the whole composition can move as one.
  // Scaling a group happens around its (x,y) point, so to zoom around the card's
  // CENTER we couple x/y = (1 - scale) * center — the layout coords stay untouched.
  const CX = 540, CY = 675;
  const cam = (scale: number) => ({ scale, x: (1 - scale) * CX, y: (1 - scale) * CY });

  return scene({
    id: "gh-card",
    size: { width: 1080, height: 1350 },
    fps: 30,
    background: BG,
    nodes: [group({ id: "stage", ...cam(1.06) }, nodes)],
    timeline: par(
      // camera: a quick push-in to settle, then a slow cinematic drift (Ken Burns).
      seq(
        tween("stage", cam(1), { duration: 1.0, ease: "easeOutExpo", label: "zoom-in" }),
        tween("stage", cam(1.035), { duration: 4.6, ease: "linear", label: "drift" }),
      ),
      seq(
      wait(0.2),
      par(
        tween("avatar", { opacity: 1, scale: 1 }, { duration: 0.7, ease: "easeOutBack", label: "avatar-in" }),
        tween("ring", { opacity: 1, scale: 1 }, { duration: 0.7, ease: "easeOutBack" }),
      ),
      par(
        tween("name", { opacity: 1 }, { duration: 0.4, ease: "easeOutQuad", label: "name-in" }),
        seq(wait(0.1), tween("handle", { opacity: 1 }, { duration: 0.4, ease: "easeOutQuad" })),
        seq(wait(0.2), tween("bio", { opacity: 1 }, { duration: 0.4, ease: "easeOutQuad" })),
      ),
      stagger(0.12, ...["s-repos", "s-stars", "s-foll"].map((id) => tween(id, { opacity: 1, scale: 1 }, { duration: 0.6, ease: "easeOutBack", ...(id === "s-repos" && { label: "count" }) }))),
      par(
        tween("lang-h", { opacity: 1 }, { duration: 0.3, ease: "easeOutQuad", label: "lang-in" }),
        tween("bar-bg", { opacity: 1 }, { duration: 0.3, ease: "easeOutQuad" }),
        stagger(0.06, ...segs.map((_, i) => tween(`seg-${i}`, { opacity: 1 }, { duration: 0.3, ease: "easeOutQuad" }))),
        seq(wait(0.2), stagger(0.08, ...segs.slice(0, 3).map((_, i) => tween(`ll-${i}`, { opacity: 1 }, { duration: 0.3 })))),
      ),
      ...(d.topRepo ? [tween("repo", { opacity: 1 }, { duration: 0.5, ease: "easeOutCubic", label: "repo-in" })] : []),
      par(
        tween("cta", { opacity: 1 }, { duration: 0.4, ease: "easeOutQuad", label: "cta-in" }),
        seq(wait(0.15), tween("made", { opacity: 1 }, { duration: 0.4, ease: "easeOutQuad" })),
      ),
      wait(1.6, "hold"),
      ),
    ),
  });
}
