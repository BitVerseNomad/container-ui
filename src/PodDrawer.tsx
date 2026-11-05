import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { usePoll } from "./hooks";
import { K8sEvent, K8sProblem, Pod } from "./lib/k8s";
import { ago } from "./lib/events";
import Drawer from "./ui/Drawer";
import { Banner } from "./ui";
import { Icon } from "./ui/icons";

type Props = { kctx: string; pod: Pod; problems: K8sProblem[]; events: K8sEvent[]; onClose: () => void };

export default function PodDrawer({ kctx, pod, problems, events, onClose }: Props) {
  const [previous, setPrevious] = useState(false);
  const logArgs = ["logs", pod.name, "-n", pod.namespace, "--tail", "300", ...(previous ? ["--previous"] : [])];
  const logs = usePoll(() => invoke<string>("kubectl", { context: kctx, args: logArgs }), [kctx, pod.name, pod.namespace, previous], 3000);
  const mine = events.filter((e) => e.object === `pod/${pod.name}` && e.namespace === pod.namespace && e.warning).slice(0, 6);
  const command = `kubectl --context ${kctx} logs ${pod.name} -n ${pod.namespace} --tail 300${previous ? " --previous" : ""}`;
  const now = Date.now();

  return (
    <Drawer label={`Pod ${pod.name}`} title={<>{pod.name}</>} onClose={onClose}>
      <p className="hint">Namespace {pod.namespace} · {pod.ready} ready · {pod.restarts} restart{pod.restarts === 1 ? "" : "s"} · node {pod.node || "none yet"}</p>
      {problems.map((p) => (
        <div key={p.id} className={`problem-line ${p.level}`}>
          <b>{p.title}</b>
          <div className="hint">{p.detail}</div>
        </div>
      ))}
      {mine.length > 0 && (
        <div className="group">
          <h4>Warnings from Kubernetes</h4>
          <ul className="activity">
            {mine.map((e, i) => (
              <li key={i} className="warn">
                <span className="adot" aria-hidden="true" />
                <span>{e.message}</span>
                <span className="when">{ago(e.time, now)}{e.count > 1 ? ` · ${e.count}×` : ""}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="group">
        <h4>Logs</h4>
        {pod.restarts > 0 && (
          <label className="check">
            <input type="checkbox" checked={previous} onChange={(e) => setPrevious(e.target.checked)} />
            Show the previous run (before the last restart)
          </label>
        )}
        <Banner error={logs.error} />
        <pre className="out-log">{logs.data?.trim() || (logs.data === null ? "Loading…" : "No log output.")}</pre>
        <button onClick={() => navigator.clipboard.writeText(command)}><Icon name="copy" size={14} /> Copy kubectl logs command</button>
      </div>
    </Drawer>
  );
}
