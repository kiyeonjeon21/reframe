/**
 * Drop-shadow / outer-glow sugar. These return a partial-props object you spread
 * into a shape node; the underlying `shadow*` props stay animatable (e.g. pulse a
 * glow with `oscillate(id, "shadowBlur", …)`). Units are screen pixels.
 */
import type { BaseProps } from "./ir.js";

type ShadowProps = Pick<BaseProps, "shadowColor" | "shadowBlur" | "shadowX" | "shadowY">;

/** An outer glow — a shadow with no offset. `rect({ …, ...glow("#FFD24B", 28) })`. */
export function glow(color: string, blur = 24): ShadowProps {
  return { shadowColor: color, shadowBlur: blur, shadowX: 0, shadowY: 0 };
}

/** A drop shadow (offset downward by default). `rect({ …, ...dropShadow("#0008", 40, 0, 16) })`. */
export function dropShadow(color: string, blur = 24, x = 0, y = 12): ShadowProps {
  return { shadowColor: color, shadowBlur: blur, shadowX: x, shadowY: y };
}
