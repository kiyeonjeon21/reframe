import { scene, group, rect, text, seq, par, to, wait } from "@reframe/core";

// Scene transition: card A wipes out left while card B slides in from the
// right behind an orange sweep. Two "scenes" live as sibling groups inside
// one reframe scene — stresses group transforms and cross-group timing.
export default scene({
  id: "transition",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#101014",
  nodes: [
    group({ id: "sceneA", x: 0, y: 0 }, [
      rect({ id: "bgA", x: 0, y: 0, width: 1920, height: 1080, fill: "#16324F" }),
      text({
        id: "titleA",
        x: 960,
        y: 540,
        anchor: "center",
        content: "Chapter One",
        fontFamily: "Inter",
        fontSize: 110,
        fontWeight: 800,
        fill: "#FFFFFF",
      }),
    ]),
    group({ id: "sceneB", x: 1920, y: 0 }, [
      rect({ id: "bgB", x: 0, y: 0, width: 1920, height: 1080, fill: "#3B1F47" }),
      text({
        id: "titleB",
        x: 960,
        y: 540,
        anchor: "center",
        content: "Chapter Two",
        fontFamily: "Inter",
        fontSize: 110,
        fontWeight: 800,
        fill: "#FFFFFF",
        opacity: 0,
      }),
    ]),
    // The sweep bar that motivates the cut.
    rect({
      id: "sweep",
      x: -200,
      y: 0,
      width: 160,
      height: 1080,
      fill: "#FF4D00",
      rotation: 0,
    }),
  ],

  states: {
    aHold: { sceneA: { x: 0 }, sceneB: { x: 1920 }, sweep: { x: -200 } },
    swept: { sceneA: { x: -1920 }, sceneB: { x: 0 }, sweep: { x: 2120 }, titleB: { opacity: 1 } },
  },
  initial: "aHold",

  timeline: seq(
    wait(1.2),
    par(
      to("swept", { duration: 0.8, ease: "easeInOutQuart" }),
    ),
    wait(1.6),
  ),
});
