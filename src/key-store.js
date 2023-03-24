import * as crypto from '@libp2p/crypto'
import { Buffer } from 'safe-buffer'
import ComposedStorage from './storage/composed.js'
import LevelStorage from './storage/level.js'
import LRUStorage from './storage/lru.js'

const unmarshal = crypto.keys.supportedKeys.secp256k1.unmarshalSecp256k1PrivateKey
const unmarshalPubKey = crypto.keys.supportedKeys.secp256k1.unmarshalSecp256k1PublicKey

const verifySignature = async (signature, publicKey, data) => {
  if (!signature) {
    throw new Error('No signature given')
  }
  if (!publicKey) {
    throw new Error('Given publicKey was undefined')
  }
  if (!data) {
    throw new Error('Given input data was undefined')
  }

  if (!Buffer.isBuffer(data)) {
    data = Buffer.from(data)
  }

  const isValid = (key, msg, sig) => key.verify(msg, sig)

  let res = false
  try {
    const pubKey = unmarshalPubKey(Buffer.from(publicKey, 'hex'))
    res = await isValid(pubKey, data, Buffer.from(signature, 'hex'))
  } catch (e) {
    // Catch error: sig length wrong
  }

  return Promise.resolve(res)
}

const signMessage = async (key, data) => {
  if (!key) {
    throw new Error('No signing key given')
  }

  if (!data) {
    throw new Error('Given input data was undefined')
  }

  if (!Buffer.isBuffer(data)) {
    data = Buffer.from(data)
  }

  return Buffer.from(await key.sign(data)).toString('hex')
}

const verifiedCache = await LRUStorage({ size: 1000 })

const verifyMessage = async (signature, publicKey, data) => {
  const cached = await verifiedCache.get(signature)

  let res = false

  if (!cached) {
    const verified = await verifySignature(signature, publicKey, data)
    res = verified
    if (verified) {
      await verifiedCache.put(signature, { publicKey, data })
    }
  } else {
    const compare = (cached, data) => {
      const match = Buffer.isBuffer(data) ? Buffer.compare(cached, data) === 0 : cached.toString() === data.toString()
      return match
    }
    res = cached.publicKey === publicKey && compare(cached.data, data)
  }
  return res
}

const defaultPath = './keystore'

/**
 * Creates an instance of KeyStore.
 * @param {Object} options Various options to use when instantiating KeyStore.
 * @param {Object} options.storage An instance of a storage class. Can be one of ComposedStorage, IPFSBlockStorage, LevelStorage, etc. Defaults to ComposedStorage.
 * @param {string} options.path The path to a valid storage. Defaults to ./keystore.
 * @return {KeyStore} An instance of KeyStore.
 */
const KeyStore = async ({ storage, path } = {}) => {
  storage = storage || await ComposedStorage(await LRUStorage({ size: 1000 }), await LevelStorage({ path: path || defaultPath }))

  const close = async () => {
    await storage.close()
  }

  const clear = async () => {
    await storage.clear()
  }

  const hasKey = async (id) => {
    if (!id) {
      throw new Error('id needed to check a key')
    }

    let hasKey = false
    try {
      const storedKey = await storage.get('private_' + id)
      hasKey = storedKey !== undefined && storedKey !== null
    } catch (e) {
      // Catches 'Error: ENOENT: no such file or directory, open <path>'
      console.error('Error: ENOENT: no such file or directory')
    }

    return hasKey
  }

  const addKey = async (id, key) => {
    //    await storage.put('public_' + id, key.publicKey)
    await storage.put('private_' + id, key.privateKey)
  }

  const createKey = async (id, { entropy } = {}) => {
    if (!id) {
      throw new Error('id needed to create a key')
    }

    // Generate a private key
    const pair = await crypto.keys.generateKeyPair('secp256k1')
    const keys = await crypto.keys.unmarshalPrivateKey(pair.bytes)
    const pubKey = keys.public.marshal()

    const key = {
      publicKey: Buffer.from(pubKey),
      privateKey: Buffer.from(keys.marshal())
    }

    await addKey(id, key)

    return keys
  }

  const getKey = async (id) => {
    if (!id) {
      throw new Error('id needed to get a key')
    }

    let storedKey
    try {
      storedKey = await storage.get('private_' + id)
    } catch (e) {
      // ignore ENOENT error
    }

    if (!storedKey) {
      return
    }

    return unmarshal(storedKey)
  }

  const getPublic = (keys, options = {}) => {
    const formats = ['hex', 'buffer']
    const format = options.format || 'hex'
    if (formats.indexOf(format) === -1) {
      throw new Error('Supported formats are `hex` and `buffer`')
    }
    let pubKey = keys.public.marshal()
    pubKey = Buffer.from(pubKey)
    return format === 'buffer' ? pubKey : pubKey.toString('hex')
  }

  return {
    clear,
    close,
    hasKey,
    addKey,
    createKey,
    getKey,
    getPublic
  }
}

export {
  KeyStore as default,
  verifyMessage,
  signMessage
}