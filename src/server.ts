import net from "node:net";

const bodies = {
  "/": "",
  "/hello": "hello",
  "/hi-ko": "안녕",
};

const isAllowedPath = (path: string): path is keyof typeof bodies => {
  return Object.keys(bodies).includes(path);
};

const allowedMethods = ["GET", "HEAD"] as const;

const isAllowedMethod = (method: string): method is (typeof allowedMethods)[number] => {
  return allowedMethods.includes(method as (typeof allowedMethods)[number]);
};

const allowedHttpVersions = ["HTTP/1.0", "HTTP/1.1"] as const;

const isAllowedHttpVersion = (version: string): version is (typeof allowedHttpVersions)[number] => {
  return allowedHttpVersions.includes(version as (typeof allowedHttpVersions)[number]);
};

export const createServer = () => {
  return net.createServer((socket) => {
    const chunks: Buffer[] = [];
    socket.on("data", (chunk) => {
      chunks.push(chunk);
      if (Buffer.concat(chunks).includes("\r\n\r\n")) {
        const message = Buffer.concat(chunks).toString();
        const requestHeader = message.split("\r\n\r\n")[0] ?? "";
        const [requestLine, ...additionalRequestArr] = requestHeader.split("\r\n");
        const tokens = (requestLine ?? "").split(" ");
        if (tokens.length !== 3) {
          socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
          socket.end();
          return;
        }
        const [method, requestTarget, httpVersion] = tokens;
        if (httpVersion === undefined || !/^HTTP\/\d\.\d$/.test(httpVersion)) {
          socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
          socket.end();
          return;
        }
        if (!isAllowedHttpVersion(httpVersion)) {
          socket.write("HTTP/1.1 505 HTTP Version Not Supported\r\n\r\n");
          socket.end();
          return;
        }
        const path = requestTarget?.split("?")[0];
        if (method === undefined || !isAllowedMethod(method)) {
          socket.write(
            `HTTP/1.1 405 Method Not Allowed\r\nAllow: ${allowedMethods.join(", ")}\r\n\r\n`,
          );
          socket.end();
          return;
        }
        if (path === undefined || !isAllowedPath(path)) {
          socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
          socket.end();
          return;
        }
        const headerList = additionalRequestArr.map((v) => {
          const [name, value] = v.split(":");
          const upperCaseName = name?.toUpperCase();
          return [upperCaseName, value];
        });
        if (
          headerList.filter((v) => v[0] !== v[0]?.trim()).length >= 1 ||
          headerList.filter((v) => v[0] === undefined || v[1] === undefined).length >= 1
        ) {
          socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
          socket.end();
          return;
        }
        if (
          httpVersion !== "HTTP/1.0" &&
          (headerList.filter((v) => v[0] === "HOST").length === 0 ||
            headerList.filter((v) => v[0] === "HOST").length >= 2)
        ) {
          socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
          socket.end();
          return;
        }
        socket.write("HTTP/1.1 200 OK\r\n");
        const body = bodies[path];
        socket.write(`Content-Length: ${Buffer.byteLength(body)}\r\n`);
        socket.write("\r\n");
        if (method !== "HEAD") {
          socket.write(body);
        }
        socket.end();
      }
    });
  });
};
