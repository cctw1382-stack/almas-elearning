declare module '*.css';

interface ImportMeta {
  readonly env: Readonly<Record<string, string | undefined>>;
}
