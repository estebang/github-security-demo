import { ServiceHelper, mutation, Inject } from 'services';
import { ScenesService } from './scenes';
import { Source, SourcesService, TSourceType } from 'services/sources';
import {
  ISceneItem,
  SceneItem,
  IScene,
  ISceneNodeAddOptions,
  ISceneItemInfo,
  ISceneItemFolder,
  SceneItemFolder,
  ISceneItemNode,
} from './index';
import Utils from 'services/utils';
import * as obs from '../../../obs-api';
import { SelectionService, Selection, TNodesList } from 'services/selection';
import uniqBy from 'lodash/uniqBy';
import { TSceneNodeInfo } from 'services/scene-collections/nodes/scene-items';
import * as fs from 'fs';
import uuid from 'uuid/v4';

export type TSceneNode = SceneItem | SceneItemFolder;

export interface ISceneHierarchy extends ISceneItemNode {
  children: ISceneHierarchy[];
}

@ServiceHelper()
export class Scene {
  id: string;
  name: string;
  nodes: (ISceneItem | ISceneItemFolder)[];
  resourceId: string;

  private _resourceId: string;

  @Inject() private scenesService: ScenesService;
  @Inject() private sourcesService: SourcesService;
  @Inject() private selectionService: SelectionService;

  private readonly state: IScene;

  constructor(sceneId: string) {
    this.state = this.scenesService.state.scenes[sceneId];
    Utils.applyProxy(this, this.state);
  }

  // getter for backward compatibility with previous version of API
  get items(): ISceneItem[] {
    return this.nodes.filter(node => node.sceneNodeType === 'item') as ISceneItem[];
  }

  getModel(): IScene {
    return this.state;
  }

  getObsScene(): obs.IScene {
    return obs.SceneFactory.fromName(this.id);
  }

  getNode(sceneNodeId: string): TSceneNode {
    const nodeModel = this.state.nodes.find(
      sceneItemModel => sceneItemModel.id === sceneNodeId,
    ) as ISceneItem;

    if (!nodeModel) return null;

    return nodeModel.sceneNodeType === 'item'
      ? new SceneItem(this.id, nodeModel.id, nodeModel.sourceId)
      : new SceneItemFolder(this.id, nodeModel.id);
  }

  getItem(sceneItemId: string): SceneItem {
    const node = this.getNode(sceneItemId);
    return node && node.isItem() ? node : null;
  }

  getFolder(sceneFolderId: string): SceneItemFolder {
    const node = this.getNode(sceneFolderId);
    return node && node.isFolder() ? node : null;
  }

  /**
   * returns the first node with selected name
   */
  getNodeByName(name: string): TSceneNode {
    return this.getNodes().find(node => node.name === name);
  }

  getItems(): SceneItem[] {
    return this.state.nodes
      .filter(node => node.sceneNodeType === 'item')
      .map(item => this.getItem(item.id));
  }

  getFolders(): SceneItemFolder[] {
    return this.state.nodes
      .filter(node => node.sceneNodeType === 'folder')
      .map(item => this.getFolder(item.id));
  }

  getNodes(): TSceneNode[] {
    return this.state.nodes.map(node => {
      return node.sceneNodeType === 'folder' ? this.getFolder(node.id) : this.getItem(node.id);
    });
  }

  getRootNodes(): TSceneNode[] {
    return this.getNodes().filter(node => !node.parentId);
  }

  getRootNodesIds(): string[] {
    return this.getRootNodes().map(node => node.id);
  }

  getNodesIds(): string[] {
    return this.state.nodes.map(item => item.id);
  }

  getSelection(itemsList?: TNodesList): Selection {
    return new Selection(this.id, itemsList);
  }

  setName(newName: string) {
    const sceneSource = this.sourcesService.getSource(this.id);
    sceneSource.setName(newName);
    this.SET_NAME(newName);
  }

  createAndAddSource(
    sourceName: string,
    type: TSourceType,
    settings?: Dictionary<any>,
    options: ISceneNodeAddOptions = {},
  ): SceneItem {
    const sourceAddOptions = options.sourceAddOptions || {};
    const source = this.sourcesService.createSource(sourceName, type, settings, sourceAddOptions);
    return this.addSource(source.sourceId, options);
  }

