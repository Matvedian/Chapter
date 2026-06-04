import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.chapter.app',
  appName: 'chapter',
  webDir: 'dist',
  plugins: {
    Browser: {
      presentationStyle: 'popover',
    },
  },
};

export default config;
