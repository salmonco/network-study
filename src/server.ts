import net from "node:net";

const allowedPath = ["/", "/hello"];

export const createServer = () => {
  return net.createServer((socket) => {
    const chunks: Buffer[] = [];
    socket.on("data", (chunk) => {
      chunks.push(chunk);
      if (Buffer.concat(chunks).includes("\r\n\r\n")) {
        const message = Buffer.concat(chunks).toString();
        const path = message.split(" ")[1];
        if (path !== undefined && allowedPath.includes(path)) {
          socket.write("HTTP/1.1 200 OK\r\n");
          if (path === "/hello") {
            socket.write("Content-Length: 5\r\n");
          }
          socket.write("\r\n");
        } else {
          socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
        }
        if (path === "/hello") {
          socket.write("hello");
        }
        socket.end();
      }
    });
  });
};
