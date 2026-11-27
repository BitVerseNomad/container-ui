// A start or pull that failed because the registry wants a sign-in. For Amazon ECR the app can do it in one click:
// `aws ecr get-login-password | docker login`, with the browser sign-in to AWS first when the session ran out,
// then the Start that failed runs again. The password goes from aws to docker and nowhere else.
import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Banner, Button, Select, useConfirm } from "./ui/op";
import OutputLog from "./ui/OutputLog";
import { detectRegistryAuth, detectRegistryDenied, type RegistryAuth } from "./lib/registryAuth";
import { addRegistry, asLoginError, cancelAwsSignIn, profilesFor, rememberProfile, rememberedProfile, savedRegistry, setDockerAwsProfile, signInToRegistry, signInTrying, type AwsProfile } from "./lib/registries";

type Step = "ask" | "running" | "done" | "aws-running" | "no-aws" | "failed";

// One failed Start signs in by itself at most once: when the same failure text comes back inside this window,
// the sign-in did not fix it, and asking again would loop start, fail, sign in, start.
const AUTO_AGAIN_MS = 120_000;
const autoSignedAt = new Map<string, number>();

// onDone: what to run once the sign-in worked (the Start that failed), so nobody has to find it again.
export default function RegistryLoginFix({ text, onDone }: { text: string; onDone?: () => void }) {
  const found = detectRegistryAuth(text);
  if (!found) return null;
  // The profile in use cannot read this registry: signing in again changes nothing, so the person picks another profile.
  return detectRegistryDenied(text) ? <WrongProfile found={found} onDone={onDone} /> : <Fix found={found} text={text} onDone={onDone} />;
}

function Fix({ found, text, onDone }: { found: RegistryAuth; text: string; onDone?: () => void }) {
  const confirm = useConfirm();
  // A registry saved on the Registries page signs in at once, with the profile saved there.
  const [saved] = useState(() => savedRegistry(found.registry));
  const failureKey = `${found.registry}\n${text}`;
  // Pure on purpose: React's strict mode runs this twice. The time is written in the effect below.
  const [auto] = useState(() => !!saved && Date.now() - (autoSignedAt.get(failureKey) ?? 0) >= AUTO_AGAIN_MS);
  const [step, setStep] = useState<Step>(auto ? "running" : "ask");
  const [problem, setProblem] = useState("");
  const [profiles, setProfiles] = useState<string[]>([]);
  const [profile, setProfile] = useState<string | undefined>(saved?.profile);
  const [matches, setMatches] = useState<string[]>([]);
  const cancelled = useRef(false);
  const started = useRef(false);

  useEffect(() => {
    let live = true;
    // The profile of the account named in the address comes first; the rest is the AWS config's own order.
    Promise.all([
      invoke<string[]>("aws_profiles").catch(() => [] as string[]),
      invoke<AwsProfile[]>("aws_profile_accounts").catch(() => [] as AwsProfile[]),
    ]).then(([list, accounts]) => {
      if (!live) return;
      const same = profilesFor(found.registry, Array.isArray(accounts) ? accounts : []);
      setProfiles(list);
      setMatches(same);
      if (saved) return;
      const remembered = rememberedProfile();
      setProfile(same[0] ?? (remembered && list.includes(remembered) ? remembered : list[0]));
    });
    return () => { live = false; };
  }, [saved, found.registry]);

  async function run(p: string | undefined) {
    cancelled.current = false;
    setStep("running");
    try {
      // Tries the other profiles of the same account when this one is not allowed to read the registry.
      const worked = await signInTrying({ registry: found.registry, region: found.region, profile: p }, matches, (s) => setStep(s === "aws" ? "aws-running" : "running"));
      // Next time this registry signs in by itself.
      if (!saved) addRegistry({ registry: found.registry, region: found.region, profile: worked ?? p });
      setStep("done");
      onDone?.();
    } catch (e) {
      if (cancelled.current) { setStep("ask"); return; }
      const err = asLoginError(e);
      setProblem(err.message);
      setStep(err.kind === "no-aws" ? "no-aws" : "failed");
    }
  }

  useEffect(() => {
    if (!auto || !saved || started.current) return; // started: React's strict mode runs effects twice
    started.current = true;
    autoSignedAt.set(failureKey, Date.now());
    void run(saved.profile);
  }, []);

  const choose = (p: string) => { setProfile(p); rememberProfile(p); };
  const profileWords = profile ? ` --profile ${profile}` : "";

  async function signIn() {
    const ok = await confirm({
      title: `Sign in to ${found.registry}?`,
      body: "Container UI asks AWS for a sign-in and gives it to Docker. If your AWS session ran out, your browser opens to renew it first. Docker keeps the login, valid for about 12 hours.",
      command: `aws ecr get-login-password --region ${found.region}${profileWords} | docker login --username AWS --password-stdin ${found.registry}`,
      confirm: "Sign in",
    });
    if (ok) await run(profile);
  }

  async function cancelAws() {
    cancelled.current = true;
    await cancelAwsSignIn();
  }

  if (step === "no-aws") return <Banner tone="warn">The AWS command line tool is not installed.</Banner>;
  if (step === "done") return <Banner tone="info">{onDone ? "Signed in. Starting it again…" : "Signed in. Start it again."}</Banner>;

  const busy = step === "running" || step === "aws-running";
  const picker = profiles.length > 1 && profile ? (
    <Select aria-label="AWS profile" value={profile} onChange={choose} options={profiles.map((p) => ({ value: p, label: p }))} disabled={busy} />
  ) : null;
  const line =
    step === "aws-running" ? "Finish the AWS sign-in in your browser."
    : step === "running" ? `Signing in to ${found.registry}…`
    : step === "failed" ? `Signing in did not work. ${problem}`
    : `This image needs a sign-in to ${found.registry}.`;
  return (
    <>
      <Banner
        tone={step === "failed" ? "bad" : "info"}
        actions={
          <>
            {picker}
            <Button size="xs" variant="primary" busy={busy} disabled={busy} onClick={() => void signIn()}>Sign in to AWS registry</Button>
            {step === "aws-running" && <Button size="xs" onClick={() => void cancelAws()}>Cancel</Button>}
          </>
        }
      >
        {line}
      </Banner>
      {step === "aws-running" && <OutputLog event="aws-sso-progress" active status="Waiting for AWS sign-in…" />}
    </>
  );
}

