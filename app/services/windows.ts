/* tslint:disable:max-line-length */
// This singleton class provides a renderer-space API
// for spawning various child windows.
import cloneDeep from 'lodash/cloneDeep';

import Main from 'components/windows/Main.vue';
import Settings from 'components/windows/settings/Settings.vue';
import FFZSettings from 'components/windows/FFZSettings.vue';
import SourcesShowcase from 'components/windows/SourcesShowcase.vue';
import SceneTransitions from 'components/windows/SceneTransitions.vue';
import AddSource from 'components/windows/AddSource.vue';
import RenameSource from 'components/windows/RenameSource.vue';
import NameScene from 'components/windows/NameScene.vue';
import NameFolder from 'components/windows/NameFolder.vue';
import SourceProperties from 'components/windows/SourceProperties.vue';
import SourceFilters from 'components/windows/SourceFilters.vue';
import AddSourceFilter from 'components/windows/AddSourceFilter';
import EditStreamInfo from 'components/windows/EditStreamInfo.vue';
import AdvancedAudio from 'components/windows/AdvancedAudio.vue';
import Notifications from 'components/windows/Notifications.vue';
import Troubleshooter from 'components/windows/Troubleshooter.vue';
import Blank from 'components/windows/Blank.vue';
import ManageSceneCollections from 'components/windows/ManageSceneCollections.vue';
import RecentEvents from 'components/windows/RecentEvents.vue';
import GameOverlayEventFeed from 'components/windows/GameOverlayEventFeed';
import Projector from 'components/windows/Projector.vue';
import MediaGallery from 'components/windows/MediaGallery.vue';
import PlatformAppPopOut from 'components/windows/PlatformAppPopOut.vue';
import EditTransform from 'components/windows/EditTransform';
import EventFilterMenu from 'components/windows/EventFilterMenu';
import AdvancedStatistics from 'components/windows/AdvancedStatistics';
import OverlayWindow from 'components/windows/OverlayWindow.vue';
import OverlayPlaceholder from 'components/windows/OverlayPlaceholder';
import BrowserSourceInteraction from 'components/windows/BrowserSourceInteraction';
import YoutubeStreamStatus from 'components/platforms/youtube/YoutubeStreamStatus';
import { mutation, StatefulService } from 'services/core/stateful-service';
import electron from 'electron';
import Vue from 'vue';
import Util from 'services/utils';
import { Subject } from 'rxjs';

import BitGoal from 'components/widgets/goal/BitGoal.vue';
import DonationGoal from 'components/widgets/goal/DonationGoal.vue';
import SubGoal from 'components/widgets/goal/SubGoal.vue';
import StarsGoal from 'components/widgets/goal/StarsGoal.vue';
import SupporterGoal from 'components/widgets/goal/SupporterGoal.vue';
import ChatBox from 'components/widgets/ChatBox.vue';
import FollowerGoal from 'components/widgets/goal/FollowerGoal.vue';
import ViewerCount from 'components/widgets/ViewerCount.vue';
import StreamBoss from 'components/widgets/StreamBoss.vue';
import DonationTicker from 'components/widgets/DonationTicker.vue';
import Credits from 'components/widgets/Credits.vue';
import EventList from 'components/widgets/EventList.vue';
import TipJar from 'components/widgets/TipJar.vue';
import SponsorBanner from 'components/widgets/SponsorBanner.vue';
import MediaShare from 'components/widgets/MediaShare';
import AlertBox from 'components/widgets/AlertBox.vue';
import SpinWheel from 'components/widgets/SpinWheel.vue';

import PerformanceMetrics from 'components/PerformanceMetrics.vue';
import { throttle } from 'lodash-decorators';

const { ipcRenderer, remote } = electron;
const BrowserWindow = remote.BrowserWindow;
const uuid = window['require']('uuid/v4');

