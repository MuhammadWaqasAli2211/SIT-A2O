import { api } from '@/lib/api-client'

export interface PictureResult {
  picture_path: string | null
  url: string | null
}

export const pictureApi = {
  /**
   * Uploads through the API, not straight to storage.
   *
   * The bucket is private and holds no client-facing policies — the backend
   * is the only thing with a key to it. The request interceptor strips the
   * JSON Content-Type for FormData bodies so the browser sets the multipart
   * type and boundary itself.
   */
  async upload(file: File) {
    const body = new FormData()
    body.append('file', file)
    const { data } = await api.post<PictureResult>('/profile/picture', body)
    return data
  },

  async current() {
    const { data } = await api.get<PictureResult>('/profile/picture')
    return data
  },
}
