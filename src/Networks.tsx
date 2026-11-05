import { openUrl } from "./api";
import { useState } from "react";
import { score } from "./lib/fuzzy";
import { Icon } from "./ui/icons";
import { docker, dockerJson } from "./api";
import { usePoll } from "./hooks";
import { NetInfo, parseNetworks } from "./lib/network";
import { Banner, Empty, useConfirm } from "./ui";
import IconButton from "./ui/IconButton";
import ConnectionTest from "./ConnectionTest";

const BUILTIN = new Set(["bridge", "host", "none"]);
const NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;
const BRIDGE_DOCS = "https://docs.docker.com/engine/network/drivers/bridge/";

export default function Networks({ ctx }: { ctx: string }) {
  const confirm = useConfirm();
  const nets = usePoll<NetInfo[]>(async () => {
    const names = (await dockerJson<{ Name: string }>(ctx, ["network", "ls"])).map((n) => n.Name);
    return names.length ? parseNetworks(await docker(ctx, ["network", "inspect", ...names])) : [];
  }, [ctx], 4000);
  const ctrs = usePoll(() => dockerJson<{ Names: string; State: string }>(ctx, ["ps", "-a"]), [ctx], 5000);
  const [newName, setNewName] = useState("");
  const [pick, setPick] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [q, setQ] = useState("");
  const shown = (nets.data ?? []).filter((n) => score(`${n.name} ${n.subnet} ${n.members.map((m) => m.name).join(" ")}`, q) > 0);

  async function act(args: string[]) {
    try {
      await docker(ctx, args);
      setErr(null);
    } catch (e) {
      setErr(String(e));
    }
    nets.reload();
  }

  const valid = NAME.test(newName.trim()) && !BUILTIN.has(newName.trim());

  return (
    <section>
      <p className="hint lead">
        Containers on the same network reach each other by name, like <code>http://db:5432</code>. The built-in <b>bridge</b> network doesn't do name lookup, so put containers that talk to each other on a network of your own.{" "}
        <button className="link ext" onClick={() => openUrl(BRIDGE_DOCS)}>Learn more <span className="host">(docs.docker.com)</span></button>
      </p>
      <div className="inline newnet">
        <input aria-label="New network name" placeholder="New network name, like devnet" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && valid && act(["network", "create", newName.trim()]).then(() => setNewName(""))} />
        <button className="primary" disabled={!valid} onClick={async () => { await act(["network", "create", newName.trim()]); setNewName(""); }}>Create network</button>
        <button className="push-right" onClick={() => setTesting(true)}>Test a connection…</button>
      </div>
      <Banner error={nets.error ?? err} onClose={() => setErr(null)} />
      {nets.data && nets.data.length === 0 && <Empty title="No networks">Docker creates a few built-in ones when it starts.</Empty>}
      {nets.data && nets.data.length > 0 && (
        <>
          <label className="search-field network-search">
            <Icon name="search" size={14} />
            <input placeholder="Search your networks" aria-label="Search your networks" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          {shown.length === 0 && (
            <p className="hint pad">No network here matches "{q.trim()}".</p>
          )}
          {shown.length > 0 && (
            <table>
              <thead>
                <tr><th scope="col">Network</th><th scope="col">Subnet</th><th scope="col">Containers</th><th scope="col"><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody>
                {shown.map((n) => {
              const builtin = BUILTIN.has(n.name);
              const free = (ctrs.data ?? []).filter((c) => c.State === "running" && !n.members.some((m) => m.name === c.Names));
              return (
                <tr key={n.name}>
                  <td><b>{n.name}</b>{builtin && <span className="tag">Built in</span>}</td>
                  <td className="mono">{n.subnet || "none"}</td>
                  <td>
                    {n.members.length === 0 && <span className="hint">No containers</span>}
                    <span className="members">
                      {n.members.map((m) => (
                        <span key={m.id} className="member">
                          <b>{m.name}</b> <span className="mono">{m.ip}</span>
                          {!builtin && (
                            <IconButton label={`Disconnect ${m.name} from ${n.name}`} icon="close" text onClick={async () => (await confirm(`Disconnect ${m.name} from ${n.name}? It will no longer reach the others on this network.`, "Disconnect")) && act(["network", "disconnect", n.name, m.name])} />
                          )}
                        </span>
                      ))}
                    </span>
                    {!builtin && free.length > 0 && (
                      <span className="connect">
                        <select aria-label={`Connect a container to ${n.name}`} value={pick[n.name] ?? ""} onChange={(e) => setPick({ ...pick, [n.name]: e.target.value })}>
                          <option value="">Connect a container…</option>
                          {free.map((c) => <option key={c.Names}>{c.Names}</option>)}
                        </select>
                        <button disabled={!pick[n.name]} onClick={async () => { await act(["network", "connect", n.name, pick[n.name]]); setPick({ ...pick, [n.name]: "" }); }}>Connect</button>
                      </span>
                    )}
                  </td>
                  <td className="row-actions">
                    {!builtin && <IconButton label={n.members.length ? `Remove network ${n.name} (still has containers)` : `Remove network ${n.name}`} icon="trash" text danger disabled={n.members.length > 0} onClick={async () => (await confirm(`Remove network ${n.name}?`)) && act(["network", "rm", n.name])} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      </>
    )}
      {testing && <ConnectionTest ctx={ctx} onClose={() => setTesting(false)} />}
    </section>
  );
}
