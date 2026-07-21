import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      // yanki-connect（AnkiConnect client）的 autoLaunch 功能依賴 Node-only 的 `open`
      // 套件，我們用不到那個功能，但它會讓瀏覽器端打包直接失敗，改用空 stub 取代。
      open: "./src/lib/stubs/open-stub.ts",
    },
  },
};

export default nextConfig;
