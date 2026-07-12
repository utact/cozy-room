# 생성형 UI 아트 로컬 번들

게임은 아래 파일이 이 폴더에 있으면 우선 사용하고, 없으면 `src/art.ts`의
원격 CDN(Higgsfield 생성 결과)에서 로드합니다. **제출 전에는 파일을 여기에
넣어 원격 의존을 없애는 것을 권장**합니다 (심사 기간 중 CDN 만료 방지).

| 파일 | 용도 | 원본 |
|---|---|---|
| `logo.png` | 타이틀 로고 (투명 배경) | src/art.ts `ART.logo.remote` |
| `keyart.png` | 메뉴 배경 키 비주얼 (16:9) | src/art.ts `ART.keyart.remote` |
| `judge.png` | AI 심사위원 로봇 초상 (1:1) | src/art.ts `ART.judge.remote` |

원격 URL을 브라우저로 열어 저장한 뒤 위 이름으로 넣으면 됩니다.
