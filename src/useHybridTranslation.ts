import { useCallback, useEffect, useRef, useState } from 'react'
import { checkBackend, defaultBackendUrl, modelErrorMessage, requestModelTranslation } from './translationClient'
import type { DialectId } from './hospitalLexicon'
import type { BackendConnection, Direction, ModelHealth, SpeechBackend, Translation, TranslationRequest } from './translationTypes'

type LocalTranslator = (text: string, dialect: DialectId, direction: Direction) => Translation | null
const CACHE_TTL = 5 * 60_000

export function useHybridTranslation(localTranslate: LocalTranslator) {
  const [translation, setTranslation] = useState<Translation | null>(null)
  const [snapshot, setSnapshot] = useState<TranslationRequest | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [connection, setConnection] = useState<BackendConnection>({ url: defaultBackendUrl, token: '' })
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState('')
  const [canRetry, setCanRetry] = useState(false)
  const [healthMessage, setHealthMessage] = useState('')
  const [models, setModels] = useState<ModelHealth[]>([])
  const [asr, setAsr] = useState<SpeechBackend>({ configured: false })
  const [checking, setChecking] = useState(false)
  const requestRef = useRef<AbortController | null>(null)
  const healthRef = useRef<AbortController | null>(null)
  const knownDialects = useRef<Set<DialectId> | null>(null)
  const generationRef = useRef(0)
  const activeKey = useRef<string | null>(null)
  const cache = useRef(new Map<string, { result: Translation; expires: number }>())

  useEffect(() => () => {
    generationRef.current += 1
    requestRef.current?.abort()
    healthRef.current?.abort()
    cache.current.clear()
  }, [])

  const cancel = useCallback(() => {
    generationRef.current += 1
    requestRef.current?.abort()
    requestRef.current = null
    activeKey.current = null
    setPending(false)
    setNotice('')
    setCanRetry(false)
  }, [])

  const stop = useCallback(() => {
    cancel()
    setNotice('已停止模型翻译，保留词库参考。')
  }, [cancel])

  const reset = useCallback(() => {
    cancel()
    setTranslation(null)
    setSnapshot(null)
  }, [cancel])

  const restore = (request: TranslationRequest, result: Translation) => {
    cancel()
    setSnapshot({ ...request })
    setTranslation({ ...result })
  }
  const clearSession = () => { reset(); cache.current.clear() }

  const run = useCallback(async (text: string, dialect: DialectId, direction: Direction) => {
    const input = { text: text.trim(), dialect, direction }
    const key = JSON.stringify([input.text, dialect, direction, enabled])
    if (activeKey.current === key) return
    cancel()
    if (!input.text) { setTranslation(null); setSnapshot(null); return }
    setSnapshot(input)
    const now = Date.now()
    for (const [cacheKey, value] of cache.current) if (value.expires <= now) cache.current.delete(cacheKey)
    const cached = cache.current.get(key)
    if (cached) {
      cache.current.delete(key)
      cache.current.set(key, cached)
      setTranslation(cached.result)
      return
    }
    const remember = (result: Translation) => {
      cache.current.set(key, { result, expires: Date.now() + CACHE_TTL })
      while (cache.current.size > 20) cache.current.delete(cache.current.keys().next().value!)
    }
    const local = localTranslate(input.text, dialect, direction)
    setTranslation(local)
    if (!local) return
    if (local.confidence === 'phrase' || local.confidence === 'template' || !enabled) { remember(local); return }
    if (knownDialects.current && !knownDialects.current.has(dialect)) {
      setNotice('当前方言暂未接入整句翻译，已保留词库参考。')
      return
    }
    const controller = new AbortController()
    requestRef.current = controller
    activeKey.current = key
    const generation = generationRef.current
    setPending(true)
    setNotice('正在翻译，先显示词库参考…')
    try {
      const result = await requestModelTranslation(input, connection, controller.signal)
      if (generation === generationRef.current && !controller.signal.aborted) {
        remember(result)
        setTranslation(result)
        setNotice('模型翻译完成，请对照原文核对。')
      }
    } catch (error) {
      if (generation === generationRef.current && !controller.signal.aborted) {
        setNotice(modelErrorMessage(error))
        setCanRetry(true)
      }
    } finally {
      if (generation === generationRef.current) {
        setPending(false)
        requestRef.current = null
        activeKey.current = null
      }
    }
  }, [cancel, connection, enabled, localTranslate])

  const updateMode = (value: boolean) => {
    cancel()
    setSnapshot(null)
    setEnabled(value)
  }

  const updateConnection = (next: BackendConnection) => {
    cancel()
    setSnapshot(null)
    cache.current.clear()
    healthRef.current?.abort()
    knownDialects.current = null
    setConnection(next)
    setModels([])
    setAsr({ configured: false })
    setHealthMessage('')
    setChecking(false)
  }

  const check = async (probe = false) => {
    healthRef.current?.abort()
    const controller = new AbortController()
    healthRef.current = controller
    setChecking(true)
    setHealthMessage(probe ? '正在验证模型推理，最多等待 40 秒…' : '正在检测服务连接…')
    try {
      const result = await checkBackend(connection, controller.signal, probe)
      if (!controller.signal.aborted) {
        knownDialects.current = new Set(result.models.filter((model) => model.available && model.ready !== false).flatMap((model) => model.dialects))
        setModels(result.models)
        setAsr(result.asr)
        const count = result.models.filter((model) => model.available && model.ready === true).length
        setHealthMessage(probe
          ? `服务已连接；${count ? `${count} 个模型推理已验证。` : '模型推理尚未通过，请检查模型服务。'}`
          : '服务已连接。模型推理可单独检测。')
        return result
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        knownDialects.current = null
        setModels([])
        setAsr({ configured: false })
        setHealthMessage(error instanceof Error && error.name === 'TimeoutError'
          ? '连接检测超时，请检查服务后重试。' : modelErrorMessage(error).replace('，已保留词库参考。', '。'))
      }
    } finally {
      if (!controller.signal.aborted) setChecking(false)
    }
    return null
  }

  const connect = async (dialect: DialectId) => {
    const result = await check()
    if (result?.models.some((model) => model.available && model.ready !== false && model.dialects.includes(dialect))) updateMode(true)
  }

  return {
    translation, snapshot, enabled, connection, pending, notice, canRetry, checking, models, healthMessage, asr,
    run, reset, restore, clearSession, cancel, stop, updateMode, updateConnection, check, connect,
  }
}
