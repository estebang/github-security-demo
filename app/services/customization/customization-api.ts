import { Observable } from 'rxjs';
import { TObsFormData } from 'components/obs/inputs/ObsInput';
import { overArgs } from 'lodash-decorators';
import Display from 'components/shared/Display.vue';

export interface IPinnedStatistics {
  cpu: boolean;
  fps: boolean;
  droppedFrames: boolean;
  bandwidth: boolean;
}

export interface ICustomizationServiceState {
  nightMode?: string;
  theme: string;
  updateStreamInfoOnLive: boolean;
  livePreviewEnabled: boolean;
  leftDock: boolean;
  hideViewerCount: boolean;
  folderSelection: boolean;
  livedockCollapsed: boolean;
  livedockSize: number;
  eventsSize: number;
  controlsSize: number;
  performanceMode: boolean;
  chatZoomFactor: number;
  enableBTTVEmotes: boolean;
  enableFFZEmotes: boolean;
  mediaBackupOptOut: boolean;
  navigateToLiveOnStreamStart: boolean;
  experimental: any;
  legacyEvents: boolean;
  pinnedStatistics: IPinnedStatistics;
}

export interface ICustomizationSettings extends ICustomizationServiceState {}

export interface ICustomizationServiceApi {
  settingsChanged: Observable<Partial<ICustomizationSettings>>;
  setSettings(settingsPatch: Partial<ICustomizationSettings>): void;
  getSettings(): ICustomizationSettings;
  getSettingsFormData(): TObsFormData;
  getExperimentalSettingsFormData(): TObsFormData;
  restoreDefaults(): void;
}
