import { Service } from './core/service';
import Util from 'services/utils';
import { Inject } from './core/injector';

// Hands out hostnames to the rest of the app. Eventually
// we should allow overriding this value. But for now we
// are just keeping the value in one place.
export class HostsService extends Service {
  get streamlabs() {
    if (Util.useLocalHost()) {
      return 'streamlabs.site';
    }
    return 'streamlabs.com';
  }

  get overlays() {
    if (Util.isPreview()) {
      return 'beta-overlays.streamlabs.com';
    }
    return 'overlays.streamlabs.com';
  }

  get media() {
    return 'media.streamlabs.com';
  }

  get facemaskCDN() {
    return 'facemasks-cdn.streamlabs.com/';
  }

  get io() {
    if (Util.useLocalHost()) {
      return 'http://io.streamlabs.site:4567';
    }
    return 'https://aws-io.streamlabs.com';
  }

  get cdn() {
    return 'cdn.streamlabs.com';
  }

  get platform() {
    return 'platform.streamlabs.com';
  }

  get analitycs() {
    return 'r2d2.streamlabs.com';
  }
}

export class UrlService extends Service {
  @Inject('HostsService') private hosts: HostsService;

  get protocol() {
    return Util.useLocalHost() ? 'http://' : 'https://';
  }

  getStreamlabsApi(endpoint: string) {
    return `${this.protocol}${this.hosts.streamlabs}/api/v5/slobs/${endpoint}`;
  }
}
