import { Inject } from '../../services/core/injector';
import { Menu } from './Menu';
import { Source, SourcesService } from '../../services/sources';
import { ScenesService } from '../../services/scenes';
import { ClipboardService } from '../../services/clipboard';
import { SourceTransformMenu } from './SourceTransformMenu';
import { GroupMenu } from './GroupMenu';
import { SourceFiltersService } from '../../services/source-filters';
import { WidgetsService } from 'services/widgets';
import { CustomizationService } from 'services/customization';
import { SelectionService } from 'services/selection';
import { ProjectorService } from 'services/projector';
import { AudioService } from 'services/audio';
import electron from 'electron';
import { $t } from 'services/i18n';
import { EditorCommandsService } from 'services/editor-commands';
import { ERenderingMode } from '../../../obs-api';

interface IEditMenuOptions {
  selectedSourceId?: string;
  showSceneItemMenu?: boolean;
  selectedSceneId?: string;
  showAudioMixerMenu?: boolean;
}

export class EditMenu extends Menu {
  @Inject() private sourcesService: SourcesService;
  @Inject() private scenesService: ScenesService;
  @Inject() private sourceFiltersService: SourceFiltersService;
  @Inject() private clipboardService: ClipboardService;
  @Inject() private widgetsService: WidgetsService;
  @Inject() private customizationService: CustomizationService;
  @Inject() private selectionService: SelectionService;
  @Inject() private projectorService: ProjectorService;
  @Inject() private audioService: AudioService;
  @Inject() private editorCommandsService: EditorCommandsService;

  private scene = this.scenesService.getScene(this.options.selectedSceneId);

  private readonly source: Source;

  constructor(private options: IEditMenuOptions) {
    super();

    if (this.options.selectedSourceId) {
      this.source = this.sourcesService.getSource(this.options.selectedSourceId);
    } else if (this.options.showSceneItemMenu && this.selectionService.isSceneItem()) {
      this.source = this.selectionService.getItems()[0].getSource();
    }

    this.appendEditMenuItems();
  }

