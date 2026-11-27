import { afterEach, describe, expect, it, vi } from "vitest";
import { signInTrying, addRegistry, loadRegistries, parseEcrHost, removeRegistry, savedRegistry, withRegistry, withoutRegistry } from "./registries";

const HOST = "123456789012.dkr.ecr.us-west-2.amazonaws.com";
afterEach(() => localStorage.clear());

describe("parseEcrHost", () => {
  it("given a bare ECR host, then it returns the host and its region", () => {
    expect(parseEcrHost(HOST)).toEqual({ registry: HOST, region: "us-west-2" });
  });
  it("given a full image reference, then it returns the host and its region", () => {
    expect(parseEcrHost(`  ${HOST}/team/app:1.0 `)).toEqual({ registry: HOST, region: "us-west-2" });
  });
  it("given FIPS and China hosts, then it reads their regions", () => {
    expect(parseEcrHost("123456789012.dkr.ecr-fips.us-east-1.amazonaws.com")?.region).toBe("us-east-1");
    expect(parseEcrHost("123456789012.dkr.ecr.cn-north-1.amazonaws.com.cn")?.region).toBe("cn-north-1");
  });
  it("given a non-ECR registry, then it returns null", () => {
    expect(parseEcrHost("ghcr.io/org/app:1")).toBeNull();
    expect(parseEcrHost("nginx:latest")).toBeNull();
    expect(parseEcrHost(`${HOST}.evil.com/app`)).toBeNull();
  });
  it("given junk or nothing, then it returns null", () => {
    expect(parseEcrHost("")).toBeNull();
    expect(parseEcrHost("   ")).toBeNull();
    expect(parseEcrHost("not a host")).toBeNull();
    expect(parseEcrHost("12345.dkr.ecr.us-west-2.amazonaws.com")).toBeNull();
  });
});

describe("saved registries", () => {
  it("given nothing saved, then the list is empty", () => {
    expect(loadRegistries()).toEqual([]);
  });
  it("given a host is added, then it is kept and found again", () => {
    addRegistry({ registry: HOST, region: "us-west-2", profile: "prod-readonly" });
    expect(loadRegistries()).toEqual([{ registry: HOST, region: "us-west-2", profile: "prod-readonly" }]);
    expect(savedRegistry(HOST)?.profile).toBe("prod-readonly");
  });
  it("given the same host again, then it is replaced, not doubled", () => {
    const once = withRegistry([{ registry: HOST, region: "us-west-2", profile: "a" }], { registry: HOST, region: "us-west-2", profile: "b" });
    expect(once).toEqual([{ registry: HOST, region: "us-west-2", profile: "b" }]);
  });
  it("given a host is removed, then only it goes", () => {
    const other = { registry: "123456789012.dkr.ecr.eu-west-1.amazonaws.com", region: "eu-west-1" };
    addRegistry({ registry: HOST, region: "us-west-2" });
    addRegistry(other);
    expect(removeRegistry(HOST)).toEqual([other]);
    expect(withoutRegistry([other], "nope")).toEqual([other]);
  });
  it("given damaged saved data, then the list is empty and nothing throws", () => {
    localStorage.setItem("container-ui:registries", "{oops");
    expect(loadRegistries()).toEqual([]);
    localStorage.setItem("container-ui:registries", JSON.stringify([{ registry: 1 }, { registry: HOST, region: "us-west-2" }]));
    expect(loadRegistries()).toEqual([{ registry: HOST, region: "us-west-2" }]);
  });
});


const denied = { kind: "login", message: "AccessDeniedException ... is not authorized to perform: ecr:GetAuthorizationToken" };
describe("signInTrying", () => {
  it("given the first profile is not allowed to read ECR, when signing in, then the next profile of the account is tried and returned", async () => {
    const calls: (string | undefined)[] = [];
    vi.doMock("@tauri-apps/api/core", () => ({ invoke: async (cmd: string, a: { profile?: string }) => { if (cmd === "registry_login") { calls.push(a.profile); if (a.profile === "prod-admin") throw denied; } } }));
    vi.resetModules();
    const m = await import("./registries");
    const worked = await m.signInTrying({ registry: HOST, region: "us-west-2", profile: "prod-admin" }, ["prod-admin", "prod-readonly"]);
    expect(worked).toBe("prod-readonly");
    expect(calls).toEqual(["prod-admin", "prod-readonly"]);
    vi.doUnmock("@tauri-apps/api/core");
  });
});
void signInTrying;
