import Vue from 'vue';
import { Component } from 'vue-property-decorator';
import ModalLayout from 'components/ModalLayout.vue';
import { Inject } from 'services/core/injector';
import { UserService } from 'services/user';
import { I18nService } from 'services/i18n';
import electron from 'electron';
import BrowserView from 'components/shared/BrowserView';

@Component({
  components: { ModalLayout, BrowserView },
})
export default class RecentEvents extends Vue {
  @Inject() userService: UserService;
  @Inject() i18nService: I18nService;

  $refs: {
    webview: Electron.WebviewTag;
  };

  onBrowserViewReady(view: Electron.BrowserView) {
    electron.ipcRenderer.send('webContents-preventPopup', view.webContents.id);

    view.webContents.on('new-window', (e, url) => {
      electron.remote.shell.openExternal(url);
    });
  }

  get recentEventsUrl() {
    return this.userService.recentEventsUrl();
  }
}
