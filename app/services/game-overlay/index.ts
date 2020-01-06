import electron, { ipcRenderer } from 'electron';
import { Subject, Subscription } from 'rxjs';
import { delay, take } from 'rxjs/operators';
import { Inject, InitAfter } from 'services/core';
import { LoginLifecycle, UserService } from 'services/user';
import { CustomizationService } from 'services/customization';
import { WindowsService } from '../windows';
import { PersistentStatefulService } from 'services/core/persistent-stateful-service';
import { mutation } from 'services/core/stateful-service';
import { $t } from 'services/i18n';
import { StreamInfoService } from 'services/stream-info';

const { BrowserWindow } = electron.remote;

// We remote.require because this module needs to live in the main
// process so we can paint to it from there. We are doing this to
// work around an electron bug: https://github.com/electron/electron/issues/20559
const overlay = electron.remote.require('@streamlabs/game-overlay');

interface IWindowProperties {
  chat: { position: IVec2; id: number; enabled: boolean };
  recentEvents: { position: IVec2; id: number; enabled: boolean };
}

export type GameOverlayState = {
  isEnabled: boolean;
  isShowing: boolean;
  isPreviewEnabled: boolean;
  previewMode: boolean;
  opacity: number;
  windowProperties: IWindowProperties;
};

const hideInteraction = `
  const elements = [];

  /* Platform Chats */
  elements.push(document.querySelector('.chat-input'));
  elements.push(document.querySelector('.webComposerBlock__3lT5b'));

  /* Recent Events */
  elements.push(document.querySelector('.recent-events__header'));
  elements.push(document.querySelector('.recent-events__tabs'));
  elements.push(document.querySelector('.popout--recent-events'));
  elements.forEach((el) => {
    if (el) { el.style.cssText = 'display: none !important'; }
  });
`;

@InitAfter('UserService')
export class GameOverlayService extends PersistentStatefulService<GameOverlayState> {
  @Inject() userService: UserService;
  @Inject() customizationService: CustomizationService;
  @Inject() windowsService: WindowsService;
  @Inject() streamInfoService: StreamInfoService;

  static defaultState: GameOverlayState = {
    isEnabled: false,
    isShowing: false,
    isPreviewEnabled: true,
    previewMode: false,
    opacity: 100,
    windowProperties: {
      chat: { position: null, id: null, enabled: true },
      recentEvents: { position: null, id: null, enabled: true },
    },
  };

  windows: {
    chat: Electron.BrowserWindow;
    recentEvents: Electron.BrowserWindow;
    // overlayControls: Electron.BrowserWindow;
  } = {} as any;

  previewWindows: {
    chat: Electron.BrowserWindow;
    recentEvents: Electron.BrowserWindow;
    // overlayControls: Electron.BrowserWindow;
  } = {} as any;

  private onWindowsReady: Subject<Electron.BrowserWindow> = new Subject<Electron.BrowserWindow>();
  private onWindowsReadySubscription: Subscription;
  private onChatUrlChangedSubscription: Subscription;
  private lifecycle: LoginLifecycle;

  private commonWindowOptions = {} as Electron.BrowserWindowConstructorOptions;

  async init() {
    super.init();
    this.lifecycle = await this.userService.withLifecycle({
      init: this.initializeOverlay,
      destroy: () => this.setEnabled(false),
      context: this,
    });
  }

  private overlayRunning = false;

  async initializeOverlay() {
    if (!this.state.isEnabled) return;

    if (this.overlayRunning) return;
    this.overlayRunning = true;

    let crashHandlerLogPath = '';
    if (process.env.NODE_ENV !== 'production' || !!process.env.SLOBS_PREVIEW) {
      const overlayLogFile = '\\game-overlays.log';
      crashHandlerLogPath = electron.remote.app.getPath('userData') + overlayLogFile;
    }

    overlay.start(crashHandlerLogPath);

    this.onWindowsReadySubscription = this.onWindowsReady
      .pipe(
        take(Object.keys(this.windows).length),
        delay(5000), // so recent events has time to load
      )
      .subscribe({ complete: () => this.createWindowOverlays() });

    this.assignCommonWindowOptions();
    const partition = this.userService.state.auth.partition;
    const chatWebPrefences = { ...this.commonWindowOptions.webPreferences, partition };
    this.windows.recentEvents = this.windowsService.createOneOffWindowForOverlay({
      ...this.commonWindowOptions,
      width: 600,
      componentName: 'GameOverlayEventFeed',
      queryParams: { gameOverlay: true },
      webPreferences: { offscreen: true, nodeIntegration: true },
      isFullScreen: true,
    });
    this.windows.chat = new BrowserWindow({
      ...this.commonWindowOptions,
      height: 600,
      webPreferences: chatWebPrefences,
    });

    this.windows.chat.webContents.setAudioMuted(true);

    this.createPreviewWindows();
    await this.configureWindows();
  }

