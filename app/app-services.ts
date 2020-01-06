/**
 * All services must be registered in this file
 */

// OFFLINE SERVICES
export { AppService } from 'services/app';
export { InternalApiService } from 'services/api/internal-api';
export { ExternalApiService } from 'services/api/external-api';
export { SourcesService, Source } from 'services/sources';
export { Scene, SceneItem, SceneItemFolder, SceneItemNode, ScenesService } from 'services/scenes';
export { ObsImporterService } from 'services/obs-importer';
export { ClipboardService } from 'services/clipboard';
export { AudioService, AudioSource } from 'services/audio';
export { HostsService, UrlService } from 'services/hosts';
export { Hotkey, HotkeysService } from 'services/hotkeys';
export { KeyListenerService } from 'services/key-listener';
export { ShortcutsService } from 'services/shortcuts';
export { CustomizationService } from 'services/customization';
export { LayoutService } from 'services/layout';
export { NotificationsService } from 'services/notifications';
export { OnboardingService } from 'services/onboarding';
export { NavigationService } from 'services/navigation';
export { PerformanceService } from 'services/performance';
export { SettingsService, OutputSettingsService } from 'services/settings';
export { VideoService } from 'services/video';
export { WindowsService } from 'services/windows';
export { TransitionsService } from 'services/transitions';
export { FontLibraryService } from 'services/font-library';
export { SourceFiltersService } from 'services/source-filters';
export { CacheUploaderService } from 'services/cache-uploader';
export { TcpServerService } from 'services/api/tcp-server';
export { IpcServerService } from 'services/api/ipc-server';
export { JsonrpcService } from 'services/api/jsonrpc';
export { DismissablesService } from 'services/dismissables';
export { SceneCollectionsServerApiService } from 'services/scene-collections/server-api';
export { SceneCollectionsService } from 'services/scene-collections';
export { TroubleshooterService } from 'services/troubleshooter';
export { Selection, SelectionService } from 'services/selection';
export { OverlaysPersistenceService } from 'services/scene-collections/overlays';
export { SceneCollectionsStateService } from 'services/scene-collections/state';
export { FileManagerService } from 'services/file-manager';
export { ProtocolLinksService } from 'services/protocol-links';
export { ProjectorService } from 'services/projector';
export { I18nService } from 'services/i18n';
export { ObsUserPluginsService } from 'services/obs-user-plugins';
export { HardwareService, DefaultHardwareService } from 'services/hardware';
export { Prefab, PrefabsService } from 'services/prefabs';
export { EditorCommandsService } from 'services/editor-commands';
export { StreamSettingsService } from 'services/settings/streaming';

// ONLINE SERVICES
export { UserService } from './services/user';
export { YoutubeService } from 'services/platforms/youtube';
export { TwitchService } from 'services/platforms/twitch';
export { MixerService } from 'services/platforms/mixer';
export { FacebookService } from 'services/platforms/facebook';
export { RestreamService } from 'services/restream';
export { TwitterService } from 'services/integrations/twitter';
export { UsageStatisticsService } from './services/usage-statistics';

export { MediaGalleryService } from 'services/media-gallery';
export { GuestApiService } from 'services/guest-api';
export { MediaBackupService } from 'services/media-backup';
export { OutageNotificationsService } from 'services/outage-notifications';
export { AnnouncementsService } from 'services/announcements';
export { BrandDeviceService } from 'services/auto-config/brand-device';
export { WebsocketService } from 'services/websocket';
export { IncrementalRolloutService } from 'services/incremental-rollout';
export { CrashReporterService } from 'services/crash-reporter';
export { PatchNotesService } from 'services/patch-notes';
export { VideoEncodingOptimizationService } from 'services/video-encoding-optimizations';
export { StreamInfoService } from './services/stream-info';
export { StreamingService } from 'services/streaming';
export { StreamlabelsService } from 'services/streamlabels';
export { AutoConfigService } from 'services/auto-config';
export { FacemasksService } from 'services/facemasks';
export { PlatformAppsService } from 'services/platform-apps';
export { PlatformAppStoreService } from 'services/platform-app-store';
export { PlatformAppAssetsService } from 'services/platform-apps/platform-app-assets-service';
export { ChatService } from 'services/chat';
export { RecentEventsService } from 'services/recent-events';
export { MagicLinkService } from 'services/magic-link';

// WIDGETS
export { WidgetSource, WidgetsService } from './services/widgets';
export { BitGoalService } from 'services/widgets/settings/bit-goal';
export { ChatBoxService } from 'services/widgets/settings/chat-box';
export { DonationGoalService } from 'services/widgets/settings/donation-goal';
export { FollowerGoalService } from 'services/widgets/settings/follower-goal';
export { StarsGoalService } from 'services/widgets/settings/stars-goal';
export { SupporterGoalService } from 'services/widgets/settings/supporter-goal';
export { ViewerCountService } from 'services/widgets/settings/viewer-count';
export { StreamBossService } from 'services/widgets/settings/stream-boss';
export { DonationTickerService } from 'services/widgets/settings/donation-ticker';
export { CreditsService } from 'services/widgets/settings/credits';
export { EventListService } from 'services/widgets/settings/event-list';
export { TipJarService } from 'services/widgets/settings/tip-jar';
export { SponsorBannerService } from 'services/widgets/settings/sponsor-banner';
export { SubGoalService } from 'services/widgets/settings/sub-goal';
export { MediaShareService } from 'services/widgets/settings/media-share';
export { AlertBoxService } from 'services/widgets/settings/alert-box';
export { SpinWheelService } from 'services/widgets/settings/spin-wheel';

export { GameOverlayService } from 'services/game-overlay';
