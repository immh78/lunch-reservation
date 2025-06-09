<script setup>
import { ref, onMounted } from 'vue';
import { useUserStore } from '../store/user';
import { signOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import { useRouter } from 'vue-router';
import { useCookies } from '@vueuse/integrations/useCookies';
import { database, ref as firebaseRef, get } from "../config/firebase";

const userStore = useUserStore();
const router = useRouter();
const cookies = useCookies();

const user = userStore.user;
const userInfo = ref({});

async function logout() {
  await signOut(auth);
  cookies.remove('authToken');
  userStore.clearUser();
  router.push('/login');
};

async function selectUser() {
  const dbRef = firebaseRef(database, "user/" + auth.currentUser.uid);
  await get(dbRef)
    .then(snapshot => {
      if (snapshot.exists()) {
        userInfo.value = snapshot.val();
      }
    })
    .catch(err => {
      //console.error("Error fetching data:", err);
    });

}

onMounted(async() => {
  console.log("auth.currentUser.uid", auth.currentUser.uid);
  await selectUser();

  console.log('userInfo', userInfo.value);
});

console.log('user', user );
</script>


<template>
  <h5> {{ auth.currentUser.uid }} </h5>

  <div v-if="user">
    <p>환영합니다, {{ userInfo.name }} 님</p>
  </div>
  <div v-else>
    <p>사용자 정보를 불러오는 중...</p>
  </div>
  <button @click="logout">로그아웃</button>
</template>