  assignCommonWindowOptions() {
    const [containerX, containerY] = this.getWindowContainerStartingPosition();
    this.commonWindowOptions = {
      backgroundColor: this.customizationService.themeBackground,
      show: false,
      frame: false,
      width: 300,
      height: 300,
      x: containerX,
      y: containerY,
      skipTaskbar: true,
      thickFrame: false,
      resizable: false,
      webPreferences: { nodeIntegration: false, offscreen: true },
    };
  }

  createPreviewWindows() {
    this.previewWindows.recentEvents = this.windowsService.createOneOffWindowForOverlay({
      ...this.commonWindowOptions,
      width: 600,
      transparent: true,
      webPreferences: { offscreen: false, nodeIntegration: true },
      isFullScreen: true,
      alwaysOnTop: true,
      componentName: 'OverlayPlaceholder',
      title: $t('Recent Events'),
    });

    this.previewWindows.chat = this.windowsService.createOneOffWindowForOverlay({
      ...this.commonWindowOptions,
      height: 600,
      transparent: true,
      webPreferences: { offscreen: false, nodeIntegration: true },
      isFullScreen: true,
      alwaysOnTop: true,
      componentName: 'OverlayPlaceholder',
      title: $t('Chat'),
    });
  }

  async configureWindows() {
    Object.keys(this.windows).forEach((key: string) => {
      const win = this.windows[key];
      win.webContents.once('did-finish-load', () => this.onWindowsReady.next(win));

      const position = this.determineStartPosition(key);
      const size = key === 'chat' ? { width: 300, height: 600 } : { width: 600, height: 300 };
      win.setBounds({ ...position, ...size });
      this.previewWindows[key].setBounds({ ...position, ...size });
    });

    if (this.streamInfoService.state.chatUrl) {
      this.windows.chat
        .loadURL(this.streamInfoService.state.chatUrl)
        .catch(this.handleRedirectError);
    }

    // sync chat url if it has been changed
    this.onChatUrlChangedSubscription = this.streamInfoService.streamInfoChanged.subscribe(
      streamInfo => {
        if (!this.state.isEnabled) return;
        const chatWindow = this.windows.chat;
        if (!chatWindow) return;
        if (streamInfo.chatUrl && streamInfo.chatUrl !== chatWindow.webContents.getURL()) {
          chatWindow.loadURL(streamInfo.chatUrl).catch(this.handleRedirectError);
        }
      },
    );
  }

  handleRedirectError(e: Error) {
    // This error happens when the page redirects, which is expected for chat
    if (!e.message.match(/\(\-3\) loading/)) {
      throw e;
    }
  }

  determineStartPosition(window: string) {
    const pos = this.state.windowProperties[window].position;
    if (pos) {
      const display = electron.remote.screen.getAllDisplays().find(display => {
        const bounds = display.bounds;
        const intBounds = pos.x > bounds.x && pos.y > bounds.y;
        const extBounds = pos.x < bounds.x + bounds.width && pos.y < bounds.y + bounds.height;
        return intBounds && extBounds;
      });

      if (display) return pos;
    }
    this.SET_WINDOW_POSITION(window, null);

    return this.defaultPosition(window);
  }

  resetPosition() {
    this.enabledWindows.forEach((key: string) => {
      const overlayId = this.state.windowProperties[key].id;
      if (!overlayId) return;

      this.SET_WINDOW_POSITION(key, null);
      const pos = this.defaultPosition(key);
      const size = key === 'chat' ? { width: 300, height: 600 } : { width: 600, height: 300 };

      this.windows[key].setBounds({ ...pos, ...size });
      this.previewWindows[key].setBounds({ ...pos, ...size });
      overlay.setPosition(overlayId, pos.x, pos.y, size.width, size.height);
    });
  }

  private defaultPosition(key: string) {
    const [containerX, containerY] = this.getWindowContainerStartingPosition();
    const x = key === 'recentEvents' ? containerX - 600 : containerX;

    return { x, y: containerY };
  }

  showOverlay() {
    overlay.show();
    this.TOGGLE_OVERLAY(true);

    // Force a refresh to trigger a paint event
    Object.values(this.windows).forEach(win => win.webContents.invalidate());
  }

  hideOverlay() {
    overlay.hide();
    this.TOGGLE_OVERLAY(false);
  }

  toggleOverlay() {
    // This is a typo in the module: "runing"
    if (overlay.getStatus() !== 'runing' || !this.state.isEnabled) {
      return;
    }

    if (this.state.previewMode) this.setPreviewMode(false);

    this.state.isShowing ? this.hideOverlay() : this.showOverlay();
  }

  get enabledWindows() {
    return Object.keys(this.windows).filter(
      (win: string) => this.state.windowProperties[win].enabled,
    );
  }

  async setEnabled(shouldEnable: boolean = true) {
    if (shouldEnable && !this.userService.isLoggedIn()) {
      return Promise.reject($t('Please log in to use the in-game overlay.'));
    }

    const shouldStart = shouldEnable && !this.state.isEnabled;
    const shouldStop = !shouldEnable && this.state.isEnabled;

    this.SET_ENABLED(shouldEnable);
    if (shouldStart) await this.initializeOverlay();
    if (shouldStop) await this.destroyOverlay();
  }

