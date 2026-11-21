"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_plugins_1 = require("expo/config-plugins");
/**
 * Configures Android ABI splits so that separate APKs are built for
 * the real-device CPU architecture published by the independent core Release.
 *
 * 发布镜像为 32 位 armeabi-v7a，与本地重新编译的 Engine AAR 保持一致。
 * x86_64 仍可通过命令行覆盖用于模拟器构建。
 *
 * All variants share the same versionCode (no per-ABI offset).
 */
const withAbiSplits = (config) => {
    return (0, config_plugins_1.withAppBuildGradle)(config, (config) => {
        const contents = config.modResults.contents;
        // --- 1. splits block ---
        const splitsConfig = `
    splits {
        abi {
            enable true
            reset()
            include "armeabi-v7a"
            universalApk false
        }
    }
`;
        if (!contents.includes('splits {')) {
            const androidBlockMatch = contents.match(/^android\s*\{[\s\S]*?\n\}/m);
            if (androidBlockMatch) {
                const androidBlock = androidBlockMatch[0];
                const modified = androidBlock.replace(/\n\}$/, splitsConfig + '\n}');
                config.modResults.contents = contents.replace(androidBlock, modified);
                console.log('✓ Added splits configuration to build.gradle');
            }
        }
        else {
            // Splits already present (a re-prebuild without --clean). Rewrite the
            // `include` line in place so stale ABIs are dropped and stay in sync with
            // the independent core Release.
            const includeRe = /include\s+"armeabi-v7a"[^\n]*/;
            if (includeRe.test(contents)) {
                config.modResults.contents = contents.replace(includeRe, 'include "armeabi-v7a"');
                console.log('✓ Updated splits include list in build.gradle');
            }
            else {
                console.log('ℹ splits already configured in build.gradle');
            }
        }
        config.modResults.contents = config.modResults.contents.replace(/universalApk\s+(true|false)/, 'universalApk false');
        return config;
    });
};
exports.default = (0, config_plugins_1.createRunOncePlugin)(withAbiSplits, 'withAbiSplits', '1.0.0');
