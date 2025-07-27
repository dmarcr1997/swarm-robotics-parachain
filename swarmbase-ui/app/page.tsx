"use client";
import { useEffect, useRef, useState } from "react";
import { initPolkadot, listenToCommandEvents } from "./lib/polkadot";

import RobotCanvas from "./components/RobotCanvas";
import CommandLog from "./components/CommandLog";

export default function Home() {
  const [api, setApi] = useState(null);
  const [signer, setSigner] = useState(null);
  const [robots, setRobots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState([]);

  const onMoveCommand = ([, centerXRaw, centerYRaw]) => {
    const centerX = Number(centerXRaw);
    const centerY = Number(centerYRaw);

    setRobots((rs) => {
      const n = rs.length;
      const radius = 25;
      return rs.map((r, i) => {
        const angle = (2 * Math.PI * i) / n;
        return {
          ...r,
          position: {
            x: centerX + radius * Math.cos(angle),
            y: centerY + radius * Math.sin(angle),
          },
        };
      });
    });
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
    setRobots((r) => [...r, { id: r.length, position: { x: 0, y: 0 } }]);
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
        <button
          className="row polkadot-button"
          onClick={registerRobot}
          disabled={!ready}
        >
          {loading ? "Loading…" : "Register Robot"}
        </button>
        <p>
          {loading
            ? "Waiting for blockchain…"
            : "Click on the canvas to send a move command to all robots."}
        </p>

        <RobotCanvas robots={robots} onClick={handleCanvasClick} />
      </div>
      <div className="log-panel">
        <h2>Command Log</h2>
        <CommandLog log={events} />
      </div>
    </div>
  );
}