// This is a list of components that are registered to be
// top level components in new child windows.
export function getComponents() {
  return {
    Main,
    Settings,
    FFZSettings,
    SceneTransitions,
    SourcesShowcase,
    RenameSource,
    AddSource,
    NameScene,
    NameFolder,
    SourceProperties,
    SourceFilters,
    AddSourceFilter,
    Blank,
    EditStreamInfo,
    AdvancedAudio,
    Notifications,
    Troubleshooter,
    ManageSceneCollections,
    Projector,
    RecentEvents,
    MediaGallery,
    PlatformAppPopOut,
    EditTransform,
    OverlayWindow,
    OverlayPlaceholder,
    PerformanceMetrics,
    BrowserSourceInteraction,
    EventFilterMenu,
    GameOverlayEventFeed,
    AdvancedStatistics,
    BitGoal,
    DonationGoal,
    FollowerGoal,
    StarsGoal,
    SupporterGoal,
    ChatBox,
    ViewerCount,
    DonationTicker,
    Credits,
    EventList,
    TipJar,
    SponsorBanner,
    StreamBoss,
    SubGoal,
    MediaShare,
    AlertBox,
    SpinWheel,
    YoutubeStreamStatus,
  };
}

export interface IWindowOptions extends Electron.BrowserWindowConstructorOptions {
  componentName: string;
  queryParams?: Dictionary<any>;
  size?: {
    width: number;
    height: number;
    minWidth?: number;
    minHeight?: number;
  };
  scaleFactor: number;
  isShown: boolean;
  title?: string;
  center?: boolean;
  isPreserved?: boolean;
  preservePrevWindow?: boolean;
  prevWindowOptions?: IWindowOptions;
  isFullScreen?: boolean;

  // Will be true when the UI is performing animations, transitions, or property changes that affect
  // the display of elements we cannot draw over. During this time such elements, for example
  // BrowserViews and the OBS Display, will be hidden until the operation is complete.
  hideStyleBlockers: boolean;
}

interface IWindowsState {
  [windowId: string]: IWindowOptions;
}

const DEFAULT_WINDOW_OPTIONS: IWindowOptions = {
  componentName: '',
  scaleFactor: 1,
  isShown: true,
  hideStyleBlockers: false,
};

export class WindowsService extends StatefulService<IWindowsState> {
  /**
   * 'main' and 'child' are special window ids that always exist
   * and have special purposes.  All other windows ids are considered
   * 'one-off' windows and can be freely created and destroyed.
   */
  static initialState: IWindowsState = {
    main: {
      componentName: 'Main',
      scaleFactor: 1,
      isShown: true,
      hideStyleBlockers: true,
      title: `Streamlabs OBS - Version: ${remote.process.env.SLOBS_VERSION}`,
    },
    child: {
      componentName: '',
      scaleFactor: 1,
      hideStyleBlockers: false,
      isShown: false,
    },
  };

  // This is a list of components that are registered to be
  // top level components in new child windows.
  components = getComponents();

  windowUpdated = new Subject<{ windowId: string; options: IWindowOptions }>();
  windowDestroyed = new Subject<string>();
  private windows: Dictionary<Electron.BrowserWindow> = {};

  init() {
    const windows = BrowserWindow.getAllWindows();

    this.windows.main = windows[0];
    this.windows.child = windows[1];

    this.updateScaleFactor('main');
    this.updateScaleFactor('child');
    this.windows.main.on('move', () => this.updateScaleFactor('main'));
    this.windows.child.on('move', () => this.updateScaleFactor('child'));
  }

  @throttle(500)
  private updateScaleFactor(windowId: string) {
    const window = this.windows[windowId];
    if (window && !window.isDestroyed()) {
      const bounds = window.getBounds();
      const currentDisplay = electron.remote.screen.getDisplayMatching(bounds);
      this.UPDATE_SCALE_FACTOR(windowId, currentDisplay.scaleFactor);
    }
  }

