import { Command } from './command';
import { Inject } from 'services/core';
import { TransitionsService } from 'services/transitions';
import { $t } from 'services/i18n';

export class CreateConnectionCommand extends Command {
  @Inject() transitionsService: TransitionsService;

  description = $t('Create a new connection');

  private connectionId: string;

  constructor(private fromId: string, private toId: string, private transitionId: string) {
    super();
  }

  execute() {
    const connection = this.transitionsService.addConnection(
      this.fromId,
      this.toId,
      this.transitionId,
      this.connectionId,
    );
    this.connectionId = connection.id;

    return connection;
  }

  rollback() {
    this.transitionsService.deleteConnection(this.connectionId);
  }
}
