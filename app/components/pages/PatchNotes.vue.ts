import Vue from 'vue';
import { Component } from 'vue-property-decorator';
import { PatchNotesService } from 'services/patch-notes';
import { Inject } from 'services/core/injector';
import { NavigationService } from 'services/navigation';

@Component({})
export default class Dashboard extends Vue {
  @Inject() patchNotesService: PatchNotesService;
  @Inject() navigationService: NavigationService;

  get notes() {
    return this.patchNotesService.notes;
  }

  done() {
    this.navigationService.navigate('Studio');
  }

  patchNotesClosing = false;
  patchNotesOpening = false;

  show() {
    const vid = <HTMLVideoElement>this.$refs.patchNotesVideo;
    vid.play();
    this.patchNotesClosing = true;
    this.patchNotesOpening = true;
  }
}
