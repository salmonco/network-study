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
const notAllowedMethods = ["POST", "PUT", "DELETE"] as const;

const isAllowedMethod = (method: string): method is (typeof allowedMethods)[number] => {
  return allowedMethods.includes(method as (typeof allowedMethods)[number]);
};

const isNotAllowedMethod = (method: string): method is (typeof notAllowedMethods)[number] => {
  return notAllowedMethods.includes(method as (typeof notAllowedMethods)[number]);
};

const allowedHttpVersions = ["HTTP/1.0", "HTTP/1.1"] as const;

const isAllowedHttpVersion = (version: string): version is (typeof allowedHttpVersions)[number] => {
  return allowedHttpVersions.includes(version as (typeof allowedHttpVersions)[number]);
};

/**
 * @see https://www.rfc-editor.org/info/rfc9110/#section-5.6.2
 */
const tokenPattern = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

const isToken = (s: string) => tokenPattern.test(s);

const isAbsoluteForm = (requestTarget: string) => {
  const upperCaseRequestTarget = requestTarget.toUpperCase();
  return (
    upperCaseRequestTarget.startsWith("HTTP://") || upperCaseRequestTarget.startsWith("HTTPS://")
  );
};

/**
 * authority는 "//" 뒤에서 시작해 처음 나오는 "/", "?", "#" 또는 끝에서 끝난다.
 * @see https://www.rfc-editor.org/rfc/rfc3986#section-3.2
 */
const splitAbsoluteForm = (absoluteForm: string) => {
  const afterScheme = absoluteForm.slice(absoluteForm.indexOf("://") + "://".length);
  const authorityEnd = afterScheme.search(/[/?#]/);
  if (authorityEnd === -1) {
    return { authority: afterScheme, rest: "" };
  }
  return {
    authority: afterScheme.slice(0, authorityEnd),
    rest: afterScheme.slice(authorityEnd),
  };
};

/**
 * 경로가 비어 있으면 "/"로 본다.
 * @see https://www.rfc-editor.org/rfc/rfc9112#section-3.2.1
 */
const toOriginForm = (rest: string) => (rest.startsWith("/") ? rest : "/" + rest);

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
        const headerList = additionalRequestArr.map((v) => {
          const [name, value] = v.split(":");
          const upperCaseName = name?.toUpperCase();
          return [upperCaseName, value];
        });
        const headerNames = headerList.map((v) => v[0]);
        const hostFieldLength = headerNames.filter((v) => v === "HOST").length;
        if (httpVersion !== "HTTP/1.0" && (hostFieldLength == 0 || hostFieldLength >= 2)) {
          socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
          socket.end();
          return;
        }
        if (
          headerList.filter((v) => v[0] === undefined || v[1] === undefined).length >= 1 ||
          headerNames.filter((v) => v !== undefined && !isToken(v)).length >= 1
        ) {
          socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
          socket.end();
          return;
        }
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
        let parsedRequestTarget = requestTarget;
        if (requestTarget !== undefined && isAbsoluteForm(requestTarget)) {
          const { authority, rest } = splitAbsoluteForm(requestTarget);
          if (authority === "") {
            socket.write(`HTTP/1.1 400 Bad Request\r\n\r\n`);
            socket.end();
            return;
          }
          parsedRequestTarget = toOriginForm(rest);
        }
        if (parsedRequestTarget?.includes("#")) {
          socket.write(`HTTP/1.1 400 Bad Request\r\n\r\n`);
          socket.end();
          return;
        }
        const path = parsedRequestTarget?.split("?")[0];
        if (!path?.startsWith("/")) {
          socket.write(`HTTP/1.1 400 Bad Request\r\n\r\n`);
          socket.end();
          return;
        }
        if (method === undefined || !isToken(method)) {
          socket.write(`HTTP/1.1 400 Bad Request\r\n\r\n`);
          socket.end();
          return;
        }
        if (!isAllowedMethod(method) && isNotAllowedMethod(method)) {
          socket.write(
            `HTTP/1.1 405 Method Not Allowed\r\nAllow: ${allowedMethods.join(", ")}\r\n\r\n`,
          );
          socket.end();
          return;
        }
        if (!isAllowedMethod(method) && !isNotAllowedMethod(method)) {
          socket.write(`HTTP/1.1 501 Not Implemented\r\n\r\n`);
          socket.end();
          return;
        }
        if (path === undefined || !isAllowedPath(path)) {
          socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
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
