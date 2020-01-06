import { Subject } from 'rxjs';
import { PersistentStatefulService } from '../core/persistent-stateful-service';
import { mutation } from '../core/stateful-service';
import {
  ICustomizationServiceApi,
  ICustomizationServiceState,
  ICustomizationSettings,
  IPinnedStatistics,
} from './customization-api';
import {
  IObsInput,
  IObsListInput,
  IObsNumberInputValue,
  TObsFormData,
} from 'components/obs/inputs/ObsInput';
import Utils from 'services/utils';
import { $t } from 'services/i18n';
import { Inject } from 'services/core';
import { UserService } from 'services/user';

// Maps to --background
const THEME_BACKGROUNDS = {
  'night-theme': { r: 9, g: 22, b: 29 },
  'day-theme': { r: 245, g: 248, b: 250 },
};

// Maps to --section
const DISPLAY_BACKGROUNDS = {
  'night-theme': { r: 11, g: 22, b: 28 },
  'day-theme': { r: 227, g: 232, b: 235 },
};

/**
 * This class is used to store general UI behavior flags
 * that are sticky across application runtimes.
 */
export class CustomizationService extends PersistentStatefulService<ICustomizationServiceState>
  implements ICustomizationServiceApi {
  @Inject() userService: UserService;

  static get migrations() {
    return [
      {
        oldKey: 'nightMode',
        newKey: 'theme',
        transform: (val: boolean) => (val ? 'night-theme' : 'day-theme'),
      },
    ];
  }

  static defaultState: ICustomizationServiceState = {
    theme: 'night-theme',
    updateStreamInfoOnLive: true,
    livePreviewEnabled: true,
    leftDock: false,
    hideViewerCount: false,
    livedockCollapsed: true,
    livedockSize: 0,
    eventsSize: 156,
    controlsSize: 240,
    performanceMode: false,
    chatZoomFactor: 1,
    enableBTTVEmotes: false,
    enableFFZEmotes: false,
    mediaBackupOptOut: false,
    folderSelection: false,
    navigateToLiveOnStreamStart: true,
    legacyEvents: false,
    pinnedStatistics: {
      cpu: false,
      fps: false,
      droppedFrames: false,
      bandwidth: false,
    },
    experimental: {
      // put experimental features here
    },
  };

  settingsChanged = new Subject<Partial<ICustomizationSettings>>();

  init() {
    super.init();
    this.setSettings(this.runMigrations(this.state, CustomizationService.migrations));
    this.setLiveDockCollapsed(true); // livedock is always collapsed on app start
  }

  setSettings(settingsPatch: Partial<ICustomizationSettings>) {
    const changedSettings = Utils.getChangedParams(this.state, settingsPatch);
    this.SET_SETTINGS(changedSettings);
    this.settingsChanged.next(changedSettings);
  }

  getSettings(): ICustomizationSettings {
    return this.state;
  }

  get currentTheme() {
    return this.state.theme;
  }

  setTheme(theme: string) {
    return this.setSettings({ theme });
  }

  get themeBackground() {
    return THEME_BACKGROUNDS[this.currentTheme];
  }

  get displayBackground() {
    return DISPLAY_BACKGROUNDS[this.currentTheme];
  }

  get isDarkTheme() {
    return ['night-theme'].includes(this.currentTheme);
  }

  setUpdateStreamInfoOnLive(update: boolean) {
    this.setSettings({ updateStreamInfoOnLive: update });
  }

  setLivePreviewEnabled(enabled: boolean) {
    this.setSettings({ livePreviewEnabled: enabled });
  }

  setLeftDock(enabled: boolean) {
    this.setSettings({ leftDock: enabled });
  }

  setLiveDockCollapsed(collapsed: boolean) {
    this.setSettings({ livedockCollapsed: collapsed });
  }

  setHiddenViewerCount(hidden: boolean) {
    this.setSettings({ hideViewerCount: hidden });
  }

  setMediaBackupOptOut(optOut: boolean) {
    this.setSettings({ mediaBackupOptOut: optOut });
  }

  setPinnedStatistics(pinned: IPinnedStatistics) {
    this.setSettings({ pinnedStatistics: pinned });
  }

  getSettingsFormData(): TObsFormData {
    const settings = this.getSettings();

    const formData: TObsFormData = [
      <IObsListInput<string>>{
        value: settings.theme,
        name: 'theme',
        description: $t('Theme'),
        type: 'OBS_PROPERTY_LIST',
        options: [
          { value: 'night-theme', description: $t('Night') },
          { value: 'day-theme', description: $t('Day') },
        ],
        visible: true,
        enabled: true,
      },

      <IObsListInput<boolean>>{
        value: settings.folderSelection,
        name: 'folderSelection',
        description: $t('Scene item selection mode'),
        type: 'OBS_PROPERTY_LIST',
        options: [
          { value: true, description: $t('Single click selects group. Double click selects item') },
          {
            value: false,
            description: $t('Double click selects group. Single click selects item'),
          },
        ],
        visible: true,
        enabled: true,
      },

      <IObsInput<boolean>>{
        value: settings.leftDock,
        name: 'leftDock',
        description: $t('Show the live dock (chat) on the left side'),
        type: 'OBS_PROPERTY_BOOL',
        visible: true,
        enabled: true,
      },

      <IObsNumberInputValue>{
        value: settings.chatZoomFactor,
        name: 'chatZoomFactor',
        description: $t('Chat Text Size'),
        type: 'OBS_PROPERTY_SLIDER',
        minVal: 0.25,
        maxVal: 2,
        stepVal: 0.25,
        visible: true,
        enabled: true,
        usePercentages: true,
      },
    ];

    if (this.userService.isLoggedIn() && this.userService.platform.type === 'twitch') {
      formData.push(<IObsInput<boolean>>{
        value: settings.enableBTTVEmotes,
        name: 'enableBTTVEmotes',
        description: $t('Enable BetterTTV emotes for Twitch'),
        type: 'OBS_PROPERTY_BOOL',
        visible: true,
        enabled: true,
      });

      formData.push(<IObsInput<boolean>>{
        value: settings.enableFFZEmotes,
        name: 'enableFFZEmotes',
        description: $t('Enable FrankerFaceZ emotes for Twitch'),
        type: 'OBS_PROPERTY_BOOL',
        visible: true,
        enabled: true,
      });
    }

    return formData;
  }

  getExperimentalSettingsFormData(): TObsFormData {
    return [];
  }

  restoreDefaults() {
    this.setSettings(CustomizationService.defaultState);
  }

  @mutation()
  private SET_SETTINGS(settingsPatch: Partial<ICustomizationSettings>) {
    Object.assign(this.state, settingsPatch);
  }
}
