import { AppComponents, IWorldsManager, WorldMetadata } from '../../src/types'
import { bufferToStream, streamToBuffer } from '@dcl/catalyst-storage'
import { AuthChain, Entity } from '@dcl/schemas'
import { stringToUtf8Bytes } from 'eth-connect'
import { extractWorldRuntimeMetadata } from '../../src/logic/world-runtime-metadata-utils'

export async function createWorldsManagerMockComponent({
  storage
}: Pick<AppComponents, 'storage'>): Promise<IWorldsManager> {
  async function getDeployedWorldsNames(): Promise<string[]> {
    const worlds = []
    for await (const key of storage.allFileIds('name-')) {
      worlds.push(key.substring(5)) // remove "name-" prefix
    }
    return worlds
  }

  async function getEntityForWorld(worldName: string): Promise<Entity | undefined> {
    const metadata = await getMetadataForWorld(worldName)
    if (!metadata || !metadata.entityId) {
      return undefined
    }

    const content = await storage.retrieve(metadata.entityId)
    if (!content) {
      return undefined
    }

    const json = JSON.parse((await streamToBuffer(await content?.asStream())).toString())

    return {
      // the timestamp is not stored in the entity :/
      timestamp: 0,
      ...json,
      id: metadata.entityId
    }
  }

  async function getMetadataForWorld(worldName: string): Promise<WorldMetadata | undefined> {
    const content = await storage.retrieve(`name-${worldName.toLowerCase()}`)
    if (!content) {
      return undefined
    }
    return JSON.parse((await streamToBuffer(await content.asStream())).toString())
  }

  async function storeWorldMetadata(worldName: string, worldMetadata: Partial<WorldMetadata>): Promise<void> {
    const contentMetadata = (await getMetadataForWorld(worldName.toLowerCase())) || {}
    const metadata: Partial<WorldMetadata> = Object.assign({}, contentMetadata, worldMetadata)
    Object.assign(metadata, worldMetadata)

    await storage.storeStream(
      `name-${worldName.toLowerCase()}`,
      bufferToStream(stringToUtf8Bytes(JSON.stringify(metadata)))
    )
  }

  async function deployScene(worldName: string, scene: Entity): Promise<void> {
    await storeWorldMetadata(worldName, {
      entityId: scene.id,
      runtimeMetadata: extractWorldRuntimeMetadata(worldName, scene)
    })
  }

  async function storeAcl(worldName: string, acl: AuthChain): Promise<void> {
    await storeWorldMetadata(worldName, { acl })
  }

  return {
    getDeployedWorldsNames,
    getMetadataForWorld,
    getEntityForWorld,
    deployScene,
    storeAcl
  }
}