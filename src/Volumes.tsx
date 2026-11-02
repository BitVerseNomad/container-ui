import { useState } from "react";
import { score } from "./lib/fuzzy";
import { docker, dockerJson } from "./api";
import { usePoll } from "./hooks";
import { Banner, Empty, useConfirm } from "./ui";
import IconButton from "./ui/IconButton";
import { isAnonymous, unusedAnonymous, volumeUsage } from "./lib/volumes";
import { backupOf } from "./lib/bringOver";
import { dockerLocked, useDockerLocked } from "./dockerLock";

// While a copy or replace runs, a removed volume could be the backup a restore needs.
const WAIT = "Waits for what is changing Docker now.";
import { parseVolumeSizes } from "./lib/events";
import { formatBytes } from "./containerInfo";
import { Icon } from "./ui/icons";

type V = { Name: string; Driver: string };

export default function Volumes({ ctx }: { ctx: string }) {
  const confirm = useConfirm();
  const { data, error, reload } = usePoll(() => dockerJson<V>(ctx, ["volume", "ls"]), [ctx], 5000);
  // Which containers mount which volume: one `docker inspect` over every container.
  const usage = usePoll(async () => {
    const ids = (await docker(ctx, ["ps", "-a", "-q"])).split("\n").filter(Boolean);
    return ids.length ? volumeUsage(JSON.parse(await docker(ctx, ["inspect", ...ids]))) : new Map<string, string[]>();
  }, [ctx], 5000);
  // The exact shape of `docker system df -v --format json` is unverified; if it can't be read, sizes show a dash.
  const sizes = usePoll(async () => parseVolumeSizes(await docker(ctx, ["system", "df", "-v", "--format", "json"]).catch(() => "")), [ctx], 30000);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const locked = useDockerLocked();

  const shown = (data ?? []).filter((v) => score(`${v.Name} ${v.Driver}`, q) > 0);

  async function act(args: string[]) {
    // Checked again after the confirm: a copy may have started while it was open.
    if (dockerLocked()) return setErr(WAIT);
    try {
      await docker(ctx, args);
      setErr(null);
    } catch (e) {
      setErr(String(e));
    }
    reload();
    usage.reload();
  }

  const used = usage.data ?? new Map<string, string[]>();
  const loose = unusedAnonymous((data ?? []).map((v) => v.Name), used);

  return (
    <section>
      <div className="table-tools">
        <button
          className="danger"
          disabled={loose.length === 0}
          aria-disabled={locked || undefined}
          aria-describedby={locked ? "volumes-wait" : undefined}
          onClick={async () =>
            !locked && (await confirm(
              `Remove ${loose.length} unused anonymous volume${loose.length > 1 ? "s" : ""}? These are unnamed volumes that no container uses. Named volumes are never removed here.`,
              "Remove",
            )) && act(["volume", "rm", ...loose])
          }
        >
          Remove unused anonymous ({loose.length})
        </button>
        {locked && <span id="volumes-wait" className="hint">{WAIT}</span>}
      </div>
      <Banner error={error ?? usage.error ?? err} onClose={() => setErr(null)} />
      {data && data.length === 0 && <Empty title="No volumes">Volumes created by your containers will show up here.</Empty>}
      {data && data.length > 0 && (
        <>
          <label className="search-field volume-search">
            <Icon name="search" size={14} />
            <input placeholder="Search your volumes" aria-label="Search your volumes" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          {shown.length === 0 && (
            <p className="hint pad">No volume here matches "{q.trim()}".</p>
          )}
          {shown.length > 0 && (
            <table>
              <thead>
                <tr><th scope="col">Name</th><th scope="col">Driver</th><th scope="col">Used by</th><th scope="col">Size</th><th scope="col"><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody>
                {shown.map((v) => {
              const by = used.get(v.Name) ?? [];
              return (
                <tr key={v.Name}>
                  <td className="mono clip" title={v.Name}>
                    {isAnonymous(v.Name) ? `${v.Name.slice(0, 12)}… (anonymous)` : v.Name}
                    {/* A backup Bring over made: easy to find, and to remove once the data is checked. */}
                    {backupOf(v.Name) && <span className="volume-backup">{backupOf(v.Name)}</span>}
                  </td>
                  <td>{v.Driver}</td>
                  <td className={by.length ? "in-use" : ""}>
                    {usage.data === null ? "…" : by.length ? `In use by ${by.length} container${by.length > 1 ? "s" : ""}: ${by.join(", ")}` : "Not used"}
                  </td>
                  <td className="mono">{sizes.data?.has(v.Name) ? formatBytes(sizes.data.get(v.Name)!) : "—"}</td>
                  <td className="row-actions">
                    <IconButton
                      label={by.length ? `Remove volume ${v.Name} (in use by ${by.join(", ")})` : `Remove volume ${v.Name}`}
                      icon="trash"
                      danger
                      disabled={by.length > 0}
                      waiting={locked ? WAIT : undefined}
                      onClick={async () => (await confirm(`Remove volume ${v.Name}? Its data is lost.`)) && act(["volume", "rm", v.Name])}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      </>
    )}
    </section>
  );
}
