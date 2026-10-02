/** Build-time configuration (Vite env vars). All values here are public by nature. */
export const config = {
  googleClientId: (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() ?? '',
  googleApiKey: (import.meta.env.VITE_GOOGLE_API_KEY as string | undefined)?.trim() ?? '',
  googleAppId: (import.meta.env.VITE_GOOGLE_APP_ID as string | undefined)?.trim() ?? '',
  appEnv: ((import.meta.env.VITE_APP_ENV as string | undefined)?.trim() || import.meta.env.MODE) as string,
};

export const googleConfigured = () => config.googleClientId !== '';
export const pickerConfigured = () => googleConfigured() && config.googleApiKey !== '' && config.googleAppId !== '';
