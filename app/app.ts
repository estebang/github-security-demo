import { I18nService, $t } from 'services/i18n';

window['eval'] = global.eval = () => {
  throw new Error('window.eval() is disabled for security');
};

import 'reflect-metadata';
import Vue from 'vue';

import { createStore } from './store';
import { WindowsService } from './services/windows';
import { ObsUserPluginsService } from 'services/obs-user-plugins';
import { AppService } from './services/app';
import Utils from './services/utils';
import electron from 'electron';
import * as Sentry from '@sentry/browser';
import * as Integrations from '@sentry/integrations';
import VTooltip from 'v-tooltip';
import Toasted from 'vue-toasted';
import VueI18n from 'vue-i18n';
import VModal from 'vue-js-modal';
import VeeValidate from 'vee-validate';
import ChildWindow from 'components/windows/ChildWindow.vue';
import OneOffWindow from 'components/windows/OneOffWindow.vue';
import electronLog from 'electron-log';
import { UserService, setSentryContext } from 'services/user';
import { getResource } from 'services';
import * as obs from '../obs-api';
import path from 'path';
import uuid from 'uuid/v4';

const crashHandler = window['require']('crash-handler');

const { ipcRenderer, remote } = electron;
const slobsVersion = remote.process.env.SLOBS_VERSION;
const isProduction = process.env.NODE_ENV === 'production';
const isPreview = !!remote.process.env.SLOBS_PREVIEW;

// This is the development DSN
let sentryDsn = 'https://8f444a81edd446b69ce75421d5e91d4d@sentry.io/252950';

if (isProduction) {
  // This is the production DSN
  sentryDsn = 'https://6971fa187bb64f58ab29ac514aa0eb3d@sentry.io/251674';

  electron.crashReporter.start({
    productName: 'streamlabs-obs',
    companyName: 'streamlabs',
    ignoreSystemCrashHandler: true,
    submitURL:
      'https://sentry.io/api/1283430/minidump/?sentry_key=01fc20f909124c8499b4972e9a5253f2',
    extra: {
      'sentry[release]': slobsVersion,
      processType: 'renderer',
    },
  });
}

let usingSentry = false;

if (
  (isProduction || process.env.SLOBS_REPORT_TO_SENTRY) &&
  !electron.remote.process.env.SLOBS_IPC
) {
  usingSentry = true;

  Sentry.init({
    dsn: sentryDsn,
    release: slobsVersion,
    sampleRate: isPreview ? 1.0 : 0.1,
    beforeSend: event => {
      // Because our URLs are local files and not publicly
      // accessible URLs, we simply truncate and send only
      // the filename.  Unfortunately sentry's electron support
      // isn't that great, so we do this hack.
      // Some discussion here: https://github.com/getsentry/sentry/issues/2708
      const normalize = (filename: string) => {
        const splitArray = filename.split('/');
        return splitArray[splitArray.length - 1];
      };

      if (event.exception && event.exception.values[0].stacktrace) {
        event.exception.values[0].stacktrace.frames.forEach(frame => {
          frame.filename = normalize(frame.filename);
        });
      }

      if (event.request) {
        event.request.url = normalize(event.request.url);
      }

      return event;
    },
    integrations: [new Integrations.Vue({ Vue })],
  });

  const oldConsoleError = console.error;

  console.error = (msg: string, ...params: any[]) => {
    oldConsoleError(msg, ...params);

    Sentry.withScope(scope => {
      if (params[0] instanceof Error) {
        scope.setExtra('exception', params[0].stack);
      }

      scope.setExtra('console-args', JSON.stringify(params, null, 2));
      Sentry.captureMessage(msg, Sentry.Severity.Error);
    });
  };
}

require('./app.g.less');
require('./themes.g.less');

// Initiates tooltips and sets their parent wrapper
Vue.use(VTooltip);
VTooltip.options.defaultContainer = '#mainWrapper';
Vue.use(Toasted);
Vue.use(VeeValidate); // form validations
Vue.use(VModal);

// Disable chrome default drag/drop behavior
document.addEventListener('dragover', event => event.preventDefault());
document.addEventListener('dragenter', event => event.preventDefault());
document.addEventListener('drop', event => event.preventDefault());

