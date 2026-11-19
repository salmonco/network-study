import net from "node:net";
import { setTimeout as sleep } from "node:timers/promises";

export type ChunkedResult = {
  /** snapshots[i] = i번째 조각을 보내고 delayMs만큼 기다린 시점까지 받은 응답 */
  snapshots: string[];
  /** 서버가 연결을 닫을 때까지 받은 전체 응답 */
  response: string;
};

/**
 * 테스트용 TCP 클라이언트 (조각 전송)
 * chunks를 하나씩 보내고, 조각 사이마다 delayMs만큼 기다린다.
 *
 * 기다리는 이유: write를 연달아 호출하면 OS가 여러 조각을 하나로 합쳐 보낼 수 있다.
 * 그러면 서버가 data 이벤트를 한 번만 받아서, "나눠서 도착하는" 상황을 재현할 수 없다.
 *
 * 서버가 중간에 연결을 닫으면 남은 조각은 보내지 않고, 그때까지의 결과로 resolve한다.
 */
export function sendChunks(port: number, chunks: string[], delayMs = 50): Promise<ChunkedResult> {
  return new Promise((resolve, reject) => {
    const received: Buffer[] = [];
    const snapshots: string[] = [];
    const current = () => Buffer.concat(received).toString("utf8");

    const socket = net.connect({ port, host: "127.0.0.1" }, async () => {
      // 조각마다 스냅샷을 남긴다. 서버가 먼저 닫아도 스냅샷은 계속 기록해서 길이가 chunks와 같게 한다.
      for (const chunk of chunks) {
        if (!socket.destroyed && socket.writable) socket.write(chunk);
        await sleep(delayMs);
        snapshots.push(current());
      }
      await closed;
      resolve({ snapshots, response: current() });
    });

    const closed = new Promise<void>((onClose) => socket.on("close", () => onClose()));
    socket.on("data", (chunk) => received.push(chunk));
    socket.on("error", reject);
  });
}
