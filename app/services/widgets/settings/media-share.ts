import { IWidgetData, IWidgetSettings, WidgetDefinitions, WidgetSettingsService } from '../index';
import { WidgetType } from 'services/widgets';
import { InheritMutations } from 'services/core/stateful-service';
import { $t } from 'services/i18n';
import { metadata } from 'components/widgets/inputs';

export interface IMediaShareSettings extends IWidgetSettings {
  advanced_settings: {
    auto_play: boolean;
    auto_show: boolean;
    buffer_time: number;
    enabled: boolean;
    max_duration: number;
    min_amount_to_share: number;
    moderation_queue: boolean;
    price_per_second: number;
    requests_enabled: boolean;
    security: number;
    volume: number;
  };
  allowed_types: string[];
  auto_show_video: boolean;
  enabled: boolean;
  max_duration: number;
  min_amount_to_share: number;
  price_per_second: number;
  security: number;
  volume: number;
  buffer_time: number;
}

export interface IMediaShareData extends IWidgetData {
  settings: IMediaShareSettings;
  banned_media: IMediaShareBan[];
}

export interface IMediaShareBan {
  id: number;
  user_id: number;
  media_type: string;
  media: string;
  media_title: string;
  action_by: string;
  created_at?: string;
  updated_at?: string;
}

@InheritMutations()
export class MediaShareService extends WidgetSettingsService<IMediaShareData> {
  getApiSettings() {
    return {
      type: WidgetType.MediaShare,
      url: WidgetDefinitions[WidgetType.MediaShare].url(this.getHost(), this.getWidgetToken()),
      previewUrl: `https://${this.getHost()}/widgets/media-share?token=${this.getWidgetToken()}`,
      settingsUpdateEvent: 'mediaSharingSettingsUpdate',
      goalCreateEvent: 'newmediaShare',
      goalResetEvent: 'mediaShareEnd',
      dataFetchUrl: `https://${this.getHost()}/api/v5/slobs/widget/media`,
      settingsSaveUrl: `https://${this.getHost()}/api/v5/slobs/widget/media`,
      testers: ['Follow', 'Subscription', 'Donation', 'Bits', 'Host'],
      customCodeAllowed: false,
      customFieldsAllowed: false,
    };
  }

  getMetadata() {
    return {
      pricePerSecond: {
        title: $t('Price Per Second'),
        tooltip: $t(
          'In order to control length, you can decide how much it costs per second to share media. Setting this to 0.30' +
            ' would mean that for $10, media would play for 30 seconds. The default value is 0.10.',
        ),
      },
      minAmount: {
        title: $t('Min. Amount to Share'),
        tooltip: $t(
          'The minimum amount a donor must donate in order to share media. The default value is $5.00 USD',
        ),
      },
      maxDuration: {
        title: $t('Max Duration'),
        tooltip: $t(
          'The maximum duration in seconds that media can be played, regardless of amount donated.' +
            ' The default value is 60 seconds.',
        ),
        isInteger: true,
      },
      buffer: metadata.slider({
        tooltip: $t('The time between videos the next video has to buffer.'),
        max: 30,
        interval: 1,
        title: $t('Buffer Time'),
      }),
      security: metadata.spamSecurity({
        title: $t('Spam Security'),
        tooltip: $t(
          // tslint:disable-next-line:prefer-template
          'This slider helps you filter shared media before it can be submitted.\n' +
            'Off: No security\n' +
            'Low: 65%+ rating, 5k+ views\n' +
            'Medium: 75%+ rating, 40k+ views\n' +
            'High: 80%+ rating, 300k+ views\n' +
            'Very High: 85%+ rating, 900k+ views',
        ),
      }),
    };
  }

  async unbanMedia(media: string) {
    const url = `${this.getApiSettings().dataFetchUrl}/unban`;
    await this.request({
      url,
      method: 'POST',
      body: { media },
    });
    return this.refreshData();
  }

  protected patchAfterFetch(response: IMediaShareData): any {
    // we should be using settings.advanced settings values instead, similar to sl.com
    // so overwrite values for all keys in settings with settings.advance_settings
    return {
      ...response,
      settings: {
        ...response.settings,
        ...response.settings.advanced_settings,
      },
    };
  }

  protected patchBeforeSend(settings: IMediaShareSettings): any {
    // backend makes settings into advanced.settings and store in json
    // without deleting, it will nest settings.advanced_settings.advanced_settings x infinity
    delete settings.advanced_settings;
    return { settings };
  }
}
