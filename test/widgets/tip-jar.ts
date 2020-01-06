import { test, useSpectron } from '../helpers/spectron/index';
import { addSource } from '../helpers/spectron/sources';
import { logIn } from '../helpers/spectron/user';
import { sleep } from '../helpers/sleep';

useSpectron();

test('Set tip-jar settings', async t => {
  if (!(await logIn(t))) return;

  const client = t.context.app.client;
  await addSource(t, 'The Jar', '__The Jar', false);
  const martiniGlass = '[src="https://cdn.streamlabs.com/static/tip-jar/jars/glass-martini.png"]';
  const activeMartiniGlass =
    '.active img[src="https://cdn.streamlabs.com/static/tip-jar/jars/glass-martini.png"]';
  await client.waitForVisible(martiniGlass);
  await client.click(martiniGlass);
  await client.waitForVisible(activeMartiniGlass);
  t.pass();
});
