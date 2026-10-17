/// <reference types="vite/client" />

import { MypostAPI } from '../../preload';

declare global {
  interface Window {
    mypostAPI: MypostAPI;
  }
}
