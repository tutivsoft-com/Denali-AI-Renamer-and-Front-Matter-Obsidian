export function normalizeFolderSuggestion(value) {
    const path = value.trim().replace(/\\/g, '/');
    if (!path || path.startsWith('/') || /^[a-z]:/i.test(path) || path.startsWith('~')) return null;
    const segments = path.split('/');
    if (segments.some(segment => !segment || segment === '.' || segment === '..' || /[\u0000-\u001f<>:"|?*]/.test(segment))) return null;
    return segments.join('/');
}
