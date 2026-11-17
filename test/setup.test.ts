import net from "node:net";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { sendRaw } from "./helpers/raw-client.ts";

describe("예시 테스트", () => {
  let server: net.Server | undefined;

  afterEach(() => {
    server?.close();
    server = undefined;
  });

  it("TCP 서버를 띄우고 바이트를 주고받을 수 있다", async () => {
    // 받은 걸 그대로 돌려주고 연결을 닫는 에코 서버
    server = net.createServer((socket) => {
      socket.on("data", (chunk) => socket.end(chunk));
    });

    // 포트를 0으로 지정하면 OS가 비어 있는 포트를 골라준다 (테스트끼리 포트 충돌 방지)
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;

    const response = await sendRaw(port, "GET / HTTP/1.1\r\nHost: localhost\r\n\r\n");

    expect(response).toBe("GET / HTTP/1.1\r\nHost: localhost\r\n\r\n");
  });
});
