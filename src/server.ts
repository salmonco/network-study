import net from "node:net";

export const createServer = () => {
  return net.createServer((socket) => {
    const chunks: Buffer[] = [];
    socket.on("data", (chunk) => {
      chunks.push(chunk);
      if (Buffer.concat(chunks).includes("\r\n\r\n")) {
        const message = Buffer.concat(chunks).toString();
        const path = message.split(" ")[1];
        if (path !== "/" && path !== "/hello") {
          socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
        } else {
          socket.write("HTTP/1.1 200 OK\r\n\r\n");
        }
        socket.end();
      }
    });
  });
};