export const apiInitErrorResultToMessage = (resultCode: obs.EVideoCodes) => {
  switch (resultCode) {
    case obs.EVideoCodes.NotSupported: {
      return $t('OBSInit.NotSupportedError');
    }
    case obs.EVideoCodes.ModuleNotFound: {
      return $t('OBSInit.ModuleNotFoundError');
    }
    default: {
      return $t('OBSInit.UnknownError');
    }
  }
};

const showDialog = (message: string): void => {
  electron.remote.dialog.showErrorBox($t('OBSInit.ErrorTitle'), message);
};

document.addEventListener('DOMContentLoaded', () => {
  createStore().then(async store => {
    const windowsService: WindowsService = WindowsService.instance;

    if (Utils.isMainWindow()) {
      // Services
      const appService: AppService = AppService.instance;
      const obsUserPluginsService: ObsUserPluginsService = ObsUserPluginsService.instance;

      // This is used for debugging
      window['obs'] = obs;

      // Host a new OBS server instance
      obs.IPC.host(`slobs-${uuid()}`);
      obs.NodeObs.SetWorkingDirectory(
        path.join(
          electron.remote.app.getAppPath().replace('app.asar', 'app.asar.unpacked'),
          'node_modules',
          'obs-studio-node',
        ),
      );

      crashHandler.registerProcess(appService.pid, false);

      await obsUserPluginsService.initialize();

      // Initialize OBS API
      const apiResult = obs.NodeObs.OBS_API_initAPI(
        'en-US',
        appService.appDataDirectory,
        electron.remote.process.env.SLOBS_VERSION,
      );

      if (apiResult !== obs.EVideoCodes.Success) {
        const message = apiInitErrorResultToMessage(apiResult);
        showDialog(message);

        crashHandler.unregisterProcess(appService.pid);

        obs.NodeObs.StopCrashHandler();
        obs.IPC.disconnect();

        electron.ipcRenderer.send('shutdownComplete');
        return;
      }

      ipcRenderer.on('closeWindow', () => windowsService.closeMainWindow());
      AppService.instance.load();
    } else {
      if (Utils.isChildWindow()) {
        ipcRenderer.on('closeWindow', () => windowsService.closeChildWindow());
      }

      if (usingSentry) {
        const userService = getResource<UserService>('UserService');

        const ctx = userService.getSentryContext();
        if (ctx) setSentryContext(ctx);
        userService.sentryContext.subscribe(setSentryContext);
      }
    }

    // setup VueI18n plugin
    Vue.use(VueI18n);
    const i18nService: I18nService = I18nService.instance;
    await i18nService.load(); // load translations from a disk
    const i18n = new VueI18n({
      locale: i18nService.state.locale,
      fallbackLocale: i18nService.getFallbackLocale(),
      messages: i18nService.getLoadedDictionaries(),
      missing: (language: string, key: string) => {
        if (isProduction) return;
        console.error(`Missing translation found for ${language} -- "${key}"`);
      },
    });
    I18nService.setVuei18nInstance(i18n);

    // create a root Vue component
    const windowId = Utils.getCurrentUrlParams().windowId;
    const vm = new Vue({
      i18n,
      store,
      el: '#app',
      render: h => {
        if (windowId === 'child') return h(ChildWindow);
        if (windowId === 'main') {
          const componentName = windowsService.state[windowId].componentName;
          return h(windowsService.components[componentName]);
        }
        return h(OneOffWindow);
      },
    });
  });
});

if (Utils.isDevMode()) {
  window.addEventListener('error', () => ipcRenderer.send('showErrorAlert'));
  window.addEventListener('keyup', ev => {
    if (ev.key === 'F12') electron.ipcRenderer.send('openDevTools');
  });
}

// ERRORS LOGGING

function logError(...args: unknown[]) {
  if (Utils.isDevMode()) ipcRenderer.send('showErrorAlert');
  electronLog.error(...args);
}

// override console
Object.assign(console, {
  log: electronLog.log,
  warn: electronLog.warn,
  info: electronLog.info,
  error: logError,
});

// catch and log unhandled errors/rejected promises:
electronLog.catchErrors({ onError: () => Utils.isDevMode() && ipcRenderer.send('showErrorAlert') });
