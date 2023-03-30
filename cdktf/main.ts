import path from "path";
import { Image as DockerImage } from "@cdktf/provider-docker/lib/image";
import { DockerProvider } from "@cdktf/provider-docker/lib/provider";
import { RegistryImage as DockerRegistryImage } from "@cdktf/provider-docker/lib/registry-image";
import { App, TerraformStack, Fn } from "cdktf";
import { Construct } from "constructs";
import { App as FlyApp } from "../.gen/providers/fly/app";
import { Ip as FlyIp } from "../.gen/providers/fly/ip";
import { Machine as FlyMachine } from "../.gen/providers/fly/machine";
import { FlyProvider } from "../.gen/providers/fly/provider";

export class MyStack extends TerraformStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    new FlyProvider(this, "fly", {
      useinternaltunnel: true,
      internaltunnelorg: "personal",
      internaltunnelregion: "ams",
    });

    new DockerProvider(this, "docker", {
      registryAuth: [
        {
          address: "registry.fly.io",
          configFile: Fn.pathexpand("~/.docker/config.json"),
        },
      ],
    });

    const image = new DockerImage(this, "image", {
      name: "registry.fly.io/strava-weather-app:1",
      buildAttribute: {
        context: path.resolve(__dirname, "../"),
      },
    });

    const registry = new DockerRegistryImage(this, "registry-image", {
      name: image.name,
    });

    const app = new FlyApp(this, "app", {
      name: "strava-weather-app2",
      org: "personal",
    });

    new FlyIp(this, "ipv4", {
      app: app.name,
      type: "v4",
    });

    new FlyIp(this, "ipv6", {
      app: app.name,
      type: "v6",
    });

    new FlyMachine(this, "machine", {
      app: app.name,
      region: "ams",
      name: `${app.name}-ams`,
      image: image.name,
      services: [
        {
          ports: [
            {
              port: 443,
              handlers: ["tls", "http"],
            },
            {
              port: 80,
              handlers: ["http"],
            },
          ],
          protocol: "tcp",
          internalPort: 80,
        },
      ],
      cpus: 1,
      memorymb: 256,
      dependsOn: [registry],
    });
  }
}

const app = new App();

new MyStack(app, "strava-weather-app");

app.synth();
