export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' || Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value as object).length === 0;
  return false;
}

export function deepClone<T>(value: T): T {
  return structuredClone(value);
}

/** Builds a FormData body from a flat object, skipping empty values. */
export function toFormData(source: Record<string, unknown>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(source)) {
    if (value === null || value === undefined || value === '') continue;
    if (value instanceof File || value instanceof Blob) {
      formData.append(key, value);
    } else if (Array.isArray(value)) {
      value.forEach((item) => formData.append(key, String(item)));
    } else {
      formData.append(key, String(value));
    }
  }
  return formData;
}
