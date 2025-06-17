<script setup>
import { ref, onMounted } from 'vue';
import { useUserStore } from './store/user';
import { RouterView } from 'vue-router';

const ready = ref(false);
const userStore = useUserStore();

onMounted(() => {
    //console.log(userStore.user);

    if (userStore.user.uid) {
      ready.value = true;
    } else {
      ready.value = false;
    }
    
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

<style scoped></style>
