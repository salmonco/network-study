import net, { type AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, expectTypeOf, it } from "vitest";
import { createServer } from "../src/server.ts";
import { sendRaw } from "./helpers/raw-client.ts";
import { sendChunks } from "./helpers/chunked-client.ts";

describe("HTTP Server", () => {
  let server: net.Server | undefined;

  beforeEach(() => {
    server = createServer();
  });

  afterEach(() => {
    server?.close();
    server = undefined;
  });

  it("createServer는 net.Server를 반환한다", () => {
    expectTypeOf(createServer).returns.toEqualTypeOf<net.Server>();
  });

  it("요청을 보내면 HTTP/1.1 200 OK\r\n로 시작하는 응답이 온다", async () => {
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
    const { port } = server?.address() as AddressInfo;
    const response = await sendRaw(port, "GET / HTTP/1.1\r\nHost: localhost\r\n\r\n");
    expect(response).toMatch(/^HTTP\/1\.1 200 OK\r\n/);
  });

  it("헤더 끝이 오기 전엔 응답하지 않는다", async () => {
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
    const { port } = server?.address() as AddressInfo;
    const { snapshots, response } = await sendChunks(port, [
      "GET / HTTP/1.1\r\nHost: loc",
      "alhost\r\n\r\n",
    ]);
    expect(snapshots[0]).toBe("");
    expect(response).toMatch(/^HTTP\/1\.1 200 OK\r\n/);
  });

  it("헤더 끝의 빈 줄이 별도 조각으로 와도 응답한다", async () => {
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
    const { port } = server?.address() as AddressInfo;
    const { snapshots, response } = await sendChunks(port, [
      "GET / HTTP/1.1\r\nHost: loc",
      "alhost\r\n",
      "\r\n",
    ]);
    expect(snapshots[0]).toBe("");
    expect(response).toMatch(/^HTTP\/1\.1 200 OK\r\n/);
  });

  it("없는 경로로 요청하면 404 Not Found로 응답한다", async () => {
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
    const { port } = server?.address() as AddressInfo;
    const response = await sendRaw(port, "GET /nope HTTP/1.1\r\nHost: localhost\r\n\r\n");
    expect(response).toMatch(/^HTTP\/1\.1 404 Not Found\r\n/);
  });

  it("없는 경로로 요청하면 404 응답 하나만 온다", async () => {
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
    const { port } = server?.address() as AddressInfo;
    const response = await sendRaw(port, "GET /nope HTTP/1.1\r\nHost: localhost\r\n\r\n");
    expect(response).toBe("HTTP/1.1 404 Not Found\r\n\r\n");
  });

  it.each(["/hi", "/abc", "/users/1", "/index.html"])(
    "%s로 요청하면 404로 응답한다",
    async (path) => {
      await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
      const { port } = server?.address() as AddressInfo;
      const response = await sendRaw(port, `GET ${path} HTTP/1.1\r\nHost: localhost\r\n\r\n`);
      expect(response).toBe("HTTP/1.1 404 Not Found\r\n\r\n");
    },
  );

  it("/hello로 요청하면 200으로 응답한다", async () => {
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
    const { port } = server?.address() as AddressInfo;
    const response = await sendRaw(port, "GET /hello HTTP/1.1\r\nHost: localhost\r\n\r\n");
    expect(response).toBe("HTTP/1.1 200 OK\r\n\r\n");
  });
});
