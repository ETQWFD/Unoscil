# Unoscil 构建说明

## Android（32 位 armeabi-v7a）

1. 安装依赖：`npm ci`
2. 生成原生工程：`APP_VARIANT=production npx expo prebuild --platform android --no-install --clean`
3. 准备引擎 AAR：`bash scripts/update-unified-engine-core.sh --platform android`
4. 官方 AAR 仅含 arm64-v8a / x86_64。32 位包需要从 `UniClipboard/Engine` 的
   `v1.1.0-rc.24`（commit `203a9290`）源码交叉编译 `armv7-linux-androideabi`，
   并把 `libuc_engine_uniffi.so` 放入 AAR 的 `jni/armeabi-v7a/`。
5. 使用本地 AAR 构建：
   ```bash
   UC_ENGINE_LOCAL_AAR=/path/to/UniClipboardEngine-armv7.aar \
   UNOSCIL_KEYSTORE=signing/unoscil-release.keystore \
   ./gradlew assembleRelease
   ```
6. 产物：`android/app/build/outputs/apk/release/app-armeabi-v7a-release.apk`

签名密钥不进入仓库。构建前设置：
`UNOSCIL_KEYSTORE`、`UNOSCIL_STORE_PASSWORD`、`UNOSCIL_KEY_ALIAS`、`UNOSCIL_KEY_PASSWORD`。

## Windows 桌面版

```bash
cd desktop
npm install
npm run package:win
```

产物：`desktop/dist/Unoscil-win32-x64/Unoscil.exe`

## 许可证

MIT。原始版权归 JericX 与 mkdir700 所有，详见 `LICENSE`。

联系：241644244@qq.com
