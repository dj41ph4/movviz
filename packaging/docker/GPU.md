# GPU/iGPU on a Linux NAS

Run the Compose deployment from the NAS host with:

```sh
cd packaging/docker
docker compose pull
sh up.sh
```

`up.sh` checks for the character device `/dev/dri/renderD128`. When present, it
adds `docker-compose.gpu.yml`, maps `/dev/dri` into the container and passes
the device's numeric group ID to Movviz. The entrypoint adds the runtime user
to that group before starting the app. Without the device, the normal Compose
file is used and Movviz can still play and transcode on the CPU. Run `sh up.sh`
again after each image update; pulling an image alone cannot change an
already-created container's device mappings.

If you use Synology Container Manager or another GUI instead of Compose,
configure the device mapping `/dev/dri:/dev/dri` in the container/project and
grant its user access to the host render device group. An image update in the
GUI cannot add that mapping for you. The GPU must also be exposed by the NAS
kernel and supported by the FFmpeg build inside the image. Movviz verifies a
real hardware encode and uses the CPU when it fails.

NVIDIA GPUs require the NVIDIA container runtime/toolkit and a separate Docker
GPU configuration. This `/dev/dri` override is for Linux DRM devices such as
Intel/AMD iGPUs.

## NAS Linux : GPU/iGPU

Depuis le NAS, `docker compose pull` puis `sh up.sh` dans `packaging/docker`
activent automatiquement le mapping si `/dev/dri/renderD128` est présent.
Relancez `sh up.sh` après chaque mise à jour de l'image. Dans Container Manager,
il faut configurer le mapping et les droits du groupe manuellement une fois ;
la mise à jour de l'image seule ne peut pas modifier les périphériques du
conteneur. Sans périphérique utilisable, Movviz conserve le transcodage CPU.