// The sign-in worked but this AWS profile may not read the registry. Never signs in by itself and never restarts by itself.
function WrongProfile({ found, onDone }: { found: RegistryAuth; onDone?: () => void }) {
  const [profiles, setProfiles] = useState<string[]>([]);
  const [current] = useState(() => savedRegistry(found.registry)?.profile ?? rememberedProfile() ?? undefined);
  const [pick, setPick] = useState<string | undefined>(current);
  const [step, setStep] = useState<"ask" | "running" | "aws-running" | "failed">("ask");
  const [problem, setProblem] = useState("");
  const cancelled = useRef(false);

  useEffect(() => {
    let live = true;
    invoke<string[]>("aws_profiles").then((list) => {
      if (!live) return;
      setProfiles(list);
      setPick((p) => p ?? list[0]);
    }, () => {});
    return () => { live = false; };
  }, []);

  async function useProfile() {
    cancelled.current = false;
    setStep("running");
    try {
      addRegistry({ registry: found.registry, region: found.region, profile: pick });
      if (pick) rememberProfile(pick);
      await setDockerAwsProfile(pick ?? null);
      await signInToRegistry({ registry: found.registry, region: found.region, profile: pick }, (s) => setStep(s === "aws" ? "aws-running" : "running"));
      onDone?.();
    } catch (e) {
      if (cancelled.current) { setStep("ask"); return; }
      setProblem(asLoginError(e).message);
      setStep("failed");
    }
  }

  const busy = step === "running" || step === "aws-running";
  const options = pick && !profiles.includes(pick) ? [pick, ...profiles] : profiles;
  return (
    <>
      <Banner
        tone="bad"
        actions={
          <>
            {pick && <Select aria-label="AWS profile" value={pick} onChange={setPick} options={options.map((p) => ({ value: p, label: p }))} disabled={busy} />}
            <Button size="xs" variant="primary" busy={busy} disabled={busy} onClick={() => void useProfile()}>Use this profile and start again</Button>
            {step === "aws-running" && <Button size="xs" onClick={() => { cancelled.current = true; void cancelAwsSignIn(); }}>Cancel</Button>}
          </>
        }
      >
        {step === "aws-running" ? "Finish the AWS sign-in in your browser."
          : step === "failed" ? `Signing in did not work. ${problem}`
          : `${current ?? "This AWS profile"} is signed in but is not allowed to read ${found.registry}. Pick another AWS profile.`}
      </Banner>
      {step === "aws-running" && <OutputLog event="aws-sso-progress" active status="Waiting for AWS sign-in…" />}
    </>
  );
}
