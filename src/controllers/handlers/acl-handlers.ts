import { IHttpServerComponent } from '@well-known-components/interfaces'
import { AccessControlList, HandlerContextWithPath, InvalidRequestError, PermissionType } from '../../types'
import { AuthChain, EthAddress } from '@dcl/schemas'
import { defaultPermissions } from '../../logic/permissions-checker'

export async function getAclHandler(
  ctx: HandlerContextWithPath<'worldsManager', '/acl/:world_name'>
): Promise<IHttpServerComponent.IResponse> {
  const { worldsManager } = ctx.components

  const worldName = ctx.params.world_name

  const worldMetadata = await worldsManager.getMetadataForWorld(worldName)
  const acl: AccessControlList = {
    resource: worldName,
    allowed: worldMetadata?.permissions?.deployment.wallets || [],
    timestamp: ''
  }

  return {
    status: 200,
    body: acl
  }
}

export async function postAclHandler(
  ctx: HandlerContextWithPath<'namePermissionChecker' | 'worldsManager', '/acl/:world_name'>
): Promise<IHttpServerComponent.IResponse> {
  const { namePermissionChecker, worldsManager } = ctx.components

  const worldName = ctx.params.world_name

  const authChain = (await ctx.request.json()) as AuthChain
  if (!AuthChain.validate(authChain)) {
    throw new InvalidRequestError('Invalid payload received. Need to be a valid AuthChain.')
  }

  const permission = await namePermissionChecker.checkPermission(authChain[0].payload, worldName)
  if (!permission) {
    return {
      status: 403,
      body: {
        message: `Your wallet does not own "${worldName}", you can not set access control lists for it.`
      }
    }
  }

  const acl = JSON.parse(authChain[authChain.length - 1].payload)
  if (acl.resource !== worldName) {
    throw new InvalidRequestError(
      `Provided acl is for world "${acl.resource}" but you are trying to set acl for world ${worldName}.`
    )
  }

  if (
    !acl.allowed ||
    !Array.isArray(acl.allowed) ||
    !acl.allowed.every((address: string) => EthAddress.validate(address))
  ) {
    throw new InvalidRequestError('Provided acl is invalid. allowed is missing or not an array of addresses.')
  }

  if (acl.allowed.map((address: EthAddress) => address.toLowerCase()).includes(authChain[0].payload.toLowerCase())) {
    throw new InvalidRequestError(
      `You are trying to give permission to yourself. You own "${worldName}", so you already have permission to deploy scenes, no need to include yourself in the ACL.`
    )
  }

  if (!acl.timestamp || !Date.parse(acl.timestamp)) {
    throw new InvalidRequestError('Invalid ACL, timestamp is missing or has an invalid date.')
  }

  const ts = Date.parse(acl.timestamp)
  if (Math.abs(ts - Date.now()) > 120_000) {
    throw new InvalidRequestError('Timestamp is not recent. Please sign a new ACL change request.')
  }

  // Convert acl to permissions and store
  const worldMetadata = await worldsManager.getMetadataForWorld(worldName)
  const permissions = worldMetadata?.permissions || defaultPermissions()
  permissions.deployment.wallets = acl.allowed
  if (permissions.streaming.type === PermissionType.AllowList) {
    permissions.streaming.wallets = permissions.deployment.wallets
  }
  await worldsManager.storePermissions(worldName, permissions)

  return {
    status: 200,
    body: acl
  }
}
