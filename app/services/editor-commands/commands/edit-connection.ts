import { Command } from './command';
import { Inject } from 'services/core';
import { TransitionsService, ITransitionConnection } from 'services/transitions';
import cloneDeep from 'lodash/cloneDeep';
import { $t } from 'services/i18n';

export class EditConnectionCommand extends Command {
  @Inject() private transitionsService: TransitionsService;

  description = $t('Edit a connection');

  private beforeConnection: ITransitionConnection;

  constructor(private connectionId: string, private changes: Partial<ITransitionConnection>) {
    super();
  }

  execute() {
    this.beforeConnection = cloneDeep(this.transitionsService.getConnection(this.connectionId));

    this.transitionsService.updateConnection(this.connectionId, this.changes);
  }

  rollback() {
    this.transitionsService.updateConnection(this.connectionId, this.beforeConnection);
  }
}