  async toggleWindowEnabled(window: string) {
    this.TOGGLE_WINDOW_ENABLED(window);

    const id = this.state.windowProperties[window].id;

    overlay.setVisibility(id, this.state.windowProperties[window].enabled);

    if (!this.state.windowProperties[window].enabled) {
      this.previewWindows[window].hide();
    } else if (this.state.previewMode) {
      this.previewWindows[window].show();
    }
  }

  async setPreviewMode(previewMode: boolean) {
    if (this.state.isShowing) this.hideOverlay();
    if (!this.state.isEnabled) return;
    this.SET_PREVIEW_MODE(previewMode);
    if (previewMode) {
      this.enabledWindows.forEach(win => this.previewWindows[win].show());
    } else {
      this.enabledWindows.forEach(async key => {
        const win: electron.BrowserWindow = this.previewWindows[key];
        const overlayId = this.state.windowProperties[key].id;

        const [x, y] = win.getPosition();
        this.SET_WINDOW_POSITION(key, { x, y });
        const { width, height } = win.getBounds();

        await overlay.setPosition(overlayId, x, y, width, height);
        win.hide();
      });
    }
  }

  setOverlayOpacity(percentage: number) {
    this.SET_OPACITY(percentage);
    if (!this.state.isEnabled) return;
    Object.keys(this.windows).forEach(key => {
      const overlayId = this.state.windowProperties[key].id;

      overlay.setTransparency(overlayId, percentage * 2.55);
    });
  }

  async destroy() {
    if (!this.lifecycle) return;
    await this.destroyOverlay();
  }

  async destroyOverlay() {
    if (!this.overlayRunning) return;
    this.overlayRunning = false;

    await overlay.stop();
    if (this.onWindowsReadySubscription) await this.onWindowsReadySubscription.unsubscribe();
    if (this.windows) await Object.values(this.windows).forEach(win => win.destroy());
    if (this.previewWindows) {
      await Object.values(this.previewWindows).forEach(win => win.destroy());
    }
    this.onChatUrlChangedSubscription.unsubscribe();
    this.SET_PREVIEW_MODE(false);
    this.TOGGLE_OVERLAY(false);
  }

  private createWindowOverlays() {
    Object.keys(this.windows).forEach((key: string) => {
      const win: electron.BrowserWindow = this.windows[key];
      // Fix race condition in screen tests
      if (win.isDestroyed()) return;

      const overlayId = overlay.addHWND(win.getNativeWindowHandle());

      if (overlayId === -1 || overlayId == null) {
        win.hide();
        throw new Error('Error creating overlay');
      }

      this.SET_WINDOW_ID(key, overlayId);

      const position = this.getPosition(key, win);
      const { width, height } = win.getBounds();

      overlay.setPosition(overlayId, position.x, position.y, width, height);
      overlay.setTransparency(overlayId, this.state.opacity * 2.55);
      overlay.setVisibility(overlayId, this.state.windowProperties[key].enabled);

      win.webContents.executeJavaScript(hideInteraction);

      // We bind the paint callback in the main process to avoid a memory
      // leak in electron. This can be moved back to the renderer process
      // when the leak is fixed: https://github.com/electron/electron/issues/20559
      ipcRenderer.send('gameOverlayPaintCallback', { overlayId, contentsId: win.webContents.id });
      win.webContents.setFrameRate(1);
    });
  }

  private getPosition(key: string, win: electron.BrowserWindow) {
    if (this.state.windowProperties[key].position) {
      return this.state.windowProperties[key].position;
    }
    const [x, y] = win.getPosition();
    return { x, y };
  }

  private getWindowContainerStartingPosition() {
    const display = this.windowsService.getMainWindowDisplay();

    return [display.workArea.height / 2 + 200, display.workArea.height / 2 - 300];
  }

  @mutation()
  private TOGGLE_OVERLAY(isShowing: boolean) {
    this.state.isShowing = isShowing;
  }

  @mutation()
  private SET_ENABLED(shouldEnable: boolean = true) {
    this.state.isEnabled = shouldEnable;
  }

  @mutation()
  private SET_PREVIEW_MODE(previewMode: boolean = true) {
    this.state.previewMode = previewMode;
  }

  @mutation()
  private SET_WINDOW_ID(window: string, id: number) {
    this.state.windowProperties[window].id = id;
  }

  @mutation()
  private SET_WINDOW_POSITION(window: string, position: IVec2) {
    this.state.windowProperties[window].position = position;
  }

  @mutation()
  private TOGGLE_WINDOW_ENABLED(window: string) {
    this.state.windowProperties[window].enabled = !this.state.windowProperties[window].enabled;
  }

  @mutation()
  private SET_OPACITY(val: number) {
    this.state.opacity = val;
  }
}
