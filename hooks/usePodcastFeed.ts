'use client'

import { useQuery } from '@tanstack/react-query'

export interface PodcastEpisode {
  id: string
  title: string
  description: string
  thumbnailUrl: string
  publishedAt: string
  url: string
  duration?: string
}

export function useYouTubeFeed() {
  return useQuery({
    queryKey: ['youtube-podcast-feed'],
    queryFn: async () => {
      const res = await fetch('/api/podcast/youtube')
      if (!res.ok) throw new Error('YouTube feed failed')
      const data = await res.json()
      const episodes = (data.episodes as PodcastEpisode[]) ?? []
      return episodes.sort(
        (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      )
    },
    staleTime: 1000 * 60 * 30,
  })
}

export function useSpotifyFeed() {
  return useQuery({
    queryKey: ['spotify-podcast-feed'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/podcast/spotify')
        if (!res.ok) return []
        const data = await res.json()
        const episodes = (data.episodes as PodcastEpisode[]) ?? []
        return episodes.sort(
          (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
        )
      } catch {
        return []
      }
    },
    staleTime: 1000 * 60 * 30,
    retry: false,
  })
}
