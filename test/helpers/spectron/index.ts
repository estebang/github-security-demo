/// <reference path="../../../app/index.d.ts" />
import avaTest, { ExecutionContext, TestInterface } from 'ava';
import { Application } from 'spectron';
import { getClient } from '../api-client';
import { DismissablesService } from 'services/dismissables';
import { getUser, releaseUserInPool } from './user';
import { sleep } from '../sleep';
import { uniq } from 'lodash';
import { installFetchMock } from './network';

// save names of all running tests to use them in the retrying mechanism
const pendingTests: string[] = [];
export const test: TestInterface<ITestContext> = new Proxy(avaTest, {
  apply: (target, thisArg, args) => {
    const testName = args[0];
    pendingTests.push(testName);
    return target.apply(thisArg, args);
  },
});

const path = require('path');
const fs = require('fs');
const os = require('os');
const rimraf = require('rimraf');

const ALMOST_INFINITY = Math.pow(2, 31) - 1; // max 32bit int
const FAILED_TESTS_PATH = 'test-dist/failed-tests.json';

let activeWindow: string | RegExp;

const afterStartCallbacks: ((t: TExecutionContext) => any)[] = [];
export function afterAppStart(cb: (t: TExecutionContext) => any) {
  afterStartCallbacks.push(cb);
}

export async function focusWindow(t: any, regex: RegExp): Promise<boolean> {
  const handles = await t.context.app.client.windowHandles();

  for (const handle of handles.value) {
    await t.context.app.client.window(handle);
    const url = await t.context.app.client.getUrl();
    if (url.match(regex)) {
      activeWindow = regex;
      return true;
    }
  }
  return false;
}

// Focuses the main window
export async function focusMain(t: any) {
  await focusWindow(t, /windowId=main$/);
}

// Focuses the child window
export async function focusChild(t: any) {
  await focusWindow(t, /windowId=child/);
}

// Focuses the Library webview
export async function focusLibrary(t: any) {
  // doesn't work without delay, probably need to wait until load
  await sleep(2000);
  await focusWindow(t, /streamlabs\.com\/library/);
}

// Close current focused window
export async function closeWindow(t: any) {
  await t.context.app.browserWindow.close();
}

export async function waitForLoader(t: any) {
  await t.context.app.client.waitForExist('.main-loading', 10000, true);
}

interface ITestRunnerOptions {
  skipOnboarding?: boolean;
  restartAppAfterEachTest?: boolean;
  pauseIfFailed?: boolean;
  appArgs?: string;

  /**
   * disable synchronisation of scene-collections and media-backup
   */
  noSync?: boolean;

  /**
   * Enable this to show network logs if test failed
   */
  networkLogging?: boolean;

  /**
   * Called after cache directory is created but before
   * the app is started.  This is useful for setting up
   * some known state in the cache directory before the
   * app starts up and loads it.
   */
  beforeAppStartCb?(t: any): Promise<any>;
}

const DEFAULT_OPTIONS: ITestRunnerOptions = {
  skipOnboarding: true,
  restartAppAfterEachTest: true,
  noSync: true,
  networkLogging: false,
  pauseIfFailed: false,
};

export interface ITestContext {
  cacheDir: string;
  app: Application;
}

export type TExecutionContext = ExecutionContext<ITestContext>;

let startAppFn: (t: TExecutionContext) => Promise<any>;
let stopAppFn: (clearCache?: boolean) => Promise<any>;

export async function startApp(t: TExecutionContext) {
  return startAppFn(t);
}

export async function stopApp(clearCache?: boolean) {
  return stopAppFn(clearCache);
}

export async function restartApp(t: TExecutionContext): Promise<Application> {
  await stopAppFn(false);
  return await startAppFn(t);
}

let skipCheckingErrorsInLogFlag = false;

/**
 * Disable checking errors in the log file for a single test
 */
