// Datadog RUM init — bundled by Agent 1 (esbuild) to rum-init.js.
// NOTE: keep `version` in step with the `version` field in package.json (1.0.0).
// The clientToken below is a public browser token meant to be embedded in the site.

import { datadogRum } from '@datadog/browser-rum';

try {
  datadogRum.init({
    applicationId: 'a3caa3ee-c97f-4ad1-b73f-88f0b332c8dd',
    clientToken: 'pub64f4157a783a60c869656001071c84ac',
    remoteConfiguration: {
      id: 'ecf1ba7e-43a0-4d4f-8c3a-9efb501107ff',
    },
    site: 'us3.datadoghq.com',
    service: 'bfung.github.io',
    env: 'prod',
    version: '1.0.0',
    sessionSampleRate: 100,
    sessionReplaySampleRate: 20,
    trackResources: true,
    trackUserInteractions: true,
    trackLongTasks: true,
  });
} catch (error) {
  // RUM must never break the page if it fails to initialise.
  console.error('Datadog RUM failed to initialise:', error);
}
