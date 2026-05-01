import {AppController} from './app-controller.js';

async function main() {
  const app = new AppController();
  await app.initialize();
}

main().catch((error) => {
  const status = document.querySelector('#route-status');

  if (status) {
    status.textContent = 'Map failed to initialize. Check network access and reload.';
    status.dataset.tone = 'warning';
  }

  console.error(error);
});
