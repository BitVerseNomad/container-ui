// Private image registries (Amazon ECR). Sign in once here, and Compose and Run just work.
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Banner, Button, Empty, Field, Select } from "./ui/op";
import {
  addRegistry, orderProfiles, setDockerAwsProfile, asLoginError, cancelAwsSignIn, loadRegistries, parseEcrHost, rememberProfile, rememberedProfile,
  profilesFor, removeRegistry, saveRegistries, signedInSince, signInTrying, type AwsProfile, type FoundRegistry, type Registry,
} from "./lib/registries";

type Status = { kind: "running" | "aws" | "failed" | "no-aws"; text?: string };

const DEFAULT_PROFILE = "default";
const HINT = "Docker Hub and public registries need nothing here.";

// Which AWS profile signs in to a registry: the one whose account is in the address. One match is just said; the
// list only shows when there is a real choice (several matches, or none and so every profile).
function ProfilePick({ host, value, all, accounts, onChange, disabled, label }: { host?: string; value: string; all: string[]; accounts: AwsProfile[]; onChange: (p: string) => void; disabled?: boolean; label: string }) {
  const matches = host ? profilesFor(host, accounts) : [];
  const options = matches.length ? matches : all.includes(value) ? all : [value, ...all];
  if (matches.length === 1) return <span className="hint whitespace-nowrap leading-none" title="The AWS profile for this account">Profile <b className="font-medium text-fg">{matches[0]}</b></span>;
  return (
    <>
      <span className="hint leading-none" aria-hidden="true">{matches.length ? "Profile for this account" : "AWS profile"}</span>
      <Select aria-label={label} value={options.includes(value) ? value : options[0]} onChange={onChange} options={options.map((v) => ({ value: v, label: v }))} disabled={disabled} />
    </>
  );
}

const ago = (since: number) => {
  const min = Math.floor((Date.now() - since) / 60000);
  return min < 1 ? "just now" : min < 60 ? `${min} min ago` : `${Math.floor(min / 60)} h ago`;
};

