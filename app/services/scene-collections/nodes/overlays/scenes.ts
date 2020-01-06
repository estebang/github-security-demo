import { ArrayNode } from '../array-node';
import { ScenesService, Scene } from '../../../scenes';
import { IFolderSchema, SlotsNode, TSlotSchema } from './slots';
import uuid from 'uuid';

interface ISchema {
  name: string;
  sceneId: string;
  slots: SlotsNode;
}

interface IContext {
  assetsPath: string;
}

export class ScenesNode extends ArrayNode<ISchema, IContext, Scene> {
  schemaVersion = 2;

  scenesService: ScenesService = ScenesService.instance;

  getItems() {
    return this.scenesService.scenes;
  }

  async saveItem(scene: Scene, context: IContext): Promise<ISchema> {
    const slots = new SlotsNode();
    await slots.save({ scene, assetsPath: context.assetsPath });

    return {
      slots,
      name: scene.name,
      sceneId: scene.id,
    };
  }

  async loadItem(obj: ISchema, context: IContext): Promise<() => Promise<void>> {
    const scene = this.scenesService.createScene(obj.name, {
      sceneId: obj.sceneId,
    });

    // Load items into the scene after all scenes have been created
    // to handle scene-in-scene situations
    return async () => {
      await obj.slots.load({ scene, assetsPath: context.assetsPath });

      // append children to folders
      const foldersSchemas = (obj.slots.data.items as TSlotSchema[])
        .filter(item => item.sceneNodeType === 'folder')
        .reverse();

      const folders = scene.getFolders();
      folders.forEach((folder, ind) => {
        const childrenIds = (foldersSchemas[ind] as IFolderSchema).childrenIds;
        scene.getSelection(childrenIds).moveTo(scene.id, folder.id);
      });
    };
  }

  migrate(version: number) {
    if (version === 1) {
      // version 1 doesn't have sceneId, so generate a random id
      this.data.items = this.data.items.map(item => {
        if (item.sceneId) return item;
        return { ...item, sceneId: uuid() };
      });
    }
  }
}