  showWindow(options: Partial<IWindowOptions>) {
    // Don't center the window if it's the same component
    // This prevents "snapping" behavior when navigating settings
    if (options.componentName !== this.state.child.componentName) {
      options.center = true;
    }

    /*
     * Override `options.size` when what is passed in is bigger than the current display.
     * We do not do this on CI since it runs at 1024x768 and it break tests that aren't easy
     * to workaround.
     */
    if (options.size && !remote.process.env.CI) {
      const {
        width: screenWidth,
        height: screenHeight,
      } = electron.remote.screen.getDisplayMatching(this.windows.main.getBounds()).workAreaSize;

      const SCREEN_PERCENT = 0.75;

      if (options.size.width > screenWidth || options.size.height > screenHeight) {
        options.size = {
          width: Math.round(screenWidth * SCREEN_PERCENT),
          height: Math.round(screenHeight * SCREEN_PERCENT),
        };
      }
    }

    ipcRenderer.send('window-showChildWindow', options);
    this.updateChildWindowOptions(options);
  }

  getMainWindowDisplay() {
    const window = this.windows.main;
    const bounds = window.getBounds();
    return electron.remote.screen.getDisplayMatching(bounds);
  }

  closeChildWindow() {
    const windowOptions = this.state.child;

    // show previous window if `preservePrevWindow` flag is true
    if (windowOptions.preservePrevWindow && windowOptions.prevWindowOptions) {
      const options = {
        ...windowOptions.prevWindowOptions,
        isPreserved: true,
      };

      ipcRenderer.send('window-showChildWindow', options);
      this.updateChildWindowOptions(options);
      return;
    }

    // This prevents you from seeing the previous contents
    // of the window for a split second after it is shown.
    this.updateChildWindowOptions({ componentName: '', isShown: false });

    // Refocus the main window
    ipcRenderer.send('window-focusMain');
    ipcRenderer.send('window-closeChildWindow');
  }

  closeMainWindow() {
    remote.getCurrentWindow().close();
  }

  /**
   * Creates a one-off window that will not impact or close
   * any existing windows, and will cease to exist when closed.
   * @param options window options
   * @param windowId A unique window id.  If a window with that id
   * already exists, this function will focus the existing window instead.
   * @return the window id of the created window
   */
  createOneOffWindow(options: Partial<IWindowOptions>, windowId?: string): string {
    // tslint:disable-next-line:no-parameter-reassignment TODO
    windowId = windowId || uuid();

    if (this.windows[windowId]) {
      this.windows[windowId].restore();
      this.windows[windowId].focus();
      return windowId;
    }

    this.CREATE_ONE_OFF_WINDOW(windowId, { ...DEFAULT_WINDOW_OPTIONS, ...options });

    const newWindow = (this.windows[windowId] = new BrowserWindow({
      frame: false,
      width: 400,
      height: 400,
      title: 'New Window',
      backgroundColor: '#17242D',
      webPreferences: { nodeIntegration: true, webviewTag: true },
      ...options,
      ...options.size,
    }));

    newWindow.removeMenu();
    newWindow.on('closed', () => {
      this.windowDestroyed.next(windowId);
      delete this.windows[windowId];
      this.DELETE_ONE_OFF_WINDOW(windowId);
    });

    this.updateScaleFactor(windowId);
    newWindow.on('move', () => this.updateScaleFactor(windowId));

    if (Util.isDevMode()) newWindow.webContents.openDevTools({ mode: 'detach' });

    const indexUrl = remote.getGlobal('indexUrl');
    newWindow.loadURL(`${indexUrl}?windowId=${windowId}`);

    return windowId;
  }

  createOneOffWindowForOverlay(
    options: Partial<IWindowOptions>,
    windowId?: string,
  ): Electron.BrowserWindow {
    // tslint:disable-next-line:no-parameter-reassignment TODO
    windowId = windowId || uuid();

    this.CREATE_ONE_OFF_WINDOW(windowId, options);

    const newWindow = (this.windows[windowId] = new BrowserWindow(options));

    const indexUrl = remote.getGlobal('indexUrl');
    newWindow.loadURL(`${indexUrl}?windowId=${windowId}`);

    return newWindow;
  }

