import { useCookies } from '@vueuse/integrations/useCookies';

export function isLoggedIn() {
  const cookies = useCookies();
  return !!cookies.get('authToken');
}