  addSource(sourceId: string, options: ISceneNodeAddOptions = {}): SceneItem {
    const source = this.sourcesService.getSource(sourceId);
    if (!source) throw new Error(`Source ${sourceId} not found`);

    if (!this.canAddSource(sourceId)) return null;

    const sceneItemId = options.id || uuid();

    let obsSceneItem: obs.ISceneItem;
    obsSceneItem = this.getObsScene().add(source.getObsInput());

    this.ADD_SOURCE_TO_SCENE(sceneItemId, source.sourceId, obsSceneItem.id);
    const sceneItem = this.getItem(sceneItemId);

    // Default is to select
    if (options.select == null) options.select = true;
    if (options.select) this.selectionService.select(sceneItemId);

    if (options.initialTransform) {
      sceneItem.setTransform(options.initialTransform);
    }

    this.scenesService.itemAdded.next(sceneItem.getModel());
    return sceneItem;
  }

  addFile(path: string, folderId?: string): TSceneNode {
    const fstat = fs.lstatSync(path);
    if (!fstat) return null;
    const fname = path.split('\\').slice(-1)[0];

    if (fstat.isDirectory()) {
      const folder = this.createFolder(fname);
      if (folderId) folder.setParent(folderId);
      const files = fs.readdirSync(path).reverse();
      files.forEach(filePath => this.addFile(`${path}\\${filePath}`, folder.id));
      return folder;
    }

    const source = this.sourcesService.addFile(path);
    if (!source) return null;
    const item = this.addSource(source.sourceId);
    if (folderId) item.setParent(folderId);
    return item;
  }

  createFolder(name: string, options: ISceneNodeAddOptions = {}) {
    const id = options.id || uuid();

    this.ADD_FOLDER_TO_SCENE({
      id,
      name,
      sceneNodeType: 'folder',
      sceneId: this.id,
      resourceId: `SceneItemFolder${JSON.stringify([this.id, id])}`,
      parentId: '',
    });
    return this.getFolder(id);
  }

  removeFolder(folderId: string) {
    const sceneFolder = this.getFolder(folderId);
    if (!sceneFolder) return;
    if (sceneFolder.isSelected()) sceneFolder.deselect();
    sceneFolder.getSelection().remove();
    sceneFolder.detachParent();
    this.REMOVE_NODE_FROM_SCENE(folderId);
  }

  remove(force?: boolean): IScene {
    return this.scenesService.removeScene(this.id, force);
  }

  removeItem(sceneItemId: string) {
    const sceneItem = this.getItem(sceneItemId);
    if (!sceneItem) return;
    const sceneItemModel = sceneItem.getModel();
    if (sceneItem.isSelected()) sceneItem.deselect();
    sceneItem.detachParent();
    sceneItem.getObsSceneItem().remove();
    this.REMOVE_NODE_FROM_SCENE(sceneItemId);
    this.scenesService.itemRemoved.next(sceneItemModel);
  }

  clear() {
    this.getSelection()
      .selectAll()
      .remove();
  }

  setLockOnAllItems(locked: boolean) {
    this.getItems().forEach(item => item.setSettings({ locked }));
  }

