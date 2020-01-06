import Vue from 'vue';
import { Component } from 'vue-property-decorator';
import { Inject } from 'services/core/injector';
import { SceneCollectionsService } from 'services/scene-collections/index';
import { OverlaysPersistenceService } from 'services/scene-collections/overlays';
import { CustomizationService } from 'services/customization/index';
import electron from 'electron';
import path from 'path';
import { AppService } from 'services/app/index';
import { WidgetsService } from 'services/widgets/index';
import { ScenesService } from 'services/scenes/index';
import { $t } from 'services/i18n/index';
import { BoolInput } from 'components/shared/inputs/inputs';

@Component({ components: { BoolInput } })
export default class OverlaySettings extends Vue {
  @Inject() sceneCollectionsService: SceneCollectionsService;
  @Inject() overlaysPersistenceService: OverlaysPersistenceService;
  @Inject() appService: AppService;
  @Inject() widgetsService: WidgetsService;
  @Inject() scenesService: ScenesService;
  @Inject() customizationService: CustomizationService;

  busy = false;
  message = '';

  get mediaBackupOptOut(): boolean {
    return this.customizationService.state.mediaBackupOptOut;
  }

  set mediaBackupOptOut(value: boolean) {
    this.customizationService.setMediaBackupOptOut(value);
  }

  async saveOverlay() {
    const { filePath } = await electron.remote.dialog.showSaveDialog({
      filters: [{ name: 'Overlay File', extensions: ['overlay'] }],
    });

    if (!filePath) return;

    this.busy = true;
    this.message = '';

    // TODO: Expose progress to the user
    this.overlaysPersistenceService.saveOverlay(filePath).then(() => {
      this.busy = false;
      this.message = $t('Successfully saved %{filename}', {
        filename: path.parse(filePath).base,
      });
    });
  }

  async loadOverlay() {
    const chosenPath = (await electron.remote.dialog.showOpenDialog({
      filters: [{ name: 'Overlay File', extensions: ['overlay'] }],
    })).filePaths;

    if (!chosenPath) return;

    this.busy = true;
    this.message = '';

    const filename = path.parse(chosenPath[0]).name;
    const configName = this.sceneCollectionsService.suggestName(filename);

    this.sceneCollectionsService.loadOverlay(chosenPath[0], configName).then(() => {
      this.busy = false;
      this.message = $t('Successfully loaded %{filename}.overlay', { filename });
    });
  }

  loadWidget() {
    const chosenPath = electron.remote.dialog.showOpenDialog({
      filters: [{ name: 'Widget File', extensions: ['widget'] }],
    });

    if (!chosenPath) return;

    this.busy = true;

    this.widgetsService.loadWidgetFile(chosenPath[0], this.scenesService.activeSceneId).then(() => {
      this.busy = false;
    });
  }
}
