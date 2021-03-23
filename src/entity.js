import { useEntity } from './useEntity'
import { store } from './store'
import { plugins } from './plugin'

export const entity = (initialValue, meta = {}) => {
  if (initialValue === undefined)
    throw new Error('Entity requires an initial value.')

  if (typeof meta !== 'object')
    throw new Error('Entity metadata should be an object.')

  const newEntity = {
    _value: undefined,
    _subscribers: []
  }
  newEntity.get = () => newEntity._value
  newEntity.set = createSetter(newEntity)
  newEntity.init = createInit(newEntity, initialValue)
  newEntity.use = createHook(newEntity)

  applyPlugins(newEntity, meta)

  newEntity.init()

  // Save reference to this entity for use with `resetAll`
  store.push(newEntity)

  return newEntity
}

const createSetter = entity => (newValue, ...updaterArgs) => {
  if (typeof newValue === 'function')
    newValue = newValue(entity._value, ...updaterArgs)

  entity._value = newValue

  // Cleanup any nullified subscribers from prior unmounts
  cleanupNullSubscriptions(entity._subscribers)

  for (let i = 0, c = entity._subscribers.length; i < c; i++)
    entity._subscribers[i](entity._value)
}

const cleanupNullSubscriptions = subscribers => {
  for (let i = 0; i < subscribers.length; i++)
    while (subscribers.length > i && typeof subscribers[i] !== 'function')
      subscribers.splice(i, 1)
}

const applyPlugins = (entity, meta) => {
  plugins.forEach(plugin => {
    const tapMethod = (method, tap, shouldIgnore) => {
      const ignore = typeof shouldIgnore === 'function' && shouldIgnore(meta)
      if (!ignore && typeof tap === 'function') {
        const func = entity[method]
        entity[method] = (...args) => {
          func(...args)
          tap(entity, meta)
        }
      }
    }

    tapMethod('init', plugin.onInit, plugin.shouldIgnoreInit)
    tapMethod('set', plugin.onSet, plugin.shouldIgnoreSet)
  })
}

const createInit = (entity, initialValue) => {
  return typeof initialValue.then === 'function'
    ? () => {
        initialValue.then(value => entity.set(value))
      }
    : () => {
        entity.set(initialValue)
      }
}

const createHook = entity => {
  return (...args) => useEntity(entity, ...args)
}

export default entity
