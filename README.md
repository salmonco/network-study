# network-study

`node:net`만 써서 HTTP/1.1 서버를 TDD로 직접 만들며 네트워크를 공부하는 저장소입니다.

## 배경

평소에는 `node:http`나 Express 같은 프레임워크가 요청 파싱, 헤더 처리, 상태 코드 결정을 대신 해 줍니다.
편하지만 그 아래 TCP 위에서 실제로 어떤 바이트가 오가는지, 서버가 잘못된 요청을 어떻게 판단하는지는 보이지 않습니다.
그 부분을 직접 구현해 보면서 이해하려고 이 저장소를 만들었습니다.

## 목적

- TCP 소켓으로 들어오는 바이트를 읽어 HTTP 요청으로 해석하는 과정을 직접 구현한다.
- RFC 9110, RFC 9112를 읽고 명세에 맞게 동작하는지 테스트로 확인한다.
- 기능을 TDD로 하나씩 쌓는다. 실패하는 테스트를 쓰고, 통과시키고, 리팩터링한다.

## 진행 방식

- 고수준 HTTP 모듈 없이 `node:net`만 사용합니다.
- 테스트에서는 서버를 임의 포트에 띄우고, raw 바이트를 보낸 뒤 응답 문자열을 통째로 비교합니다. 일반 클라이언트라면 보내지 않을 잘못된 요청도 그대로 보내 볼 수 있습니다.
- 작은 단위로 커밋해서, 커밋 기록만 봐도 기능이 어떤 순서로 붙었는지 알 수 있게 합니다.

현재 지원하는 기능은 [test/server.test.ts](test/server.test.ts)에서 확인할 수 있습니다.

## 시작하기

```sh
npm install
npm test            # 테스트 실행
npm run test:watch  # 변경 감지하며 테스트 실행
npm run typecheck   # 타입 검사
```

## 참고

- [RFC 9110: HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110)
- [RFC 9112: HTTP/1.1](https://www.rfc-editor.org/rfc/rfc9112)
- [Node.js `net` 문서](https://nodejs.org/api/net.html)
