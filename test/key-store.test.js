import { strictEqual, deepStrictEqual } from 'assert'
import rmrf from 'rimraf'
import { copy, pathExists } from 'fs-extra'
import KeyStore, { signMessage, verifyMessage } from '../src/key-store.js'
import LevelStorage from '../src/storage/level.js'
import testKeysPath from './fixtures/test-keys-path.js '

const keysPath = './testkeys'

describe('KeyStore', () => {
  let keystore

  describe('Creating and retrieving keys', () => {
    let id

    beforeEach(async () => {
      keystore = await KeyStore()

      id = 'key1'
      await keystore.createKey(id)
    })

    afterEach(async () => {
      if (keystore) {
        await keystore.close()
        await rmrf(keystore.defaultPath)
      }
    })

    it('creates a key', async () => {
      const hasKey = await keystore.hasKey(id)
      strictEqual(hasKey, true)
    })

    it('throws an error when creating a key without an id', async () => {
      let err

      try {
        await keystore.createKey()
      } catch (e) {
        err = e.toString()
      }

      strictEqual(err, 'Error: id needed to create a key')
    })

    it('throws an error when creating a key with a null id', async () => {
      let err

      try {
        await keystore.createKey(null)
      } catch (e) {
        err = e.toString()
      }

      strictEqual(err, 'Error: id needed to create a key')
    })

    it('returns true if key exists', async () => {
      const id = 'key1'

      await keystore.createKey(id)
      const hasKey = await keystore.hasKey(id)
      strictEqual(hasKey, true)
    })

    it('returns false if key does not exist', async () => {
      const id = 'key1234567890'
      const hasKey = await keystore.hasKey(id)
      strictEqual(hasKey, false)
    })

    it('throws an error when checking if key exists when no id is specified', async () => {
      let err
      try {
        await keystore.hasKey()
      } catch (e) {
        err = e.toString()
      }
      strictEqual(err, 'Error: id needed to check a key')
    })

    it('gets a key', async () => {
      const id = 'key1'
      const keys = await keystore.createKey(id)
      deepStrictEqual(await keystore.getKey(id), keys)
    })

    it('throws an error when getting a key without an id', async () => {
      const id = 'key1'
      let err

      await keystore.createKey(id)

      try {
        await keystore.getKey()
      } catch (e) {
        err = e.toString()
      }

      strictEqual(err, 'Error: id needed to get a key')
    })

    it('throws an error when getting a key with a null id', async () => {
      const id = 'key1'
      let err

      await keystore.createKey(id)

      try {
        await keystore.getKey(null)
      } catch (e) {
        err = e.toString()
      }

      strictEqual(err, 'Error: id needed to get a key')
    })

    it('gets a non-existent key', async () => {
      const expected = undefined
      const id = 'key111111111'

      const actual = await keystore.getKey(id)

      strictEqual(actual, expected)
    })
  })

  describe('Options', () => {
    describe('Using default options', () => {
      beforeEach(async () => {
        keystore = await KeyStore()
      })

      afterEach(async () => {
        if (keystore) {
          await keystore.close()
          await rmrf(keystore.defaultPath)
        }
      })

      it('loads default storage using default path', async () => {
        strictEqual(await pathExists(keystore.defaultPath), true)
      })
    })

    describe('Setting options.storage', () => {
      const path = './custom-level-key-store'

      beforeEach(async () => {
        const storage = await LevelStorage({ path })
        keystore = await KeyStore({ storage })
      })

      afterEach(async () => {
        if (keystore) {
          await keystore.close()
          await rmrf(path)
        }
      })

      it('loads custom storage', async () => {
        strictEqual(await pathExists(path), true)
      })
    })

    describe('Setting options.path', () => {
      beforeEach(async () => {
        await copy(testKeysPath, keysPath)
        keystore = await KeyStore({ path: keysPath })
      })

      afterEach(async () => {
        if (keystore) {
          await keystore.close()
        }

        await rmrf(keysPath)
      })

      it('loads default storage using custom path', async () => {
        strictEqual(await pathExists(keysPath), true)
      })
    })
  })

  describe('Using keys for signing and verifying', () => {
    beforeEach(async () => {
      await copy(testKeysPath, keysPath)
      keystore = await KeyStore({ path: keysPath })
      // For creating test keys fixtures (level) database
      // const identities = await Identities({ keystore })
      // const a = await identities.createIdentity({ id: 'userA' })
      // const b = await identities.createIdentity({ id: 'userB' })
      // const c = await identities.createIdentity({ id: 'userC' })
      // const d = await identities.createIdentity({ id: 'userD' })
      // const x = await identities.createIdentity({ id: 'userX' })
    })

    afterEach(async () => {
      if (keystore) {
        await keystore.close()
      }
      await rmrf(keysPath)
    })

    describe('Signing', () => {
      it('signs data', async () => {
        const expected = '3045022100df961fa46bb8a3cb92594a24205e6008a84daa563ac3530f583bb9f9cef5af3b02207b84c5d63387d0a710e42e05785fbccdaf2534c8ed16adb8afd57c3eba930529'

        const key = await keystore.getKey('userA')
        const actual = await signMessage(key, 'data data data')
        strictEqual(actual, expected)
      })

      it('throws an error if no key is passed', async () => {
        let err
        try {
          await signMessage(null, 'data data data')
        } catch (e) {
          err = e.toString()
        }

        strictEqual(err, 'Error: No signing key given')
      })

      it('throws an error if no data is passed', async () => {
        const key = 'key_1'
        let err
        try {
          await signMessage(key)
        } catch (e) {
          err = e.toString()
        }

        strictEqual(err, 'Error: Given input data was undefined')
      })
    })

    describe('Getting the public key', async () => {
      let key

      beforeEach(async () => {
        key = await keystore.getKey('userA')
      })

      it('gets the public key', async () => {
        const expected = '02e7247a4c155b63d182a23c70cb6fe8ba2e44bc9e9d62dc45d4c4167ccde95944'
        const publicKey = await keystore.getPublic(key)
        strictEqual(publicKey, expected)
      })

      it('gets the public key buffer', async () => {
        const expected = '02e7247a4c155b63d182a23c70cb6fe8ba2e44bc9e9d62dc45d4c4167ccde95944'
        const publicKey = await keystore.getPublic(key, { format: 'buffer' })

        deepStrictEqual(publicKey.toString('hex'), expected)
      })

      it('throws an error if no keys are passed', async () => {
        try {
          await keystore.getPublic()
        } catch (e) {
          strictEqual(true, true)
        }
      })

      it('throws an error if a bad format is passed', async () => {
        try {
          await keystore.getPublic(key, { format: 'foo' })
        } catch (e) {
          strictEqual(true, true)
        }
      })
    })

    describe('Verifying', async function () {
      let key, publicKey

      beforeEach(async () => {
        key = await keystore.getKey('userA')
        publicKey = await keystore.getPublic(key)
      })

      it('verifies content', async () => {
        const signature = await signMessage(key, 'data data data')
        const expectedSignature = '3045022100df961fa46bb8a3cb92594a24205e6008a84daa563ac3530f583bb9f9cef5af3b02207b84c5d63387d0a710e42e05785fbccdaf2534c8ed16adb8afd57c3eba930529'
        strictEqual(expectedSignature, signature)

        const verified = await verifyMessage(expectedSignature, publicKey, 'data data data')
        strictEqual(verified, true)
      })

      it('verifies content with cache', async () => {
        const data = 'data'.repeat(1024 * 1024)
        const signature = await signMessage(key, data)
        const startTime = new Date().getTime()
        await verifyMessage(signature, publicKey, data)
        const first = new Date().getTime()
        await verifyMessage(signature, publicKey, data)
        const after = new Date().getTime()
        console.log('First pass:', first - startTime, 'ms', 'Cached:', after - first, 'ms')
        strictEqual(first - startTime > after - first, true)
      })

      it('does not verify content with bad signature', async () => {
        const signature = 'xxxxxx'
        const verified = await verifyMessage(signature, publicKey, 'data data data')
        strictEqual(verified, false)
      })
    })
  })
})