  placeAfter(sourceNodeId: string, destNodeId?: string) {
    const sourceNode = this.getNode(sourceNodeId);
    const destNode = this.getNode(destNodeId);

    if (destNode && destNode.id === sourceNode.id) return;

    const destNodeIsParentForSourceNode = destNode && destNode.id === sourceNode.parentId;

    let destFolderId = '';

    if (destNode) {
      if (destNode.isItem()) {
        destFolderId = destNode.parentId;
      } else {
        if (destNode.id === sourceNode.parentId) {
          destFolderId = destNode.id;
        } else {
          destFolderId = destNode.parentId;
        }
      }
    }

    if (sourceNode.parentId !== destFolderId) {
      sourceNode.setParent(destFolderId);
    }

    const itemsToMove: SceneItem[] = sourceNode.isFolder()
      ? sourceNode.getNestedItems()
      : [sourceNode];

    // move nodes

    const sceneNodesIds = this.getNodesIds();
    const nodesToMoveIds: string[] =
      sourceNode.sceneNodeType === 'folder'
        ? [sourceNode.id].concat((sourceNode as SceneItemFolder).getNestedNodesIds())
        : [sourceNode.id];
    const firstNodeIndex = this.getNode(nodesToMoveIds[0]).getNodeIndex();

    let newNodeIndex = 0;

    if (destNode) {
      const destNodeIndex = destNode.getNodeIndex();

      newNodeIndex =
        destNode.isFolder() && !destNodeIsParentForSourceNode
          ? destNodeIndex + destNode.getNestedNodes().length + 1
          : destNodeIndex + 1;

      if (destNodeIndex > firstNodeIndex) {
        // Adjust for moved items
        newNodeIndex -= nodesToMoveIds.length;
      }
    }

    sceneNodesIds.splice(firstNodeIndex, nodesToMoveIds.length);
    sceneNodesIds.splice(newNodeIndex, 0, ...nodesToMoveIds);

    this.SET_NODES_ORDER(sceneNodesIds);

    this.reconcileNodeOrderWithObs();
  }

  setNodesOrder(order: string[]) {
    this.SET_NODES_ORDER(order);
    this.reconcileNodeOrderWithObs();
  }

  /**
   * Makes sure all scene items are in the correct order in OBS.
   */
  private reconcileNodeOrderWithObs() {
    this.getItems().forEach((item, index) => {
      const currentIndex = this.getObsScene()
        .getItems()
        .reverse()
        .findIndex(obsItem => obsItem.id === item.obsSceneItemId);
      this.getObsScene().moveItem(currentIndex, index);
    });
  }

  placeBefore(sourceNodeId: string, destNodeId: string) {
    const destNode = this.getNode(destNodeId);
    const newDestNode = destNode.getPrevSiblingNode();
    if (newDestNode) {
      this.placeAfter(sourceNodeId, newDestNode.id);
    } else if (destNode.parentId) {
      this.getNode(sourceNodeId).setParent(destNode.parentId); // place to the top of folder
    } else {
      this.placeAfter(sourceNodeId); // place to the top of scene
    }
  }

  addSources(nodes: TSceneNodeInfo[]) {
    const arrayItems: (ISceneItemInfo & obs.ISceneItemInfo)[] = [];

    // tslint:disable-next-line:no-parameter-reassignment TODO
    nodes = nodes.filter(sceneNode => {
      if (sceneNode.sceneNodeType === 'folder') return true;
      const source = this.sourcesService.getSource(sceneNode.sourceId);
      if (!source) return false;
      arrayItems.push({
        name: source.sourceId,
        id: sceneNode.id,
        sourceId: source.sourceId,
        crop: sceneNode.crop,
        scaleX: sceneNode.scaleX == null ? 1 : sceneNode.scaleX,
        scaleY: sceneNode.scaleY == null ? 1 : sceneNode.scaleY,
        visible: sceneNode.visible,
        x: sceneNode.x == null ? 0 : sceneNode.x,
        y: sceneNode.y == null ? 0 : sceneNode.y,
        locked: sceneNode.locked,
        rotation: sceneNode.rotation || 0,
        streamVisible: sceneNode.streamVisible,
        recordingVisible: sceneNode.recordingVisible,
      });
      return true;
    });

    const obsSceneItems = obs.addItems(this.getObsScene(), arrayItems);

    // create folder and items
    let itemIndex = 0;
    nodes.forEach(nodeModel => {
      if (nodeModel.sceneNodeType === 'folder') {
        this.createFolder(nodeModel.name, { id: nodeModel.id });
      } else {
        this.ADD_SOURCE_TO_SCENE(nodeModel.id, nodeModel.sourceId, obsSceneItems[itemIndex].id);
        this.getItem(nodeModel.id).loadItemAttributes(nodeModel);
        itemIndex++;
      }
    });

    // add items to folders
    nodes.reverse().forEach(nodeModel => {
      if (nodeModel.sceneNodeType !== 'folder') return;
      this.getSelection(nodeModel.childrenIds).moveTo(this.id, nodeModel.id);
    });
  }

