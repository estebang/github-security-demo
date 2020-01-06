import { Command } from './command';
import { ScenesService } from 'services/scenes';
import { Inject } from 'services/core/injector';
import { SourcesNode } from 'services/scene-collections/nodes/sources';
import { Source } from 'services/sources';
import { ReorderNodesCommand, EPlaceType } from './reorder-nodes';
import { $t } from 'services/i18n';
import { ISceneItemSettings } from 'services/api/external-api/scenes';

// Removing and recreating a source is a very complex event.
// We can save a lot of time by leveraging the scene collection system.
// This operation isn't very fast but it keeps things DRY.
// Hacky? Yes. Easy? Yes. Problems? Probably.
class SourceReviver extends SourcesNode {
  constructor(private source: Source) {
    super();
  }

  getItems() {
    return [this.source];
  }
}

export class RemoveItemCommand extends Command {
  @Inject() private scenesService: ScenesService;

  private sceneId: string;
  private sourceId: string;
  private sourceReviver: SourceReviver;

  private reorderNodesSubcommand: ReorderNodesCommand;

  private settings: ISceneItemSettings;

  constructor(private sceneItemId: string) {
    super();
  }

  get description() {
    return $t('Remove %{sourceName}', {
      sourceName: this.scenesService.getSceneItem(this.sceneItemId).name,
    });
  }

  async execute() {
    const item = this.scenesService.getSceneItem(this.sceneItemId);
    const scene = this.scenesService.getScene(item.sceneId);
    this.sceneId = item.sceneId;
    this.sourceId = item.sourceId;

    this.settings = item.getSettings();

    // Save even more work by moving this item top the top of the
    // stack and then rolling it back to restore.
    this.reorderNodesSubcommand = new ReorderNodesCommand(
      scene.getSelection(this.sceneItemId),
      void 0,
      EPlaceType.After,
    );
    this.reorderNodesSubcommand.execute();

    // If this was the last item using this source, the underlying source
    // will automatically be removed. In this case, we need to store enough
    // information to bring it back intio existence in the rollback function.
    if (
      this.scenesService.getSourceItemCount(item.sourceId) === 1 &&
      item.source.type !== 'scene'
    ) {
      this.sourceReviver = new SourceReviver(item.source);
      await this.sourceReviver.save({});
    }

    item.remove();
  }

  async rollback() {
    if (this.sourceReviver) {
      await this.sourceReviver.load({});
    }

    const scene = this.scenesService.getScene(this.sceneId);

    const item = scene.addSource(this.sourceId, { id: this.sceneItemId, select: false });

    this.reorderNodesSubcommand.rollback();
    item.setSettings(this.settings);
  }
}
