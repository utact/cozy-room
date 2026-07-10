import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages는 서브경로(/cozy-room/)에 배포되므로 상대 경로 사용
  base: './',
  build: {
    target: 'es2022',
  },
});
