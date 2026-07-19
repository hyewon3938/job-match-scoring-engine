import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // localStorage 복원(마운트 후 setState 한 번)은 hydration 안전을 위한 의도된 패턴.
    // 인라인 disable 주석을 쓰지 않는 이유: src/ 하드코딩 부재 테스트가 규칙 이름 문자열까지 잡는다.
    files: ["src/app/JobSelector.tsx", "src/app/RankingTable.tsx"],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
