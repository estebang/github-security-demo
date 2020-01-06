import uniq from 'lodash/uniq';
import { ServiceHelper, Inject } from 'services';
import {
  ScenesService,
  TSceneNodeModel,
  Scene,
  SceneItemFolder,
  SceneItem,
  TSceneNode,
  ISceneItem,
  ISceneItemSettings,
  ISceneItemNode,
  IPartialTransform,
} from 'services/scenes';
import { Source } from 'services/sources';
import { Rect } from 'util/rect';
import { AnchorPoint, AnchorPositions, CenteringAxis } from 'util/ScalableRectangle';
import { ISelectionState, TNodesList } from './index';

/**
 * Helper for working with multiple sceneItems
 */
@ServiceHelper()
export class Selection {
  @Inject() private scenesService: ScenesService;

  _resourceId: string;

  private state: ISelectionState = {
    selectedIds: [],
    lastSelectedId: '',
  };

  constructor(public sceneId: string, itemsList: TNodesList = []) {
    this.select(itemsList);
  }

  // SELECTION METHODS

  getScene(): Scene {
    return this.scenesService.getScene(this.sceneId);
  }

  add(itemsList: TNodesList): Selection {
    const ids = this.resolveItemsList(itemsList);
    this.select(this.state.selectedIds.concat(ids));
    return this;
  }

  select(itemsList: TNodesList): Selection {
    let ids = this.resolveItemsList(itemsList);
    ids = uniq(ids);
    const scene = this.getScene();

    // omit ids that are not presented on the scene
    // and select the all nested items of selected folders
    const selectedIds: string[] = [];
    ids.forEach(id => {
      const node = scene.getNode(id);
      if (!node) return;
      selectedIds.push(id);
      if (node.sceneNodeType !== 'folder') return;
      selectedIds.push(...(node as SceneItemFolder).getNestedNodesIds());
    });

    this.setState({ selectedIds });

    if (!this.state.selectedIds.includes(this.state.lastSelectedId)) {
      this.setState({ lastSelectedId: selectedIds[selectedIds.length - 1] });
    }

    this._resourceId = `Selection${JSON.stringify([this.sceneId, this.state.selectedIds])}`;

    return this;
  }

  deselect(itemsList: TNodesList): Selection {
    const ids = this.resolveItemsList(itemsList);
    this.select(this.state.selectedIds.filter(id => !ids.includes(id)));
    return this;
  }

  reset(): Selection {
    this.select([]);
    return this;
  }

  clone(): Selection {
    return this.getScene().getSelection(this.getIds());
  }

  /**
   * return items with the order as in the scene
   */
  getItems(): SceneItem[] {
    const scene = this.getScene();
    if (!this.getSize()) return [];
    return scene.getItems().filter(item => this.state.selectedIds.includes(item.id));
  }

  /**
   * return nodes with the order as in the scene
   */
  getNodes(): TSceneNode[] {
    const scene = this.getScene();
    if (!this.getSize()) return [];
    return scene.getNodes().filter(node => this.state.selectedIds.includes(node.id));
  }

  /**
   * return folders with the order as in the scene
   */
  getFolders(): SceneItemFolder[] {
    const scene = this.getScene();
    if (!this.getSize()) return [];
    return scene.getFolders().filter(folder => this.state.selectedIds.includes(folder.id));
  }

  /**
   * true if selections has only one SceneItem
   */
  isSceneItem(): boolean {
    return this.getSize() === 1 && this.getNodes()[0].isItem();
  }

  /**
   * true if selections has only one folder
   */
  isSceneFolder(): boolean {
    const rootNodes = this.getRootNodes();
    return rootNodes.length === 1 && rootNodes[0].sceneNodeType === 'folder';
  }

  getVisualItems(): SceneItem[] {
    return this.getItems().filter(item => item.isVisualSource);
  }

  /**
   * the right order is not guaranteed
   */
  getIds(): string[] {
    return this.state.selectedIds;
  }

  getInvertedIds(): string[] {
    const selectedIds = this.getIds();
    return this.getScene()
      .getNodesIds()
      .filter(id => {
        return !selectedIds.includes(id);
      });
  }

  getLastSelected(): TSceneNode {
    return this.getScene().getNode(this.state.lastSelectedId);
  }

  getLastSelectedId(): string {
    return this.state.lastSelectedId;
  }

  getSize(): number {
    return this.state.selectedIds.length;
  }

  getBoundingRect(): Rect {
    const items = this.getVisualItems();
    if (!items.length) return null;

    let minTop = Infinity;
    let minLeft = Infinity;
    let maxRight = -Infinity;
    let maxBottom = -Infinity;

    items.forEach(item => {
      const rect = item.getBoundingRect();
      minTop = Math.min(minTop, rect.y);
      minLeft = Math.min(minLeft, rect.x);
      maxRight = Math.max(maxRight, rect.x + rect.width);
      maxBottom = Math.max(maxBottom, rect.y + rect.height);
    });

    return new Rect({
      x: minLeft,
      y: minTop,
      width: maxRight - minLeft,
      height: maxBottom - minTop,
    });
  }

