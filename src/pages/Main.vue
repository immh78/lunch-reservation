<template>

  <div v-if="user">
    <p>환영합니다, {{ user.displayName || user.email }} 님</p>
  </div>
  <div v-else>
    <p>사용자 정보를 불러오는 중...</p>
  </div>
   <button @click="logout">로그아웃</button>
</template>

<script setup>
import { useUserStore } from '../store/user';
import { signOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import { useRouter } from 'vue-router';
import { useCookies } from '@vueuse/integrations/useCookies';

const userStore = useUserStore();
const router = useRouter();
const cookies = useCookies();

const logout = async () => {
  await signOut(auth);
  cookies.remove('authToken');
  userStore.clearUser();
  router.push('/login');
};

const user = userStore.user;

console.log(user);
</script>
