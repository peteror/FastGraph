export enum Headers {
  // GraphCDN
  gcdnCache = 'gcdn-cache',
  gcdnOriginStatusCode = 'gcdn-origin-status-code',
  gcdnOriginStatusText = 'gcdn-origin-status-text',
  gcdnOriginIgnoreCacheHeaders = 'gcdn-origin-ignore-cache-headers',
  gcdnScope = 'gcdn-scope',

  // Common
  setCookie = 'set-cookie',
  contentType = 'content-type',
  cacheControl = 'cache-control',
  date = 'date',
  age = 'age',
  xCache = 'x-cache',
  authorization = 'authorization',
  vary = 'vary',
  xRobotsTag = 'x-robots-tag',
  xFrameOptions = 'x-frame-options',

  // CORS
  accessControlAllowCredentials = 'access-control-allow-credentials',
  accessControlAllowHeaders = 'access-control-allow-headers',
  accessControlAllowMethods = 'access-control-allow-methods',
  accessControlAllowOrigin = 'access-control-allow-origin',
  accessControlExposeHeaders = 'access-control-expose-headers',
  accessControlMaxAge = 'access-control-max-age',

  // Security
  contentSecurityPolicy = 'content-security-policy',
  strictTransportSecurity = 'strict-transport-security',
}

export enum Scope {
  AUTHENTICATED = 'AUTHENTICATED',
  PUBLIC = 'PUBLIC',
}

export enum CacheHitHeader {
  MISS = 'MISS',
  HIT = 'HIT',
  PASS = 'PASS',
  ERROR = 'ERROR',
}

export const parseMaxAge = (header: string): number => {
  const matches = header.match(/max-age=(\d+)/)
  return matches ? parseInt(matches[1]) : -1
}

export function isResponseCachable(res: Response): boolean {
  if (res.status === 206) return false

  const vary = res.headers.get('vary') || ''
  if (!!~vary.indexOf('*')) return false

  const ccontrol = res.headers.get(Headers.cacheControl) || ''
  if (/(private|no-cache|no-store)/i.test(ccontrol)) return false

  return true
}
