import { Component, Prop } from 'vue-property-decorator';
import { debounce } from 'lodash-decorators';
import { TObsType, IObsInput, ObsInput } from './ObsInput';
import Utils from '../../../services/utils';
import VueColor from 'vue-color';

interface IColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

@Component({
  components: { ColorPicker: VueColor.Sketch },
})
class ObsColorInput extends ObsInput<IObsInput<number>> {
  static obsType: TObsType;

  @Prop()
  value: IObsInput<number>;

  pickerVisible = false;

  togglePicker() {
    this.pickerVisible = !this.pickerVisible;
  }

  @debounce(500)
  setValue(rgba: IColor) {
    if (!Object.keys(rgba).every(key => rgba[key] === this.obsColor[key])) {
      const intColor = Utils.rgbaToInt(rgba.r, rgba.g, rgba.b, Math.round(255 * rgba.a));
      this.emitInput({ ...this.value, value: intColor });
    }
  }

  mounted() {
    this.setValue(this.obsColor);
  }

  get hexAlpha() {
    const alpha = this.obsColor.a;
    return `00${Math.floor(alpha * 255).toString(16)}`;
  }

  get hexColor() {
    const rgba = Utils.intToRgba(this.value.value);
    return this.intTo2hexDigit(rgba.r) + this.intTo2hexDigit(rgba.g) + this.intTo2hexDigit(rgba.b);
  }

  // This is displayed to the user
  get hexARGB() {
    return `#${this.hexAlpha}${this.hexColor}`.toLowerCase();
  }

  get swatchStyle() {
    return {
      backgroundColor: `#${this.hexColor}`,
      opacity: this.obsColor.a || 1,
    };
  }

  get obsColor(): IColor {
    const rgba = Utils.intToRgba(this.value.value);
    return {
      r: rgba.r,
      g: rgba.g,
      b: rgba.b,
      a: Number((rgba.a / 255).toFixed(2)),
    };
  }

  private intTo2hexDigit(int: number) {
    let result = int.toString(16);
    if (result.length === 1) result = `0${result}`;
    return result;
  }
}

ObsColorInput.obsType = 'OBS_PROPERTY_COLOR';

export default ObsColorInput;
