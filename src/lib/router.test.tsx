import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import React from "react";
import { go, useRoute } from "./router.ts";

function RouteReader() {
  const { route } = useRoute();
  return <div data-route={route.page}>{JSON.stringify(route)}</div>;
}

beforeEach(() => {
  window.localStorage.clear();
  window.location.hash = "";
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("go", () => {
  it("Given the hash '#/images', when go('#/volumes') runs, then location.hash is '#/volumes'", () => {
    window.location.hash = "#/images";
    go("#/volumes");
    expect(window.location.hash).toBe("#/volumes");
  });

  it("Given the address '/?scenario=design#/images', when go('#/volumes') runs, then location.search is still '?scenario=design'", () => {
    window.history.replaceState(null, "", "/?scenario=design");
    window.location.hash = "#/images";
    go("#/volumes");
    expect(window.location.search).toBe("?scenario=design");
    expect(window.location.hash).toBe("#/volumes");
  });
});

describe("useRoute", () => {
  it("Given an unknown hash '#/nowhere', when a component calls useRoute, then the hash becomes '#/containers'", async () => {
    window.location.hash = "#/nowhere";
    render(<RouteReader />);
    await waitFor(() => expect(window.location.hash).toBe("#/containers"));
  });

  it("Given localStorage 'openpier:last-route' is '#/images' and the hash is empty, when useRoute runs, then the hash becomes '#/images'", async () => {
    window.localStorage.setItem("openpier:last-route", "#/images");
    window.location.hash = "";
    render(<RouteReader />);
    await waitFor(() => expect(window.location.hash).toBe("#/images"));
  });

  it("Given localStorage throws on read, when useRoute runs on an empty hash, then the hash becomes '#/containers'", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    window.location.hash = "";
    render(<RouteReader />);
    await waitFor(() => expect(window.location.hash).toBe("#/containers"));
  });
});
