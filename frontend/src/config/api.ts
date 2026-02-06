/**
 * API 客户端配置
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || ''

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }))
      throw new Error(error.detail || `API Error: ${response.status}`)
    }

    return response.json()
  }

  async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`)

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`)
    }

    return response.json()
  }

  /**
   * 上传文件，返回可访问的 URL
   */
  async uploadImage(file: File): Promise<string> {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${this.baseUrl}/api/upload`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error('图片上传失败')
    }

    const data = await response.json()
    // 返回完整的可访问 URL
    return `${this.baseUrl}${data.url}`
  }
}

export const apiClient = new ApiClient(API_BASE_URL)
