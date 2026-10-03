import { useState } from "react";
import { docker, dockerJson } from "./api";
import { usePoll } from "./hooks";
import { Banner, Empty } from "./ui";

type V = { Name: string; Driver: string; Mountpoint?: string };

export default function Volumes({ ctx }: { ctx: string }) {
  const { data, error, reload } = usePoll(() => dockerJson<V>(ctx, ["volume", "ls"]), [ctx], 5000);
  const [err, setErr] = useState<string | null>(null);

  async function act(args: string[]) {
    try {
      await docker(ctx, args);
      setErr(null);
    } catch (e) {
      setErr(String(e));
    }
    reload();
  }

  return (
    <section>
      <header>
        <h2>Volumes</h2>
        <button
          className="danger"
          onClick={() => confirm("Remove all volumes not used by a container? Their data is lost.") && act(["volume", "prune", "-a", "-f"])}
        >
          Remove unused
        </button>
      </header>
      <Banner error={error ?? err} onClose={() => setErr(null)} />
      {data && data.length === 0 && <Empty title="No volumes">Volumes created by your containers will show up here.</Empty>}
      {data && data.length > 0 && (
        <table>
          <thead>
            <tr><th>Name</th><th>Driver</th><th /></tr>
          </thead>
          <tbody>
            {data.map((v) => (
              <tr key={v.Name}>
                <td className="mono clip" title={v.Name}>{v.Name}</td>
                <td>{v.Driver}</td>
                <td className="row-actions">
                  <button className="danger" onClick={() => confirm(`Remove volume ${v.Name}? Its data is lost.`) && act(["volume", "rm", v.Name])}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
