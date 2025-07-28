"use client";
import { useEffect, useRef, useState } from "react";
import { initPolkadot, listenToCommandEvents } from "./lib/polkadot";

import RobotCanvas from "./components/RobotCanvas";
import CommandLog from "./components/CommandLog";
import { limit, normalize, Robot, SwarmType, Vec } from "./lib/utils";

export default function Home() {
  const [api, setApi] = useState(null);
  const [signer, setSigner] = useState(null);
  const [robots, setRobots] = useState<Robot[]>([]);
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState([]);
  const [swarmType, setSwarmType] = useState<SwarmType>(SwarmType.Boids);
  const [target, setTarget] = useState<Vec | null>(null);
  const robotsRef = useRef<Robot[]>(robots);

  // keep the ref in sync
  useEffect(() => {
    robotsRef.current = robots;
  }, [robots]);

  const onMoveCommand = ([, xRaw, yRaw]) => {
    setTarget({ x: Number(xRaw), y: Number(yRaw) });
  };

  useEffect(() => {
    if (!target) return;
    let frame = 0;
    const timer = setInterval(() => {
      console.log("RB", robots.length); // <-- fresh each render
      if (robotsRef.current.length === 1) directSeek(target.x, target.y);
      else if (swarmType === SwarmType.Boids) moveToBoids(target.x, target.y);
      else moveToPotentialField(target.x, target.y);

      frame++;
      if (frame >= 120) clearInterval(timer);
    }, 1000 / 60);

    return () => clearInterval(timer);
  }, [robots, target, swarmType]);

  const directSeek = (cx: number, cy: number) => {
    const maxSpeed = 5;
    setRobots((rs) => {
      const dx = cx - rs[0].position.x;
      const dy = cy - rs[0].position.y;
      const d = Math.hypot(dx, dy);
      if (d === 0) return rs[0];
      const ux = dx / d,
        uy = dy / d;
      const vx = ux * maxSpeed;
      const vy = uy * maxSpeed;
      return [
        {
          ...rs[0],
          velocity: { x: vx, y: vy },
          position: { x: rs[0].position.x + vx, y: rs[0].position.y + vy },
        },
      ];
    });
  };

  const moveToPotentialField = (cx: number, cy: number) => {
    // Parameters
    const sepDist = 20; // only repel if other robot < 30px
    const stoppingDist = 5; //distance when to stop
    const attGain = 0.1; // attraction constant
    const repGain = 300; // repulsion constant
    const maxSpeed = 5; // px per frame
    const damping = 0.8; // bleed off oscillation

    setRobots((rs) => {
      return rs.map((r, _, arr) => {
        // → Attraction: vector = (goal - pos) * attGain
        const dx = cx - r.position.x;
        const dy = cy - r.position.y;
        const distToGoal = Math.hypot(dx, dy);
        let fAtt = { x: 0, y: 0 };
        if (distToGoal > stoppingDist) {
          const dir = { x: dx / distToGoal, y: dy / distToGoal };
          const speed = Math.min(distToGoal * attGain, maxSpeed);
          fAtt = { x: dir.x * speed, y: dir.y * speed };
        }
        // → Repulsion: sum of repulsions from neighbors
        let fRep = { x: 0, y: 0 };
        arr.forEach((o) => {
          if (o.id === r.id) return;
          const rx = r.position.x - o.position.x;
          const ry = r.position.y - o.position.y;
          const d = Math.hypot(rx, ry);
          if (d > 0 && d < sepDist) {
            const str = repGain / (d * d);
            fRep.x += (rx / d) * str;
            fRep.y += (ry / d) * str;
          }
        });

        // → Combine forces into a velocity
        const vx = (fAtt.x + fRep.x) * damping;
        const vy = (fAtt.y + fRep.y) * damping;

        // → Step the position
        return {
          ...r,
          position: {
            x: r.position.x + vx,
            y: r.position.y + vy,
          },
        };
      });
    });
  };

  const moveToBoids = (cx: number, cy: number) => {
    const visionRadius = 50;
    const sepRadius = 20;
    const sepWeight = 1.5;
    const alignWeight = 1.0;
    const seekWeight = 1.2;
    const cohesionWeight = 1.0;
    const maxSpeed = 4;
    const maxForce = 0.1;

    setRobots((rs) =>
      rs.map((r) => {
        let seek: Vec = { x: 0, y: 0 };
        const dx = cx - r.position.x;
        const dy = cy - r.position.y;
        const dGoal = Math.hypot(dx, dy);
        if (dGoal > 0) {
          // desired velocity
          seek = { x: (dx / dGoal) * maxSpeed, y: (dy / dGoal) * maxSpeed };
          // steering = desired - current velocity
          seek.x -= r.velocity.x;
          seek.y -= r.velocity.y;
          seek = limit(seek, maxForce);
        }
        // 1) Accumulators
        let sep: Vec = { x: 0, y: 0 };
        let align: Vec = { x: 0, y: 0 };
        let coh: Vec = { x: 0, y: 0 };
        let countAlign = 0;
        let countCoh = 0;

        // 2) Gather neighbors
        for (const o of rs) {
          if (o.id === r.id) continue;
          const ox = o.position.x - r.position.x;
          const oy = o.position.y - r.position.y;
          const d = Math.hypot(ox, oy);
          if (d < visionRadius) {
            // — Alignment
            align.x += o.velocity.x;
            align.y += o.velocity.y;
            countAlign++;

            // — Cohesion
            coh.x += o.position.x;
            coh.y += o.position.y;
            countCoh++;
          }
          if (d > 0 && d < sepRadius) {
            // — Separation
            sep.x -= (o.position.x - r.position.x) / d;
            sep.y -= (o.position.y - r.position.y) / d;
          }
        }

        // 3) Finalize each steering vector
        // a) Separation
        sep = normalize(sep);
        sep.x *= maxSpeed;
        sep.y *= maxSpeed;
        sep.x -= r.velocity.x;
        sep.y -= r.velocity.y;
        sep = limit(sep, maxForce);

        // b) Alignment
        if (countAlign > 0) {
          align.x /= countAlign;
          align.y /= countAlign;
          align = normalize(align);
          align.x *= maxSpeed;
          align.y *= maxSpeed;
          align.x -= r.velocity.x;
          align.y -= r.velocity.y;
          align = limit(align, maxForce);
        }

        // c) Cohesion
        if (countCoh > 0) {
          coh.x /= countCoh;
          coh.y /= countCoh;
          coh.x -= r.position.x;
          coh.y -= r.position.y;
          coh = normalize(coh);
          coh.x *= maxSpeed;
          coh.y *= maxSpeed;
          coh.x -= r.velocity.x;
          coh.y -= r.velocity.y;
          coh = limit(coh, maxForce);
        }

        // 4) Combine and apply
        const accel = {
          x:
            sep.x * sepWeight +
            align.x * alignWeight +
            coh.x * cohesionWeight +
            seek.x * seekWeight,
          y:
            sep.y * sepWeight +
            align.y * alignWeight +
            coh.y * cohesionWeight +
            seek.y * seekWeight,
        };
        let vx = r.velocity.x + accel.x;
        let vy = r.velocity.y + accel.y;
        ({ x: vx, y: vy } = limit({ x: vx, y: vy }, maxSpeed));

        return {
          ...r,
          velocity: { x: vx, y: vy },
          position: {
            x: r.position.x + vx,
            y: r.position.y + vy,
          },
        };
      })
    );
  };

  const updateEvents = (newEvent: string) => {
    setEvents((previousEvents) => [...previousEvents, newEvent]);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      const { api, devPair } = await initPolkadot();
      if (!alive) return;
      setApi(api);
      setSigner(devPair);
      updateEvents("Connected to Swarm Parachain...");
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!api) return;
    let unsub: () => void;

    (async () => {
      unsub = await api.query.system.events((records) => {
        records.forEach(({ event: { section, method, data } }) => {
          if (section === "swarmRobotPallet" && method === "CommandPulled") {
            const [rawId, rawCmd] = data;

            const idNum = rawId.toNumber();
            const human = rawCmd.toHuman(); // => { GoToLocation: [x, y] }
            const coords = human.GoToLocation || human[Object.keys(human)[0]];
            const { x, y } = coords;
            const newX = Number(x);
            const newY = Number(y);

            updateEvents(`Moving robot #${idNum} to ${newX},${newY}`);

            onMoveCommand([idNum, newX, newY]);
          }
        });
      });
    })();

    return () => {
      unsub && unsub();
    };
  }, [api]);

  const registerRobot = async () => {
    if (!api || !signer) {
      console.error("API or signer not ready");
      return;
    }
    setLoading(true);
    const tx = api.tx.swarmRobotPallet.registerRobot(robots.length);
    updateEvents(`Registerd Robot ${robots.length}`);
    const { nonce } = await api.rpc.system.accountNextIndex(signer.address);
    await tx.signAndSend(signer, { nonce }, ({ status, dispatchError }) => {
      if (dispatchError) {
        console.error("Register failed:", dispatchError.toString());
        updateEvents(`Register failed: ${dispatchError.toString()}`);
        setLoading(false);
      } else if (status.isFinalized) {
        console.log("Registered in block", status.asFinalized.toString());
        updateEvents(`Registered in block: ${status.asFinalized.toString()}`);
        setLoading(false);
      }
    });
    setRobots((r) => [
      ...r,
      { id: r.length, position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 } },
    ]);
  };

  const handleCanvasClick = async (x, y) => {
    if (!api || !signer) {
      console.error("API or signer not ready");
      return;
    }
    setLoading(true);
    try {
      await api.tx.swarmRobotPallet
        .enqueueCommand({ GoToLocation: [x, y] })
        .signAndSend(signer, ({ status, dispatchError }) => {
          if (dispatchError) {
            updateEvents(`Command failed: ${dispatchError.toString()}`);
            console.error("Command failed:", dispatchError.toString());
            setLoading(false);
          } else if (status.isFinalized) {
            console.log("Enqueued move to", x, y);
            commandPull();
          }
        });
    } catch (err) {
      console.error("enqueue failed:", err);
      setLoading(false);
    }
  };

  const commandPull = async () => {
    if (!api || !signer) return;
    if (robots.length === 0) {
      console.error("No robots registered");
      return;
    }
    updateEvents("Sending to robots.");
    await api.tx.swarmRobotPallet
      .pullNext(robots[0].id)
      .signAndSend(signer, ({ status, dispatchError }) => {
        if (dispatchError) {
          updateEvents("Command Failed!!!");
          updateEvents(dispatchError.toString());
          console.error("Pull failed:", dispatchError.toString());
          setLoading(false);
        } else if (status.isFinalized) {
          updateEvents("Finished Command");
          setLoading(false);
        }
      });
  };

  const ready = !!api && !!signer;

  return (
    <div className="page-wrapper">
      <div className="main-panel">
        <h1>SwarmBase Command Center</h1>
        <div className="row">
          <button
            className="polkadot-button"
            onClick={registerRobot}
            disabled={!ready}
          >
            {loading ? "Loading…" : "Register Robot"}
          </button>
          <button
            className="polkadot-button"
            onClick={() => setSwarmType(SwarmType.Potential)}
            disabled={swarmType === SwarmType.Potential}
          >
            {swarmType === SwarmType.Potential ? "Current" : "Potential Field"}
          </button>
          <button
            className="polkadot-button"
            onClick={() => setSwarmType(SwarmType.Boids)}
            disabled={swarmType === SwarmType.Boids}
          >
            {swarmType === SwarmType.Boids ? "Current" : "Boids (Flocking)"}
          </button>
        </div>
        <p>
          {loading
            ? "Waiting for blockchain…"
            : "Click on the canvas to send a move command to all robots."}
        </p>

        <RobotCanvas robots={robotsRef.current} onClick={handleCanvasClick} />
      </div>
      <div className="log-panel">
        <h2>Command Log</h2>
        <CommandLog log={events} />
      </div>
    </div>
  );
}
