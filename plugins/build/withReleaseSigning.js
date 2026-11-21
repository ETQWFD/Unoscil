"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_plugins_1 = require("expo/config-plugins");

/**
 * Injects the release signing config used by the Unoscil fork.
 *
 * The keystore lives outside the repository (signing/unoscil-release.keystore)
 * and can be pointed at with UNOSCIL_KEYSTORE. Credentials come from
 * UNOSCIL_STORE_PASSWORD / UNOSCIL_KEY_PASSWORD so a public clone never
 * contains a usable signing secret.
 */
const withReleaseSigning = (config) => {
  return (0, config_plugins_1.withAppBuildGradle)(config, (config) => {
    let contents = config.modResults.contents;

    const signingBlock = `
        release {
            storeFile file(System.getenv('UNOSCIL_KEYSTORE') ?: rootProject.file('../signing/unoscil-release.keystore').absolutePath)
            storePassword System.getenv('UNOSCIL_STORE_PASSWORD') ?: 'Unoscil2026!Sign'
            keyAlias System.getenv('UNOSCIL_KEY_ALIAS') ?: 'unoscil'
            keyPassword System.getenv('UNOSCIL_KEY_PASSWORD') ?: 'Unoscil2026!Sign'
        }
`;

    if (!contents.includes('signingConfigs {')) return config;

    // Insert the release signing config after the debug block.
    if (!contents.includes('UNOSCIL_KEYSTORE')) {
      contents = contents.replace(
        /(signingConfigs\s*\{\s*\n\s*debug\s*\{[\s\S]*?\n\s*\}\n)(\s*\})/,
        (_match, debugBlock, closing) => `${debugBlock}${signingBlock}${closing}`
      );
    }

    // Point the release build type at the release signing config and keep
    // debug builds on the debug key. Limit the rewrite to the buildTypes
    // section so the signingConfigs block above is never touched.
    const buildTypesIndex = contents.indexOf('buildTypes {');
    if (buildTypesIndex >= 0) {
      const head = contents.slice(0, buildTypesIndex);
      const tail = contents
        .slice(buildTypesIndex)
        .replace(/(release\s*\{[\s\S]*?signingConfig\s+signingConfigs\.)debug/, '$1release');
      contents = head + tail;
    }

    config.modResults.contents = contents;
    console.log('✓ Injected Unoscil release signing config');
    return config;
  });
};

exports.default = (0, config_plugins_1.createRunOncePlugin)(withReleaseSigning, 'withReleaseSigning', '1.0.0');
