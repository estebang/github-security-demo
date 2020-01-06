import uuid from 'uuid/v4';
import { IAlertBoxVariation } from './alert-box-api';
import { $t } from 'services/i18n';
import { metadata } from 'components/widgets/inputs';

export const API_NAME_MAP = {
  bit: 'bits',
  donation: 'donations',
  donordrivedonation: 'donordrive',
  pledge: 'patreon',
  eldonation: 'extraLife',
  justgivingdonation: 'justGiving',
  merch: 'merch',
  resub: 'resubs',
  gamewispsubscription: 'gamewisp',
  sub: 'subs',
  tiltifydonation: 'tiltify',
  treat: 'treat',
  follow: 'follows',
  host: 'hosts',
  raid: 'raids',
  superheart: 'superhearts',
  fanfunding: 'fanfunding',
  subscriber: 'subscribers', // YouTube
  sponsor: 'sponsors',
  facebook_support: 'support',
  facebook_like: 'likes',
  facebook_stars: 'stars',
  facebook_share: 'shares',
  facebook_follow: 'fbfollows',
  loyalty_store_redemption: 'loyaltystore',
  effect: 'effects',
  sticker: 'stickers',
};

export const REGEX_TESTERS = Object.keys(API_NAME_MAP).map(key => ({
  name: API_NAME_MAP[key],
  tester:
    key === 'facebook_stars'
      ? new RegExp(`^${key}_|facebook_show_stars_`)
      : new RegExp(`^${key}s?_|show_${key}_`),
}));

export const conditions = () => ({
  base: [{ value: 'RANDOM', title: $t('Randomly') }],
  donations: [
    { value: 'MIN_DONATION_AMOUNT', title: $t('Donation amount is at least <amount>') },
    { value: 'EXACT_DONATION_AMOUNT', title: $t('Donation amount is exactly <amount>') },
    { value: 'LARGEST_OF_STREAM', title: $t('Donation is the largest this stream') },
    { value: 'CRYPTO_CURRENCY_DONATION', title: $t('Donation is in Crypto currency') },
  ],
  subs: [
    { value: 'MIN_MONTHS_SUBSCRIBED', title: $t('Months subscribed is at least <months>') },
    { value: 'EXACT_MONTHS_SUBSCRIBED', title: $t('Months subscribed is exactly <months>') },
    { value: 'SUBSCRIPTION_TIER', title: $t('Subscription tier is <tier>') },
    { value: 'SUBSCRIPTION_PRIME', title: $t('Subscription is Twitch Prime') },
    { value: 'SUBSCRIPTION_GIFT', title: $t('When subscription is a gift') },
    { value: 'MIN_SUBMYSTERYGIFT', title: $t('User gifted at least <amount> subs at once') },
    { value: 'SUBTEMBER', title: $t('When user commits to continue their gift subscription') },
    {
      value: 'MIN_SUBSCRIPTION_STREAK',
      title: $t('Streak shared with chat, and months subscribed in a streak is at least <months>'),
    },
  ],
  hosts: [{ value: 'MIN_VIEWERS_ACQUIRED', title: $t('Viewers gained is at least <viewers>') }],
  bits: [
    { value: 'MIN_BITS_USED', title: $t('Bits used is at least <amount>') },
    { value: 'EXACT_BITS_USED', title: $t('Bits used is exactly <amount>') },
  ],
  raids: [{ value: 'MIN_RAIDERS_ACQUIRED', title: $t('Raid party size is at least <raiders>') }],
  sponsors: [
    { value: 'MIN_MONTHS_SPONSORED', title: $t('Months as a member is at least <months>') },
  ],
  fanfunding: [
    { value: 'MIN_FANFUNDING_AMOUNT', title: $t('Super Chat amount is at least <amount>') },
    { value: 'EXACT_FANFUNDING_AMOUNT', title: $t('Super Chat amount is exactly <amount>') },
  ],
  superhearts: [
    { value: 'MIN_SUPERHEART_COIN', title: $t('Super Hearts coins is at least <coin>') },
    { value: 'EXACT_SUPERHEART_COIN', title: $t('Super Heart coins is exactly <coin>') },
  ],
  patreon: [
    { value: 'MIN_PLEDGE_AMOUNT', title: $t('Pledge amount is at least <amount>') },
    { value: 'EXACT_PLEDGE_AMOUNT', title: $t('Pledge amount is exactly <amount>') },
  ],
  extraLife: [
    { value: 'MIN_EXTRALIFE_DONATION_AMOUNT', title: $t('Donation amount is at least <amount>') },
    { value: 'EXACT_EXTRALIFE_DONATION_AMOUNT', title: $t('Donation amount is exactly <amount>') },
  ],
  tilitfy: [
    { value: 'MIN_TILTIFY_DONATION_AMOUNT', title: $t('Donation amount is at least <amount>') },
    { value: 'EXACT_TILTIFY_DONATION_AMOUNT', title: $t('Donation amount is exactly <amount>') },
  ],
  gamewisp: [
    { value: 'GAMEWISP_SUBSCRIPTION_TIER', title: $t('Subscription tier is <tier>') },
    {
      value: 'MIN_GAMEWISP_MONTHS_SUBSCRIBED',
      title: $t('Months subscribed is at least <months>'),
    },
    {
      value: 'EXACT_GAMEWISP_MONTHS_SUBSCRIBED',
      title: $t('Months subscribed is exactly <months>'),
    },
  ],
  donordrive: [
    { value: 'MIN_DONORDRIVE_DONATION_AMOUNT', title: $t('Donation amount is at least <amount>') },
    { value: 'EXACT_DONORDRIVE_DONATION_AMOUNT', title: $t('Donation amount is exactly <amount>') },
  ],
  justGiving: [
    { value: 'MIN_JUSTGIVING_DONATION_AMOUNT', title: $t('Donation amount is at least <amount>') },
    { value: 'EXACT_JUSTGIVING_DONATION_AMOUNT', title: $t('Donation amount is exactly <amount>') },
  ],
  merch: [
    { value: 'MERCH_PRODUCT', title: $t('Product') },
    { value: 'MERCH_PREORDER', title: $t('Preorder') },
  ],
  loyaltystore: [
    { value: 'LOYALTY_STORE_REDEMPTION_ITEM_TYPE', title: $t('Item type is <type>') },
    { value: 'LOYALTY_STORE_REDEMPTION_ITEM_NAME', title: $t('Item name is <name>') },
  ],
  effects: [
    { value: 'MIN_SPARKS_USED', title: $t('Sparks sent are at least <amount>') },
    { value: 'EXACT_SPARKS_AMOUNT', title: $t('Sparks sent are exactly <amount>') },
    { value: 'MIN_EMBERS_USED', title: $t('Ember amount is at least <amount>') },
    { value: 'EXACT_EMBERS_AMOUNT', title: $t('Ember amount is exactly <amopunt>') },
  ],
  stickers: [
    { value: 'MIN_SPARKS_USED', title: $t('Sparks sent are at least <amount>') },
    { value: 'EXACT_SPARKS_AMOUNT', title: $t('Sparks sent are exactly <amount>') },
    { value: 'MIN_EMBERS_USED', title: $t('Ember amount is at least <amount>') },
    { value: 'EXACT_EMBERS_AMOUNT', title: $t('Ember amount is exactly <amopunt>') },
  ],
});

