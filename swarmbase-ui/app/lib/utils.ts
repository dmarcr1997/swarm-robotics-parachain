export type Vec = { x: number; y: number };
export enum SwarmType {
  Potential,
  Boids,
}
export interface Robot {
  id: number;
  position: Vec;
  velocity: Vec;
}

export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const scale = (a: Vec, s: number): Vec => ({ x: a.x * s, y: a.y * s });
export const norm = (a: Vec): number => Math.hypot(a.x, a.y);
export const normalize = (a: Vec): Vec => {
  const n = norm(a) || 1;
  return { x: a.x / n, y: a.y / n };
};

export const limit = (v: Vec, max: number): Vec => {
  const n = norm(v);
  return n > max ? scale(v, max / n) : v;
};
