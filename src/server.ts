import net from "node:net";

export const createServer = () => {
  return net.createServer((socket) => {
    socket.on("data", (chunk) => {
      socket.write("HTTP/1.1 200 OK\r\n\r\n");
      socket.end();
    });
  });
};