  private appendEditMenuItems() {
    if (this.scene) {
      this.append({
        label: $t('Paste (Reference)'),
        enabled: this.clipboardService.hasData(),
        accelerator: 'CommandOrControl+V',
        click: () => this.clipboardService.paste(),
      });

      this.append({
        label: $t('Paste (Duplicate)'),
        enabled: this.clipboardService.canDuplicate(),
        click: () => this.clipboardService.paste(true),
      });
    }

    const isMultipleSelection = this.selectionService.getSize() > 1;

    if (this.options.showSceneItemMenu) {
      const selectedItem = this.selectionService.getLastSelected();

      this.append({
        label: $t('Copy'),
        accelerator: 'CommandOrControl+C',
        click: () => this.clipboardService.copy(),
      });

      this.append({
        label: $t('Select All'),
        accelerator: 'CommandOrControl+A',
        click: () => this.selectionService.selectAll(),
      });
      this.append({
        label: $t('Invert Selection'),
        click: () => this.selectionService.invert(),
      });

      this.append({ type: 'separator' });

      this.append({
        label: $t('Transform'),
        submenu: this.transformSubmenu().menu,
      });

      this.append({
        label: 'Group',
        submenu: this.groupSubmenu().menu,
      });

      if (selectedItem) {
        const visibilityLabel = selectedItem.visible ? $t('Hide') : $t('Show');
        const streamVisLabel = selectedItem.streamVisible
          ? $t('Hide on Stream')
          : $t('Show on Stream');
        const recordingVisLabel = selectedItem.recordingVisible
          ? $t('Hide on Recording')
          : $t('Show on Recording');

        if (!isMultipleSelection) {
          this.append({
            label: visibilityLabel,
            click: () => {
              selectedItem.setVisibility(!selectedItem.visible);
            },
          });
          this.append({
            label: streamVisLabel,
            click: () => {
              selectedItem.setStreamVisible(!selectedItem.streamVisible);
            },
          });
          this.append({
            label: recordingVisLabel,
            click: () => {
              selectedItem.setRecordingVisible(!selectedItem.recordingVisible);
            },
          });
          this.append({
            label: $t('Create Source Projector'),
            click: () => {
              this.projectorService.createProjector(
                ERenderingMode.OBS_MAIN_RENDERING,
                selectedItem.sourceId,
              );
            },
          });
        } else {
          this.append({
            label: $t('Show'),
            click: () => {
              this.selectionService.setVisibility(true);
            },
          });
          this.append({
            label: $t('Hide'),
            click: () => {
              this.selectionService.setVisibility(false);
            },
          });
        }
      }

      if (this.source && this.source.getPropertiesManagerType() === 'widget') {
        this.append({
          label: $t('Export Widget'),
          click: () => {
            electron.remote.dialog
              .showSaveDialog({
                filters: [{ name: 'Widget File', extensions: ['widget'] }],
              })
              .then(({ filePath }) => {
                if (!filePath) return;

                this.widgetsService.saveWidgetFile(filePath, selectedItem.sceneItemId);
              });
          },
        });
      }
    }

    if (this.selectionService.isSceneFolder()) {
      this.append({
        label: $t('Rename'),
        click: () =>
          this.scenesService.showNameFolder({
            sceneId: this.scenesService.activeSceneId,
            renameId: this.selectionService.getFolders()[0].id,
          }),
      });
    }

    if (this.source) {
      this.append({
        label: $t('Remove'),
        accelerator: 'Delete',
        click: () => {
          // if scene items are selected than remove the selection
          if (this.options.showSceneItemMenu) {
            this.selectionService.remove();
          } else {
            // if no items are selected we are in the MixerSources context menu
            // if a simple source is selected than remove all sources from the current scene
            if (!this.source.channel) {
              const scene = this.scenesService.activeScene;
              const itemsToRemoveIds = scene
                .getItems()
                .filter(item => item.sourceId === this.source.sourceId)
                .map(item => item.id);

              this.editorCommandsService.executeCommand(
                'RemoveNodesCommand',
                scene.getSelection(itemsToRemoveIds),
              );
            } else {
              // remove a global source
              electron.remote.dialog
                .showMessageBox(electron.remote.getCurrentWindow(), {
                  message: $t('This source will be removed from all of your scenes'),
                  type: 'warning',
                  buttons: [$t('Cancel'), $t('OK')],
                })
                .then(({ response }) => {
                  if (!response) return;
                  this.editorCommandsService.executeCommand(
                    'RemoveSourceCommand',
                    this.source.sourceId,
                  );
                });
            }
          }
        },
      });

      if (this.source.type === 'browser_source') {
        this.append({
          label: $t('Interact'),
          click: () => this.sourcesService.showInteractWindow(this.source.sourceId),
        });
      }
    }

    if (this.source && !isMultipleSelection) {
      this.append({
        label: $t('Rename'),
        click: () => this.sourcesService.showRenameSource(this.source.sourceId),
      });

      this.append({ type: 'separator' });

      const filtersCount = this.sourceFiltersService.getFilters(this.source.sourceId).length;

      this.append({
        label: $t('Filters') + (filtersCount > 0 ? ` (${filtersCount})` : ''),
        click: () => {
          this.showFilters();
        },
      });

      this.append({
        label: $t('Copy Filters'),
        click: () => this.clipboardService.copyFilters(this.source.sourceId),
      });

      this.append({
        label: $t('Paste Filters'),
        click: () => this.clipboardService.pasteFilters(this.source.sourceId),
        enabled: this.clipboardService.hasFilters(),
      });

      this.append({ type: 'separator' });

      this.append({
        label: $t('Properties'),
        click: () => {
          this.showProperties();
        },
        enabled: this.source.hasProps(),
      });
    }

    if (!this.options.showSceneItemMenu && !this.source) {
      this.append({ type: 'separator' });

      this.append({
        label: $t('Lock Sources'),
        click: () => this.scenesService.setLockOnAllScenes(true),
      });

      this.append({
        label: $t('Unlock Sources'),
        click: () => this.scenesService.setLockOnAllScenes(false),
      });

      this.append({
        label: $t('Performance Mode'),
        type: 'checkbox',
        checked: this.customizationService.state.performanceMode,
        click: () =>
          this.customizationService.setSettings({
            performanceMode: !this.customizationService.state.performanceMode,
          }),
      });
    }

    this.append({ type: 'separator' });

    this.append({
      label: $t('Create Output Projector'),
      click: () => this.projectorService.createProjector(ERenderingMode.OBS_MAIN_RENDERING),
    });

    this.append({
      label: $t('Create Stream Output Projector'),
      click: () => this.projectorService.createProjector(ERenderingMode.OBS_STREAMING_RENDERING),
    });

    this.append({
      label: $t('Create Recording Output Projector'),
      click: () => this.projectorService.createProjector(ERenderingMode.OBS_RECORDING_RENDERING),
    });

    this.append({ type: 'separator' });

    this.append({
      label: $t('Undo %{action}', { action: this.editorCommandsService.nextUndoDescription }),
      accelerator: 'CommandOrControl+Z',
      click: () => this.editorCommandsService.undo(),
      enabled: this.editorCommandsService.nextUndo != null,
    });

    this.append({
      label: $t('Redo %{action}', { action: this.editorCommandsService.nextRedoDescription }),
      accelerator: 'CommandOrControl+Y',
      click: () => this.editorCommandsService.redo(),
      enabled: this.editorCommandsService.nextRedo != null,
    });

    if (this.options.showAudioMixerMenu) {
      this.append({ type: 'separator' });

      this.append({
        label: 'Hide',
        click: () => {
          this.editorCommandsService.executeCommand('HideMixerSourceCommand', this.source.sourceId);
        },
      });

      this.append({
        label: 'Unhide All',
        click: () => this.editorCommandsService.executeCommand('UnhideMixerSourcesCommand'),
      });
    }
  }

  private showFilters() {
    this.sourceFiltersService.showSourceFilters(this.source.sourceId);
  }

  private showProperties() {
    this.sourcesService.showSourceProperties(this.source.sourceId);
  }

  private transformSubmenu() {
    return new SourceTransformMenu();
  }

  private groupSubmenu() {
    return new GroupMenu();
  }
}
