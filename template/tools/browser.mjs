// Launch the Chrome for Testing build already in the Playwright cache, so no browser download is needed.
import { chromium } from 'playwright';
import os from 'node:os';

const CHROME = `${os.homedir()}/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;

export function launch() {
  return chromium.launch({
    executablePath: process.env.CHROME || CHROME,
    args: ['--allow-file-access-from-files', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
  });
}
