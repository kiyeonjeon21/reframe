import { scene, group, ellipse, rect, text, oscillate } from "@reframe/core";

// Reproduces the logo-reveal hold: a lockup floating at amplitude 6px,
// 0.4 Hz — peak speed ~0.5 px/frame, below block-matching sensitivity.
// C5: must NOT classify as static, and diff periodicity must find ~0.4 Hz.
export default scene({
  id: "cal-micro",
  size: { width: 1920, height: 1080 },
  fps: 30,
  duration: 6,
  background: "#0A0A0C",
  nodes: [
    group({ id: "lockup", x: 960, y: 540 }, [
      ellipse({ id: "disc", x: 0, y: -60, width: 220, height: 220, anchor: "center", fill: "#FF4D00" }),
      rect({ id: "mark", x: 0, y: -60, width: 88, height: 88, anchor: "center", fill: "#0A0A0C", radius: 18 }),
      text({
        id: "wordmark",
        x: 0,
        y: 130,
        anchor: "center",
        content: "reframe",
        fontFamily: "Inter",
        fontSize: 84,
        fontWeight: 700,
        fill: "#FFFFFF",
      }),
    ]),
  ],
  behaviors: [oscillate("lockup", "y", { amplitude: 6, frequency: 0.4 })],
});
