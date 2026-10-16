/// <reference types="vite/client" />
interface Window {
  electron?: {
    isDesktop: boolean;
    platform: string;
    version: string;
    readSettings: (name: string) => string | null;
    writeSettings: (name: string, value: string | null) => void;
  };
}
