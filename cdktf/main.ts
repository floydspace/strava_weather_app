import path from 'path';
import { Image as DockerImage } from '@cdktf/provider-docker/lib/image';
import { DockerProvider } from '@cdktf/provider-docker/lib/provider';
import { RegistryImage as DockerRegistryImage } from '@cdktf/provider-docker/lib/registry-image';
import { App, CloudBackend, Fn, NamedCloudWorkspace, TerraformStack } from 'cdktf';
import { Construct } from 'constructs';
import { App as FlyApp } from '../.gen/providers/fly/app';
import { Ip as FlyIp } from '../.gen/providers/fly/ip';
import { Machine as FlyMachine } from '../.gen/providers/fly/machine';
import { FlyProvider } from '../.gen/providers/fly/provider';
// import { Volume as FlyVolume } from '../.gen/providers/fly/volume';
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
          configFile: Fn.pathexpand('~/.docker/config.json'),
        },
      ],
    });

    const image = new DockerImage(this, 'image', {
      name: `${registryUrl}/${name}:deployment-${Date.now()}`,
      buildAttribute: { context: path.resolve(__dirname, '../') },
    });

    const registry = new DockerRegistryImage(this, 'registry-image', {
      name: image.name,
    });

    const app = new FlyApp(this, 'app', {
      name: name,
      org: 'personal',
      provisioners: [
        {
          type: 'local-exec',
          command:
            `fly secrets -a ${name} set ` +
            `SECRET_KEY=${process.env.SECRET_KEY} ` +
            `API_WEATHER_KEY=${process.env.API_WEATHER_KEY} ` +
            `STRAVA_CLIENT_ID=${process.env.STRAVA_CLIENT_ID} ` +
            `STRAVA_CLIENT_SECRET=${process.env.STRAVA_CLIENT_SECRET} ` +
            `STRAVA_WEBHOOK_TOKEN=${process.env.STRAVA_WEBHOOK_TOKEN} `,
          when: 'create',
        },
      ],
    });

    // new FlyIp(this, 'ipv4', { app: app.name, type: 'v4' });
    new FlyIp(this, 'ipv6', { app: app.name, type: 'v6' });

    // new FlyVolume(this, 'volume', {
    //   app: app.name,
    //   name: `${name.replace(/-/g, '_')}_data`,
    //   region: region,
    //   size: 1,
    // });

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
      // mounts: [
      //   {
      //     volume: volume.id,
      //     encrypted: true,
      //     path: '/usr/src/app/data',
      //     sizeGb: 1,
      //   },
      // ],
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
