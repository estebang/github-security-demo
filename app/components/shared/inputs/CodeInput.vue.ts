import { Component, Prop } from 'vue-property-decorator';
import { codemirror } from 'vue-codemirror';
import { BaseInput } from './BaseInput';
import 'codemirror/mode/javascript/javascript.js';
import 'codemirror/mode/css/css.js';
import 'codemirror/mode/htmlmixed/htmlmixed.js';
import 'codemirror/keymap/sublime';
import { IInputMetadata } from './index';
import { Inject } from 'services';
import { CustomizationService } from 'services/customization';

@Component({
  components: { codemirror },
})
export default class CodeInput extends BaseInput<string, IInputMetadata> {
  @Prop({ default: '' })
  readonly value: string;
  @Prop()
  readonly title: string;
  @Prop({ default: () => ({ type: 'html' }) })
  readonly metadata: IInputMetadata;

  @Inject() customizationService: CustomizationService;

  get theme() {
    return this.customizationService.isDarkTheme ? 'material' : 'xq-light';
  }

  // codemirror options
  editorOptions = {
    html: {
      mode: 'htmlmixed',
      keyMap: 'sublime',
      lineNumbers: true,
      autofocus: true,
      tabSize: 2,
      theme: this.theme,
      autoRefresh: true,
      autoCloseBrackets: true,
      matchBrackets: true,
      autoCloseTags: true,
      extraKeys: {
        Tab: 'emmetExpandAbbreviation',
        Enter: 'emmetInsertLineBreak',
      },
    },

    css: {
      mode: 'text/css',
      keyMap: 'sublime',
      lineNumbers: true,
      autofocus: true,
      tabSize: 2,
      theme: this.theme,
      autoRefresh: true,
      autoCloseBrackets: true,
      matchBrackets: true,
      autoCloseTags: true,
      extraKeys: {
        Tab: 'emmetExpandAbbreviation',
        Enter: 'emmetInsertLineBreak',
      },
    },

    js: {
      // codemirror options
      mode: 'javascript',
      keyMap: 'sublime',
      lineNumbers: true,
      autofocus: true,
      tabSize: 2,
      theme: this.theme,
      autoRefresh: true,
      autoCloseBrackets: true,
      matchBrackets: true,
      autoCloseTags: true,
    },
  };
}