  getInverted(): TSceneNode[] {
    const scene = this.getScene();
    return this.getInvertedIds().map(id => scene.getNode(id));
  }

  invert(): Selection {
    const items = this.getInverted();
    this.select(items.map(item => item.id));
    return this;
  }

  isSelected(sceneNode: string | TSceneNodeModel) {
    const itemId =
      typeof sceneNode === 'string' ? sceneNode : (sceneNode as ISceneItem).sceneItemId;
    return this.getIds().includes(itemId);
  }

  selectAll(): Selection {
    this.select(
      this.getScene()
        .getNodes()
        .map(node => node.id),
    );
    return this;
  }

  copyTo(sceneId: string, folderId?: string, duplicateSources = false): TSceneNode[] {
    const insertedNodes: TSceneNode[] = [];
    const scene = this.scenesService.getScene(sceneId);
    const foldersMap: Dictionary<string> = {};
    let prevInsertedNode: TSceneNode;
    let insertedNode: TSceneNode;

    const sourcesMap: Dictionary<Source> = {};
    // TODO: we're updating this, but we don't seem to ever use it
    const notDuplicatedSources: Source[] = [];
    if (duplicateSources) {
      this.getSources().forEach(source => {
        const duplicatedSource = source.duplicate();
        if (!duplicatedSource) {
          notDuplicatedSources.push(source);
          return;
        }
        sourcesMap[source.sourceId] = duplicatedSource;
      });
    }

    // copy items and folders structure
    this.getNodes().forEach(sceneNode => {
      if (sceneNode.isFolder()) {
        insertedNode = scene.createFolder(sceneNode.name);
        foldersMap[sceneNode.id] = insertedNode.id;
        insertedNodes.push(insertedNode);
      } else if (sceneNode.isItem()) {
        insertedNode = scene.addSource(
          sourcesMap[sceneNode.sourceId]
            ? sourcesMap[sceneNode.sourceId].sourceId
            : sceneNode.sourceId,
        );
        insertedNode.setSettings(sceneNode.getSettings());
        insertedNodes.push(insertedNode);
      }

      const newParentId = foldersMap[sceneNode.parentId] || '';
      if (newParentId) {
        insertedNode.setParent(newParentId);
      }

      if (prevInsertedNode && prevInsertedNode.parentId === newParentId) {
        insertedNode.placeAfter(prevInsertedNode.id);
      }

      prevInsertedNode = insertedNode;
    });

    return insertedNodes;
  }

  moveTo(sceneId: string, folderId?: string): TSceneNode[] {
    if (this.sceneId === sceneId) {
      if (!folderId) return;
      this.getRootNodes()
        .reverse()
        .forEach(sceneNode => sceneNode.setParent(folderId));
    } else {
      const insertedItems = this.copyTo(sceneId, folderId);
      this.remove();
      return insertedItems;
    }
  }

  /**
   * A selection is considered visible if at least 1 item
   * in the selection is visible.
   */
  isVisible(): boolean {
    return this.getItems().some(item => item.visible);
  }

  /**
   * A selection is considered locked if all items in the
   * selection are locked.
   */
  isLocked(): boolean {
    return this.getItems().every(item => item.locked);
  }

  /**
   * Helper method to check if any items in the selection
   * are locked.
   */
  isAnyLocked(): boolean {
    return this.getItems().some(item => item.locked);
  }

  isStreamVisible(): boolean {
    return this.getItems().every(item => item.streamVisible);
  }

  isRecordingVisible(): boolean {
    return this.getItems().every(item => item.recordingVisible);
  }

  /**
   * Returns a minimal representation of selection
   * for selection list like this:
   *
   * Folder1      <- selected
   *  |_ Item1    <- selected
   *  \_ Folder2  <- selected
   * Item3        <- selected
   * Folder3
   *  |_ Item3
   *  \_ Item4    <- selected
   *
   *  returns Folder1, Item3, Item4
   */
  getRootNodes(): TSceneNode[] {
    const rootNodes: TSceneNode[] = [];
    const foldersIds: string[] = [];
    this.getNodes().forEach(node => {
      if (!foldersIds.includes(node.parentId)) {
        rootNodes.push(node);
      }
      if (node.isFolder()) foldersIds.push(node.id);
    });
    return rootNodes;
  }

  /**
   * Returns the closest common parent folder for selection if exists
   */
  getClosestParent(): SceneItemFolder {
    const rootNodes = this.getRootNodes();
    const paths: string[][] = [];

    for (const node of rootNodes) {
      if (!node.parentId) return null;
      paths.push(node.getPath());
    }

    const minPathLength = Math.min(...paths.map(path => path.length));
    let closestParentId = '';

    for (let ind = 0; ind < minPathLength; ind++) {
      const parents = paths.map(path => path[ind]);
      if (uniq(parents).length === 1) {
        closestParentId = parents[0];
      } else {
        return this.getScene().getFolder(closestParentId);
      }
    }
  }

