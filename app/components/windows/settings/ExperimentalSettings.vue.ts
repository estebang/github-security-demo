import Vue from 'vue';
import { Component } from 'vue-property-decorator';
import { Inject } from 'services/core/injector';
import GenericForm from 'components/obs/inputs/GenericForm';
import { TObsFormData, TObsValue } from 'components/obs/inputs/ObsInput';
import { ICustomizationServiceApi } from 'services/customization';

@Component({
  components: { GenericForm },
})
export default class ExperimentalSettings extends Vue {
  @Inject() private customizationService: ICustomizationServiceApi;

  settingsFormData: TObsFormData = null;

  created() {
    this.settingsFormData = this.customizationService.getExperimentalSettingsFormData();
  }

  saveSettings(formData: TObsFormData) {
    const settings: Dictionary<TObsValue> = {};
    formData.forEach(formInput => {
      settings[formInput.name] = formInput.value;
    });
    this.customizationService.setSettings({ experimental: settings });
    this.settingsFormData = this.customizationService.getExperimentalSettingsFormData();
  }
}
