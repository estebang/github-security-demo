/**
 * abstract class for representing scene's folders and items
 */
import { ServiceHelper, mutation, Inject } from 'services';
import { TSceneNodeType } from '.';
import {
  ScenesService,
  Scene,
  ISceneItemNode,
  SceneItemFolder,
  SceneItem,
  TSceneNode,
} from './index';
import { SelectionService } from 'services/selection';

export function isFolder(node: SceneItemNode): node is SceneItemFolder {
  return node.sceneNodeType === 'folder';
}

export function isItem(node: SceneItemNode): node is SceneItem {
  return node.sceneNodeType === 'item';
}

@ServiceHelper()
export abstract class SceneItemNode implements ISceneItemNode {
  id: string;
  parentId: string;
  abstract sceneNodeType: TSceneNodeType;
  resourceId: string;
  sceneId: string;

  private _resourceId: string;

  @Inject() protected scenesService: ScenesService;
  @Inject() protected selectionService: SelectionService;

  getScene(): Scene {
    return this.scenesService.getScene(this.sceneId);
  }

  get childrenIds(): string[] {
    return this.getScene()
      .getModel()
      .nodes.filter(node => node.parentId === this.id)
      .map(node => node.id);
  }

  setParent(parentId: string) {
    // prevent to set a child folder as parent
    if (this.isFolder() && this.getNestedNodesIds().indexOf(parentId) !== -1) {
      return;
    }
    this.SET_PARENT(parentId);
    this.placeAfter(parentId);
  }

  detachParent() {
    if (this.parentId) this.SET_PARENT('');
  }

  getParent(): SceneItemFolder {
    return this.getScene().getFolder(this.parentId);
  }

  hasParent(): boolean {
    return !!this.state.parentId;
  }

  getNodeIndex(): number {
    return this.getScene()
      .getNodesIds()
      .indexOf(this.id);
  }

  placeAfter(nodeId: string) {
    this.getScene().placeAfter(this.id, nodeId);
  }

  placeBefore(nodeId: string) {
    this.getScene().placeBefore(this.id, nodeId);
  }

  getPrevNode(): TSceneNode {
    const nodeInd = this.getNodeIndex();
    return this.getScene().getNodes()[nodeInd - 1];
  }

  getNextNode(): TSceneNode {
    const nodeInd = this.getNodeIndex();
    return this.getScene().getNodes()[nodeInd + 1];
  }

  getPrevSiblingNode(): TSceneNode {
    const siblingsIds = this.parentId
      ? this.getParent().getNestedNodesIds()
      : this.getScene().getRootNodesIds();

    const childInd = siblingsIds.indexOf(this.id);
    if (childInd !== 0) return this.getScene().getNode(siblingsIds[childInd - 1]);
  }

  getNextSiblingNode(): TSceneNode {
    const siblingsIds = this.parentId
      ? this.getParent().getNestedNodesIds()
      : this.getScene().getRootNodesIds();

    const childInd = siblingsIds.indexOf(this.id);
    if (childInd !== 0) return this.getScene().getNode(siblingsIds[childInd + 1]);
  }

  getPrevItem(): SceneItem {
    let nodeInd = this.getNodeIndex();
    const nodes = this.getScene().getNodes();
    while (nodeInd--) {
      if (nodes[nodeInd].isItem()) return nodes[nodeInd] as SceneItem;
    }
    return null;
  }

  getNextItem(): SceneItem {
    let nodeInd = this.getNodeIndex();
    const nodes = this.getScene().getNodes();
    while (nodeInd++) {
      if (!nodes[nodeInd]) return null;
      if (nodes[nodeInd].isItem()) return nodes[nodeInd] as SceneItem;
    }
  }

  /**
   * @returns all parent Ids
   */
  getPath(): string[] {
    const parent = this.getParent();
    return parent ? parent.getPath().concat([this.id]) : [this.id];
  }

  isSelected() {
    return this.selectionService.isSelected(this.id);
  }

  select() {
    this.selectionService.select(this.id);
  }

  addToSelection() {
    this.selectionService.add(this.id);
  }

  deselect() {
    this.selectionService.deselect(this.id);
  }

  isFolder(): this is SceneItemFolder {
    return isFolder(this);
  }

  isItem(): this is SceneItem {
    return isItem(this);
  }

  getResourceId() {
    return this._resourceId;
  }

  protected abstract get state(): ISceneItemNode;
  abstract remove(): void;

  @mutation()
  protected SET_PARENT(parentId?: string) {
    this.state.parentId = parentId;
  }
}
