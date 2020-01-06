import {
  SettingsService,
  OutputSettingsService,
  IStreamingEncoderSettings,
  EEncoderFamily,
} from 'services/settings';
import { StreamingService, EStreamingState } from 'services/streaming';
import { Inject, mutation, PersistentStatefulService } from 'services/core';
import { IEncoderProfile } from './definitions';
import cloneDeep from 'lodash/cloneDeep';
import { camelize, handleErrors } from '../../util/requests';
import { UrlService } from '../hosts';

export * from './definitions';

/**
 SLOBS will send these information as inputs for the server
 - Current Bitrate
 - Current output resolution
 - Current game
 - Current video encoder
 - Profile choose by the users
 The server will return :
 - New output resolution
 - Presets and option for the video encoders
 Once SLOBS will receive these, the same behavior will be done :
 - We save the current settings
 - We apply the optimized settings depending on what the user choose
 - We start streaming
 - When the stream ends :
 - We remove the optimized settings
 - We apply the old settings
 We now support the x264 / QSV / NVENC encoders
 We're also doing some resolution switching
 */

interface IVideoEncodingOptimizationServiceState {
  useOptimizedProfile: boolean;
  lastLoadedGame: string;
  lastLoadedProfiles: IEncoderProfile[];
  lastSelectedProfile: IEncoderProfile;
}

export class VideoEncodingOptimizationService extends PersistentStatefulService<
  IVideoEncodingOptimizationServiceState
> {
  static defaultState: IVideoEncodingOptimizationServiceState = {
    useOptimizedProfile: false,
    lastLoadedGame: '',
    lastLoadedProfiles: [],
    lastSelectedProfile: null,
  };

  private previousSettings: {
    video: any;
    output: any;
  };
  private isUsingEncodingOptimizations = false;

  @Inject() private settingsService: SettingsService;
  @Inject() private streamingService: StreamingService;
  @Inject() private outputSettingsService: OutputSettingsService;
  @Inject() private urlService: UrlService;

  init() {
    super.init();
    this.streamingService.streamingStatusChange.subscribe(status => {
      if (status === EStreamingState.Offline && this.isUsingEncodingOptimizations) {
        this.isUsingEncodingOptimizations = false;
        this.restorePreviousValues();
      }
    });
  }

  /**
   * returns profiles according to the current encoder settings
   */
  async fetchOptimizedProfile(game: string): Promise<IEncoderProfile> {
    const settings = this.outputSettingsService.getSettings().streaming;
    const profiles = await this.fetchAvailableGameProfiles(game);

    // We don't have settings for jim_nvenc encoder in DB
    // use settings for nvenc instead
    const encoder =
      settings.encoder === EEncoderFamily.jim_nvenc ? EEncoderFamily.nvenc : settings.encoder;

    const filteredProfiles = profiles.filter(profile => {
      return (
        profile.encoder === encoder &&
        profile.bitrateMax >= settings.bitrate &&
        profile.bitrateMin <= settings.bitrate &&
        (!settings.preset || settings.preset === profile.presetIn)
      );
    });

    if (!filteredProfiles.length) return null;

    // find profiles with the closest resolution to current resolution in current settings
    const resInPx = resToPx(settings.outputResolution);
    const profile = filteredProfiles.sort((profileA, profileZ) => {
      return (
        Math.abs(resToPx(profileA.resolutionIn) - resInPx) -
        Math.abs(resToPx(profileZ.resolutionIn) - resInPx)
      );
    })[0];

    // don't change the current encoder
    profile.encoder = settings.encoder;

    return profile;
  }

  /**
   * returns profiles according to the game name
   */
  private async fetchAvailableGameProfiles(game: string): Promise<IEncoderProfile[]> {
    let profiles: IEncoderProfile[] = [];

    if (game === this.state.lastLoadedGame) {
      profiles = this.state.lastLoadedProfiles;
    } else if (game) {
      // try to fetch a game-specific profile

      try {
        profiles = await fetch(
          this.urlService.getStreamlabsApi(`gamepresets/${encodeURIComponent(game.toUpperCase())}`),
        )
          .then(handleErrors)
          .then(camelize);
      } catch (e) {
        // probably some network error
        // don't stop here
        console.error(e);
      }
    }

    // if no game-specific profile found then fetch generic profiles
    if (!profiles.length) {
      try {
        profiles = await fetch(this.urlService.getStreamlabsApi('gamepresets/DEFAULT'))
          .then(handleErrors)
          .then(camelize);
      } catch (e) {
        // probably some network error
        // don't stop here
        console.error(e);
      }
    }

    if (profiles.length) this.CACHE_PROFILES(game, profiles);
    return cloneDeep(profiles);
  }

  applyProfile(encoderProfile: IEncoderProfile) {
    this.previousSettings = {
      output: cloneDeep(this.settingsService.getSettingsFormData('Output')),
      video: cloneDeep(this.settingsService.getSettingsFormData('Video')),
    };
    this.SAVE_LAST_SELECTED_PROFILE(encoderProfile);
    const currentSettings = this.outputSettingsService.getSettings();
    const newStreamingSettings: Partial<IStreamingEncoderSettings> = {
      encoder: encoderProfile.encoder,
      encoderOptions: encoderProfile.options,
      preset: encoderProfile.presetOut,
      rescaleOutput: false, // prevent using the rescaled resolution from encoder settings
      bitrate: currentSettings.streaming.bitrate,
    };

    if (!currentSettings.streaming.hasCustomResolution) {
      // change the resolution only if user didn't set a custom one
      newStreamingSettings.outputResolution = encoderProfile.resolutionOut;
    }

    console.log('Apply encoder settings', newStreamingSettings);

    // apply new streaming settings
    // also migrate simple settings to advanced settings if the current mode is Simple
    this.outputSettingsService.setSettings({
      mode: 'Advanced',
      streaming: newStreamingSettings,
      recording: currentSettings.recording,
      replayBuffer: currentSettings.replayBuffer,
    });

    this.isUsingEncodingOptimizations = true;
  }

  canApplyProfileFromCache() {
    return !!(this.state.useOptimizedProfile && this.state.lastSelectedProfile);
  }

  async applyProfileFromCache() {
    if (!this.canApplyProfileFromCache()) {
      return;
    }
    this.applyProfile(this.state.lastSelectedProfile);
  }

  useOptimizedProfile(enabled: boolean) {
    this.USE_OPTIMIZED_PROFILE(enabled);
  }

  private restorePreviousValues() {
    // clear encoderOptions settings
    this.outputSettingsService.setSettings({ streaming: { encoderOptions: '' } });

    this.settingsService.setSettings('Output', this.previousSettings.output);
    this.settingsService.setSettings('Video', this.previousSettings.video);
  }

  @mutation()
  private USE_OPTIMIZED_PROFILE(enabled: boolean) {
    this.state.useOptimizedProfile = enabled;
  }

  @mutation()
  private CACHE_PROFILES(game: string, profiles: IEncoderProfile[]) {
    this.state.lastLoadedGame = game;
    this.state.lastLoadedProfiles = profiles;
  }

  @mutation()
  private SAVE_LAST_SELECTED_PROFILE(profile: IEncoderProfile) {
    this.state.lastSelectedProfile = profile;
  }
}

/**
 * convert resolution like 1024x768 to amount of pixels
 */
function resToPx(res: string): number {
  return res
    .split('x')
    .map(px => Number(px))
    .reduce((prev, current) => prev * current);
}
