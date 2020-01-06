import { useSpectron, test } from '../helpers/spectron';
import { getClient } from '../helpers/api-client';
import { TransitionsService } from 'services/api/external-api/transitions';

useSpectron({ restartAppAfterEachTest: false });

test('Transitions', async t => {
  const api = await getClient();
  const transitionsService = api.getResource<TransitionsService>('TransitionsService');

  // test enable studio mode
  let eventWatcher = api.watchForEvents(['TransitionsService.studioModeChanged']);
  transitionsService.enableStudioMode();
  await eventWatcher.waitForAll();
  t.true(eventWatcher.receivedEvents[0].data);
  t.true(transitionsService.getModel().studioMode);

  // test disable studio mode
  eventWatcher = api.watchForEvents(['TransitionsService.studioModeChanged']);
  transitionsService.disableStudioMode();
  await eventWatcher.waitForAll();
  t.false(eventWatcher.receivedEvents[0].data);
  t.false(transitionsService.getModel().studioMode);
});
