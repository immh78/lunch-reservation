<script setup>
import { ref } from 'vue';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, get, database, ref as firebaseRef } from '../config/firebase';
import { useRouter, useRoute } from 'vue-router';
import { useCookies } from '@vueuse/integrations/useCookies';
import { useUserStore } from '../store/user';

const email = ref('');
const password = ref('');
const showPassword = ref(false);
const loading = ref(false);
const route = useRoute();
const router = useRouter();
const cookies = useCookies();
const userStore = useUserStore();


async function login() {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email.value, password.value);
    const user = userCredential.user;
    const token = await user.getIdToken();

    cookies.set('authToken', token);
    //console.log(user);

    if (user) {
      userStore.setUser({
        email: auth.currentUser.email,
        name: await selectUserName(auth.currentUser.uid),
        uid: auth.currentUser.uid
      });   
    } else {
      userStore.clearUser();
    }

    //console.log("userStore.user", userStore.user);

    // 리디렉트 경로 있으면 해당 페이지로, 없으면 홈으로
    const redirectTo = route.query.redirect || '/';
    router.push(redirectTo);

  } catch (error) {
    console.error('로그인 오류:', error.code);
    switch (error.code) {
      case 'auth/user-not-found':
        alert('등록되지 않은 이메일입니다.');
        break;
      case 'auth/wrong-password':
        alert('비밀번호가 올바르지 않습니다.');
        break;
      case 'auth/invalid-credential':
        alert('이메일 또는 비밀번호가 유효하지 않습니다.');
        break;
      default:
        alert('로그인에 실패했습니다.');
    }
  }
};

async function selectUserName(uid) {
  const dbRef = firebaseRef(database, "user/" + uid);
  let userInfo = "";
  await get(dbRef)
    .then(snapshot => {
      if (snapshot.exists()) {
        userInfo = snapshot.val();
      }
    })
    .catch(err => {
      //console.error("Error fetching data:", err);
    });

  return userInfo.name;
}

function goToRegister() {
  router.push('/register'); // 회원가입 페이지 경로
};
</script>

<template>
  <v-container class="d-flex align-center justify-center fill-height">
    <v-card width="400" class="pa-6">
      <v-card-title class="text-h5 text-center">로그인</v-card-title>

      <v-form @submit.prevent="login()">
        <v-text-field v-model="email" label="Email" prepend-inner-icon="mdi-email" type="email" required />

        <v-text-field v-model="password" label="Password" prepend-inner-icon="mdi-lock"
          :type="showPassword ? 'text' : 'password'" :append-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
          @click:append="showPassword = !showPassword" required @keydown.enter="login()" />

        <v-btn :loading="loading" color="primary" class="mt-4" type="submit" block>
          로그인
        </v-btn>
      </v-form>

      <div class="text-center mt-4">
        <p>계정이 없으신가요?</p>
        <v-btn variant="outlined" color="secondary" @click="goToRegister()">
          회원가입
        </v-btn>
      </div>
    </v-card>
  </v-container>
</template>

<style scoped>
.fill-height {
  min-height: 100vh;
}
</style>
