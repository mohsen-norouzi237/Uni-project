/// <reference types="vite/client" />

/** Typed environment variables: a typo in `import.meta.env` is now a compile error. */
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  /** 'true' enables the mock service layer. */
  readonly VITE_USE_MOCKS?: string;
  /** Role used by the mock login, so every role path can be exercised. */
  readonly VITE_MOCK_ROLE?:
    | 'super_admin'
    | 'dept_admin'
    | 'professor'
    | 'head_ta'
    | 'ta';
  /**
   * 'true' mounts the dev-only /preview UI-kit routes. They stay behind
   * ProtectedRoute even when enabled, and are stripped from prod builds.
   */
  readonly VITE_ENABLE_PREVIEW?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