export const conditionData = () => ({
  RANDOM: metadata.frequency({ title: $t('Variation Frequency') }),
  LOYALTY_STORE_REDEMPTION_ITEM_TYPE: metadata.list({
    title: $t('Item Type'),
    options: [
      { value: 'perk', title: 'Perk' },
      { value: 'sound', title: 'Sound' },
      { value: 'code', title: 'Code' },
    ],
  }),
  LOYALTY_STORE_REDEMPTION_ITEM_NAME: metadata.text({ title: $t('Item Name'), max: 50 }),
});

export const newVariation = (type: string): IAlertBoxVariation => ({
  condition: 'RANDOM',
  conditions: [],
  conditionData: '3',
  name: 'New Variation',
  deleteable: true,
  id: uuid(),
  settings: {
    customCss: '',
    customHtml: '',
    customHtmlEnabled: false,
    customJs: '',
    customJson: '',
    duration: 8,
    hideAnimation: 'fadeOut',
    image: {
      href:
        type === 'merch'
          ? 'https://cdn.streamlabs.com/merch/Mug_mockup.png'
          : 'http://uploads.twitchalerts.com/image-defaults/1n9bK4w.gif',
    },
    layout: 'above',
    showAnimation: 'fadeIn',
    sound: { href: '', volume: 80 },
    text: {
      animation: 'tada',
      color: '#FFFFFF',
      color2: '#32C3A6',
      font: 'Open Sans',
      format: '',
      resubFormat: null,
      tierUpgradeFormat: null,
      size: 32,
      thickness: 400,
    },
    textDelay: 0,
    type: Object.keys(API_NAME_MAP).find(key => API_NAME_MAP[key] === type),
    useCustomImage: null,
    moderation: null,
  },
});
