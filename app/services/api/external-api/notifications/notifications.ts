import { NotificationsService as InternalNotificationsService } from 'services/notifications';
import { Inject } from 'services/core/injector';
import { Fallback, Singleton } from 'services/api/external-api';
import { IJsonRpcRequest } from 'services/api/jsonrpc';

enum ENotificationType {
  INFO = 'INFO',
  WARNING = 'WARNING',
  SUCCESS = 'SUCCESS',
}

enum ENotificationSubType {
  DEFAULT = 'DEFAULT',
  DISCONNECTED = 'DISCONNECTED',
  DROPPED = 'DROPPED',
  LAGGED = 'LAGGED',
  SKIPPED = 'SKIPPED',
}

interface INotificationOptions {
  message: string;
  code?: string;
  unread?: boolean;
  type?: ENotificationType;
  action?: IJsonRpcRequest;
  playSound?: boolean;
  data?: any;
  subType?: ENotificationSubType;

  /** The notification's life time in ms. Use -1 for infinity */
  lifeTime?: number;
  showTime?: boolean;
}

export interface INotificationModel extends INotificationOptions {
  id: number;
  type: ENotificationType;
  message: string;
  unread: boolean;
  date: number;
  playSound: boolean;
  lifeTime: number;
  showTime: boolean;
  subType: ENotificationSubType;
}

export interface INotificationsSettings {
  enabled: boolean;
  playSound: boolean;
}

@Singleton()
export class NotificationsService {
  @Fallback()
  @Inject()
  protected notificationsService: InternalNotificationsService;

  push(notifyInfo: INotificationOptions): INotificationModel {
    return this.notificationsService.push(notifyInfo);
  }

  getNotification(id: number): INotificationModel {
    return this.notificationsService.getNotification(id);
  }

  applyAction(notificationId: number) {
    return this.notificationsService.applyAction(notificationId);
  }

  getAll(type: ENotificationType): INotificationModel[] {
    return this.notificationsService.getAll(type);
  }

  getUnread(type: ENotificationType): INotificationModel[] {
    return this.notificationsService.getUnread(type);
  }

  getRead(type: ENotificationType): INotificationModel[] {
    return this.notificationsService.getRead(type);
  }

  markAsRead(id: number): void {
    return this.notificationsService.markAsRead(id);
  }

  markAllAsRead(): void {
    return this.notificationsService.markAllAsRead();
  }

  getSettings(): INotificationsSettings {
    return this.notificationsService.getSettings();
  }

  setSettings(patch: Partial<INotificationsSettings>): void {
    return this.notificationsService.setSettings(patch);
  }

  restoreDefaultSettings(): void {
    return this.notificationsService.restoreDefaultSettings();
  }

  showNotifications(): void {
    return this.notificationsService.showNotifications();
  }
}
