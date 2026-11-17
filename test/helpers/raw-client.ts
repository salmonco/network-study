import net from "node:net";

/**
 * 테스트용 TCP 클라이언트
 * 서버에 연결해서 data를 그대로 보내고, 서버가 연결을 닫을 때까지 받은 바이트를 문자열로 돌려준다.
 *
 * 주의: 서버가 연결을 닫지 않으면(keep-alive 등) 이 Promise는 끝나지 않고 테스트가 타임아웃된다.
 */
export function sendRaw(port: number, data: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const socket = net.connect({ port, host: "127.0.0.1" }, () => {
      socket.write(data);
    });

    socket.on("data", (chunk) => chunks.push(chunk));
    socket.on("close", () => resolve(Buffer.concat(chunks).toString("utf8")));
    socket.on("error", reject);
  });
}
