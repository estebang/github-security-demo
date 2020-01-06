import { Component, Prop } from 'vue-property-decorator';
import { Multiselect } from 'vue-multiselect';
import { FontLibraryService } from '../../../services/font-library';
import { Inject } from '../../../services/core/injector';
import { SourcesService } from '../../../services/sources';
import { ObsInput, IGoogleFont } from './ObsInput';
import ObsFontSizeSelector from './ObsFontSizeSelector.vue';
import * as fi from 'node-fontinfo';
import { EFontStyle } from 'obs-studio-node';

@Component({
  components: { Multiselect, FontSizeSelector: ObsFontSizeSelector },
})
export default class GoogleFontSelector extends ObsInput<IGoogleFont> {
  @Inject()
  fontLibraryService: FontLibraryService;

  @Inject()
  sourcesService: SourcesService;

  @Prop()
  value: IGoogleFont;

  fontFamilies: string[] = [];

  fontStyles: string[] = [];

  selectedFamily = '';

  selectedStyle = '';

  /* TrueType/OpenType defines fonts to have a
   * preferred family name. For instance Arial Black
   * has a preferred family name of 'Arial' and a
   * preferred subfamily name of 'Black'.
   *
   * GDI+ and consequently the plugin doesn't
   * understand this at all. GDI+ only understands
   * the following for styles:
   *
   * `Bold | Italic | Bold Italic | Regular
   *
   * As a result, anything that isn't part of the style must
   * be part of the family name. For example, in the eyes of
   * GDI+, Arial Black has a family name of 'Arial Black' and
   * a subfamily name of Regular.
   * The plugin itself takes the family name as the style
   * as a bitmask of flags */
  actualFamily = '';

  actualStyle: number = 0;

  // Disambiguate from `loading` which it would conflict with prop being passed/inherited to this
  isLoading = true;

  created() {
    this.isLoading = true;
    this.fontLibraryService.getManifest().then(manifest => {
      this.isLoading = false;
      this.fontFamilies = manifest.families.map(family => family.name);

      if (this.value.path) this.updateSelectionFromPath();
    });
  }

  updateSelectionFromPath() {
    this.fontLibraryService.lookupFontInfo(this.value.path).then(info => {
      this.selectedFamily = info.family;
      this.selectedStyle = info.style;

      this.updateStyles();
    });
  }

  updateStyles() {
    if (this.selectedFamily) {
      this.fontLibraryService.findFamily(this.selectedFamily).then(fam => {
        this.fontStyles = fam.styles.map(sty => sty.name);
      });
    }
  }

  setFamily(familyName: string) {
    this.isLoading = true;
    this.selectedFamily = familyName;

    this.fontLibraryService.findFamily(familyName).then(family => {
      const style = family.styles[0];

      this.updateStyles();
      this.setStyle(style.name);
    });
  }

  setStyle(styleName: string) {
    this.isLoading = true;
    this.selectedStyle = styleName;

    this.fontLibraryService.findStyle(this.selectedFamily, styleName).then(style => {
      this.fontLibraryService.downloadFont(style.file).then(fontPath => {
        const fontInfo = fi.getFontInfo(fontPath);

        if (!fontInfo) {
          this.actualFamily = 'Arial';
          this.actualStyle = 0;
        } else {
          this.actualFamily = fontInfo.family_name;

          this.actualStyle =
            (fontInfo.italic ? EFontStyle.Italic : 0) | (fontInfo.bold ? EFontStyle.Bold : 0);
        }

        this.value.face = this.actualFamily;
        this.value.flags = this.actualStyle;

        this.emitInput({ ...this.value, path: fontPath });
        this.isLoading = false;
      });
    });
  }

  setSize(size: string) {
    this.emitInput({ ...this.value, size });
  }
}
