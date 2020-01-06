import { SelectionService as InternalSelectionService } from 'services/selection';
import { Fallback, Singleton } from 'services/api/external-api';
import { Selection } from 'services/api/external-api/scenes/selection';
import { Inject } from 'services';

/**
 * Allows select/deselect items and call bulk actions on Scene Items.
 * Works only with the currently active scene.
 */
@Singleton()
export class SelectionService extends Selection {
  @Fallback()
  @Inject('SelectionService')
  private internalSelectionService: InternalSelectionService;

  get sceneId() {
    return this.internalSelectionService.sceneId;
  }

  protected get selection() {
    return this.internalSelectionService;
  }
}
