/**
 * Token storage for the JWT pair.
 *
 * SECURITY: tokens live in `sessionStorage`, NOT `localStorage`.
 * A stolen XSS payload can still read sessionStorage during the session, but
 * `localStorage` persists the tokens across browser restarts and on shared
 * machines, which widens the blast radius enormously. sessionStorage is wiped
 * when the tab closes, so a leaked token expires with the browsing session.
 *
 * The long-term fix (tracked separately) is moving the refresh token to an
 * httpOnly cookie set by SimpleJWT (`SET_REFRESH_COOKIE`) so scripts cannot
 * read it at all; until the backend ships that cookie flow, sessionStorage is
 * the strict improvement over the previous localStorage implementation.
 */
const ACCESS_TOKEN_KEY = "tams_access_token";
const REFRESH_TOKEN_KEY = "tams_refresh_token";

let sessionVersion = 0;

export const tokenStorage = {
  getSessionVersion: () => sessionVersion,
  getAccessToken: () => sessionStorage.getItem(ACCESS_TOKEN_KEY),
  setAccessToken: (token: string) =>
    sessionStorage.setItem(ACCESS_TOKEN_KEY, token),
  getRefreshToken: () => sessionStorage.getItem(REFRESH_TOKEN_KEY),
  setRefreshToken: (token: string) =>
    sessionStorage.setItem(REFRESH_TOKEN_KEY, token),
  setTokens: (access: string, refresh: string) => {
    sessionVersion += 1;
    sessionStorage.setItem(ACCESS_TOKEN_KEY, access);
    sessionStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  },
  clearTokens: () => {
    sessionVersion += 1;
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};
