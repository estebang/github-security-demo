import { useSpectron, test } from '../helpers/spectron';
import { getClient } from '../helpers/api-client';
import { IAudioServiceApi } from 'services/audio';
import { ScenesService } from 'services/scenes';
import { ISceneCollectionsServiceApi } from 'services/scene-collections';
import { IJsonRpcEvent } from '../../app/services/api/jsonrpc';

useSpectron({ restartAppAfterEachTest: false });

test('The default sources exists', async t => {
  const client = await getClient();
  const audioService = client.getResource<IAudioServiceApi>('AudioService');
  const audioSources = audioService.getSourcesForCurrentScene();

  t.is(audioSources.length, 2);
});

test('The sources with audio have to be appeared in AudioService', async t => {
  const client = await getClient();
  const scenesService = client.getResource<ScenesService>('ScenesService');
  const audioService = client.getResource<IAudioServiceApi>('AudioService');

  const scene = scenesService.activeScene;
  scene.createAndAddSource('MyAudio', 'wasapi_output_capture');
  const audioSources = audioService.getSourcesForCurrentScene();

  t.is(audioSources.length, 3);
});

test('The audio sources have to keep settings after application restart', async t => {
  const client = await getClient();
  const scenesService = client.getResource<ScenesService>('ScenesService');
  const audioService = client.getResource<IAudioServiceApi>('AudioService');
  const sceneCollectionsService = client.getResource<ISceneCollectionsServiceApi>(
    'SceneCollectionsService',
  );

  const scene = scenesService.activeScene;
  const source = scene.createAndAddSource('MyMic', 'wasapi_input_capture');
  const audioSource = audioService.getSource(source.sourceId);

  audioSource.setSettings({
    audioMixers: 1,
    monitoringType: 1,
    forceMono: true,
    syncOffset: 10,
    muted: true,
  });

  const audioSourceModel = audioSource.getModel();

  // reload config
  await sceneCollectionsService.load(sceneCollectionsService.collections[0].id);

  const loadedAudioSourceModel = audioService.getSource(source.sourceId).getModel();

  t.deepEqual(audioSourceModel, loadedAudioSourceModel);
});

test('Events are emitted when the audio source is updated', async t => {
  const client = await getClient();
  const scenesService = client.getResource<ScenesService>('ScenesService');
  const audioService = client.getResource<IAudioServiceApi>('AudioService');

  const scene = scenesService.activeScene;
  const sceneItem = scene.createAndAddSource('MyAudio', 'wasapi_output_capture');
  const sourceId = sceneItem.getSource().sourceId;

  const watcher = client.watchForEvents(['AudioService.audioSourceUpdated']);
  audioService.getSource(sourceId).setDeflection(0.5);
  await watcher.waitForAll();
  t.is(watcher.receivedEvents[0].data.fader.deflection, 0.5);
});
