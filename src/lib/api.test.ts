// Covers run()/runCrmTool()'s confirm-token retry flow: previously 0% tested
// in a repo with no test runner at all. The logic is pure (req()'s only
// dependency is global fetch) so no DOM/React needed.
import { describe, it, expect, vi } from "vitest";
import { run, runCrmTool } from "./api";

function jsonResponse(body: unknown, status = 200) {
  return {
    status,
    ok: status < 400,
    statusText: "",
    json: async () => body,
  } as Response;
}

// store.get/set wrap localStorage in try/catch, so running in vitest's
// default node environment (no localStorage global) is fine — req() just
// sends no Authorization header, which these tests don't assert on.

describe("run()", () => {
  it("returns the result directly when the tool isn't confirm-gated", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const confirm = vi.fn();

    const result = await run("support_ops_sla_risk_monitor", {}, confirm);

    expect(result).toEqual({ ok: true });
    expect(confirm).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it("previews then executes with the same args plus the confirm_token, when the user confirms", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ preview: { id: "1" }, confirm_token: "tok-123" }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const confirm = vi.fn().mockResolvedValue(true);

    const result = await run("support_ops_pause_collisions", { id: "1" }, confirm);

    expect(result).toEqual({ ok: true });
    expect(confirm).toHaveBeenCalledWith("support_ops_pause_collisions", { id: "1" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondCallBody = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string);
    expect(secondCallBody).toEqual({ args: { id: "1" }, confirm_token: "tok-123" });
    vi.unstubAllGlobals();
  });

  it("returns null and never fires a second request when the user declines", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ preview: {}, confirm_token: "tok-123" }));
    vi.stubGlobal("fetch", fetchMock);
    const confirm = vi.fn().mockResolvedValue(false);

    const result = await run("support_ops_pause_collisions", {}, confirm);

    expect(result).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});

describe("runCrmTool()", () => {
  it("hits /api/ops/crm-tools/{provider}/{name}, not /api/ops/tools/{name}", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const confirm = vi.fn();

    await runCrmTool("salesforce", "salesforce_update_contact", { id: "003" }, confirm);

    const [path] = fetchMock.mock.calls[0];
    expect(path).toBe("/api/ops/crm-tools/salesforce/salesforce_update_contact");
    vi.unstubAllGlobals();
  });

  it("repeats the same preview/confirm flow as run() for a provider's own write tool", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ preview: { id: "1" }, confirm_token: "tok-456" }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const confirm = vi.fn().mockResolvedValue(true);

    const result = await runCrmTool("salesforce", "salesforce_delete_contact", { id: "1" }, confirm);

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });
});
