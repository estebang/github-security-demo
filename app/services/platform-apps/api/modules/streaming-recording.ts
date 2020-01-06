import { Module, EApiPermissions, apiMethod, apiEvent } from './module';
import { StreamingService, EStreamingState, ERecordingState } from 'services/streaming';
import { Inject } from 'services/core/injector';
import { Subject } from 'rxjs';
import { StreamInfoService } from 'services/stream-info';

interface IOutputState {
  streamingStatus: EStreamingState;
  streamingStatusTime: string;
  recordingStatus: ERecordingState;
  recordingStatusTime: string;
}

interface IStreamInfo {
  title: string;
  game: string;
  viewerCount: number;
}

export class StreamingRecordingModule extends Module {
  moduleName = 'StreamingRecording';
  permissions = [EApiPermissions.Streaming];

  @Inject() streamingService: StreamingService;
  @Inject() streamInfoService: StreamInfoService;

  constructor() {
    super();
    this.streamingService.streamingStatusChange.subscribe(() => {
      this.outputStateChanged.next(this.streamingService.state);
    });
    this.streamingService.recordingStatusChange.subscribe(() => {
      this.outputStateChanged.next(this.streamingService.state);
    });
    this.streamInfoService.streamInfoChanged.subscribe(() => {
      this.streamInfoChanged.next(this.serializeStreamInfo());
    });
  }

  @apiEvent()
  outputStateChanged = new Subject<IOutputState>();

  @apiEvent()
  streamInfoChanged = new Subject<IStreamInfo>();

  @apiMethod()
  getOutputState(): IOutputState {
    return this.streamingService.state;
  }

  @apiMethod()
  getStreamInfo(): IStreamInfo {
    return this.serializeStreamInfo();
  }

  private serializeStreamInfo(): IStreamInfo {
    return {
      title: this.streamInfoService.state.title,
      game: this.streamInfoService.state.game,
      viewerCount: this.streamInfoService.state.viewerCount,
    };
  }
}
