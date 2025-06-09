<template>
  <v-container class="d-flex align-center justify-center fill-height">
    <v-card width="400" class="pa-6">
      <v-card-title class="text-h5 text-center">Google 로그인</v-card-title>

      <v-form @submit.prevent="loginWithGoogle">
        <v-text-field
          v-model="email"
          label="Google Email"
          prepend-inner-icon="mdi-account"
          type="email"
          required
        />

        <v-text-field
          v-model="password"
          label="Password"
          prepend-inner-icon="mdi-lock"
          :type="showPassword ? 'text' : 'password'"
          :append-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
          @click:append="showPassword = !showPassword"
          required
          @keydown.enter="loginWithGoogle"
        />

        <v-btn
          :loading="loading"
          color="primary"
          class="mt-4"
          type="submit"
          block
        >
          Google로 로그인
        </v-btn>
      </v-form>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { signInWithRedirect, getRedirectResult } from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';
import { useRouter } from 'vue-router';
import { useCookies } from '@vueuse/integrations/useCookies';
import { useUserStore } from '../store/user';

const email = ref('');
const password = ref('');
const showPassword = ref(false);
const loading = ref(false);

const router = useRouter();
const cookies = useCookies();
const userStore = useUserStore(); // ✅ 여기서 실행해서 인스턴스를 얻음

// 리디렉션 방식 로그인
const loginWithGoogle = async () => {
  try {
    loading.value = true;
    await signInWithRedirect(auth, googleProvider);
  } catch (error) {
    console.error('Google 로그인 실패:', error.message);
    alert('로그인에 실패했습니다.');
  } finally {
    loading.value = false;
  }
};

// 리디렉션 결과 처리
onMounted(async () => {
  const result = await getRedirectResult(auth);
  if (result?.user) {
    const user = result.user;
    const token = await user.getIdToken();

    cookies.set('authToken', token);
    userStore.setUser({ email: user.email, displayName: user.displayName }); // ✅ 고쳐진 부분
    router.push('/');
  }
});
</script>


<style scoped>
.fill-height {
  min-height: 100vh;
}
</style>
