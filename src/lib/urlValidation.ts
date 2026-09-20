import { z } from 'zod'

export const httpUrlSchema = z.string().url().max(2_048).refine((value) => {
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password
  } catch {
    return false
  }
}, 'Only credential-free HTTP(S) URLs are allowed')
