import path from 'path';
import glob from 'glob';
import { Image as DockerImage } from '@cdktf/provider-docker/lib/image';
import { DockerProvider } from '@cdktf/provider-docker/lib/provider';
import { RegistryImage as DockerRegistryImage } from '@cdktf/provider-docker/lib/registry-image';
import { App, CloudBackend, NamedCloudWorkspace, TerraformStack, Fn } from 'cdktf';
import { Construct } from 'constructs';
import { App as FlyApp } from '../.gen/providers/fly/app';
import { Ip as FlyIp } from '../.gen/providers/fly/ip';
import { Machine as FlyMachine } from '../.gen/providers/fly/machine';
import { FlyProvider } from '../.gen/providers/fly/provider';
import { Volume as FlyVolume } from '../.gen/providers/fly/volume';
import { StravaProvider } from '../.gen/providers/strava/provider';
import { PushSubscription as StravaPushSubscription } from '../.gen/providers/strava/push-subscription';

export class MyStack extends TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    const region = 'ams';
    const registryUrl = 'registry.fly.io';

    new CloudBackend(this, {
      organization: 'floydspace',
      workspaces: new NamedCloudWorkspace(name),
    });

    new StravaProvider(this, 'strava');

    new FlyProvider(this, 'fly', {
      useinternaltunnel: true,
      internaltunnelorg: 'personal',
      internaltunnelregion: region,
    });

    new DockerProvider(this, 'docker', {
      registryAuth: [
        {
          address: registryUrl,
          username: 'x', // See why https://github.com/superfly/flyctl/blob/4ab254962153a30bf6dc0e73efb88bfaafc916ec/internal/command/auth/docker.go#L92
          password: process.env.FLY_API_TOKEN,
        },
      ],
    });

    const cwd = path.resolve(__dirname, '../');
    const srcFiles = [...glob.sync('utils/*.py', { cwd }), 'Dockerfile', 'requirements.txt', 'run.py'];

    const image = new DockerImage(this, 'image', {
      name: `${registryUrl}/${name}:dev`,
      buildAttribute: { context: cwd },
      triggers: srcFiles.reduce(
        (acc, file) => ({ ...acc, [file]: Fn.filemd5(path.resolve(cwd, file)) }),
        {} as Record<string, string>
      ),
    });

    const registry = new DockerRegistryImage(this, 'registry-image', {
      name: image.name,
    });

    const app = new FlyApp(this, 'app', {
      name: name,
      org: 'personal',
      secrets: {
        SECRET_KEY: { value: process.env.SECRET_KEY! },
        API_WEATHER_KEY: { value: process.env.API_WEATHER_KEY! },
        STRAVA_CLIENT_ID: { value: process.env.STRAVA_CLIENT_ID! },
        STRAVA_CLIENT_SECRET: { value: process.env.STRAVA_CLIENT_SECRET! },
        STRAVA_WEBHOOK_TOKEN: { value: process.env.STRAVA_WEBHOOK_TOKEN! },
      },
    });

    // new FlyIp(this, 'ipv4', { app: app.name, type: 'v4' });
    new FlyIp(this, 'ipv6', { app: app.name, type: 'v6' });

    const volume = new FlyVolume(this, 'volume', {
      app: app.name,
      name: `${name.replace(/-/g, '_')}_data`,
      region: region,
      size: 1,
    });

    new FlyMachine(this, 'machine', {
      app: app.name,
      region: region,
      name: `${app.name}-${region}`,
      image: registry.name,
      env: {
        DATABASE: process.env.DATABASE!,
        PRIMARY_REGION: region,
      },
      services: [
        {
          ports: [
            { port: 80, handlers: ['http'] },
            { port: 443, handlers: ['tls', 'http'] },
          ],
          protocol: 'tcp',
          internalPort: 8000,
        },
      ],
      mounts: [
        {
          volume: volume.id,
          encrypted: true,
          path: '/usr/src/app/data',
          sizeGb: 1,
        },
      ],
      cpus: 1,
      cputype: 'shared',
      memorymb: 256,
    });

    new StravaPushSubscription(this, 'push-subscription', {
      callbackUrl: `https://${app.hostname}/webhook`,
      verifyToken: process.env.STRAVA_WEBHOOK_TOKEN!,
    });
  }
}

const app = new App();

// new MyStack(app, 'strava-weather-app-dev');
new MyStack(app, 'strava-weather-app');

app.synth();
