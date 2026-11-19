import net, { type AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, expectTypeOf, it } from "vitest";
import { createServer } from "../src/server.ts";
import { sendRaw } from "./helpers/raw-client.ts";

describe("HTTP Server", () => {
  let server: net.Server | undefined;

  beforeEach(() => {
    server = createServer();
  });

  afterEach(() => {
    server?.close();
    server = undefined;
  });

  it("서버를 만들 수 있다", () => {
    expectTypeOf(createServer).returns.toEqualTypeOf<net.Server>();
  });

  it("요청을 보내면 HTTP/1.1 200 OK\r\n로 시작하는 응답이 온다", async () => {
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
    const { port } = server?.address() as AddressInfo;
    const response = await sendRaw(port, "GET / HTTP/1.1\r\nHost: localhost\r\n\r\n");
    expect(response).toMatch(/^HTTP\/1\.1 200 OK\r\n/);
  });
});
