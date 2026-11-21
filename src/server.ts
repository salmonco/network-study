import net from "node:net";

const bodies = {
  "/": "",
  "/hello": "hello",
  "/hi-ko": "안녕",
};

const isAllowedPath = (path: string): path is keyof typeof bodies => {
  return Object.keys(bodies).includes(path);
};

export const createServer = () => {
  return net.createServer((socket) => {
    const chunks: Buffer[] = [];
    socket.on("data", (chunk) => {
      chunks.push(chunk);
      if (Buffer.concat(chunks).includes("\r\n\r\n")) {
        const message = Buffer.concat(chunks).toString();
        const [method, path] = message.split(" ");
        if (method !== "GET") {
          socket.write("HTTP/1.1 405 Method Not Allowed\r\n\r\n");
          socket.end();
          return;
        }
        if (path !== undefined && isAllowedPath(path)) {
          socket.write("HTTP/1.1 200 OK\r\n");
          const body = bodies[path];
          socket.write(`Content-Length: ${Buffer.byteLength(body)}\r\n`);
          socket.write("\r\n");
          socket.write(body);
        } else {
          socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
        }
        socket.end();
      }
    });
  });
};
