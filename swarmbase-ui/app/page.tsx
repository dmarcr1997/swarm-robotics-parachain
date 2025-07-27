"use client";
import { useEffect, useRef, useState } from "react";
import { initPolkadot, listenToCommandEvents } from "./lib/polkadot";

import RobotCanvas from "./components/RobotCanvas";

export default function Home() {
  const [api, setApi] = useState(null);
  const [signer, setSigner] = useState(null);
  const [robots, setRobots] = useState([]);
  const [xValue, setXValue] = useState(0);
  const [yValue, setYValue] = useState(0);
  const [queue, setQueue] = useState([]);

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

  useEffect(() => {
    let alive = true;
    (async () => {
      const { api, devPair } = await initPolkadot();
      if (!alive) return;
      setApi(api);
      setSigner(devPair);
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

            console.log(`Moving robot #${idNum} to`, newX, newY);

            onMoveCommand([idNum, newX, newY]);
            setQueue((q) => [...q, { id: idNum, cmd: coords }]);
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
    const tx = api.tx.swarmRobotPallet.registerRobot(robots.length);
    const { nonce } = await api.rpc.system.accountNextIndex(signer.address);
    await tx.signAndSend(signer, { nonce }, ({ status, dispatchError }) => {
      if (dispatchError) {
        console.error("Register failed:", dispatchError.toString());
      } else if (status.isFinalized) {
        console.log("Registered in block", status.asFinalized.toString());
      }
    });
    setRobots((r) => [...r, { id: r.length, position: { x: 0, y: 0 } }]);
  };

  const sendMoveCommand = async () => {
    if (!api || !signer) {
      console.error("API or signer not ready");
      return;
    }
    const tx = api.tx.swarmRobotPallet.enqueueCommand({
      GoToLocation: [xValue, yValue],
    });
    const { nonce } = await api.rpc.system.accountNextIndex(signer.address);
    await tx.signAndSend(signer, { nonce }, ({ status, dispatchError }) => {
      if (dispatchError) {
        console.error("Command failed:", dispatchError.toString());
      } else if (status.isFinalized) {
        console.log("Move command finalized");
      }
    });
  };

  const commandPull = async () => {
    if (!api || !signer) return;
    if (robots.length === 0) {
      console.error("No robots registered");
      return;
    }

    await api.tx.swarmRobotPallet
      .pullNext(robots[0].id)
      .signAndSend(signer, ({ status, dispatchError }) => {
        if (dispatchError) {
          console.error("Pull failed:", dispatchError.toString());
        } else if (status.isFinalized) {
          console.log(`Pulled command for robots`);
        }
      });
  };

  const ready = !!api && !!signer;

  return (
    <div className="container">
      <h1>SwarmBase Command Center</h1>
      <button
        className="row polkadot-button"
        onClick={registerRobot}
        disabled={!ready}
      >
        Register Robot
      </button>
      <div className="row">
        <button
          className="polkadot-button"
          onClick={sendMoveCommand}
          disabled={!ready}
        >
          Send Move Command
        </button>
        <input
          type="number"
          placeholder="X Coordinate"
          value={xValue}
          onChange={(event) => setXValue(event.target.value)}
        />
        <input
          type="number"
          placeholder="Y Coordinate"
          value={yValue}
          onChange={(event) => setYValue(event.target.value)}
        />
      </div>
      <button
        className="row polkadot-button"
        onClick={commandPull}
        disabled={!ready}
      >
        Pull Next Command
      </button>
      <RobotCanvas robots={robots} />
    </div>
  );
}
