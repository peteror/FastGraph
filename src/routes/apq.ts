import type { Handler } from 'worktop'
import { SHA256, timingSafeEqual } from 'worktop/crypto'
import { isCacheable } from 'worktop/cache'
import { find, save } from '../stores/APQCache'
import { CacheHitHeader, Headers as HTTPHeaders, parseMaxAge } from '../utils'
import { HTTPResponseError } from '../errors'
import { GraphQLRequest } from './graphql'

declare const DEFAULT_TTL: string
const defaultMaxAgeInSeconds = parseInt(DEFAULT_TTL)

declare const APQ_TTL: string
const defaultAPQTTL = parseInt(APQ_TTL)

declare const ORIGIN_URL: string
const originUrl = ORIGIN_URL

declare const SWR: string
const swr = parseInt(SWR)

declare const IGNORE_ORIGIN_CACHE_HEADERS: string

type APQExtensions = {
  persistedQuery: {
    version: number
    sha256Hash: string
    variables?: Record<string, number | string>
  }
}

export const apq: Handler = async function (req, res) {
  const extensionsRawJson = req.query.get('extensions')

  if (!extensionsRawJson) {
    return res.send(400, {
      error: 'Invalid APQ request',
    })
  }

  const { persistedQuery } = JSON.parse(extensionsRawJson) as APQExtensions

  if (persistedQuery.version !== 1) {
    return res.send(400, 'Unsupported persisted query version')
  }

  let query = req.query.get('query')

  const result = await find(persistedQuery.sha256Hash)
  if (result) {
    query = result.query
  }

  // if query could not be found in cache, we will assume
  // the next action is to register the APQ
  if (!result) {
    // check if APQ hash is matching with the query hash
    if (query) {
      if (
        !timingSafeEqual(
          Buffer.from(await SHA256(query)),
          Buffer.from(persistedQuery.sha256Hash),
        )
      ) {
        return res.send(400, 'provided sha does not match query')
      }
      // Alias for `event.waitUntil`
      // ~> queues background task (does NOT delay response)
      req.extend(
        save(
          persistedQuery.sha256Hash,
          {
            query,
          },
          defaultAPQTTL,
        ),
      )
    } else {
      // when APQ could not be found the client must retry with the original query
      return res.send(200, {
        data: {
          errors: [
            {
              extensions: {
                code: 'PERSISTED_QUERY_NOT_FOUND',
              },
            },
          ],
        },
      })
    }
  }

  let operationName = req.query.get('operationName')
  let variables = req.query.get('variables')

  const q = query!
  const body: GraphQLRequest = { query: q }

  if (operationName) {
    body.operationName = operationName
  }
  if (variables) {
    body.variables = JSON.parse(variables)
  }

  const originResponse = await fetch(originUrl, {
    body: JSON.stringify(body),
    headers: req.headers,
    method: 'POST',
  })

  if (!originResponse.ok) {
    throw new HTTPResponseError(originResponse)
  }

  const ignoreOriginCacheHeaders = IGNORE_ORIGIN_CACHE_HEADERS === '1'

  const cacheControlHeader = originResponse.headers.get(
    HTTPHeaders.cacheControl,
  )

  let cacheMaxAge = defaultMaxAgeInSeconds
  const headers: Record<string, string> = {
    [HTTPHeaders.cacheControl]: `public, max-age=${cacheMaxAge}, stale-if-error=60, stale-while-revalidate=${swr}`,
    [HTTPHeaders.contentType]: 'application/json',
    [HTTPHeaders.fgOriginStatusCode]: originResponse.status.toString(),
    [HTTPHeaders.fgOriginStatusText]: originResponse.statusText.toString(),
  }

  if (ignoreOriginCacheHeaders === false && cacheControlHeader) {
    headers[HTTPHeaders.cacheControl] = cacheControlHeader
  }

  return res.send(200, await originResponse.json(), headers)
}
