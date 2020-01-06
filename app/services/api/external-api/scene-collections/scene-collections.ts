import { SceneCollectionsService as InternalSceneCollectionsService } from 'services/scene-collections';
import { Inject } from 'services/core/injector';
import { Fallback, Singleton } from 'services/api/external-api';
import { Observable } from 'rxjs';

interface ISceneCollectionsManifestEntry {
  id: string;
  name: string;
}

interface ISceneCollectionCreateOptions {
  name?: string;
}

interface ISceneCollectionSchema {
  name: string;
  id: string;

  scenes: {
    id: string;
    name: string;
    sceneItems: { sceneItemId: string; sourceId: string }[];
  }[];

  sources: {
    sourceId: string;
    name: string;
    type: string;
    channel: number;
  }[];
}

@Singleton()
export class SceneCollectionsService {
  @Fallback()
  @Inject()
  protected sceneCollectionsService: InternalSceneCollectionsService;

  get activeCollection(): ISceneCollectionsManifestEntry {
    return this.sceneCollectionsService.activeCollection;
  }

  fetchSceneCollectionsSchema(): Promise<ISceneCollectionSchema[]> {
    return this.sceneCollectionsService.fetchSceneCollectionsSchema();
  }

  create(options: ISceneCollectionCreateOptions): Promise<ISceneCollectionsManifestEntry> {
    return this.sceneCollectionsService.create(options);
  }

  load(id: string): Promise<void> {
    return this.sceneCollectionsService.load(id);
  }

  rename(newName: string, id: string): Promise<void> {
    return this.sceneCollectionsService.rename(newName, id);
  }

  /**
   * Deletes a scene collection.  If no id is specified, it
   * will delete the current collection.
   * @param id the id of the collection to delete
   */
  async delete(id?: string): Promise<void> {
    return this.sceneCollectionsService.delete(id);
  }

  get collectionAdded(): Observable<ISceneCollectionsManifestEntry> {
    return this.sceneCollectionsService.collectionAdded;
  }

  get collectionRemoved(): Observable<ISceneCollectionsManifestEntry> {
    return this.sceneCollectionsService.collectionRemoved;
  }

  get collectionWillSwitch(): Observable<void> {
    return this.sceneCollectionsService.collectionWillSwitch;
  }

  get collectionSwitched(): Observable<ISceneCollectionsManifestEntry> {
    return this.sceneCollectionsService.collectionSwitched;
  }

  get collectionUpdated(): Observable<ISceneCollectionsManifestEntry> {
    return this.sceneCollectionsService.collectionUpdated;
  }

  get collections(): ISceneCollectionsManifestEntry[] {
    return this.sceneCollectionsService.collections;
  }
}
