/** 空间接口（api.md 第 1 节） */
import request from './request'
import { SpaceListResponse, SpaceMutationResult } from '../types/api'

export function getSpaces(): Promise<SpaceListResponse> {
  return request<SpaceListResponse>('/spaces')
}

export function createSpace(data: { name: string; parentId?: string | null; sortOrder?: number }): Promise<SpaceMutationResult> {
  return request<SpaceMutationResult>('/spaces', { method: 'POST', data })
}

export function updateSpace(id: string, data: { name?: string; parentId?: string | null; sortOrder?: number }): Promise<SpaceMutationResult> {
  return request<SpaceMutationResult>('/spaces/' + id, { method: 'PATCH', data })
}

export function deleteSpace(id: string): Promise<unknown> {
  return request('/spaces/' + id, { method: 'DELETE' })
}
