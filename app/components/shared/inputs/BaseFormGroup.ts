import { ErrorField } from 'vee-validate';
import { EInputType, IInputMetadata } from './index';
import { BaseInput } from './BaseInput';

/**
 * Base class for input-component layouts
 */
export default abstract class BaseFormGroup extends BaseInput<any, IInputMetadata> {
  abstract readonly type: EInputType;
  abstract readonly value: undefined;
  abstract readonly metadata: IInputMetadata;
  abstract readonly title: string;

  inputErrors: ErrorField[] = [];

  created() {
    if (!this.form) return;

    // if type is not defined that means we can have several components in slot
    // these components must care about how to send an input-event to a form themselves
    if (!this.options.type) this.delegateChildrenEvents = false;

    // collect errors
    this.form.validated.subscribe(errors => {
      this.inputErrors = errors.filter(error => error.field === this.options.uuid);
    });
  }

  get formInputMetadata() {
    const options = this.options;
    if (!options.type) return {};
    const inputMetadata = options;

    // FormGroup handle the render of the FormInput title
    // so remove the title from FormInput metadata
    delete inputMetadata.title;
    delete inputMetadata.tooltip;
    delete inputMetadata.description;
    return inputMetadata;
  }

  getOptions() {
    const options = super.getOptions();
    // add `type` to options
    options.type = this.type || options.type;
    return options;
  }
}
