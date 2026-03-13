export function getApiBaseUrl() {
  const explicitApiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (explicitApiUrl) {
    return explicitApiUrl.replace(/\/$/, "");
  }

  const publicDomain = process.env.EXPO_PUBLIC_DOMAIN;
  if (publicDomain) {
    const normalizedDomain = publicDomain.endsWith("/")
      ? publicDomain.slice(0, -1)
      : publicDomain;
    return `${normalizedDomain}/api`;
  }

  return "http://localhost:5000/api";
}
