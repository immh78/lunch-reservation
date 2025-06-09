<script setup>
import { ref, onMounted } from 'vue';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './config/firebase';
import { useUserStore } from './store/user';
import { RouterView } from 'vue-router';

const ready = ref(false);
const userStore = useUserStore();

onMounted(() => {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      userStore.setUser({
        email: user.email,
        displayName: user.displayName,
      });
    } else {
      userStore.clearUser();
    }
    ready.value = true; // ✅ 인증 처리 완료 후 렌더링 허용
  });
});
</script>

<template>
  <div v-if="ready">
    <RouterView />
  </div>
  <div v-else>
    <v-container class="text-center">
      <v-progress-circular indeterminate color="primary" />
      <p>로그인 상태 확인 중...</p>
    </v-container>
  </div>
</template>

<style scoped>
.v-container {
  margin-top: 50px;
}
</style>
