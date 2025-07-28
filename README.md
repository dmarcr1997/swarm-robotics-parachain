<div align="center">

# 🧠 SwarmBase

> A decentralized command-and-control protocol for field-deployed robot swarms, built on Polkadot + Pixi.js + Next.js

---

</div>

## 📦 Project Structure

```
swarmbase/
├── pallets/swarm/     # SwarmPallet: command queue, robot registry
├── swarmbase-ui/          # Frontend app (Next.js + Pixi.js)
│   ├── components/         # Canvas, robot UI, command log
│   ├── lib/                # Chain API, event listeners
│   └── pages/
└── README.md
```

---

## 🚀 Overview

SwarmBase is a research prototype for coordinating swarms of 2D robots using blockchain-based commands. It includes:

- ✅ A Polkadot parachain with a `SwarmPallet` to register robots and queue movement/task commands
- ✅ A Next.js-based frontend app to:
  - Register and display robots in real time
  - Move robots to canvas-clicked locations using Pixi.js
  - Execute simple swarm behaviors
  - Show a live blockchain event log of swarm commands

---

## 🧠 Features

### Blockchain (Parachain)

- Built using the [Polkadot Parachain Template](https://github.com/substrate-developer-hub/substrate-parachain-template)
- Custom pallet `SwarmPallet` exposes:
  - `register_robot(robot_id)`
  - `enqueue_command(command_type, optional_data)`
  - `pull_command()`
- Emits `CommandEnqueued`, `RobotRegistered`, `CommandPulled`, and other relevant events

### Frontend (`swarmbase-ui`)

- Built in **Next.js**
- 2D simulation using **Pixi.js**
- Connects to local parachain via `@polkadot/api`
- Displays live robot movement and command execution
- Visualizes event log from on-chain activity

---

## 📋 Commands

### Parachain Setup

```bash
cd node/
cargo build --release
chain-spec-builder create --relay-chain "rococo-local" --para-id {{PARACHAIN_ID}} --runtime \
    target/release/wbuild/parachain-template-runtime/parachain_template_runtime.wasm named-preset development
polkadot-omni-node --chain ./chain_spec.json --dev
```

### Frontend Setup

```bash
cd swarmbase-ui/
npm install
npm run dev
```

---

## 📡 Live Interaction Flow

1. Register robots via UI → sends extrinsic to `register_robot`
2. Click on canvas → `GoToLocation(x, y)` command pushed on chain
3. Robots pull command queue and move accordingly
4. UI updates robot positions and displays blockchain events in real-time

---

## 🛠️ Coming Next

- [ ] Add basic swarm algorithms (flocking, dispersion, formation)
- [ ] Task types beyond movement (e.g., scan, relay)
- [ ] Event acknowledgments (robot-to-chain)
- [ ] Real robot integration via ESP32 / Pi
- [ ] Token staking for task priority or load balancing

---

## 🧪 Dev Notes

- Robots currently act on commands in a simple FIFO queue
- Event log watches `system.events` and filters by `swarmRobotPallet`
- Pixi.js rendering is stateless — robot logic is updated on frame ticks

---

## 🤖 Built For

- Field robotics coordination
- Decentralized AI task delegation
- Research in swarm consensus models
- Hardcore cyberpunk autonomy systems

---

## License

MIT

---
