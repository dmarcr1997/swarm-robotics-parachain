import { ApiPromise, Keyring, WsProvider } from "@polkadot/api";
import { cryptoWaitReady } from "@polkadot/util-crypto";

let cached: {
  api?: ApiPromise;
  devPair?: ReturnType<Keyring["addFromUri"]>;
} = {};

export async function initPolkadot() {
  if (cached.api && cached.devPair) {
    return cached;
  }
  await cryptoWaitReady();

  const keyring = new Keyring({ type: "sr25519", ss58Format: 42 });
  const devPair = keyring.addFromUri("//Alice");

  const provider = new WsProvider("ws://127.0.0.1:9944");
  const api = await ApiPromise.create({ provider });
  await api.isReady;

  cached = { api, devPair };
  return cached;
}

export async function listenToCommandEvents(api, onCommand) {
  const unsub = await api.query.system.events((events) => {
    events.forEach(({ event: { section, method, data } }) => {
      if (section === "swarmRobotPallet" && method === "CommandPulled") {
        const [id, cmd] = data;
        onCommand(id.toString(), cmd.toHuman());
      }
    });
  });
  return unsub;
}
