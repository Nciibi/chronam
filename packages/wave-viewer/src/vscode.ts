import type { WebviewToExtensionMessage } from '@chronam/shared-types';

interface WebviewApi {
  postMessage(message: WebviewToExtensionMessage): void;
  getState(): any;
  setState(state: any): void;
}

declare function acquireVsCodeApi(): WebviewApi;

let vscodeApi: WebviewApi | undefined;

export function getVSCodeApi(): WebviewApi {
  if (!vscodeApi) {
    if (typeof acquireVsCodeApi === 'function') {
      vscodeApi = acquireVsCodeApi();
    } else {
      // Mock for browser development
      vscodeApi = {
        postMessage: (message) => console.log('postMessage', message),
        getState: () => ({}),
        setState: (state) => console.log('setState', state),
      };
    }
  }
  return vscodeApi;
}

export function postMessage(message: WebviewToExtensionMessage) {
  getVSCodeApi().postMessage(message);
}
