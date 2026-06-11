import { scene, text, seq, par, stagger, tween, wait } from "@reframe/core";

// Kinetic typography: words punch in one after another, hold, then the whole
// phrase scatters. Stresses the stagger() operator and per-node tweens.
const words = ["DESIGN", "IS", "HOW", "IT", "WORKS"];
const centerY = 540;
const spacing = 150;
const startY = centerY - ((words.length - 1) * spacing) / 2;

export default scene({
  id: "kinetic-typo",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#0D0D0F",
  nodes: words.map((word, i) =>
    text({
      id: `word-${i}`,
      x: 960,
      y: startY + i * spacing,
      anchor: "center",
      content: word,
      fontFamily: "Inter",
      fontSize: i === words.length - 1 ? 140 : 96, // last word is the punchline
      fontWeight: 800,
      fill: i === words.length - 1 ? "#FF4D00" : "#FFFFFF",
      opacity: 0,
      scale: 0.4,
    }),
  ),

  timeline: seq(
    // Punch-in: each word scales up and overshoots slightly.
    stagger(
      0.22,
      ...words.map((_, i) =>
        seq(
          par(
            tween(`word-${i}`, { opacity: 1 }, { duration: 0.18, ease: "easeOutQuad" }),
            tween(`word-${i}`, { scale: 1.12 }, { duration: 0.18, ease: "easeOutCubic" }),
          ),
          tween(`word-${i}`, { scale: 1 }, { duration: 0.12, ease: "easeInOutQuad" }),
        ),
      ),
    ),
    wait(1.4),
    // Scatter: words fly out alternating left/right.
    par(
      ...words.map((_, i) =>
        par(
          tween(`word-${i}`, { x: i % 2 === 0 ? -400 : 2320 }, { duration: 0.5, ease: "easeInCubic" }),
          tween(`word-${i}`, { opacity: 0 }, { duration: 0.5, ease: "easeInQuad" }),
        ),
      ),
    ),
  ),
});
