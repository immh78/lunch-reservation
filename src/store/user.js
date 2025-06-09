// store/user.js
import { defineStore } from 'pinia';

export const useUserStore = defineStore('user', {
  state: () => ({
    user: null,
  }),
  actions: {
    setUser(userInfo) {
      this.user = userInfo;
    },
    clearUser() {
      this.user = null;
    },
  },
  persist: true, // ✅ 로컬스토리지에 자동 저장
});