export function skipCheckingErrorsInLog() {
  skipCheckingErrorsInLogFlag = true;
}

export function useSpectron(options: ITestRunnerOptions = {}) {
  // tslint:disable-next-line:no-parameter-reassignment TODO
  options = Object.assign({}, DEFAULT_OPTIONS, options);
  let appIsRunning = false;
  let context: any = null;
  let app: any;
  let testPassed = false;
  let failMsg = '';
  let testName = '';
  let logFileLastReadingPos = 0;
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slobs-test'));

  startAppFn = async function startApp(t: TExecutionContext): Promise<Application> {
    t.context.cacheDir = cacheDir;
    const appArgs = options.appArgs ? options.appArgs.split(' ') : [];
    if (options.networkLogging) appArgs.push('--network-logging');
    if (options.noSync) appArgs.push('--nosync');
    app = t.context.app = new Application({
      path: path.join(__dirname, '..', '..', '..', '..', 'node_modules', '.bin', 'electron.cmd'),
      args: [
        '--require',
        path.join(__dirname, 'context-menu-injected.js'),
        '--require',
        path.join(__dirname, 'dialog-injected.js'),
        ...appArgs,
        '.',
      ],
      env: {
        NODE_ENV: 'test',
        SLOBS_CACHE_DIR: t.context.cacheDir,
      },
      webdriverOptions: {
        // most of deprecation warning encourage us to use WebdriverIO actions API
        // however the documentation for this API looks very poor, it provides only one example:
        // http://webdriver.io/api/protocol/actions.html
        // disable deprecation warning and waiting for better docs now
        deprecationWarnings: false,
      },
    });

    if (options.beforeAppStartCb) await options.beforeAppStartCb(t);

    await t.context.app.start();

    // Disable CSS transitions while running tests to allow for eager test clicks
    const disableTransitionsCode = `
      const disableAnimationsEl = document.createElement('style');
      disableAnimationsEl.textContent =
        '*{ transition: none !important; transition-property: none !important; animation: none !important }';
      document.head.appendChild(disableAnimationsEl);
    `;
    await focusMain(t);
    await t.context.app.webContents.executeJavaScript(disableTransitionsCode);

    // allow usage of fetch-mock library
    await installFetchMock(t);

    // Wait up to 2 seconds before giving up looking for an element.
    // This will slightly slow down negative assertions, but makes
    // the tests much more stable, especially on slow systems.
    t.context.app.client.timeouts('implicit', 2000);

    // await sleep(10000);

    // Pretty much all tests except for onboarding-specific
    // tests will want to skip this flow, so we do it automatically.
    await waitForLoader(t);
    if (await t.context.app.client.isExisting('span=Skip')) {
      if (options.skipOnboarding) {
        await t.context.app.client.click('span=Skip');
        await t.context.app.client.click('h2=Start Fresh');
        await t.context.app.client.click('p=Skip');
        if (await t.context.app.client.isVisible('p=Skip')) {
          await t.context.app.client.click('p=Skip');
        }
      } else {
        // Wait for the connect screen before moving on
        await t.context.app.client.isExisting('button=Twitch');
      }
    }

    // disable the popups that prevents context menu to be shown
    const client = await getClient();
    const dismissablesService = client.getResource<DismissablesService>('DismissablesService');
    dismissablesService.dismissAll();

    // disable animations in the child window
    await focusChild(t);
    await t.context.app.webContents.executeJavaScript(disableTransitionsCode);
    await focusMain(t);

    context = t.context;
    appIsRunning = true;

    for (const callback of afterStartCallbacks) {
      await callback(t);
    }

    return app;
  };

  stopAppFn = async function stopApp(clearCache = true) {
    try {
      await app.stop();
    } catch (e) {
      fail('Crash on shutdown');
      console.error(e);
    }
    appIsRunning = false;
    await checkErrorsInLogFile();
    logFileLastReadingPos = 0;

    if (!clearCache) return;
    await new Promise(resolve => {
      rimraf(cacheDir, resolve);
    });
  };

  /**
   * test should be considered as failed if it writes exceptions in to the log file
   */
  async function checkErrorsInLogFile() {
    const filePath = path.join(cacheDir, 'slobs-client', 'log.log');
    if (!fs.existsSync(filePath)) return;
    const logs = fs.readFileSync(filePath).toString();
    const errors = logs
      .substr(logFileLastReadingPos)
      .split('\n')
      .filter((record: string) => record.match(/\[error\]/));

    // save the last reading position, to skip already read records next time
    logFileLastReadingPos = logs.length - 1;

    if (errors.length && !skipCheckingErrorsInLogFlag) {
      fail(`The log-file has errors \n ${logs}`);
    } else if (options.networkLogging && !testPassed) {
      fail(`log-file: \n ${logs}`);
    }
  }

  test.before(async t => {
    // consider all tests as failed until it's not successfully finished
    // so we can catch failures for tests with timeouts
    saveFailedTestsToFile(pendingTests);
  });

  test.beforeEach(async t => {
    testName = t.title.replace('beforeEach hook for ', '');
    testPassed = false;
    skipCheckingErrorsInLogFlag = false;

    t.context.app = app;
    if (options.restartAppAfterEachTest || !appIsRunning) await startAppFn(t);
  });

  test.afterEach(async t => {
    testPassed = true;
  });

  test.afterEach.always(async t => {
    await checkErrorsInLogFile();
    if (!testPassed && options.pauseIfFailed) {
      console.log('Test execution has been paused due `pauseIfFailed` enabled');
      await sleep(ALMOST_INFINITY);
    }

    // wrap in try/catch for the situation when we have a crash
    // so we still can read the logs after the crash
    try {
      const client = await getClient();
      await client.unsubscribeAll();
      await releaseUserInPool();
      if (options.restartAppAfterEachTest) {
        client.disconnect();
        await stopAppFn();
      }
    } catch (e) {
      fail('Test finalization failed');
      console.error(e);
    }

    if (testPassed) {
      // consider this test succeed and remove from the `failedTests` list
      removeFailedTestFromFile(testName);
    } else {
      fail();
      const user = getUser();
      if (user) console.log(`Test failed for the account: ${user.type} ${user.email}`);
      t.fail(failMsg);
    }
  });

  test.after.always(async t => {
    if (!appIsRunning) return;
    await stopAppFn();
    if (!testPassed) saveFailedTestsToFile([testName]);
  });

  /**
   * mark tests as failed
   */
  function fail(msg?: string) {
    testPassed = false;
    if (msg) failMsg = msg;
  }
}

function saveFailedTestsToFile(failedTests: string[]) {
  if (fs.existsSync(FAILED_TESTS_PATH)) {
    // tslint:disable-next-line:no-parameter-reassignment TODO
    failedTests = JSON.parse(fs.readFileSync(FAILED_TESTS_PATH)).concat(failedTests);
  }
  fs.writeFileSync(FAILED_TESTS_PATH, JSON.stringify(uniq(failedTests)));
}

function removeFailedTestFromFile(testName: string) {
  if (fs.existsSync(FAILED_TESTS_PATH)) {
    const failedTests = JSON.parse(fs.readFileSync(FAILED_TESTS_PATH));
    failedTests.splice(failedTests.indexOf(testName), 1);
    fs.writeFileSync(FAILED_TESTS_PATH, JSON.stringify(failedTests));
  }
}

// the built-in 'click' method doesn't show selector in the error message
// wrap this method to achieve this functionality

export async function click(t: TExecutionContext, selector: string) {
  try {
    return await t.context.app.client.click(selector);
  } catch (e) {
    const windowId = String(activeWindow);
    const message = `click to "${selector}" failed in window ${windowId}: ${e.message} ${e.type}`;
    throw new Error(message);
  }
}
