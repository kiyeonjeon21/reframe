# HTML + GSAP motion guide

You write a motion-graphics scene as a **single self-contained `.html` file**
using HTML, CSS, and GSAP. The page is rendered to video frame-by-frame by a
deterministic capture harness.

## Required structure

```html
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { margin: 0; }
  #stage {
    position: relative; width: 1920px; height: 1080px;
    background: #101014; overflow: hidden;
    font-family: Inter, sans-serif;
  }
  /* static styling for your elements */
</style>
</head>
<body>
<div id="stage">
  <!-- your elements -->
</div>
<script src="./gsap.min.js"></script>
<script>
  // your animation code
</script>
</body>
</html>
```

- The video frame is exactly the `#stage` element — keep it `1920px × 1080px`
  with `overflow: hidden`, and put everything inside it.
- GSAP 3 is available locally at `./gsap.min.js` (already next to your file).
  Do not load anything else from the network — no CDNs, no images, no iframes.
- Font: use `font-family: Inter` (weights 400/700/800 are pre-installed by the
  harness; no @font-face needed). Fallback `sans-serif`.

## Animation rules (important)

The harness virtualizes time: `requestAnimationFrame`, `setTimeout`,
`setInterval`, `performance.now()` and `Date.now()` all follow a virtual
clock, so GSAP timelines and hand-rolled rAF loops are captured exactly.

- **All motion must be driven by GSAP or JavaScript.** CSS `animation`,
  CSS `transition`, and SMIL run on the compositor clock and will NOT be
  captured — a scene that relies on them renders as a frozen frame.
  Static CSS styling (layout, colors, border-radius, flex...) is fine.
- No `Math.random()` unless seeded yourself deterministically; no `<video>`;
  no user interaction. The page must play by itself from t=0.
- Match the brief's total duration: time your timeline so the action completes
  within it (trailing hold is fine).

## GSAP quick reference

```js
const tl = gsap.timeline({ delay: 0.2 });
tl.to("#el", { x: 300, opacity: 1, duration: 0.5, ease: "power2.out" })
  .fromTo("#el2", { scale: 0.5 }, { scale: 1.1, duration: 0.2, ease: "power2.out" })
  .to("#el2", { scale: 1, duration: 0.1, ease: "power1.inOut" })   // settle
  .to("#el3", { y: -40, duration: 0.3 }, "<")      // "<" = start with previous
  .to("#el4", { opacity: 0, duration: 0.3 }, "+=1.5"); // "+=" = gap after previous

gsap.to(".items", { opacity: 1, stagger: 0.1, duration: 0.4 }); // staggered
gsap.to("#el", { rotation: 3, yoyo: true, repeat: -1, duration: 0.6,
                 ease: "sine.inOut" }); // continuous wiggle during holds
```

Eases: `power1/2/3/4.out` (decelerate — entrances), `.in` (accelerate — exits),
`.inOut`, `sine.inOut`, `back.out(1.7)` (overshoot), `expo.out`.
Position params: `"<"` start with previous, `"+=0.5"` gap, absolute `1.2`.

Useful patterns:

```js
// Count-up number label
const counter = { value: 0 };
gsap.to(counter, { value: 14.0, duration: 1, ease: "power2.out",
  onUpdate: () => { el.textContent = counter.value.toFixed(1); } });

// Center an element at a point (so scale/rotation pivot around its center)
// CSS: position:absolute; left:960px; top:540px; transform:translate(-50%,-50%)
// Then animate with xPercent/yPercent preserved:
gsap.fromTo("#el", { xPercent: -50, yPercent: -50, scale: 0.5 },
                   { xPercent: -50, yPercent: -50, scale: 1, duration: 0.3 });

// Grow a bar upward: anchor it with bottom CSS, animate height
gsap.fromTo("#bar", { height: 0 }, { height: 320, duration: 0.7, ease: "power3.out" });
```

## Worked example A — countdown (3, 2, 1, GO!)

```html
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { margin: 0; }
  #stage { position: relative; width: 1920px; height: 1080px;
    background: #101014; overflow: hidden; font-family: Inter, sans-serif; }
  #ring { position: absolute; left: 960px; top: 540px;
    width: 360px; height: 360px; margin: -180px 0 0 -180px;
    border: 10px solid #3B82F6; border-radius: 50%; opacity: 0; }
  .num, #go { position: absolute; left: 960px; top: 540px;
    transform: translate(-50%, -50%); font-weight: 800; color: #fff; opacity: 0; }
  .num { font-size: 220px; }
  #go { font-size: 320px; color: #FF4D00; }
</style>
</head>
<body>
<div id="stage">
  <div id="ring"></div>
  <div class="num" id="num-3">3</div>
  <div class="num" id="num-2">2</div>
  <div class="num" id="num-1">1</div>
  <div id="go">GO!</div>
</div>
<script src="./gsap.min.js"></script>
<script>
  const tl = gsap.timeline();
  tl.to("#ring", { opacity: 1, duration: 0.3, ease: "power2.out" });
  for (const n of ["3", "2", "1"]) {
    tl.fromTo(`#num-${n}`,
      { opacity: 0, scale: 0.5 },
      { opacity: 1, scale: 1.1, duration: 0.2, ease: "power2.out" })
      .to(`#num-${n}`, { scale: 1, duration: 0.1, ease: "power1.inOut" })
      .to(`#num-${n}`, { opacity: 0, scale: 0.7, duration: 0.1, ease: "power1.in" }, "+=0.45");
  }
  tl.fromTo("#go",
    { opacity: 0, scale: 0.5 },
    { opacity: 1, scale: 1.15, duration: 0.25, ease: "power2.out" })
    .to("#ring", { scale: 1.6, opacity: 0, duration: 0.4, ease: "power2.out" }, "<")
    .to("#go", { scale: 1, duration: 0.15, ease: "power1.inOut" });
</script>
</body>
</html>
```

## Worked example B — badge pop (overshoot + wiggle + drop)

```html
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { margin: 0; }
  #stage { position: relative; width: 1920px; height: 1080px;
    background: #15151A; overflow: hidden; font-family: Inter, sans-serif; }
  #badge { position: absolute; left: 960px; top: 540px;
    width: 420px; height: 160px; margin: -80px 0 0 -210px;
    background: #E11D48; border-radius: 28px;
    display: flex; align-items: center; justify-content: center;
    opacity: 0; transform: scale(0); }
  #badge span { color: #fff; font-size: 88px; font-weight: 800; letter-spacing: 6px; }
</style>
</head>
<body>
<div id="stage">
  <div id="badge"><span>NEW</span></div>
</div>
<script src="./gsap.min.js"></script>
<script>
  const tl = gsap.timeline({ delay: 0.2 });
  tl.to("#badge", { opacity: 1, duration: 0.15, ease: "power1.out" })
    .to("#badge", { scale: 1.18, duration: 0.28, ease: "power2.out" }, "<")
    .to("#badge", { scale: 1, duration: 0.18, ease: "power1.inOut" })
    .to("#badge", { y: 180, opacity: 0, duration: 0.35, ease: "power2.in" }, "+=1.6");

  gsap.to("#badge", { rotation: 2.5, duration: 0.625, yoyo: true, repeat: -1,
                      ease: "sine.inOut" });
</script>
</body>
</html>
```
