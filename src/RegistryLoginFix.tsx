// A start or pull that failed because the registry wants a sign-in. For Amazon ECR the app can do it: ask first,
// then `aws ecr get-login-password | docker login`. The password goes from aws to docker and nowhere else.
import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Banner, Button, Select, useConfirm } from "./ui/op";
import OutputLog from "./ui/OutputLog";
import { detectRegistryAuth, type RegistryAuth } from "./lib/registryAuth";

type LoginError = { kind: "aws-session" | "no-aws" | "login"; message: string };
type Step = "ask" | "running" | "done" | "aws-session" | "aws-running" | "aws-done" | "no-aws" | "failed";

const PROFILE_KEY = "container-ui:awsProfile";
const rememberedProfile = () => { try { return localStorage.getItem(PROFILE_KEY); } catch { return null; } };
const remember = (p: string) => { try { localStorage.setItem(PROFILE_KEY, p); } catch { /* the choice just isn't kept */ } };
const asError = (e: unknown): LoginError => (e && typeof e === "object" && "kind" in e ? (e as LoginError) : { kind: "login", message: String(e) });

export default function RegistryLoginFix({ text }: { text: string }) {
  const found = detectRegistryAuth(text);
  return found ? <Fix found={found} /> : null;
}

function Fix({ found }: { found: RegistryAuth }) {
  const confirm = useConfirm();
  const [step, setStep] = useState<Step>("ask");
  const [problem, setProblem] = useState("");
  const [profiles, setProfiles] = useState<string[]>([]);
  const [profile, setProfile] = useState<string | undefined>();
  const cancelled = useRef(false);

  useEffect(() => {
    let live = true;
    invoke<string[]>("aws_profiles").then((list) => {
      if (!live) return;
      setProfiles(list);
      const saved = rememberedProfile();
      setProfile(saved && list.includes(saved) ? saved : list[0]);
    }, () => {});
    return () => { live = false; };
  }, []);

  const choose = (p: string) => { setProfile(p); remember(p); };
  const profileWords = profile ? ` --profile ${profile}` : "";

  async function signIn() {
    const ok = await confirm({
      title: `Sign in to ${found.registry}?`,
      body: "Container UI asks AWS for a sign-in and gives it to Docker. Docker keeps the login, valid for about 12 hours. Nothing else changes.",
      command: `aws ecr get-login-password --region ${found.region}${profileWords} | docker login --username AWS --password-stdin ${found.registry}`,
      confirm: "Sign in",
    });
    if (!ok) return;
    setStep("running");
    try {
      await invoke<void>("registry_login", { registry: found.registry, profile });
      setStep("done");
    } catch (e) {
      const err = asError(e);
      setProblem(err.message);
      setStep(err.kind === "aws-session" ? "aws-session" : err.kind === "no-aws" ? "no-aws" : "failed");
    }
  }

  async function awsFirst() {
    cancelled.current = false;
    setStep("aws-running");
    try {
      await invoke<void>("aws_sso_login", { profile });
      setStep("aws-done");
    } catch (e) {
      if (cancelled.current) {
        setStep("aws-session");
        return;
      }
      setProblem(asError(e).message);
      setStep("failed");
    }
  }

  async function cancelAws() {
    cancelled.current = true;
    await invoke<boolean>("aws_sso_cancel").catch(() => false);
  }

  if (step === "no-aws") return <Banner tone="warn">The AWS command line tool is not installed.</Banner>;
  if (step === "done") return <Banner tone="info">Signed in. Start it again.</Banner>;

  const busy = step === "running" || step === "aws-running";
  const picker = profiles.length > 1 && profile ? (
    <Select aria-label="AWS profile" value={profile} onChange={choose} options={profiles.map((p) => ({ value: p, label: p }))} disabled={busy} />
  ) : null;
  const awsStep = step === "aws-session" || step === "aws-running";
  const actions = (
    <>
      {picker}
      {awsStep && <Button size="xs" variant="primary" busy={step === "aws-running"} disabled={busy} onClick={() => void awsFirst()}>Sign in to AWS first</Button>}
      {step === "aws-running" && <Button size="xs" onClick={() => void cancelAws()}>Cancel</Button>}
      {!awsStep && <Button size="xs" variant="primary" busy={step === "running"} disabled={busy} onClick={() => void signIn()}>Sign in to AWS registry</Button>}
    </>
  );
  const line =
    step === "aws-session" ? "AWS needs you signed in first."
    : step === "aws-done" ? "Signed in to AWS. Now sign in to the registry."
    : step === "failed" ? `Signing in did not work. ${problem}`
    : `This image needs a sign-in to ${found.registry}.`;
  return (
    <>
      <Banner tone={step === "failed" ? "bad" : "info"} actions={step === "aws-done" ? <Button size="xs" variant="primary" onClick={() => void signIn()}>Sign in to AWS registry</Button> : actions}>{line}</Banner>
      {(awsStep || step === "aws-done") && <OutputLog event="aws-sso-progress" active={step === "aws-running"} status="Waiting for AWS sign-in…" />}
    </>
  );
}
