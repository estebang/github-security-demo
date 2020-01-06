import { Command } from './command';
import { Inject } from 'services/core';
import { AudioService } from 'services/audio';
import { $t } from 'services/i18n';

export class UnhideMixerSourcesCommand extends Command {
  @Inject() private audioService: AudioService;

  description = $t('Unhide mixer items');

  private hiddenSources: string[];

  constructor() {
    super();
  }

  execute() {
    this.hiddenSources = this.audioService
      .getSourcesForCurrentScene()
      .filter(s => s.mixerHidden)
      .map(s => s.sourceId);

    this.audioService.unhideAllSourcesForCurrentScene();
  }

  rollback() {
    this.hiddenSources.forEach(sourceId => {
      this.audioService.getSource(sourceId).setHidden(true);
    });
  }
}