export default function Registries() {
  const [list, setList] = useState<Registry[]>(loadRegistries);
  const [profiles, setProfiles] = useState<string[]>([]);
  const [profile, setProfile] = useState<string>(() => rememberedProfile() ?? DEFAULT_PROFILE);
  const [input, setInput] = useState("");
  const [invalid, setInvalid] = useState("");
  const [status, setStatus] = useState<Record<string, Status | undefined>>({});
  const [, redraw] = useState(0);
  const [accounts, setAccounts] = useState<AwsProfile[]>([]);
  const [found, setFound] = useState<FoundRegistry[]>([]);

  useEffect(() => {
    let live = true;
    invoke<string[]>("aws_profiles").then((p) => {
      if (!live) return;
      const ordered = orderProfiles(p);
      setProfiles(ordered);
      if (!rememberedProfile() && ordered[0]) setProfile(ordered[0]);
    }, () => {});
    invoke<AwsProfile[]>("aws_profile_accounts").then((a) => live && setAccounts(Array.isArray(a) ? a : []), () => {});
    invoke<FoundRegistry[]>("find_registries").then((f) => live && setFound(Array.isArray(f) ? f : []), () => {});
    return () => { live = false; };
  }, []);
  const typedHost = parseEcrHost(input)?.registry;
  const profileFor = (host: string | undefined, chosen: string) => {
    const m = host ? profilesFor(host, accounts) : [];
    return m.length && !m.includes(chosen) ? m[0] : chosen;
  };

  function add() {
    const parsed = parseEcrHost(input);
    if (!parsed) { setInvalid("That is not an Amazon ECR address."); return; }
    const used = profileFor(parsed.registry, profile);
    setList(addRegistry({ ...parsed, profile: used }));
    rememberProfile(used);
    setInput("");
    setInvalid("");
  }
  const remove = (host: string) => setList(removeRegistry(host));
  const setProfileOf = (r: Registry, p: string) => {
    const next = list.map((x) => (x.registry === r.registry ? { ...x, profile: p } : x));
    saveRegistries(next);
    setList(next);
    void setDockerAwsProfile(p);
  };

  async function signIn(r: Registry) {
    const set = (s: Status | undefined) => setStatus((m) => ({ ...m, [r.registry]: s }));
    set({ kind: "running" });
    try {
      const worked = await signInTrying(r, profilesFor(r.registry, accounts), (step) => set({ kind: step === "aws" ? "aws" : "running" }));
      if (worked && worked !== r.profile) setProfileOf(r, worked);
      set(undefined);
    } catch (e) {
      const err = asLoginError(e);
      set(err.kind === "no-aws" ? { kind: "no-aws" } : { kind: "failed", text: err.message });
    }
    redraw((n) => n + 1);
  }

  const form = (center: boolean) => (
    <div className={`flex flex-wrap items-center gap-2 ${center ? "justify-center" : ""}`}>
      <Field
        className="w-96 max-w-full"
        aria-label="Registry or image"
        placeholder="account-id.dkr.ecr.region.amazonaws.com"
        value={input}
        invalid={invalid || undefined}
        onChange={(e) => { setInput(e.target.value); setInvalid(""); }}
        onKeyDown={(e) => e.key === "Enter" && add()}
      />
      <ProfilePick host={typedHost} value={profile} all={profiles} accounts={accounts} onChange={setProfile} label="AWS profile for the new registry" />
      <Button variant="primary" onClick={add}>Add</Button>
      {profiles.length > 1 && <span className="hint basis-full">{`The AWS profile list comes from your AWS config on this Mac (${profiles.length} found).`}</span>}
    </div>
  );

  const suggestions = found.filter((f) => !list.some((r) => r.registry === f.registry));
  const suggested = suggestions.length > 0 && (
    <div className="flex flex-col gap-2">
      <h2 className="text-body font-medium">Found in your Compose projects</h2>
      <ul className="flex flex-col gap-2" aria-label="Registries found in your projects">
        {suggestions.map((f) => {
          const m = profilesFor(f.registry, accounts);
          return (
            <li key={f.registry} className="flex flex-wrap items-center gap-2">
              <span className="min-w-[16rem] flex-1"><span className="break-all font-mono">{f.registry}</span> <span className="hint">used by {f.project}</span></span>
              {m[0] && <span className="hint whitespace-nowrap">Profile <b className="font-medium text-fg">{m[0]}</b></span>}
              <Button variant="primary" aria-label={`Add ${f.registry}`} onClick={() => { setList(addRegistry({ registry: f.registry, region: f.region, profile: m[0] ?? profile })); if (m[0]) rememberProfile(m[0]); }}>Add</Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
  return (
    <div className="flex flex-col gap-3 pt-3">
      {suggested}
      {list.length === 0 && suggestions.length > 0 ? (
        <>
          <h2 className="mt-2 text-body font-medium">Or add another</h2>
          {form(false)}
        </>
      ) : list.length === 0 ? (
        <Empty icon="download" title="No registries yet" actions={form(true)}>
          {HINT} Add an Amazon ECR address below and Container UI signs in to it with your AWS profile whenever a pull needs it.
        </Empty>
      ) : (
        <>
          <ul className="flex flex-col gap-2" aria-label="Saved registries">
            {list.map((r) => {
              const st = status[r.registry];
              const busy = st?.kind === "running" || st?.kind === "aws";
              const since = signedInSince(r.registry);
              return (
                <li key={r.registry} className="flex flex-col gap-1 border-b border-edge pb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-[16rem] flex-1 break-all font-mono">{r.registry}</span>
                    <ProfilePick host={r.registry} value={r.profile ?? DEFAULT_PROFILE} all={profiles} accounts={accounts} onChange={(p) => setProfileOf(r, p)} disabled={busy} label={`AWS profile for ${r.registry}`} />
                    <Button busy={busy} disabled={busy} aria-label={`Sign in to ${r.registry}`} onClick={() => void signIn(r)}>Sign in</Button>
                    {st?.kind === "aws" && <Button onClick={() => void cancelAwsSignIn()}>Cancel</Button>}
                    <Button variant="danger-quiet" icon="trash" aria-label={`Remove ${r.registry}`} disabled={busy} onClick={() => remove(r.registry)}>Remove</Button>
                  </div>
                  {st?.kind === "running" && <span className="hint">Signing in…</span>}
                  {st?.kind === "aws" && <span className="hint">Finish the AWS sign-in in your browser.</span>}
                  {st?.kind === "no-aws" && <Banner tone="warn">The AWS command line tool is not installed.</Banner>}
                  {st?.kind === "failed" && <Banner tone="bad">{/AccessDenied|not authorized/i.test(st.text ?? "") ? `${r.profile ?? DEFAULT_PROFILE} is not allowed to pull images from this registry. Pick another AWS profile.` : `Signing in did not work. ${st.text ?? ""}`}</Banner>}
                  {!st && since !== undefined && <span className="hint">{`Signed in ${ago(since)}. Docker keeps it for about 12 hours.`}</span>}
                </li>
              );
            })}
          </ul>
          <h2 className="mt-2 text-body font-medium">Add a registry</h2>
          <p className="hint">{HINT}</p>
          {form(false)}
        </>
      )}
    </div>
  );
}