  setOneOffFullscreen(windowId: string, fullscreen: boolean) {
    this.UPDATE_ONE_OFF_WINDOW(windowId, { isFullScreen: fullscreen });
  }

  /**
   * Closes all one-off windows
   */
  closeAllOneOffs(): Promise<any> {
    const closingPromises: Promise<void>[] = [];
    Object.keys(this.windows).forEach(windowId => {
      if (windowId === 'main') return;
      if (windowId === 'child') return;
      closingPromises.push(this.closeOneOffWindow(windowId));
    });
    return Promise.all(closingPromises);
  }

  closeOneOffWindow(windowId: string): Promise<void> {
    if (!this.windows[windowId] || this.windows[windowId].isDestroyed()) return Promise.resolve();
    return new Promise(resolve => {
      this.windows[windowId].on('closed', resolve);
      this.windows[windowId].destroy();
    });
  }

  // @ExecuteInCurrentWindow()
  getChildWindowOptions(): IWindowOptions {
    return this.state.child;
  }

  // @ExecuteInCurrentWindow()
  getChildWindowQueryParams(): Dictionary<any> {
    return this.getChildWindowOptions().queryParams || {};
  }

  // @ExecuteInCurrentWindow()
  getWindowOptions(windowId: string) {
    return this.state[windowId].queryParams || {};
  }

  updateStyleBlockers(windowId: string, hideStyleBlockers: boolean) {
    this.UPDATE_HIDE_STYLE_BLOCKERS(windowId, hideStyleBlockers);
  }

  updateChildWindowOptions(optionsPatch: Partial<IWindowOptions>) {
    const newOptions: IWindowOptions = {
      ...DEFAULT_WINDOW_OPTIONS,
      ...optionsPatch,
      scaleFactor: this.state.child.scaleFactor,
    };
    if (newOptions.preservePrevWindow) {
      const currentOptions = cloneDeep(this.state.child);

      if (currentOptions.preservePrevWindow) {
        throw new Error(
          "You can't use preservePrevWindow option for more that 1 window in the row",
        );
      }

      newOptions.prevWindowOptions = currentOptions;

      // restrict saving history only for 1 window before
      delete newOptions.prevWindowOptions.prevWindowOptions;
    }

    this.SET_CHILD_WINDOW_OPTIONS(newOptions);
    this.windowUpdated.next({ windowId: 'child', options: newOptions });
  }

  updateMainWindowOptions(options: Partial<IWindowOptions>) {
    this.UPDATE_MAIN_WINDOW_OPTIONS(options);
  }

  @mutation()
  private SET_CHILD_WINDOW_OPTIONS(options: IWindowOptions) {
    options.queryParams = options.queryParams || {};
    this.state.child = options;
  }

  @mutation()
  private UPDATE_MAIN_WINDOW_OPTIONS(options: Partial<IWindowOptions>) {
    this.state.main = { ...this.state.main, ...options };
  }

  @mutation()
  private UPDATE_SCALE_FACTOR(windowId: string, scaleFactor: number) {
    this.state[windowId].scaleFactor = scaleFactor;
  }

  @mutation()
  private UPDATE_HIDE_STYLE_BLOCKERS(windowId: string, hideStyleBlockers: boolean) {
    this.state[windowId].hideStyleBlockers = hideStyleBlockers;
  }

  @mutation()
  private CREATE_ONE_OFF_WINDOW(windowId: string, options: Partial<IWindowOptions>) {
    const opts = {
      componentName: 'Blank',
      scaleFactor: 1,
      ...options,
    };

    Vue.set(this.state, windowId, opts);
  }

  @mutation()
  private UPDATE_ONE_OFF_WINDOW(windowId: string, options: Partial<IWindowOptions>) {
    const oldOpts = this.state[windowId];
    Vue.set(this.state, windowId, { ...oldOpts, ...options });
  }

  @mutation()
  private DELETE_ONE_OFF_WINDOW(windowId: string) {
    Vue.delete(this.state, windowId);
  }
}
