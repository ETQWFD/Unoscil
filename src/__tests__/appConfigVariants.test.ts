import { spawnSync } from 'child_process';
import { readFileSync } from 'fs';
import path from 'path';

jest.setTimeout(30000);

const readExpoConfig = (
  variant: 'development' | 'production' | 'test',
  type: 'public' | 'introspect' = 'public'
) => {
  const result = spawnSync('npx', ['expo', 'config', '--type', type, '--json'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      APP_VARIANT: variant,
      EXPO_NO_TELEMETRY: '1',
    },
  });

  if (result.status !== 0) {
    throw new Error(
      [`expo config failed for APP_VARIANT=${variant}`, result.stdout.trim(), result.stderr.trim()]
        .filter(Boolean)
        .join('\n')
    );
  }

  return JSON.parse(result.stdout);
};

describe('Expo app config variants', () => {
  it('isolates development installs from production identifiers', () => {
    const config = readExpoConfig('development');
    const appGroups = config.ios.entitlements['com.apple.security.application-groups'];
    const extensions = config.extra.eas.build.experimental.ios.appExtensions;

    expect(config.name).toBe('Unoscil Dev');
    expect(config.scheme).toBe('unoscil-dev');
    expect(config.ios.bundleIdentifier).toBe('app.unoscil.Unoscil.dev');
    expect(config.ios.infoPlist.UCAppGroupIdentifier).toBe(
      'group.app.unoscil.Unoscil.dev'
    );
    expect(config.ios.infoPlist.UCP2PKeychainAccessGroup).toBe(
      '$(AppIdentifierPrefix)app.unoscil.Unoscil.dev.p2p'
    );
    expect(appGroups).toEqual(['group.app.unoscil.Unoscil.dev']);
    expect(config.ios.entitlements['keychain-access-groups']).toEqual([
      '$(AppIdentifierPrefix)app.unoscil.Unoscil.dev.p2p',
    ]);
    expect(extensions).toEqual([
      {
        targetName: 'share',
        bundleIdentifier: 'app.unoscil.Unoscil.dev.Share',
        entitlements: {
          'com.apple.security.application-groups': ['group.app.unoscil.Unoscil.dev'],
          'keychain-access-groups': ['$(AppIdentifierPrefix)app.unoscil.Unoscil.dev.p2p'],
        },
      },
      {
        targetName: 'keyboard',
        bundleIdentifier: 'app.unoscil.Unoscil.dev.Keyboard',
        entitlements: {
          'com.apple.security.application-groups': ['group.app.unoscil.Unoscil.dev'],
          'keychain-access-groups': ['$(AppIdentifierPrefix)app.unoscil.Unoscil.dev.p2p'],
        },
      },
    ]);
  });

  it('isolates test installs from production and development identifiers', () => {
    const config = readExpoConfig('test');
    const extensions = config.extra.eas.build.experimental.ios.appExtensions;

    expect(config.name).toBe('Unoscil Test');
    expect(config.scheme).toBe('unoscil-test');
    expect(config.extra.appVariant).toBe('test');
    expect(config.ios.bundleIdentifier).toBe('app.unoscil.Unoscil.test');
    expect(config.ios.infoPlist.UCAppGroupIdentifier).toBe(
      'group.app.unoscil.Unoscil.test'
    );
    expect(config.ios.entitlements['com.apple.security.application-groups']).toEqual([
      'group.app.unoscil.Unoscil.test',
    ]);
    expect(config.ios.entitlements['keychain-access-groups']).toEqual([
      '$(AppIdentifierPrefix)app.unoscil.Unoscil.test.p2p',
    ]);
    expect(extensions.map((extension: { bundleIdentifier: string }) => extension.bundleIdentifier)).toEqual([
      'app.unoscil.Unoscil.test.Share',
      'app.unoscil.Unoscil.test.Keyboard',
    ]);
  });

  it('routes share handoff to the scheme of the active variant', () => {
    const share = readFileSync(path.join(process.cwd(), 'targets/share/ShareViewController.swift'), 'utf8');
    const shareTarget = readFileSync(
      path.join(process.cwd(), 'targets/share/expo-target.config.js'),
      'utf8'
    );
    const app = readFileSync(path.join(process.cwd(), 'App.tsx'), 'utf8');

    expect(share).toContain('groupID.hasSuffix(".test") ? "unoscil-test" : "unoscil"');
    expect(shareTarget).toContain("{ production: 'Unoscil', test: 'Unoscil Test' }");
    expect(app).toContain("'unoscil-test://share'");
  });

  it('keeps production identifiers and legacy migration access explicit', () => {
    const config = readExpoConfig('production');
    const appGroups = config.ios.entitlements['com.apple.security.application-groups'];
    const extensions = config.extra.eas.build.experimental.ios.appExtensions;

    expect(config.name).toBe('Unoscil');
    expect(config.scheme).toBe('unoscil');
    expect(config.ios.bundleIdentifier).toBe('app.unoscil.Unoscil');
    expect(config.ios.infoPlist.UCAppGroupIdentifier).toBe('group.app.unoscil.Unoscil');
    expect(config.ios.infoPlist.UCP2PKeychainAccessGroup).toBe(
      '$(AppIdentifierPrefix)app.unoscil.Unoscil.p2p'
    );
    expect(appGroups).toEqual([
      'group.app.unoscil.Unoscil',
      'group.app.unoscil.ios',
    ]);
    expect(config.ios.entitlements['keychain-access-groups']).toEqual([
      '$(AppIdentifierPrefix)app.unoscil.Unoscil.p2p',
    ]);
    expect(extensions).toEqual([
      {
        targetName: 'share',
        bundleIdentifier: 'app.unoscil.Unoscil.Share',
        entitlements: {
          'com.apple.security.application-groups': [
            'group.app.unoscil.Unoscil',
            'group.app.unoscil.ios',
          ],
          'keychain-access-groups': ['$(AppIdentifierPrefix)app.unoscil.Unoscil.p2p'],
        },
      },
      {
        targetName: 'keyboard',
        bundleIdentifier: 'app.unoscil.Unoscil.Keyboard',
        entitlements: {
          'com.apple.security.application-groups': [
            'group.app.unoscil.Unoscil',
            'group.app.unoscil.ios',
          ],
          'keychain-access-groups': ['$(AppIdentifierPrefix)app.unoscil.Unoscil.p2p'],
        },
      },
    ]);
  });

  it('does not declare remote push capability for local-only notifications', () => {
    const config = readExpoConfig('production', 'introspect');

    expect(config.ios.entitlements['aps-environment']).toBeUndefined();
  });

  it('makes native App Group resolution follow the active app variant', () => {
    const files = [
      'modules/app-group-store/ios/Shared/SettingsStore.swift',
      'targets/_shared/SettingsStore.swift',
    ];

    for (const file of files) {
      const source = readFileSync(path.join(process.cwd(), file), 'utf8');
      expect(source).toContain('UCAppGroupIdentifier');
      expect(source).toContain('Bundle.main.bundleIdentifier');
      expect(source).toContain('app.unoscil.Unoscil');
      expect(source).toContain('group.\\(bundleID)');
      expect(source).toContain('[".Share", ".Keyboard"]');
      expect(source).not.toContain(
        'forSecurityApplicationGroupIdentifier: "group.app.unoscil.Unoscil"'
      );
      expect(source).not.toContain('SecTaskCopyValueForEntitlement');
    }
  });

  it('does not rely on per-extension Info.plist build-setting substitution', () => {
    const files = [
      'app.config.ts',
      'targets/share/Info.plist',
      'targets/keyboard/Info.plist',
      'targets/share/expo-target.config.js',
      'targets/keyboard/expo-target.config.js',
    ];

    for (const file of files) {
      const source = readFileSync(path.join(process.cwd(), file), 'utf8');
      expect(source).not.toContain('UC_APP_GROUP');
      expect(source).not.toContain('withExtensionAppGroupBuildSetting');
    }
  });

  it('resolves the extension P2P keychain group from the active app variant', () => {
    const appJson = readFileSync(path.join(process.cwd(), 'app.json'), 'utf8');
    const extensionPlists = ['targets/share/Info.plist', 'targets/keyboard/Info.plist'];

    expect(appJson).toContain('./plugins/build/withExtensionP2PKeychainGroup.js');
    expect(appJson.indexOf('./plugins/build/withExtensionP2PKeychainGroup.js')).toBeLessThan(
      appJson.indexOf('@bacons/apple-targets')
    );

    for (const file of extensionPlists) {
      const source = readFileSync(path.join(process.cwd(), file), 'utf8');
      expect(source).toContain('<string>$(UCP2P_KEYCHAIN_ACCESS_GROUP)</string>');
      expect(source).not.toContain('Unoscil.dev.p2p');
    }
  });

  it('keeps generated iOS projects compatible with Xcode 27', () => {
    const config = readExpoConfig('development');
    const appJson = JSON.parse(readFileSync(path.join(process.cwd(), 'app.json'), 'utf8'));
    const plugins = appJson.expo.plugins;

    expect(config.ios.deploymentTarget).toBe('16.4');
    expect(plugins).toContain('./plugins/build/withXcode27DeploymentTargets.js');
    expect(plugins.indexOf('./plugins/build/withXcode27DeploymentTargets.js')).toBeLessThan(
      plugins.indexOf('@bacons/apple-targets')
    );
  });
});
