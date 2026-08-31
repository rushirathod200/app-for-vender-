const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');

const EXPO_MESSAGING_SERVICE = 'expo.modules.notifications.service.ExpoFirebaseMessagingService';
const ORDER_MESSAGING_SERVICE = '.DeskDropFirebaseMessagingService';
const ORDER_OVERLAY_SERVICE = '.OrderOverlayService';

function serviceName(service) {
  return service?.$?.['android:name'];
}

function ensurePermission(manifest, name) {
  const permissions = manifest['uses-permission'] ?? [];
  if (!permissions.some((permission) => permission?.$?.['android:name'] === name)) {
    permissions.push({ $: { 'android:name': name } });
  }
  manifest['uses-permission'] = permissions;
}

function withOrderAlertManifest(config) {
  return withAndroidManifest(config, (configWithManifest) => {
    const manifest = configWithManifest.modResults.manifest;
    manifest.$ = {
      ...(manifest.$ ?? {}),
      'xmlns:tools': 'http://schemas.android.com/tools',
    };

    ensurePermission(manifest, 'android.permission.USE_FULL_SCREEN_INTENT');
    ensurePermission(manifest, 'android.permission.SYSTEM_ALERT_WINDOW');
    ensurePermission(manifest, 'android.permission.VIBRATE');

    const application = manifest.application?.[0];
    if (!application) {
      throw new Error('DeskDrop order-alert plugin could not find the Android application manifest node.');
    }

    const services = (application.service ?? []).filter((service) => {
      const name = serviceName(service);
      return name !== EXPO_MESSAGING_SERVICE
        && name !== ORDER_MESSAGING_SERVICE
        && name !== ORDER_OVERLAY_SERVICE;
    });

    services.push({
      $: {
        'android:name': ORDER_MESSAGING_SERVICE,
        'android:exported': 'false',
      },
      'intent-filter': [{
        action: [{ $: { 'android:name': 'com.google.firebase.MESSAGING_EVENT' } }],
      }],
    });
    services.push({
      $: {
        'android:name': ORDER_OVERLAY_SERVICE,
        'android:exported': 'false',
      },
    });

    // expo-notifications declares its own FCM service from a library manifest.
    // Remove it so only DeskDrop's subclass receives and routes order messages.
    services.push({
      $: {
        'android:name': EXPO_MESSAGING_SERVICE,
        'tools:node': 'remove',
      },
    });
    application.service = services;

    const mainActivity = (application.activity ?? []).find((activity) => {
      const name = activity?.$?.['android:name'];
      return name === '.MainActivity' || name?.endsWith('.MainActivity');
    });
    if (mainActivity) {
      mainActivity.$ = {
        ...(mainActivity.$ ?? {}),
        'android:showWhenLocked': 'true',
        'android:turnScreenOn': 'true',
      };
    }

    return configWithManifest;
  });
}

function withOrderAlertKotlinSources(config) {
  return withDangerousMod(config, ['android', async (configWithMod) => {
    const packageName = configWithMod.android?.package ?? 'com.deskdrop.vendor';
    const sourceDirectory = path.join(__dirname, 'deskdrop-vendor-order-alerts', 'android');
    const destinationDirectory = path.join(
      configWithMod.modRequest.platformProjectRoot,
      'app',
      'src',
      'main',
      'java',
      ...packageName.split('.'),
    );

    fs.mkdirSync(destinationDirectory, { recursive: true });
    for (const fileName of fs.readdirSync(sourceDirectory)) {
      if (!fileName.endsWith('.kt')) continue;

      const source = fs.readFileSync(path.join(sourceDirectory, fileName), 'utf8');
      const packageAdjustedSource = source.replace(
        /^package\s+com\.deskdrop\.vendor/m,
        `package ${packageName}`,
      );
      fs.writeFileSync(path.join(destinationDirectory, fileName), packageAdjustedSource);
    }

    return configWithMod;
  }]);
}

module.exports = function withDeskDropVendorOrderAlerts(config) {
  config = withOrderAlertManifest(config);
  config = withOrderAlertKotlinSources(config);
  return config;
};
