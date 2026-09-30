export async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers }
  const token = sessionStorage.getItem('campuz-token')
  if (options.auth !== false && token) headers.Authorization = `Bearer ${token}`
  const response = await fetch(`/api${path}`, { ...options, headers })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.message || 'The request could not be completed.')
  return result
}