/** 搜索接口（api.md 第 3 节） */
import request from './request'
import { SearchResponse, SuggestionsResponse } from '../types/api'

export type SearchType = 'all' | 'item' | 'space'

export function getSearch(q: string, type: SearchType = 'all'): Promise<SearchResponse> {
  return request<SearchResponse>('/search?q=' + encodeURIComponent(q) + '&type=' + type)
}

export function getSuggestions(): Promise<SuggestionsResponse> {
  return request<SuggestionsResponse>('/search/suggestions')
}
