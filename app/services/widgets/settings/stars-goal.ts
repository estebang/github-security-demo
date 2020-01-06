import { GenericGoalService } from './generic-goal';
import { WidgetDefinitions, WidgetType } from 'services/widgets';
import { WIDGET_INITIAL_STATE } from './widget-settings';
import { InheritMutations } from 'services/core/stateful-service';

@InheritMutations()
export class StarsGoalService extends GenericGoalService {
  static initialState = WIDGET_INITIAL_STATE;

  getApiSettings() {
    return {
      type: WidgetType.StarsGoal,
      url: WidgetDefinitions[WidgetType.StarsGoal].url(this.getHost(), this.getWidgetToken()),
      previewUrl: `https://${this.getHost()}/widgets/stars-goal?token=${this.getWidgetToken()}`,
      dataFetchUrl: `https://${this.getHost()}/api/v5/slobs/widget/starsgoal/settings`,
      settingsSaveUrl: `https://${this.getHost()}/api/v5/slobs/widget/starsgoal/settings`,
      goalUrl: `https://${this.getHost()}/api/v5/slobs/widget/starsgoal`,
      settingsUpdateEvent: 'starsGoalSettingsUpdate',
      goalCreateEvent: 'starsGoalStart',
      goalResetEvent: 'starsGoalEnd',
      hasTestButtons: true,
      customCodeAllowed: true,
      customFieldsAllowed: true,
    };
  }
}
