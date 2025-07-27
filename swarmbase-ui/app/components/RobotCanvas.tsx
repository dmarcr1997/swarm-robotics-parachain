import { useEffect, useRef } from "react";
import { Application, Graphics } from "pixi.js";

export default function RobotCanvas({ robots }) {
  const containerRef = useRef(null);
  const appRef = useRef(null);
  const spritesRef = useRef({});
  const tweensRef = useRef({});

  useEffect(() => {
    if (!containerRef.current) return;
    const app = new Application();
    appRef.current = app;

    const tick = () => {
      const now = appRef.current.ticker.lastTime;
      Object.entries(tweensRef.current).forEach(([id, tw]) => {
        const { startTime, duration, startX, startY, targetX, targetY } = tw;
        const t = Math.min(1, (now - startTime) / (duration * 1000));
        const sprite = spritesRef.current[id];
        if (sprite) {
          sprite.x = startX + (targetX - startX) * t;
          sprite.y = startY + (targetY - startY) * t;
        }
        if (t >= 1) {
          delete tweensRef.current[id];
        }
      });
    };

    (async () => {
      await app.init({ width: 800, height: 600, backgroundColor: 0x1099bb });
      containerRef.current.appendChild(app.canvas);
      app.ticker.add(tick);
    })();

    return () => {
      app.destroy(true, { children: true });
    };
  }, []);

  useEffect(() => {
    const app = appRef.current;
    if (!app) return;

    robots.forEach(({ id, position }) => {
      const key = id.toString();
      const x = Number(position.x);
      const y = Number(position.y);

      if (!spritesRef.current[key]) {
        const g = new Graphics();
        g.beginFill(0xff0000).drawCircle(0, 0, 10).endFill();
        g.x = x;
        g.y = y;
        app.stage.addChild(g);
        spritesRef.current[key] = g;
        return;
      }
      // If sprite already exists, update its position
      const sprite = spritesRef.current[key];
      if (sprite.x !== x || sprite.y !== y) {
        tweensRef.current[key] = {
          startTime: app.ticker.lastTime,
          duration: 0.5, // seconds
          startX: sprite.x,
          startY: sprite.y,
          targetX: x,
          targetY: y,
        };
      }
    });
  }, [robots]);

  return <div ref={containerRef} />;
}
