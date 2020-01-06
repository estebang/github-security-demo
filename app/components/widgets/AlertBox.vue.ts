import { Component } from 'vue-property-decorator';
import WidgetEditor from 'components/windows/WidgetEditor.vue';
import WidgetSettings from './WidgetSettings.vue';
import { inputComponents } from 'components/widgets/inputs';
import VFormGroup from 'components/shared/inputs/VFormGroup.vue';
import { IAlertBoxData, AlertBoxService } from 'services/widgets/settings/alert-box';
import { $t } from 'services/i18n';

import ValidatedForm from 'components/shared/inputs/ValidatedForm';
import { Inject } from 'services/core/injector';
import { IAlertBoxVariation } from 'services/widgets/settings/alert-box/alert-box-api';

const alertNameMap = () => ({
  bits: $t('Bits'),
  donations: $t('Donations'),
  donordrive: $t('Charity Streaming Donations'),
  patreon: $t('Patreon Pledges'),
  extraLife: $t('Extra Life Donations'),
  justGiving: $t('JustGiving Donations'),
  merch: $t('Merch'),
  resubs: $t('Resubs'),
  gamewisp: $t('Gamewisp Subscriptions'),
  subs: $t('Subscriptions'),
  tiltify: $t('Tiltify Donations'),
  treat: $t('TreatStream'),
  follows: $t('Follows'),
  hosts: $t('Hosts'),
  raids: $t('Raids'),
  superhearts: $t('Super Hearts'),
  fanfunding: $t('Super Chat'),
  sponsors: $t('Members'),
  subscribers: $t('Subscribers'), // YouTube
  stars: $t('Stars'),
  support: $t('Support'),
  likes: $t('Likes'),
  shares: $t('Shares'),
  fbfollows: $t('Follows'),
  loyaltystore: $t('Cloudbot Store'),
  stickers: $t('Stickers'),
  effects: $t('Effects/Rallies'),
});

const triggerAmountMap = {
  bits: 'bits_alert_min_amount',
  donations: 'donation_alert_min_amount',
  hosts: 'host_viewer_minimum',
  raids: 'raid_raider_minimum',
};

const HAS_ALERT_SETTINGS = ['donations', 'bits', 'hosts', 'raids', 'effects', 'stickers'];
const HAS_DONOR_MESSAGE = [
  'donations',
  'bits',
  'subs',
  'merch',
  'patreon',
  'extraLife',
  'donordrive',
  'justGiving',
  'tiltify',
  'treat',
  'stars',
];

@Component({
  components: {
    WidgetEditor,
    VFormGroup,
    ValidatedForm,
    ...inputComponents,
  },
})
export default class AlertBox extends WidgetSettings<IAlertBoxData, AlertBoxService> {
  @Inject() alertBoxService: AlertBoxService;

  $refs: { [key: string]: HTMLElement };

  afterFetch() {
    this.alertTypes = this.alertTypes.filter(type => this.wData.settings[type]);
    const languages = this.wData.tts_languages;
    this.languages = Object.keys(languages)
      .map(category => ({
        label: category,
        options: Object.keys(languages[category]).map(key => ({
          value: key,
          label: languages[category][key],
        })),
      }))
      .sort((a, _b) => (a.label === 'Legacy Voice' ? -1 : 0));
  }

  alertName(alertType: string) {
    return alertNameMap()[alertType];
  }

  alertTypes = this.alertBoxService.apiNames();

  addAlertMenuOpen = false;
  selectedAlert = 'general';
  selectedId = 'default';
  editingName: string = null;
  languages: any[] = [];

  get metadata() {
    return this.service.getMetadata(
      this.selectedAlert,
      this.languages,
      this.selectedVariation.condition,
    );
  }

  get selectedVariation() {
    if (this.selectedAlert === 'general') {
      return this.wData;
    }
    return this.wData.settings[this.selectedAlert].variations.find(
      (variation: IAlertBoxVariation) => variation.id === this.selectedId,
    );
  }

  get navItems() {
    if (this.selectedAlert === 'general') {
      return [
        { value: 'general', label: $t('General Settings') },
        { value: 'moderation', label: $t('Moderator Tools') },
        { value: 'source', label: $t('Source') },
      ];
    }
    const baseItems = [
      { value: 'title', label: $t('Title Message') },
      { value: 'media', label: $t('Media') },
      { value: 'animation', label: $t('Animation') },
    ];
    if (HAS_DONOR_MESSAGE.includes(this.selectedAlert)) {
      baseItems.push({
        value: 'message',
        label: this.selectedAlert === 'subs' ? $t('Resub Message') : $t('Donor Message'),
      });
    }
    if (HAS_ALERT_SETTINGS.includes(this.selectedAlert) || this.selectedId.match('default')) {
      baseItems.push({ value: 'alert', label: $t('Alert Settings') });
    }
    return baseItems;
  }

  get conditions() {
    return this.alertBoxService.conditionsByType(this.selectedAlert);
  }

  get conditionData() {
    return this.alertBoxService.conditionDataByCondition(this.selectedVariation);
  }

  get minTriggerAmount() {
    return this.wData.settings[triggerAmountMap[this.selectedAlert]];
  }

  set minTriggerAmount(value: number) {
    this.wData.settings[triggerAmountMap[this.selectedAlert]] = value;
  }

  get minRecentEvents() {
    return this.selectedAlert === 'donation'
      ? this.wData.settings.recent_events_donation_min_amount
      : this.wData.settings.recent_events_host_min_viewer_count;
  }

  set minRecentEvents(value: number) {
    if (this.selectedAlert === 'donation') {
      this.wData.settings.recent_events_donation_min_amount = value;
    } else {
      this.wData.settings.recent_events_host_min_viewer_count = value;
    }
  }

  handleUnlimitedModerationDelay(value: boolean) {
    if (value) {
      this.wData.settings.moderation_delay = -1;
    } else {
      this.wData.settings.moderation_delay = 0;
    }
  }

  selectAlertType(alertName: string) {
    this.selectedAlert = this.selectedAlert === alertName ? 'general' : alertName;
    this.selectedId = `default-${this.selectedAlert}`;
  }

  selectVariation(id: string) {
    this.selectedId = id;
  }

  toggleAddAlertMenu() {
    this.addAlertMenuOpen = !this.addAlertMenuOpen;
  }

  addAlert(type: string) {
    const newVariation = this.alertBoxService.newVariation(type);
    this.wData.settings[type].variations.push(newVariation);
    this.selectedAlert = type;
    this.addAlertMenuOpen = false;
    this.save();
    this.$nextTick(() => this.editName(newVariation.id));
  }

  removeVariation(id: string) {
    this.selectedId = `default-${this.selectedAlert}`;
    this.wData.settings[this.selectedAlert].variations = this.wData.settings[
      this.selectedAlert
    ].variations.filter((variation: IAlertBoxVariation) => variation.id !== id);
    this.save();
  }

  editName(id: string) {
    this.editingName = id;
    this.selectedId = id;
    // Above is done here with a stop propagation in the input to avoid possible race conditions which would lead to
    // this.selectedVariation potentially being incorrect
    const field = <HTMLInputElement>this.$refs[`${id}-name-input`][0];
    this.$nextTick(() => field.focus());
  }

  nameInputHandler(eventData: string) {
    this.selectedVariation.name = eventData;
  }

  nameBlurHandler(id: string) {
    this.save();
    this.editingName = null;
  }
}
