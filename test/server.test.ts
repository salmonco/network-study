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
    expect(response).toMatch(/^HTTP\/1\.1 200 OK\r\n/);
  });

  it("/hello로 요청하면 본문 hello를 응답한다", async () => {
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
    const { port } = server?.address() as AddressInfo;
    const response = await sendRaw(port, "GET /hello HTTP/1.1\r\nHost: localhost\r\n\r\n");
    expect(response).toBe("HTTP/1.1 200 OK\r\nContent-Length: 5\r\n\r\nhello");
  });

  it("/hi-ko로 요청하면 한글 본문의 바이트 길이를 Content-Length로 보낸다", async () => {
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
    const { port } = server?.address() as AddressInfo;
    const response = await sendRaw(port, "GET /hi-ko HTTP/1.1\r\nHost: localhost\r\n\r\n");
    expect(response).toBe("HTTP/1.1 200 OK\r\nContent-Length: 6\r\n\r\n안녕");
  });

  it.each(["POST", "PUT", "DELETE"])(
    "%s 메서드로 요청하면 405 Method Not Allowed로 응답한다",
    async (method) => {
      await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
      const { port } = server?.address() as AddressInfo;
      const response = await sendRaw(port, `${method} /hello HTTP/1.1\r\nHost: localhost\r\n\r\n`);
      expect(response).toBe("HTTP/1.1 405 Method Not Allowed\r\nAllow: GET, HEAD\r\n\r\n");
    },
  );

  it.each(["/hello?", "/hello?name=jisu", "/hello?x=1"])(
    "쿼리 문자열이 붙은 %s로 요청해도 경로에 맞는 본문을 응답한다",
    async (path) => {
      await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
      const { port } = server?.address() as AddressInfo;
      const response = await sendRaw(port, `GET ${path} HTTP/1.1\r\nHost: localhost\r\n\r\n`);
      expect(response).toBe("HTTP/1.1 200 OK\r\nContent-Length: 5\r\n\r\nhello");
    },
  );

  it("HEAD로 요청하면 본문 없이 GET과 같은 헤더로 응답한다", async () => {
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
    const { port } = server?.address() as AddressInfo;
    const response = await sendRaw(port, "HEAD /hello HTTP/1.1\r\nHost: localhost\r\n\r\n");
    expect(response).toBe("HTTP/1.1 200 OK\r\nContent-Length: 5\r\n\r\n");
  });

  it.each([
    "GARBAGE\r\n\r\n",
    "GET /hello\r\n\r\n",
    "GET /hello\r\nHost: localhost\r\n\r\n",
    "GET /hello HTTP/1.1 extra\r\nHost: localhost\r\n\r\n",
    "GET /hello FOO\r\nHost: localhost\r\n\r\n",
    "GET /hello http/1.1\r\nHost: localhost\r\n\r\n",
    "GET /hello HTTP/1\r\nHost: localhost\r\n\r\n",
  ])("요청줄 형식이 잘못된 %j 요청은 400 Bad Request로 응답한다", async (request) => {
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
    const { port } = server?.address() as AddressInfo;
    const response = await sendRaw(port, request);
    expect(response).toBe("HTTP/1.1 400 Bad Request\r\n\r\n");
  });

  it.each(["HTTP/2.0", "HTTP/3.0"])(
    "지원하지 않는 HTTP 버전인 %s로 요청하면 505 HTTP Version Not Supported로 응답한다",
    async (version) => {
      await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
      const { port } = server?.address() as AddressInfo;
      const response = await sendRaw(port, `GET /hello ${version}\r\nHost: localhost\r\n\r\n`);
      expect(response).toBe("HTTP/1.1 505 HTTP Version Not Supported\r\n\r\n");
    },
  );

  it("HTTP/1.1 요청에 Host 헤더가 없으면 400 Bad Request로 응답한다", async () => {
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
    const { port } = server?.address() as AddressInfo;
    const response = await sendRaw(port, "GET /hello HTTP/1.1\r\n\r\n");
    expect(response).toBe("HTTP/1.1 400 Bad Request\r\n\r\n");
  });

  it("HTTP/1.0 요청은 Host 헤더가 없어도 200으로 응답한다", async () => {
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
    const { port } = server?.address() as AddressInfo;
    const response = await sendRaw(port, "GET /hello HTTP/1.0\r\n\r\n");
    expect(response).toBe("HTTP/1.1 200 OK\r\nContent-Length: 5\r\n\r\nhello");
  });

  it("Host 헤더가 첫 번째 헤더가 아니어도 200으로 응답한다", async () => {
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
    const { port } = server?.address() as AddressInfo;
    const response = await sendRaw(
      port,
      "GET /hello HTTP/1.1\r\nAccept: */*\r\nHost: localhost\r\n\r\n",
    );
    expect(response).toBe("HTTP/1.1 200 OK\r\nContent-Length: 5\r\n\r\nhello");
  });

  it.each(["host", "HOST", "hOsT"])("Host 헤더 이름이 %s여도 200으로 응답한다", async (name) => {
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
    const { port } = server?.address() as AddressInfo;
    const response = await sendRaw(port, `GET /hello HTTP/1.1\r\n${name}: localhost\r\n\r\n`);
    expect(response).toBe("HTTP/1.1 200 OK\r\nContent-Length: 5\r\n\r\nhello");
  });

  it.each(["X-Host: localhost", "User-Agent: Hostile", "Accept: host"])(
    "Host 헤더 없이 %j만 있으면 400 Bad Request로 응답한다",
    async (header) => {
      await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
      const { port } = server?.address() as AddressInfo;
      const response = await sendRaw(port, `GET /hello HTTP/1.1\r\n${header}\r\n\r\n`);
      expect(response).toBe("HTTP/1.1 400 Bad Request\r\n\r\n");
    },
  );

  it.each([
    "Host: localhost\r\nHost: localhost",
    "Host: a.com\r\nHost: b.com",
    "Host: localhost\r\nhost: localhost",
  ])("Host 헤더가 두 개인 %j 요청은 400 Bad Request로 응답한다", async (headers) => {
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
    const { port } = server?.address() as AddressInfo;
    const response = await sendRaw(port, `GET /hello HTTP/1.1\r\n${headers}\r\n\r\n`);
    expect(response).toBe("HTTP/1.1 400 Bad Request\r\n\r\n");
  });

  it.each(["Host: localhost\r\nAccept : */*", "Host: localhost\r\nUser-Agent\t: curl"])(
    "콜론 앞에 공백이 있는 헤더 %j가 있으면 400 Bad Request로 응답한다",
    async (headers) => {
      await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
      const { port } = server?.address() as AddressInfo;
      const response = await sendRaw(port, `GET /hello HTTP/1.1\r\n${headers}\r\n\r\n`);
      expect(response).toBe("HTTP/1.1 400 Bad Request\r\n\r\n");
    },
  );

  it.each(["Host: localhost\r\nGarbage", "Host: localhost\r\nAccept */*"])(
    "콜론이 없는 헤더 줄 %j가 있으면 400 Bad Request로 응답한다",
    async (headers) => {
      await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
      const { port } = server?.address() as AddressInfo;
      const response = await sendRaw(port, `GET /hello HTTP/1.1\r\n${headers}\r\n\r\n`);
      expect(response).toBe("HTTP/1.1 400 Bad Request\r\n\r\n");
    },
  );

  it.each(["Host:localhost", "Host:\tlocalhost", "Host:   localhost"])(
    "콜론 뒤 공백이 %j처럼 없거나 여러 개여도 200으로 응답한다",
    async (header) => {
      await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
      const { port } = server?.address() as AddressInfo;
      const response = await sendRaw(port, `GET /hello HTTP/1.1\r\n${header}\r\n\r\n`);
      expect(response).toBe("HTTP/1.1 200 OK\r\nContent-Length: 5\r\n\r\nhello");
    },
  );

  it.each(["Host: localhost\r\n: x", "Host: localhost\r\nFoo Bar: x"])(
    "이름이 비었거나 공백이 섞인 헤더 %j가 있으면 400 Bad Request로 응답한다",
    async (headers) => {
      await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
      const { port } = server?.address() as AddressInfo;
      const response = await sendRaw(port, `GET /hello HTTP/1.1\r\n${headers}\r\n\r\n`);
      expect(response).toBe("HTTP/1.1 400 Bad Request\r\n\r\n");
    },
  );

  it.each([
    "Host: localhost\r\nFoo\tBar: x",
    "Host: localhost\r\nFoo@Bar: x",
    "Host: localhost\r\nFoo(Bar): x",
  ])(
    "이름에 token이 아닌 문자가 있는 헤더 %j가 있으면 400 Bad Request로 응답한다",
    async (headers) => {
      await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
      const { port } = server?.address() as AddressInfo;
      const response = await sendRaw(port, `GET /hello HTTP/1.1\r\n${headers}\r\n\r\n`);
      expect(response).toBe("HTTP/1.1 400 Bad Request\r\n\r\n");
    },
  );

  it("HTTP/1.1 요청에 Host 헤더가 없으면 없는 경로여도 400 Bad Request로 응답한다", async () => {
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
    const { port } = server?.address() as AddressInfo;
    const response = await sendRaw(port, "GET /nope HTTP/1.1\r\n\r\n");
    expect(response).toBe("HTTP/1.1 400 Bad Request\r\n\r\n");
  });

  it.each(["FOO", "get"])(
    "모르는 메서드 %s로 요청하면 501 Not Implemented로 응답한다",
    async (method) => {
      await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
      const { port } = server?.address() as AddressInfo;
      const response = await sendRaw(port, `${method} /hello HTTP/1.1\r\nHost: localhost\r\n\r\n`);
      expect(response).toBe("HTTP/1.1 501 Not Implemented\r\n\r\n");
    },
  );

  it.each(["G(T", "GE@T", "GET,"])(
    "메서드 %j가 token이 아니면 400 Bad Request로 응답한다",
    async (method) => {
      await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
      const { port } = server?.address() as AddressInfo;
      const response = await sendRaw(port, `${method} /hello HTTP/1.1\r\nHost: localhost\r\n\r\n`);
      expect(response).toBe("HTTP/1.1 400 Bad Request\r\n\r\n");
    },
  );

  it.each(["GET hello", "HEAD hello", "POST hello", "FOO hello"])(
    "요청줄 %j처럼 요청 대상이 /로 시작하지 않으면 400 Bad Request로 응답한다",
    async (methodAndRequestTarget) => {
      await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
      const { port } = server?.address() as AddressInfo;
      const response = await sendRaw(
        port,
        `${methodAndRequestTarget} HTTP/1.1\r\nHost: localhost\r\n\r\n`,
      );
      expect(response).toBe("HTTP/1.1 400 Bad Request\r\n\r\n");
    },
  );

  it.each(["http://localhost/hello", "http://localhost/hello?x=1"])(
    "요청 대상이 %s처럼 absolute-form이어도 경로에 맞는 본문을 응답한다",
    async (requestTarget) => {
      await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
      const { port } = server?.address() as AddressInfo;
      const response = await sendRaw(
        port,
        `GET ${requestTarget} HTTP/1.1\r\nHost: localhost\r\n\r\n`,
      );
      expect(response).toBe("HTTP/1.1 200 OK\r\nContent-Length: 5\r\n\r\nhello");
    },
  );

  it.each(["http://localhost/hello/extra", "http://localhost/hi-ko/x", "http://localhost/users/1"])(
    "absolute-form 요청 대상 %s의 경로 전체를 보고 없는 경로면 404로 응답한다",
    async (requestTarget) => {
      await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
      const { port } = server?.address() as AddressInfo;
      const response = await sendRaw(
        port,
        `GET ${requestTarget} HTTP/1.1\r\nHost: localhost\r\n\r\n`,
      );
      expect(response).toBe("HTTP/1.1 404 Not Found\r\n\r\n");
    },
  );
});
