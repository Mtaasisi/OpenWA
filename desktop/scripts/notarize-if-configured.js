#!/usr/bin/env node
/**
 * electron-builder afterSign hook — notarizes macOS builds when Apple credentials are set.
 * @see desktop/.env.signing.example
 */
const path = require('path');

exports.default = async function notarizeIfConfigured(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'darwin') return;

  const appleId = process.env.APPLE_ID?.trim();
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD?.trim();
  const teamId = process.env.APPLE_TEAM_ID?.trim();

  if (!appleId || !appleIdPassword || !teamId) {
    console.log('[notarize] Skipped — set APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  console.log('[notarize] Submitting', appPath);
  const { notarize } = require('@electron/notarize');

  await notarize({
    appBundleId: context.packager.appInfo.id,
    appPath,
    appleId,
    appleIdPassword,
    teamId,
  });

  console.log('[notarize] Complete');
};