  canAddSource(sourceId: string): boolean {
    const source = this.sourcesService.getSource(sourceId);
    if (!source) return false;

    // if source is scene then traverse the scenes tree to detect possible infinity scenes loop
    if (source.type !== 'scene') return true;
    if (this.id === source.sourceId) return false;

    const sceneToAdd = this.scenesService.getScene(source.sourceId);

    if (!sceneToAdd) return true;

    return !sceneToAdd.hasNestedScene(this.id);
  }

  hasNestedScene(sceneId: string) {
    const childScenes = this.getItems()
      .filter(sceneItem => sceneItem.type === 'scene')
      .map(sceneItem => this.scenesService.getScene(sceneItem.sourceId));

    for (const childScene of childScenes) {
      if (childScene.id === sceneId) return true;
      if (childScene.hasNestedScene(sceneId)) return true;
    }

    return false;
  }

  /**
   * returns scene items of scene + scene items of nested scenes
   */
  getNestedItems(options = { excludeScenes: false }): SceneItem[] {
    let result = this.getItems();
    result
      .filter(sceneItem => sceneItem.type === 'scene')
      .map(sceneItem => {
        return this.scenesService.getScene(sceneItem.sourceId).getNestedItems();
      })
      .forEach(sceneItems => {
        result = result.concat(sceneItems);
      });
    if (options.excludeScenes) result = result.filter(sceneItem => sceneItem.type !== 'scene');
    return uniqBy(result, 'sceneItemId');
  }

  makeActive() {
    this.scenesService.makeSceneActive(this.id);
  }

  /**
   * returns sources of scene + sources of nested scenes
   * result also includes nested scenes
   */
  getNestedSources(options = { excludeScenes: false }): Source[] {
    const sources = this.getNestedItems(options).map(sceneItem => sceneItem.getSource());
    return uniqBy(sources, 'sourceId');
  }

  /**
   * return nested scenes in the safe-to-add order
   */
  getNestedScenes(): Scene[] {
    const scenes = this.getNestedSources()
      .filter(source => source.type === 'scene')
      .map(sceneSource => this.scenesService.getScene(sceneSource.sourceId));
    const resultScenes: Scene[] = [];

    scenes.forEach(scene => {
      resultScenes.push(...scene.getNestedScenes());
      if (!resultScenes.find(foundScene => foundScene.id === scene.id)) {
        resultScenes.push(scene);
      }
    });

    return resultScenes;
  }

  /**
   * returns the source linked to scene
   */
  getSource(): Source {
    return this.sourcesService.getSource(this.id);
  }

  getResourceId() {
    return this._resourceId;
  }

  @mutation()
  private SET_NAME(newName: string) {
    this.state.name = newName;
  }

  @mutation()
  private ADD_SOURCE_TO_SCENE(sceneItemId: string, sourceId: string, obsSceneItemId: number) {
    this.state.nodes.unshift({
      sceneItemId,
      sourceId,
      obsSceneItemId,
      id: sceneItemId,
      parentId: '',
      sceneNodeType: 'item',
      sceneId: this.state.id,
      resourceId: `SceneItem${JSON.stringify([this.state.id, sceneItemId, sourceId])}`,

      transform: {
        // Position in video space
        position: { x: 0, y: 0 },

        // Scale between 0 and 1
        scale: { x: 1.0, y: 1.0 },

        crop: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },

        rotation: 0,
      },

      visible: true,
      locked: false,
      streamVisible: true,
      recordingVisible: true,
    });
  }

  @mutation()
  private ADD_FOLDER_TO_SCENE(folderModel: ISceneItemFolder) {
    this.state.nodes.unshift(folderModel);
  }

  @mutation()
  private REMOVE_NODE_FROM_SCENE(nodeId: string) {
    this.state.nodes = this.state.nodes.filter(item => {
      return item.id !== nodeId;
    });
  }

  @mutation()
  private SET_NODES_ORDER(order: string[]) {
    // TODO: This is O(n^2)
    this.state.nodes = order.map(id => {
      return this.state.nodes.find(item => {
        return item.id === id;
      });
    });
  }
}