  canGroupIntoFolder(): boolean {
    const selectedNodes = this.getRootNodes();
    const nodesFolders = selectedNodes.map(node => node.parentId || null);
    const nodesHaveTheSameParent = uniq(nodesFolders).length === 1;
    return selectedNodes.length > 1 && nodesHaveTheSameParent;
  }

  getSources(): Source[] {
    // TODO: we're never updating sourceIds, the condition below will always fail
    const sourcesIds: string[] = [];
    const sources: Source[] = [];
    this.getItems().forEach(item => {
      const source = item.getSource();
      if (sourcesIds.includes(source.sourceId)) return;
      sources.push(source);
    });
    return sources;
  }

  // SCENE_ITEM METHODS

  setStreamVisible(streamVisible: boolean) {
    this.getItems().forEach(item => item.setStreamVisible(streamVisible));
  }

  setRecordingVisible(recordingVisible: boolean) {
    this.getItems().forEach(item => item.setRecordingVisible(recordingVisible));
  }

  setSettings(settings: Partial<ISceneItemSettings>) {
    this.getItems().forEach(item => item.setSettings(settings));
  }

  setVisibility(isVisible: boolean) {
    this.getItems().forEach(item => item.setVisibility(isVisible));
  }

  setTransform(transform: IPartialTransform) {
    this.getItems().forEach(item => item.setTransform(transform));
  }

  resetTransform() {
    this.getItems().forEach(item => item.resetTransform());
  }

  /**
   * Scale items.
   * Origin is the center point of scaling relative to the bounding-box of the selection
   * Where origin = [0, 0] - is top-left corner and [1, 1] is the bottom right corner of the selection
   */
  scale(scale: IVec2, origin: IVec2 = AnchorPositions[AnchorPoint.Center]) {
    const originPos = this.getBoundingRect().getOffsetFromOrigin(origin);
    this.getItems().forEach(item => item.scaleWithOffset(scale, originPos));
  }

  /**
   * same as .scale() but use absolute `offset` point instead of a relative `origin` point
   */
  scaleWithOffset(scale: IVec2, offset: IVec2) {
    this.scale(scale, this.getBoundingRect().getOriginFromOffset(offset));
  }

  setDeltaPos(dir: 'x' | 'y', delta: number) {
    this.getItems().forEach(item => item.setDeltaPos(dir, delta));
  }

  flipY() {
    this.getItems().forEach(item => item.flipY());
  }

  flipX() {
    this.getItems().forEach(item => item.flipX());
  }

  stretchToScreen() {
    this.getItems().forEach(item => item.stretchToScreen());
  }

  fitToScreen() {
    this.getItems().forEach(item => item.fitToScreen());
  }

  centerOnScreen() {
    this.getItems().forEach(item => item.centerOnScreen());
  }

  centerOnHorizontal() {
    this.getItems().forEach(item => item.centerOnAxis(CenteringAxis.X));
  }

  centerOnVertical() {
    this.getItems().forEach(item => item.centerOnAxis(CenteringAxis.Y));
  }

  rotate(deg: number) {
    this.getItems().forEach(item => item.rotate(deg));
  }

  setContentCrop() {
    this.getItems().forEach(item => item.setContentCrop());
  }

  remove() {
    this.getNodes().forEach(node => node.remove());
  }

  nudgeLeft() {
    this.getItems().forEach(item => item.nudgeLeft());
  }

  nudgeRight() {
    this.getItems().forEach(item => item.nudgeRight());
  }

  nudgeUp() {
    this.getItems().forEach(item => item.nudgeUp());
  }

  nudgeDown() {
    this.getItems().forEach(item => item.nudgeDown());
  }

  getModel() {
    return { sceneId: this.sceneId, ...this.state };
  }

  placeAfter(sceneNodeId: string) {
    this.getRootNodes()
      .reverse()
      .forEach(node => node.placeAfter(sceneNodeId));
  }

  placeBefore(sceneNodeId: string) {
    this.getRootNodes().forEach(node => node.placeBefore(sceneNodeId));
  }

  setParent(sceneNodeId: string) {
    this.getRootNodes()
      .reverse()
      .forEach(node => node.setParent(sceneNodeId));
  }

  /**
   * returns an array of sceneItem ids
   */
  private resolveItemsList(itemsList: TNodesList): string[] {
    if (!itemsList) return [];

    if (Array.isArray(itemsList)) {
      if (!itemsList.length) {
        return [];
      }

      if (typeof itemsList[0] === 'string') {
        return itemsList as string[];
      }
      return (itemsList as ISceneItemNode[]).map(item => item.id);
    }

    if (typeof itemsList === 'string') {
      return [itemsList];
    }

    return [itemsList.id];
  }

  private setState(state: Partial<ISelectionState>) {
    Object.assign(this.state, state);
  }
}
