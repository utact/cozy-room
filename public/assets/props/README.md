# 생성형 3D 프롭 넣는 곳

1. Meshy / Tripo / Hunyuan3D 등으로 생성한 GLB를 이 폴더에 `{프롭id}.glb`로 저장
   (프롭 id는 `src/catalog.ts` 참고 — 예: `frying-pan.glb`, `teddy-bear.glb`)
2. `manifest.json`에 넣은 id를 나열:

```json
["frying-pan", "teddy-bear", "rubber-duck"]
```

3. 끝. 게임이 해당 프롭의 절차적 비주얼을 GLB로 자동 교체한다.
   - 크기는 카탈로그 스케일로 자동 정규화되므로 원본 크기는 상관없음
   - 목록에 없거나 로드에 실패한 프롭은 절차적 비주얼로 폴백

권장: 폴리 수 5천 이하, 텍스처 1024px 이하로 최적화해 넣을 것 (28종 동시 로드).
