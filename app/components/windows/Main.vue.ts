import Vue from 'vue';
import { Component } from 'vue-property-decorator';
import SideNav from '../SideNav';
import NewsBanner from '../NewsBanner';
import { ScenesService } from 'services/scenes';
import { PlatformAppsService } from 'services/platform-apps';
import { EditorCommandsService } from '../../app-services';
import VueResize from 'vue-resize';
import { $t } from 'services/i18n';
import fs from 'fs';
Vue.use(VueResize);

// Pages
import Studio from '../pages/Studio';
import Chatbot from '../pages/Chatbot.vue';
import PlatformAppStore from '../pages/PlatformAppStore.vue';
import BrowseOverlays from 'components/pages/BrowseOverlays.vue';
import Onboarding from '../pages/Onboarding';
import LayoutEditor from '../pages/LayoutEditor';
import TitleBar from '../TitleBar.vue';
import { Inject } from '../../services/core/injector';
import { CustomizationService } from 'services/customization';
import { NavigationService } from 'services/navigation';
import { AppService } from 'services/app';
import { UserService } from 'services/user';
import { WindowsService } from 'services/windows';
import LiveDock from '../LiveDock.vue';
import StudioFooter from '../StudioFooter.vue';
import CustomLoader from '../CustomLoader';
import PatchNotes from '../pages/PatchNotes.vue';
import PlatformAppMainPage from '../pages/PlatformAppMainPage.vue';
import electron from 'electron';
import ResizeBar from 'components/shared/ResizeBar.vue';
import FacebookMerge from 'components/pages/FacebookMerge';
import { getPlatformService } from 'services/platforms';

@Component({
  components: {
    TitleBar,
    SideNav,
    Studio,
    BrowseOverlays,
    Onboarding,
    LiveDock,
    StudioFooter,
    CustomLoader,
    PatchNotes,
    NewsBanner,
    Chatbot,
    PlatformAppMainPage,
    PlatformAppStore,
    ResizeBar,
    FacebookMerge,
    LayoutEditor,
  },
})
export default class Main extends Vue {
  @Inject() customizationService: CustomizationService;
  @Inject() navigationService: NavigationService;
  @Inject() appService: AppService;
  @Inject() userService: UserService;
  @Inject() windowsService: WindowsService;
  @Inject() scenesService: ScenesService;
  @Inject() platformAppsService: PlatformAppsService;
  @Inject() editorCommandsService: EditorCommandsService;

  mounted() {
    const dockWidth = this.customizationService.state.livedockSize;
    if (dockWidth < 1) {
      // migrate from old percentage value to the pixel value
      this.resetWidth();
    }

    electron.remote.getCurrentWindow().show();
    this.handleResize();
  }

  minEditorWidth = 500;

  get title() {
    return this.windowsService.state.main.title;
  }

  get page() {
    return this.navigationService.state.currentPage;
  }

  get params() {
    return this.navigationService.state.params;
  }

  get theme() {
    return this.customizationService.currentTheme;
  }

  get applicationLoading() {
    return this.appService.state.loading;
  }

  get showLoadingSpinner() {
    return (
      this.appService.state.loading && this.page !== 'Onboarding' && this.page !== 'BrowseOverlays'
    );
  }

  get isLoggedIn() {
    return this.userService.isLoggedIn();
  }

  get renderDock() {
    return (
      this.isLoggedIn &&
      !this.isOnboarding &&
      this.hasLiveDock &&
      getPlatformService(this.userService.platform.type).liveDockEnabled() &&
      !this.showLoadingSpinner
    );
  }

  get isDockCollapsed() {
    return this.customizationService.state.livedockCollapsed;
  }

  get leftDock() {
    return this.customizationService.state.leftDock;
  }

  get isOnboarding() {
    return this.navigationService.state.currentPage === 'Onboarding';
  }

  get platformApps() {
    return this.platformAppsService.enabledApps;
  }

  get errorAlert() {
    return this.appService.state.errorAlert;
  }

  async isDirectory(path: string) {
    return new Promise<boolean>((resolve, reject) => {
      fs.lstat(path, (err, stats) => {
        if (err) {
          reject(err);
        }
        resolve(stats.isDirectory());
      });
    });
  }

  async onDropHandler(event: DragEvent) {
    if (this.page !== 'Studio') return;

    const fileList = event.dataTransfer.files;

    if (fileList.length < 1) return;

    const files: string[] = [];
    let fi = fileList.length;
    while (fi--) files.push(fileList.item(fi).path);

    const isDirectory = await this.isDirectory(files[0]).catch(err => {
      console.error(err);
      return false;
    });

    if (files.length > 1 || isDirectory) {
      electron.remote.dialog
        .showMessageBox(electron.remote.getCurrentWindow(), {
          message: $t('Are you sure you want to import multiple files?'),
          type: 'warning',
          buttons: [$t('Cancel'), $t('OK')],
        })
        .then(({ response }) => {
          if (!response) return;
          this.executeFileDrop(files);
        });
    } else {
      this.executeFileDrop(files);
    }
  }

  executeFileDrop(files: string[]) {
    this.editorCommandsService.executeCommand(
      'AddFilesCommand',
      this.scenesService.activeSceneId,
      files,
    );
  }

  $refs: {
    mainMiddle: HTMLDivElement;
  };

  compactView = false;

  get mainResponsiveClasses() {
    const classes = [];

    if (this.compactView) {
      classes.push('main-middle--compact');
    }

    return classes.join(' ');
  }

  created() {
    window.addEventListener('resize', this.windowSizeHandler);
  }

  destroyed() {
    window.removeEventListener('resize', this.windowSizeHandler);
  }

  windowWidth: number;

  hasLiveDock = true;

  windowResizeTimeout: number;

  windowSizeHandler() {
    if (!this.windowsService.state.main.hideStyleBlockers) {
      this.onResizeStartHandler();
    }
    this.windowWidth = window.innerWidth;

    clearTimeout(this.windowResizeTimeout);

    this.hasLiveDock = this.windowWidth >= 1070;
    if (this.page === 'Studio') {
      this.hasLiveDock = this.windowWidth >= this.minEditorWidth + 100;
    }
    this.windowResizeTimeout = window.setTimeout(
      () => this.windowsService.updateStyleBlockers('main', false),
      200,
    );
  }

  handleResize() {
    this.compactView = this.$refs.mainMiddle.clientWidth < 1200;
  }

  handleEditorWidth(width: number) {
    this.minEditorWidth = width;
  }

  onResizeStartHandler() {
    this.windowsService.updateStyleBlockers('main', true);
  }

  onResizeStopHandler(offset: number) {
    const adjustedOffset = this.leftDock ? offset : -offset;
    this.setWidth(this.customizationService.state.livedockSize + adjustedOffset);
    this.windowsService.updateStyleBlockers('main', false);
  }

  setWidth(width: number) {
    this.customizationService.setSettings({
      livedockSize: this.validateWidth(width),
    });
  }

  validateWidth(width: number): number {
    const appRect = this.$root.$el.getBoundingClientRect();
    const minWidth = 290;
    const maxWidth = Math.min(appRect.width - this.minEditorWidth, appRect.width / 2);
    let constrainedWidth = Math.max(minWidth, width);
    constrainedWidth = Math.min(maxWidth, width);
    return constrainedWidth;
  }

  updateWidth() {
    const width = this.customizationService.state.livedockSize;
    if (width !== this.validateWidth(width)) this.setWidth(width);
  }

  resetWidth() {
    const appRect = this.$root.$el.getBoundingClientRect();
    const defaultWidth = appRect.width * 0.28;
    this.setWidth(defaultWidth);
  }
}
