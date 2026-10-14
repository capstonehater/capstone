import { apiJsonFetch } from './api';

export async function validateImageUpload(file: File, signal?: AbortSignal) {
  const body = new FormData();
  body.append('image', file);
  await apiJsonFetch('/settings/image-validation', { method: 'POST', body, signal });
}
