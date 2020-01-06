import { mutation, StatefulService } from '../core/stateful-service';
import * as obs from '../../../obs-api';
import uuid from 'uuid/v4';

export enum EDeviceType {
  audioInput = 'audioInput',
  audioOutput = 'audioOutput',
  videoInput = 'videoInput',
}

export interface IDevice {
  id: string;
  type: EDeviceType;
  description: string;
}

export interface IHardwareServiceState {
  devices: IDevice[];
  dshowDevices: IDevice[]; // dhow_input operates with the different devices list
}

export class HardwareService extends StatefulService<IHardwareServiceState> {
  static initialState: IHardwareServiceState = {
    devices: [],
    dshowDevices: [],
  };

  init() {
    this.SET_DEVICES(this.fetchDevices());
  }

  getDevices() {
    return this.state.devices;
  }

  getDshowDevices() {
    return this.state.dshowDevices;
  }

  getDshowDevice(id: string) {
    return this.state.dshowDevices.find(device => device.id === id);
  }

  getDeviceByName(name: string) {
    return this.state.devices.find(device => device.description === name);
  }

  getDshowDeviceByName(name: string) {
    return this.state.dshowDevices.find(device => device.description === name);
  }

  private fetchDevices(): IHardwareServiceState {
    const devices: IDevice[] = [];
    const dshowDevices: IDevice[] = [];

    // Avoid initializing any devices by passing a device id that doesn't exist
    const obsAudioInput = obs.InputFactory.create('wasapi_input_capture', uuid(), {
      device_id: 'does_not_exist',
    });
    const obsAudioOutput = obs.InputFactory.create('wasapi_output_capture', uuid(), {
      device_id: 'does_not_exist',
    });
    const obsVideoInput = obs.InputFactory.create('dshow_input', uuid(), {
      audio_device_id: 'does_not_exist',
      video_device_id: 'does_not_exist',
    });

    (obsAudioInput.properties.get('device_id') as obs.IListProperty).details.items.forEach(
      (item: { name: string; value: string }) => {
        devices.push({
          id: item.value,
          description: item.name,
          type: EDeviceType.audioInput,
        });
      },
    );

    (obsAudioOutput.properties.get('device_id') as obs.IListProperty).details.items.forEach(
      (item: { name: string; value: string }) => {
        devices.push({
          id: item.value,
          description: item.name,
          type: EDeviceType.audioOutput,
        });
      },
    );

    (obsVideoInput.properties.get('video_device_id') as obs.IListProperty).details.items.forEach(
      (item: { name: string; value: string }) => {
        dshowDevices.push({
          id: item.value,
          description: item.name,
          type: EDeviceType.videoInput,
        });
      },
    );

    const audioDeviceIdProp = obsVideoInput.properties.get('audio_device_id') as obs.IListProperty;
    // audioDeviceIdProp can be null if no devices exist
    if (audioDeviceIdProp) {
      audioDeviceIdProp.details.items.forEach((item: { name: string; value: string }) => {
        dshowDevices.push({
          id: item.value,
          description: item.name,
          type: EDeviceType.audioInput,
        });
      });
    }

    obsAudioInput.release();
    obsAudioOutput.release();
    obsVideoInput.release();
    return { devices, dshowDevices };
  }

  @mutation()
  private SET_DEVICES(devices: IHardwareServiceState) {
    this.state.devices = devices.devices;
    this.state.dshowDevices = devices.dshowDevices;
  }
}
