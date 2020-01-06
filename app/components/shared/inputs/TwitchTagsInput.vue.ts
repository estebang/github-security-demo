import Vue from 'vue';
import { Component, Prop, Watch } from 'vue-property-decorator';
import VSelectPage from 'v-selectpage';
import { Inject } from 'services/core/injector';
import { $t, I18nService } from 'services/i18n';
import { prepareOptions, TTwitchTag, TTwitchTagWithLabel } from 'services/platforms/twitch/tags';
import { CustomizationService } from 'services/customization';

Vue.use(VSelectPage);

@Component({})
export default class TwitchTagsInput extends Vue {
  @Inject() i18nService: I18nService;
  @Inject() customizationService: CustomizationService;

  @Prop() name: string;

  @Prop() value: TTwitchTagWithLabel[];

  @Prop() tags: TTwitchTag[];

  @Prop() hasPermission: boolean;

  mounted() {
    const search = document.querySelector('.sp-search');
    const searchInput = document.querySelector('.sp-search-input');
    const results = document.querySelector('.sp-result-area');
    const cssClass = this.customizationService.currentTheme;
    search.classList.toggle(cssClass);
    searchInput.classList.toggle(cssClass);
    results.classList.toggle(cssClass);
  }

  tagsLabel = $t('Tags');

  selectPlaceholder = $t('Select stream tags');

  tableColumns = [
    {
      title: $t('Tag'),
      data: 'name',
    },
    {
      title: $t('Description'),
      data: 'description',
    },
  ];

  /*
   * VSelectPage doesn't accept an array as initial value, so we have to provide
   * it a string.
   */
  currentTags = this.value ? this.value.map(tag => tag.tag_id).join(',') : null;

  get shouldDisable() {
    return this.value === null || !this.hasPermission;
  }

  get options() {
    return prepareOptions(
      this.i18nService.state.locale || this.i18nService.getFallbackLocale(),
      this.tags,
    );
  }

  onInput(tags: TTwitchTagWithLabel[]) {
    this.$emit('input', tags);
  }
}
